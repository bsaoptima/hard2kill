import { RouteComponentProps } from '@reach/router';
import { Constants, Models, Types } from '@hard2kill/gladiatorz-common';
import { Client, Room } from 'colyseus.js';
import qs from 'querystringify';
import React, { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Helmet } from 'react-helmet';
import { View } from '../../components';
import { Game } from '../../game/Game';
import { supabase, SUPABASE_STORAGE_KEY } from '../../supabase';
import { HUDProps } from './components/HUD';
import { HUD } from './components/HUD/HUD';
import { JoystickDirections, JoySticks } from './components/JoySticks';

interface GameScreenProps
    extends RouteComponentProps<{
        roomId: string;
    }> {}

export function GameScreen({ navigate, location, roomId }: GameScreenProps) {
    const [hud, setHUD] = useState<HUDProps>({
        gameMode: '',
        gameMap: '',
        gameModeEndsAt: 0,
        roomName: '',
        playerId: '',
        playerName: '',
        playerLives: 0,
        playerMaxLives: 0,
        playerPot: 0,
        players: [],
        playersCount: 0,
        playersMaxCount: 0,
        messages: [],
        announce: '',
        killRewardAmount: null,
        killRewardVictim: null,
        potLostAmount: null,
        potLostKiller: null,
        gameResult: null,
        gameResultWinner: '',
    });
    const [betAmount, setBetAmount] = useState<number>(Constants.DEFAULT_BET_AMOUNT);
    const [isRematchQueuing, setIsRematchQueuing] = useState(false);

    const canvasRef = useRef<HTMLDivElement>();
    const clientRef = useRef<Client>();
    const gameRef = useRef<Game>();
    const roomRef = useRef<Room>();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const matchmakingRoomRef = useRef<Room | null>(null);

    //
    // Lifecycle
    //
    useEffect(() => {
        start();

        return () => {
            stop();
        };
    }, []);

    //
    // Methods
    //
    async function start() {
        gameRef.current = new Game(window.innerWidth, window.innerHeight, handleActionSend);

        const { search = '' } = location || {};

        const isNewRoom = roomId === 'new';
        const parsedSearch = qs.parse(search) as Types.RoomOptions;

        // Get current user's Supabase ID from localStorage cache
        let odinsId: string | undefined;
        try {
            const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                odinsId = parsed?.user?.id;
                console.log('[Game] Retrieved odinsId from localStorage:', odinsId);
            }
        } catch (e) {
            console.error('[Game] Error parsing localStorage:', e);
        }

        const isMatchmaking = !!parsedSearch.matchId;

        let options;
        if (isMatchmaking) {
            // From matchmaking - use match-specific settings
            const matchBetAmount = parsedSearch.betAmount ? Number(parsedSearch.betAmount) : Constants.DEFAULT_BET_AMOUNT;
            setBetAmount(matchBetAmount);
            options = {
                playerName: parsedSearch.playerName || localStorage.getItem('playerName'),
                roomName: `${parsedSearch.playerName} vs ${parsedSearch.opponentName}`,
                roomMap: 'small',
                roomMaxPlayers: 2,
                mode: 'deathmatch',
                betAmount: matchBetAmount,
                odinsId,
            };
        } else if (isNewRoom) {
            options = {
                ...parsedSearch,
                roomMaxPlayers: Number(parsedSearch.roomMaxPlayers),
                odinsId,
            };
        } else {
            // The only thing to pass when joining an existing room is a player's name
            options = {
                playerName: localStorage.getItem('playerName'),
                odinsId,
            };
        }

        console.log('[Game] Joining with options:', options);

        // Connect
        try {
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            clientRef.current = new Client(url);
            if (isMatchmaking) {
                const joinOptions = {
                    ...options,
                    matchId: parsedSearch.matchId,
                };
                console.log('[Game] Matchmaking join options:', joinOptions);
                roomRef.current = await clientRef.current.joinOrCreate(Constants.ROOM_NAME, joinOptions);
                window.history.replaceState(null, '', `/${roomRef.current.id}`);
            } else if (isNewRoom) {
                roomRef.current = await clientRef.current.create(Constants.ROOM_NAME, options);
                window.history.replaceState(null, '', `/${roomRef.current.id}`);
            } else {
                roomRef.current = await clientRef.current.joinById(roomId, options);
            }
        } catch (error) {
            navigate('/');
            return;
        }

        // Set the current player id
        const playerId = roomRef.current.sessionId;
        setHUD((prev) => ({
            ...prev,
            playerId,
        }));

        // Listen for state changes
        roomRef.current.state.game.onChange = handleGameChange;
        roomRef.current.state.players.onAdd = handlePlayerAdd;
        roomRef.current.state.players.onRemove = handlePlayerRemove;
        roomRef.current.state.monsters.onAdd = handleMonsterAdd;
        roomRef.current.state.monsters.onRemove = handleMonsterRemove;
        roomRef.current.state.props.onAdd = handlePropAdd;
        roomRef.current.state.props.onRemove = handlePropRemove;
        roomRef.current.state.bullets.onAdd = handleBulletAdd;
        roomRef.current.state.bullets.onRemove = handleBulletRemove;

        // Listen for Messages
        roomRef.current.onMessage('*', handleMessage);

        // Start game
        gameRef.current.start(canvasRef.current);

        // Listen for inputs
        window.addEventListener('resize', handleWindowResize);

        // Start players refresh listeners
        intervalRef.current = setInterval(updateRoom, Constants.PLAYERS_REFRESH);
    }

    async function stop() {
        // Colyseus - leave game room
        if (roomRef.current) {
            roomRef.current.leave();
        }

        // Leave matchmaking room if active
        if (matchmakingRoomRef.current) {
            matchmakingRoomRef.current.leave();
            matchmakingRoomRef.current = null;
        }

        // Game
        gameRef.current.stop();

        // Inputs
        window.removeEventListener('resize', handleWindowResize);

        // Start players refresh listeners
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    }

    //
    // Utils
    //
    function isPlayerIdMe(playerId: string) {
        return playerId === roomRef.current?.sessionId;
    }

    function updateRoom() {
        const stats = gameRef.current.getStats();

        setHUD((prev) => ({
            ...prev,
            ...stats,
        }));
    }

    //
    // Handlers
    //

    // Colyseus
    function handleGameChange(attributes: any) {
        for (const row of attributes) {
            gameRef.current.gameUpdate(row.field, row.value);
        }
    }

    function handlePlayerAdd(player: any, playerId: string) {
        const isMe = isPlayerIdMe(playerId);
        gameRef.current.playerAdd(playerId, player, isMe);
        updateRoom();

        player.onChange = () => {
            handlePlayerUpdate(player, playerId);
        };
    }

    function handlePlayerUpdate(player: any, playerId: string) {
        const isMe = isPlayerIdMe(playerId);
        gameRef.current.playerUpdate(playerId, player, isMe);
        if (isMe) {
            updateRoom();
        }
    }

    function handlePlayerRemove(player: Models.PlayerJSON, playerId: string) {
        const isMe = isPlayerIdMe(playerId);
        gameRef.current.playerRemove(playerId, isMe);
        updateRoom();
    }

    function handleMonsterAdd(monster: any, monsterId: string) {
        gameRef.current.monsterAdd(monsterId, monster);

        monster.onChange = () => {
            handleMonsterUpdate(monster, monsterId);
        };
    }

    function handleMonsterUpdate(monster: Models.MonsterJSON, monsterId: string) {
        gameRef.current.monsterUpdate(monsterId, monster);
    }

    function handleMonsterRemove(monster: Models.MonsterJSON, monsterId: string) {
        gameRef.current.monsterRemove(monsterId);
    }

    function handlePropAdd(prop: any, propId: string) {
        gameRef.current.propAdd(propId, prop);
        prop.onChange = () => {
            handlePropUpdate(prop, propId);
        };
    }

    function handlePropUpdate(prop: Models.PropJSON, propId: string) {
        gameRef.current.propUpdate(propId, prop);
    }

    function handlePropRemove(prop: Models.PropJSON, propId: string) {
        gameRef.current.propRemove(propId);
    }

    function handleBulletAdd(bullet: any, bulletId: string) {
        gameRef.current.bulletAdd(bulletId, bullet);

        // Listen for bullet reactivation (when server recycles a bullet)
        bullet.onChange = (changes: any) => {
            const activeChange = changes.find((c: any) => c.field === 'active');
            if (activeChange && activeChange.value === true) {
                gameRef.current.bulletAdd(bulletId, bullet);
            }
        };
    }

    function handleBulletRemove(bullet: Models.BulletJSON, bulletId: string) {
        gameRef.current.bulletRemove(bulletId);
    }

    function handleMessage(type: any, message: Models.MessageJSON) {
        const { messages } = hud;

        let announce: string | undefined;
        let killRewardAmount: number | null = null;
        let killRewardVictim: string | null = null;
        let potLostAmount: number | null = null;
        let potLostKiller: string | null = null;
        let gameResult: 'won' | 'lost' | null = null;
        let gameResultWinner: string | undefined;

        switch (type) {
            case 'waiting':
                announce = `Waiting for other players...`;
                break;
            case 'start':
                announce = `Game starts`;
                break;
            case 'won':
                // Determine if current player won or lost
                gameResultWinner = message.params.name;
                const winnerId = message.params.odInsId;
                gameResult = winnerId === roomRef.current?.sessionId ? 'won' : 'lost';
                // Don't auto-navigate - let user choose via modal
                break;
            case 'timeout':
                announce = `Timeout...`;
                break;
            case 'killed':
                // Check if current player got the kill
                if (message.params.killerPlayerId === roomRef.current?.sessionId) {
                    killRewardAmount = message.params.potWon || 0;
                    killRewardVictim = message.params.killedName;
                }
                // Check if current player was killed
                if (message.params.killedPlayerId === roomRef.current?.sessionId) {
                    potLostAmount = message.params.potWon || 0;
                    potLostKiller = message.params.killerName;
                }
                break;
            default:
                break;
        }

        setHUD((prev) => ({
            ...prev,
            // Only set the last n messages (negative value on slice() is reverse)
            messages: [...messages, message].slice(-Constants.LOG_LINES_MAX),
            announce,
            ...(killRewardAmount !== null && { killRewardAmount, killRewardVictim }),
            ...(potLostAmount !== null && { potLostAmount, potLostKiller }),
            ...(gameResult !== null && { gameResult, gameResultWinner }),
        }));

        updateRoom();
    }

    // GameManager
    function handleActionSend(action: Models.ActionJSON) {
        if (!roomRef.current) {
            return;
        }

        roomRef.current.send(action.type, action);
    }

    // Listeners
    function handleWindowResize() {
        gameRef.current.setScreenSize(window.innerWidth, window.innerHeight);
    }

    function handleJoyStickLeftMove(directions: JoystickDirections) {
        gameRef.current.inputs.up = directions.up;
        gameRef.current.inputs.right = directions.right;
        gameRef.current.inputs.down = directions.down;
        gameRef.current.inputs.left = directions.left;
    }

    function handleJoyStickLeftRelease() {
        gameRef.current.inputs.up = false;
        gameRef.current.inputs.right = false;
        gameRef.current.inputs.down = false;
        gameRef.current.inputs.left = false;
    }

    function handleJoyStickRightMove(rotation: number) {
        gameRef.current.forcedRotation = rotation;
        gameRef.current.inputs.shoot = true;
    }

    function handleJoyStickRightRelease() {
        gameRef.current.forcedRotation = null;
        gameRef.current.inputs.shoot = false;
    }

    async function handlePlayAgain() {
        if (isRematchQueuing) {
            console.log('[Game] Already queuing for rematch, ignoring duplicate click');
            return;
        }

        try {
            setIsRematchQueuing(true);
            console.log('[Game] Starting rematch with bet amount:', betAmount);

            // Get user ID from localStorage
            let odinsId: string | undefined;
            try {
                const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    odinsId = parsed?.user?.id;
                }
            } catch (e) {
                console.error('[Game] Error parsing localStorage:', e);
            }

            // Stop current game rendering
            gameRef.current?.stop();

            // Leave current game room
            if (roomRef.current) {
                await roomRef.current.leave();
                roomRef.current = null;
            }

            const playerName = localStorage.getItem('playerName') || 'Player';

            // Connect to matchmaking
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            const matchmakingClient = new Client(url);
            matchmakingRoomRef.current = await matchmakingClient.joinOrCreate('matchmaking', {
                playerName,
                odinsId: odinsId || '',
                betAmount,
            });

            console.log('[Game] Joined matchmaking queue with bet:', betAmount);

            // Listen for match found
            matchmakingRoomRef.current.onMessage('matchmaking:found', async (data: any) => {
                console.log('[Game] Match found:', data);

                // Leave matchmaking room
                if (matchmakingRoomRef.current) {
                    await matchmakingRoomRef.current.leave();
                    matchmakingRoomRef.current = null;
                }

                // Use full page reload to prevent component reuse issues
                const params = new URLSearchParams({
                    matchId: data.matchId,
                    isCreator: data.isCreator.toString(),
                    playerName: data.playerName,
                    opponentName: data.opponentName,
                    betAmount: data.betAmount.toString(),
                });
                window.location.href = `/new?${params.toString()}`;
            });
        } catch (error) {
            console.error('[Game] Error starting rematch:', error);
            setIsRematchQueuing(false);
            navigate('/');
        }
    }

    function handleGoHome() {
        // Leave matchmaking if active
        if (matchmakingRoomRef.current) {
            matchmakingRoomRef.current.leave();
            matchmakingRoomRef.current = null;
        }
        // Navigate to home page
        navigate('/');
    }

    return (
        <View
            style={{
                position: 'relative',
                height: '100%',
            }}
        >
            {/* Set page's title */}
            <Helmet>
                <title>{`${hud.roomName || hud.gameMode} [${hud.playersCount}]`}</title>
            </Helmet>

            {/* Where PIXI is injected */}
            <div ref={canvasRef} />

            {/* Joysticks */}
            {isMobile && (
                <JoySticks
                    onLeftMove={handleJoyStickLeftMove}
                    onLeftRelease={handleJoyStickLeftRelease}
                    onRightMove={handleJoyStickRightMove}
                    onRightRelease={handleJoyStickRightRelease}
                />
            )}

            {/* HUD: GUI, menu, leaderboard */}
            <HUD
                playerId={hud.playerId}
                gameMode={hud.gameMode}
                gameMap={hud.gameMap}
                gameModeEndsAt={hud.gameModeEndsAt}
                roomName={hud.roomName}
                playerName={hud.playerName}
                playerLives={hud.playerLives}
                playerMaxLives={hud.playerMaxLives}
                playerPot={hud.playerPot}
                players={hud.players}
                playersCount={hud.playersCount}
                playersMaxCount={hud.playersMaxCount}
                messages={hud.messages}
                announce={hud.announce}
                killRewardAmount={hud.killRewardAmount}
                killRewardVictim={hud.killRewardVictim}
                potLostAmount={hud.potLostAmount}
                potLostKiller={hud.potLostKiller}
                gameResult={hud.gameResult}
                gameResultWinner={hud.gameResultWinner}
                onPlayAgain={handlePlayAgain}
                onGoHome={handleGoHome}
                isRematchQueuing={isRematchQueuing}
            />
        </View>
    );
}
