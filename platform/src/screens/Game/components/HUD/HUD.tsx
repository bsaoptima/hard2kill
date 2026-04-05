import { Keys, Models } from '@hard2kill/gladiatorz-common';
import React, { CSSProperties } from 'react';
import { isMobile } from 'react-device-detect';
import { Health, Leaderboard, Menu, Messages, Players, Time } from '.';
import { View } from '../../../../components';
import { Announce } from './Announce';
import { GameResult, GameResultType } from './GameResult';

const HUD_PADDING = isMobile ? 16 : 24;

export interface HUDProps {
    gameMode: string;
    gameMap: string;
    gameModeEndsAt: number;
    roomName: string;
    playerId: string;
    playerName: string;
    playerLives: number;
    playerMaxLives: number;
    playerPot: number;
    players: Models.PlayerJSON[];
    playersCount: number;
    playersMaxCount: number;
    messages: Models.MessageJSON[];
    announce?: string;
    killRewardAmount?: number | null;
    killRewardVictim?: string | null;
    potLostAmount?: number | null;
    potLostKiller?: string | null;
    gameResult?: GameResultType;
    gameResultWinner?: string;
    onPlayAgain?: () => void;
    onGoHome?: () => void;
    isRematchQueuing?: boolean;
}

/**
 * The interface displaying important information to the user:
 * - Lives
 * - Time left
 * - Number of players
 * - Chat
 * - Leaderboard
 * - Menu
 */
export const HUD = React.memo((props: HUDProps): React.ReactElement => {
    const {
        playerId,
        gameMode,
        gameMap,
        gameModeEndsAt,
        roomName,
        playerName,
        playerLives,
        playerMaxLives,
        playerPot,
        players,
        playersCount,
        playersMaxCount,
        messages,
        announce,
        killRewardAmount,
        killRewardVictim,
        potLostAmount,
        potLostKiller,
        gameResult,
        gameResultWinner,
        onPlayAgain,
        onGoHome,
        isRematchQueuing,
    } = props;
    const [leaderboardOpened, setLeaderboardOpened] = React.useState(false);
    const [menuOpened, setMenuOpened] = React.useState(false);

    const handleLeave = () => {
        window.location.href = window.location.origin;
    };

    const handleKeyDown = (event: any) => {
        const key = event.code;

        if (Keys.LEADERBOARD.includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            setLeaderboardOpened(true);
        }
    };

    const handleKeyUp = (event: any) => {
        const key = event.code;

        if (Keys.LEADERBOARD.includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            setLeaderboardOpened(false);
        }

        if (Keys.MENU.includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            setMenuOpened((prev) => !prev);
        }
    };

    // Listen for key presses (and unlisten on unmount).
    React.useEffect(() => {
        window.document.addEventListener('keydown', handleKeyDown);
        window.document.addEventListener('keyup', handleKeyUp);

        return () => {
            window.document.removeEventListener('keydown', handleKeyDown);
            window.document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <View flex center fullscreen style={styles.hud}>
            {/* Health */}
            <Health name={playerName} lives={playerLives} maxLives={playerMaxLives} pot={playerPot} style={styles.health} />

            {/* Time */}
            <Time mode={gameMode} endsAt={gameModeEndsAt} style={styles.time} />

            {/* Players */}
            <Players
                count={playersCount}
                maxCount={playersMaxCount}
                style={styles.players}
                onMenuClicked={() => setMenuOpened(true)}
            />

            {/* Messages */}
            {isMobile ? null : <Messages messages={messages} style={styles.messages} />}

            {/* Announce (for non-win/lose messages) */}
            <Announce announce={announce} style={styles.announce} />

            {/* Game Result (Win/Lose) with amounts */}
            <GameResult
                result={gameResult ?? null}
                winnerName={gameResultWinner}
                amountWon={killRewardAmount}
                amountLost={potLostAmount}
                onPlayAgain={onPlayAgain}
                onGoHome={onGoHome}
                isQueuing={isRematchQueuing}
            />

            {/* Leaderboard */}
            {leaderboardOpened ? (
                <Leaderboard
                    roomName={roomName}
                    mapName={gameMap}
                    mode={gameMode}
                    players={players}
                    playerId={playerId}
                />
            ) : null}

            {/* Menu */}
            {menuOpened ? <Menu onClose={() => setMenuOpened(false)} onLeave={handleLeave} /> : null}
        </View>
    );
});

const styles: { [key: string]: CSSProperties } = {
    hud: {
        padding: HUD_PADDING,
        pointerEvents: 'none',
    },
    health: {
        position: 'absolute',
        left: HUD_PADDING,
        top: HUD_PADDING,
    },
    time: {
        position: 'absolute',
        top: HUD_PADDING,
        alignSelf: 'center',
    },
    players: {
        position: 'absolute',
        right: HUD_PADDING,
        top: HUD_PADDING,
    },
    messages: {
        position: 'absolute',
        left: HUD_PADDING,
        bottom: HUD_PADDING,
    },
    announce: {
        position: 'absolute',
    },
};
