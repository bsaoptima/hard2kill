import { RouteComponentProps } from '@reach/router';
import { Constants } from '@hard2kill/gladiatorz-common';
import { Client } from 'colyseus.js';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Space } from '../../components';
import { useAuth } from '../../App';
import { supabase, SUPABASE_STORAGE_KEY } from '../../supabase';

// Check if mobile
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

interface LandingScreenProps extends RouteComponentProps {}

export function LandingScreen({ navigate, location }: LandingScreenProps) {
    const { showAuth } = useAuth();
    const [userId, setUserId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [isMatchmaking, setIsMatchmaking] = useState(false);
    const [matchmakingStatus, setMatchmakingStatus] = useState('');
    const [balance, setBalance] = useState<number | null>(null);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [selectedBet, setSelectedBet] = useState(Constants.DEFAULT_BET_AMOUNT);
    const clientRef = useRef<Client | null>(null);
    const roomRef = useRef<any>(null);

    // Wasteland matchmaking state
    const [isWastelandMatchmaking, setIsWastelandMatchmaking] = useState(false);
    const [wastelandMatchmakingStatus, setWastelandMatchmakingStatus] = useState('');
    const [selectedWastelandBet, setSelectedWastelandBet] = useState(Constants.DEFAULT_BET_AMOUNT);
    const wastelandClientRef = useRef<Client | null>(null);
    const wastelandRoomRef = useRef<any>(null);

    // Gladiatorz matchmaking state
    const [isGladiatorMatchmaking, setIsGladiatorMatchmaking] = useState(false);
    const [gladiatorMatchmakingStatus, setGladiatorMatchmakingStatus] = useState('');
    const [selectedGladiatorBet, setSelectedGladiatorBet] = useState(Constants.DEFAULT_BET_AMOUNT);
    const [livePlayerCount, setLivePlayerCount] = useState(4);
    const [playerCountFlash, setPlayerCountFlash] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'games' | 'leaderboard' | 'performance' | 'wallet'>('games');

    // Coin balance + currency selection
    type Currency = 'cash' | 'coins';
    const [coins, setCoins] = useState<number | null>(null);
    const [gladiatorCurrency, setGladiatorCurrency] = useState<Currency>('cash');
    const [wastelandCurrency, setWastelandCurrency] = useState<Currency>('cash');
    const [coinNextClaimAt, setCoinNextClaimAt] = useState<number>(0); // epoch ms
    const [coinClaimTick, setCoinClaimTick] = useState(0); // forces re-render each second for countdown
    const [claiming, setClaiming] = useState(false);

    async function handleLogout() {
        await supabase.auth.signOut();
        // Clear local state
        setUserId(null);
        setUsername(null);
        setBalance(null);
        setCoins(null);
        setCoinNextClaimAt(0);
        setActiveTab('games');
        navigate?.('/');
    }

    // Get user and balance on mount and auth changes
    useEffect(() => {
        async function loadUserData(uid: string) {
            console.log('Loading user data for:', uid);
            try {
                // Load balance (cash + coins + last_coin_claim) in a single query
                const { data: balanceData, error: balanceError } = await supabase
                    .from('balances')
                    .select('balance, coins, last_coin_claim')
                    .eq('id', uid)
                    .maybeSingle();

                if (balanceError) {
                    console.error('Error loading balance:', balanceError);
                } else if (balanceData) {
                    setBalance(balanceData.balance);
                    setCoins(balanceData.coins || 0);
                    const lastClaim = balanceData.last_coin_claim ? new Date(balanceData.last_coin_claim).getTime() : 0;
                    setCoinNextClaimAt(lastClaim ? lastClaim + 60 * 60 * 1000 : 0);
                } else {
                    // No balance record exists, create one
                    console.log('Creating balance record for user');
                    const { error: insertError } = await supabase
                        .from('balances')
                        .insert({ id: uid });

                    if (!insertError) {
                        setBalance(0);
                        setCoins(0);
                        setCoinNextClaimAt(0);
                    }
                }

                // Load profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', uid)
                    .single();

                if (profileData) {
                    setUsername(profileData.username);
                    localStorage.setItem('playerName', profileData.username);
                } else {
                    // No profile - show username modal
                    setShowUsernameModal(true);
                }
            } catch (err) {
                console.error('User data fetch error:', err);
            }
        }

        // Check session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('getSession result:', !!session);
            if (session) {
                setUserId(session.user.id);
                loadUserData(session.user.id);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Landing onAuthStateChange:', event, !!session);
            if (session) {
                setUserId(session.user.id);
                loadUserData(session.user.id);
            } else {
                setUserId(null);
                setUsername(null);
                setBalance(null);
                setCoins(null);
                setCoinNextClaimAt(0);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Simulate live player count fluctuation
    useEffect(() => {
        const updatePlayerCount = () => {
            setLivePlayerCount(prev => {
                const changes = [-2, 0, 2]; // Only even changes
                const change = changes[Math.floor(Math.random() * changes.length)];
                const newCount = prev + change;

                // Only trigger flash if count actually changed
                if (newCount !== prev) {
                    setPlayerCountFlash(true);
                    setTimeout(() => setPlayerCountFlash(false), 600); // Flash duration
                }

                return Math.max(0, Math.min(10, newCount)); // Keep between 0-10
            });
        };

        const interval = setInterval(updatePlayerCount, 5000 + Math.random() * 5000); // 5-10 seconds
        return () => clearInterval(interval);
    }, []);

    async function fetchBalance() {
        if (!userId) return;
        const { data } = await supabase
            .from('balances')
            .select('balance, coins, last_coin_claim')
            .eq('id', userId)
            .single();
        if (data) {
            setBalance(data.balance);
            setCoins(data.coins || 0);
            const lastClaim = data.last_coin_claim ? new Date(data.last_coin_claim).getTime() : 0;
            setCoinNextClaimAt(lastClaim ? lastClaim + 60 * 60 * 1000 : 0);
        }
    }

    // Claim handler — hits the server endpoint
    async function handleClaimCoins() {
        if (!userId || claiming) return;
        setClaiming(true);
        try {
            const res = await fetch('/api/claim-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const result = await res.json();
            if (result.success) {
                setCoins(result.coins);
                setCoinNextClaimAt(new Date(result.nextClaimAt).getTime());
            } else if (result.nextClaimAt) {
                // On cooldown — align our local timer with server's
                setCoinNextClaimAt(new Date(result.nextClaimAt).getTime());
                if (typeof result.coins === 'number') setCoins(result.coins);
            }
        } catch (err) {
            console.error('Claim error:', err);
        }
        setClaiming(false);
    }

    // Tick every second so the countdown updates in the UI
    useEffect(() => {
        if (!coinNextClaimAt) return;
        if (Date.now() >= coinNextClaimAt) return;
        const interval = setInterval(() => setCoinClaimTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [coinNextClaimAt]);

    const coinsLoaded = coins !== null;
    const msUntilNextClaim = Math.max(0, coinNextClaimAt - Date.now());
    const canClaim = !!userId && coinsLoaded && msUntilNextClaim <= 0;
    const coinCountdown = (() => {
        if (!coinNextClaimAt || msUntilNextClaim <= 0) return '';
        const totalSec = Math.ceil(msUntilNextClaim / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}m ${s.toString().padStart(2, '0')}s`;
    })();
    void coinClaimTick; // force this derived value to re-render with the tick

    // Check for deposit success in URL
    useEffect(() => {
        const params = new URLSearchParams(location?.search || '');
        if (params.get('deposit') === 'success') {
            fetchBalance();
            window.history.replaceState({}, '', '/');
        }
    }, [location]);

    function handlePlayClick() {
        if (userId) {
            navigate('/lobby');
        } else {
            showAuth();
        }
    }

    async function handleMatchmaking() {
        if (!userId) {
            showAuth('Login to play');
            return;
        }

        if (isMatchmaking) {
            // Cancel matchmaking
            if (roomRef.current) {
                roomRef.current.leave();
                roomRef.current = null;
            }
            setIsMatchmaking(false);
            setMatchmakingStatus('');
            return;
        }

        // Check if user has enough balance
        if (balance === null || balance < selectedBet) {
            setMatchmakingStatus(`Insufficient balance. Need $${selectedBet} to play.`);
            return;
        }

        setIsMatchmaking(true);
        setMatchmakingStatus('Connecting...');

        try {
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            clientRef.current = new Client(url);

            const playerName = localStorage.getItem('playerName') || 'Player';

            roomRef.current = await clientRef.current.joinOrCreate('matchmaking', {
                playerName,
                odinsId: '',
                betAmount: selectedBet,
            });

            setMatchmakingStatus(`Waiting for $${selectedBet} opponent...`);

            roomRef.current.onMessage('matchmaking:status', (data: any) => {
                setMatchmakingStatus(`Waiting for opponent... (Position: ${data.position})`);
            });

            roomRef.current.onMessage('matchmaking:found', async (data: any) => {
                setMatchmakingStatus('Match found! Joining...');
                if (roomRef.current) {
                    roomRef.current.leave();
                    roomRef.current = null;
                }

                const params = new URLSearchParams({
                    matchId: data.matchId,
                    isCreator: data.isCreator.toString(),
                    playerName: data.playerName,
                    opponentName: data.opponentName,
                    betAmount: data.betAmount.toString(),
                });
                navigate(`/new?${params.toString()}`);
            });

            roomRef.current.onLeave(() => {
                setIsMatchmaking(false);
                setMatchmakingStatus('');
            });
        } catch (error) {
            console.error('Matchmaking error:', error);
            setIsMatchmaking(false);
            setMatchmakingStatus('Error connecting');
        }
    }

    async function handleWastelandMatchmaking() {
        if (!userId) {
            showAuth('Login to play');
            return;
        }

        if (isWastelandMatchmaking) {
            // Cancel matchmaking
            if (wastelandRoomRef.current) {
                wastelandRoomRef.current.leave();
                wastelandRoomRef.current = null;
            }
            setIsWastelandMatchmaking(false);
            setWastelandMatchmakingStatus('');
            return;
        }

        // Check balance in the selected currency
        const currency = wastelandCurrency;
        const walletBalance = currency === 'coins' ? coins : balance;
        if (walletBalance === null || walletBalance < selectedWastelandBet) {
            const prefix = currency === 'coins' ? '' : '$';
            const suffix = currency === 'coins' ? ' coins' : '';
            setWastelandMatchmakingStatus(`Insufficient ${currency}. Need ${prefix}${selectedWastelandBet}${suffix} to play.`);
            return;
        }

        setIsWastelandMatchmaking(true);
        setWastelandMatchmakingStatus('Connecting...');

        try {
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            wastelandClientRef.current = new Client(url);

            const playerName = localStorage.getItem('playerName') || 'Player';

            wastelandRoomRef.current = await wastelandClientRef.current.joinOrCreate('wasteland-matchmaking', {
                playerName,
                odinsId: userId,
                betAmount: selectedWastelandBet,
                currency,
            });

            const display = currency === 'coins' ? `${selectedWastelandBet} coins` : `$${selectedWastelandBet}`;
            setWastelandMatchmakingStatus(`Waiting for ${display} opponent...`);

            wastelandRoomRef.current.onMessage('matchmaking:status', (data: any) => {
                setWastelandMatchmakingStatus(`Waiting for opponent... (Position: ${data.position})`);
            });

            wastelandRoomRef.current.onMessage('matchmaking:found', async (data: any) => {
                setWastelandMatchmakingStatus('Match found! Joining...');
                if (wastelandRoomRef.current) {
                    wastelandRoomRef.current.leave();
                    wastelandRoomRef.current = null;
                }

                const params = new URLSearchParams({
                    matchId: data.matchId,
                    isCreator: data.isCreator.toString(),
                    playerName: data.playerName,
                    opponentName: data.opponentName,
                    betAmount: data.betAmount.toString(),
                    currency: data.currency || 'cash',
                });
                navigate(`/three-fps?${params.toString()}`);
            });

            wastelandRoomRef.current.onLeave(() => {
                setIsWastelandMatchmaking(false);
                setWastelandMatchmakingStatus('');
            });
        } catch (error) {
            console.error('Wasteland matchmaking error:', error);
            setIsWastelandMatchmaking(false);
            setWastelandMatchmakingStatus('Error connecting');
        }
    }

    async function handleGladiatorMatchmaking() {
        if (!userId) {
            showAuth('Login to play');
            return;
        }

        if (isGladiatorMatchmaking) {
            // Cancel matchmaking
            if (roomRef.current) {
                roomRef.current.leave();
                roomRef.current = null;
            }
            setIsGladiatorMatchmaking(false);
            setGladiatorMatchmakingStatus('');
            return;
        }

        // Check balance in the selected currency
        const currency = gladiatorCurrency;
        const walletBalance = currency === 'coins' ? coins : balance;
        if (walletBalance === null || walletBalance < selectedGladiatorBet) {
            const prefix = currency === 'coins' ? '' : '$';
            const suffix = currency === 'coins' ? ' coins' : '';
            setGladiatorMatchmakingStatus(`Insufficient ${currency}. Need ${prefix}${selectedGladiatorBet}${suffix} to play.`);
            return;
        }

        setIsGladiatorMatchmaking(true);
        setGladiatorMatchmakingStatus('Connecting...');

        try {
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            clientRef.current = new Client(url);

            const playerName = localStorage.getItem('playerName') || 'Player';

            roomRef.current = await clientRef.current.joinOrCreate('matchmaking', {
                playerName,
                odinsId: userId,
                betAmount: selectedGladiatorBet,
                currency,
            });

            const display = currency === 'coins' ? `${selectedGladiatorBet} coins` : `$${selectedGladiatorBet}`;
            setGladiatorMatchmakingStatus(`Waiting for ${display} opponent...`);

            roomRef.current.onMessage('matchmaking:status', (data: any) => {
                setGladiatorMatchmakingStatus(`Waiting for opponent... (Position: ${data.position})`);
            });

            roomRef.current.onMessage('matchmaking:found', async (data: any) => {
                setGladiatorMatchmakingStatus('Match found! Joining...');
                if (roomRef.current) {
                    roomRef.current.leave();
                    roomRef.current = null;
                }

                const params = new URLSearchParams({
                    matchId: data.matchId,
                    isCreator: data.isCreator.toString(),
                    playerName: data.playerName,
                    opponentName: data.opponentName,
                    betAmount: data.betAmount.toString(),
                    currency: data.currency || 'cash',
                });
                navigate(`/${data.matchId}?${params.toString()}`);
            });

            roomRef.current.onLeave(() => {
                setIsGladiatorMatchmaking(false);
                setGladiatorMatchmakingStatus('');
            });
        } catch (error) {
            console.error('Gladiator matchmaking error:', error);
            setIsGladiatorMatchmaking(false);
            setGladiatorMatchmakingStatus('Error connecting');
        }
    }

    // ==========================================
    // AUTHENTICATED LAYOUT — sidebar + page content
    // ==========================================
    if (userId) {
        const navItems: Array<{ id: typeof activeTab; label: string }> = [
            { id: 'games', label: 'Games' },
            { id: 'leaderboard', label: 'Leaderboard' },
            { id: 'performance', label: 'Performance' },
            { id: 'wallet', label: 'Wallet' },
        ];

        return (
            <View style={styles.appShell}>
                <View style={styles.sidebar}>
                    <Text style={styles.sidebarLogo}>
                        H<span style={{ color: '#39ff14' }}>2</span>K
                    </Text>

                    <Space size="m" />

                    <View style={styles.sidebarBalance}>
                        <Text style={styles.sidebarBalanceLabel}>CASH</Text>
                        <Text style={styles.sidebarBalanceValue}>
                            ${balance !== null ? balance.toLocaleString('en-US') : '...'}
                        </Text>
                    </View>

                    <Space size="xxs" />

                    <View style={styles.sidebarCoinsCard}>
                        <Text style={styles.sidebarBalanceLabel}>COINS</Text>
                        <Text style={styles.sidebarCoinsCardValue}>
                            🪙 {coins !== null ? coins.toLocaleString('en-US') : '...'}
                        </Text>
                    </View>

                    <Space size="l" />

                    <View style={styles.sidebarNav}>
                        {navItems.map((tab) => (
                            <button
                                key={tab.id}
                                style={{
                                    ...styles.sidebarNavItem,
                                    ...(activeTab === tab.id ? styles.sidebarNavItemActive : {}),
                                }}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </View>

                    <View style={{ flex: 1 }} />

                    <button style={styles.sidebarLogout} onClick={handleLogout}>
                        LOGOUT
                    </button>
                </View>

                <View style={styles.mainArea}>
                    <View style={styles.topBar}>
                        <button
                            style={styles.topBarUser}
                            onClick={() => setActiveTab('performance')}
                            title="View profile"
                        >
                            <View style={styles.topBarAvatar}>
                                <Text style={styles.topBarAvatarText}>
                                    {(username || 'P').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.topBarUserName}>{username || 'Player'}</Text>
                        </button>
                    </View>
                    <View style={styles.mainContent}>
                    {activeTab === 'games' && (
                        <View style={styles.pageContainer}>
                            <Text style={styles.pageTitle}>Games</Text>
                            <Space size="xs" />
                            <Text style={styles.pageSubtitle}>Pick a game, set your bet, find a match. Winner takes the pot.</Text>
                            <Space size="l" />

                            {/* Hourly coin claim widget */}
                            <View style={styles.claimCard}>
                                <View style={styles.claimCardLeft}>
                                    <Text style={styles.claimCoinIcon}>🪙</Text>
                                    <View>
                                        <Text style={styles.claimTitle}>Free coins every hour</Text>
                                        <Text style={styles.claimSubtitle}>
                                            {!coinsLoaded
                                                ? 'Checking your claim status...'
                                                : canClaim
                                                    ? '10 coins available right now'
                                                    : `Next claim in ${coinCountdown || '...'}`}
                                        </Text>
                                    </View>
                                </View>
                                <button
                                    className="btn-3d"
                                    onClick={handleClaimCoins}
                                    disabled={!coinsLoaded || !canClaim || claiming}
                                    style={{
                                        width: 'auto',
                                        flexShrink: 0,
                                        alignSelf: 'center',
                                        opacity: coinsLoaded && canClaim && !claiming ? 1 : 0.5,
                                    }}
                                >
                                    <span className="btn-3d-top">
                                        {!coinsLoaded
                                            ? 'LOADING...'
                                            : claiming
                                                ? 'CLAIMING...'
                                                : canClaim
                                                    ? 'CLAIM 10 COINS'
                                                    : 'ON COOLDOWN'}
                                    </span>
                                </button>
                            </View>

                            <Space size="l" />

                            <View style={{ ...styles.gamesGrid, maxWidth: '100%', paddingLeft: 0, paddingRight: 0, alignItems: 'stretch' }}>
                                <View style={{ ...styles.gameCard, padding: isMobile ? 16 : 20 }}>
                                    <div style={{
                                        overflow: 'hidden',
                                        borderRadius: 8,
                                        width: isMobile ? '100%' : '100%',
                                        maxWidth: isMobile ? '100%' : 500,
                                        flex: isMobile ? 'none' : '0 1 500px',
                                        minWidth: 0,
                                        height: isMobile ? 200 : 350,
                                    }}>
                                        <video
                                            src="/gladiatorz.mov"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, transform: 'scale(1.15)' } as React.CSSProperties}
                                        />
                                    </div>
                                    <View style={styles.gameCardContent}>
                                        <Text style={styles.gameTitle}>Gladiatorz</Text>
                                        <Space size="xs" />
                                        <Text style={styles.gameDescription}>Shoot your opponent 3 times to win in this Brawlstar like arcade game.</Text>
                                        <Space size="m" />
                                        <CurrencyToggle
                                            value={gladiatorCurrency}
                                            onChange={setGladiatorCurrency}
                                            disabled={isGladiatorMatchmaking}
                                        />
                                        <Space size="s" />
                                        <View style={styles.betSelector}>
                                            <Text style={styles.betLabel}>BET AMOUNT</Text>
                                            <View style={styles.betOptions}>
                                                {Constants.BET_AMOUNTS.map((amount) => (
                                                    <button
                                                        key={amount}
                                                        style={{
                                                            ...styles.betButton,
                                                            backgroundColor: selectedGladiatorBet === amount ? '#39ff14' : '#222',
                                                            color: selectedGladiatorBet === amount ? '#000' : '#fff',
                                                            borderColor: selectedGladiatorBet === amount ? '#39ff14' : '#333',
                                                        }}
                                                        onClick={() => setSelectedGladiatorBet(amount)}
                                                        disabled={isGladiatorMatchmaking}
                                                    >
                                                        {gladiatorCurrency === 'coins' ? `🪙 ${amount}` : `$${amount}`}
                                                    </button>
                                                ))}
                                            </View>
                                        </View>
                                        <Space size="m" />
                                        <button className="btn-3d" onClick={handleGladiatorMatchmaking}>
                                            <span className="btn-3d-top">
                                                {isGladiatorMatchmaking
                                                    ? 'CANCEL'
                                                    : `FIND ${gladiatorCurrency === 'coins' ? `🪙 ${selectedGladiatorBet}` : `$${selectedGladiatorBet}`} MATCH`}
                                            </span>
                                        </button>
                                        {gladiatorMatchmakingStatus && (
                                            <>
                                                <Space size="s" />
                                                <Text style={styles.statusText}>{gladiatorMatchmakingStatus}</Text>
                                            </>
                                        )}
                                        <Space size="xs" />
                                        <View style={{
                                            ...styles.livePlayersContainer,
                                            animation: playerCountFlash ? 'playerCountFlash 0.6s ease-out' : 'none',
                                        }}>
                                            <Text style={styles.livePlayersText}>
                                                <span style={styles.greenDot}>🟢</span> {livePlayerCount} players currently online
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ ...styles.gameCard, padding: isMobile ? 16 : 20 }}>
                                    <div style={{
                                        overflow: 'hidden',
                                        borderRadius: 8,
                                        width: isMobile ? '100%' : '100%',
                                        maxWidth: isMobile ? '100%' : 500,
                                        flex: isMobile ? 'none' : '0 1 500px',
                                        minWidth: 0,
                                        height: isMobile ? 200 : 350,
                                    }}>
                                        <img
                                            src="https://i.giphy.com/fxfmMuGbh5aPtZ9T6j.webp"
                                            alt="Wasteland"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                                        />
                                    </div>
                                    <View style={styles.gameCardContent}>
                                        <Text style={styles.gameTitle}>Wasteland</Text>
                                        <Space size="xs" />
                                        <Text style={styles.gameDescription}>FPS deathmatch. Eliminate your opponent to win money.</Text>
                                        <Space size="m" />
                                        <CurrencyToggle
                                            value={wastelandCurrency}
                                            onChange={setWastelandCurrency}
                                            disabled={isWastelandMatchmaking}
                                        />
                                        <Space size="s" />
                                        <View style={styles.betSelector}>
                                            <Text style={styles.betLabel}>BET AMOUNT</Text>
                                            <View style={styles.betOptions}>
                                                {Constants.BET_AMOUNTS.map((amount) => (
                                                    <button
                                                        key={amount}
                                                        style={{
                                                            ...styles.betButton,
                                                            backgroundColor: selectedWastelandBet === amount ? '#39ff14' : '#222',
                                                            color: selectedWastelandBet === amount ? '#000' : '#fff',
                                                            borderColor: selectedWastelandBet === amount ? '#39ff14' : '#333',
                                                        }}
                                                        onClick={() => setSelectedWastelandBet(amount)}
                                                        disabled={isWastelandMatchmaking}
                                                    >
                                                        {wastelandCurrency === 'coins' ? `🪙 ${amount}` : `$${amount}`}
                                                    </button>
                                                ))}
                                            </View>
                                        </View>
                                        <Space size="m" />
                                        <button className="btn-3d" onClick={handleWastelandMatchmaking}>
                                            <span className="btn-3d-top">
                                                {isWastelandMatchmaking
                                                    ? 'CANCEL'
                                                    : `FIND ${wastelandCurrency === 'coins' ? `🪙 ${selectedWastelandBet}` : `$${selectedWastelandBet}`} MATCH`}
                                            </span>
                                        </button>
                                        {wastelandMatchmakingStatus && (
                                            <>
                                                <Space size="s" />
                                                <Text style={styles.statusText}>{wastelandMatchmakingStatus}</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {activeTab === 'leaderboard' && (
                        <View style={styles.pageContainer}>
                            <Text style={styles.pageTitle}>Leaderboard</Text>
                            <Space size="xs" />
                            <Text style={styles.pageSubtitle}>Top 10 earners across all games. Updated every time a match ends.</Text>
                            <Space size="l" />
                            <LeaderboardPage />
                        </View>
                    )}

                    {activeTab === 'performance' && (
                        <View style={styles.pageContainer}>
                            <Text style={styles.pageTitle}>Performance</Text>
                            <Space size="xs" />
                            <Text style={styles.pageSubtitle}>Your win rate, net earnings, and the last few matches you played.</Text>
                            <Space size="l" />
                            <PerformancePage userId={userId} />
                        </View>
                    )}

                    {activeTab === 'wallet' && (
                        <View style={styles.pageContainer}>
                            <Text style={styles.pageTitle}>Wallet</Text>
                            <Space size="xs" />
                            <Text style={styles.pageSubtitle}>Top up to play, cash out when you're ahead. 10% fee on withdrawals.</Text>
                            <Space size="l" />
                            <WalletPage
                                userId={userId}
                                balance={balance}
                                onDeposit={() => setShowDepositModal(true)}
                                onWithdraw={() => setShowWithdrawModal(true)}
                            />
                        </View>
                    )}
                    </View>
                </View>

                {showDepositModal && (
                    <DepositModal
                        onClose={() => setShowDepositModal(false)}
                        onSuccess={() => {
                            setShowDepositModal(false);
                            fetchBalance();
                        }}
                    />
                )}

                {showWithdrawModal && (
                    <WithdrawModal
                        balance={balance || 0}
                        onClose={() => setShowWithdrawModal(false)}
                        onSuccess={() => {
                            setShowWithdrawModal(false);
                            fetchBalance();
                        }}
                    />
                )}

                {showUsernameModal && userId && (
                    <UsernameModal
                        userId={userId}
                        onSuccess={(name) => {
                            setUsername(name);
                            localStorage.setItem('playerName', name);
                            setShowUsernameModal(false);
                        }}
                    />
                )}
            </View>
        );
    }

    // ==========================================
    // UNAUTHENTICATED LAYOUT (marketing landing)
    // ==========================================
    return (
        <View
            flex
            center
            style={{
                minHeight: '100vh',
                backgroundColor: '#000',
                flexDirection: 'column',
                padding: 32,
                paddingTop: isMobile ? 80 : 100,
                position: 'relative',
            }}
        >
            <View style={styles.navbar}>
                <Text style={styles.navbarTitle}>HARD<span style={{ color: '#39ff14' }}>2</span>KILL</Text>

                {userId ? (
                    <View style={styles.navbarRight}>
                        <View style={styles.balanceContainer2}>
                            <Text style={styles.balanceValue2}>${balance !== null ? balance.toLocaleString('en-US') : '...'}</Text>
                            <button style={styles.depositButton} onClick={() => setShowDepositModal(true)}>
                                DEPOSIT
                            </button>
                        </View>
                        <button style={styles.profileIconButton} onClick={() => navigate?.('/profile')}>
                            <img src="/user.svg" alt="Profile" style={styles.profileIcon} />
                        </button>
                    </View>
                ) : (
                    <button className="btn-3d" style={styles.navButton} onClick={showAuth}>
                        <span className="btn-3d-top">LOGIN</span>
                    </button>
                )}</View>
            <Space size="xl" />
            <Text style={styles.tagline}>Play PvP games. Beat the opponent. Take their money</Text>
            <Space size="xs" />
            <Text style={styles.mainHeading}>SKILL-BASED BETTING</Text>
            <Space size="xs" />
            <Text style={styles.description}>
                Make money play video games against other humans
            </Text>
            <Space size="xl" />

            <View style={styles.gamesGrid}>
                <View style={styles.gameCard}>
                    <div style={{overflow: 'hidden', borderRadius: 8, width: isMobile ? '100%' : 500, height: isMobile ? 200 : 350}}>
                        <video
                            src="/gladiatorz.mov"
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{...styles.gameImage, transform: 'scale(1.15)'} as React.CSSProperties}
                        />
                    </div>
                    <View style={styles.gameCardContent}>
                        <Text style={styles.gameTitle}>Gladiatorz</Text>
                        <Space size="xs" />
                        <Text style={styles.gameDescription}>Shoot your opponent 3 times to win in this Brawlstar like arcade game.</Text>
                        <Space size="m" />

                        <View style={styles.betSelector}>
                            <Text style={styles.betLabel}>BET AMOUNT</Text>
                            <View style={styles.betOptions}>
                                {Constants.BET_AMOUNTS.map((amount) => (
                                    <button
                                        key={amount}
                                        style={{
                                            ...styles.betButton,
                                            backgroundColor: selectedGladiatorBet === amount ? '#39ff14' : '#222',
                                            color: selectedGladiatorBet === amount ? '#000' : '#fff',
                                            borderColor: selectedGladiatorBet === amount ? '#39ff14' : '#333',
                                        }}
                                        onClick={() => setSelectedGladiatorBet(amount)}
                                        disabled={isGladiatorMatchmaking}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                            </View>
                        </View>
                        <Space size="m" />

                        <button className="btn-3d" onClick={handleGladiatorMatchmaking}>
                            <span className="btn-3d-top">
                                {isGladiatorMatchmaking ? 'CANCEL' : `FIND $${selectedGladiatorBet} MATCH`}
                            </span>
                        </button>

                        {gladiatorMatchmakingStatus && (
                            <>
                                <Space size="s" />
                                <Text style={styles.statusText}>{gladiatorMatchmakingStatus}</Text>
                            </>
                        )}

                        <Space size="xs" />

                        <View style={{
                            ...styles.livePlayersContainer,
                            animation: playerCountFlash ? 'playerCountFlash 0.6s ease-out' : 'none',
                        }}>
                            <Text style={styles.livePlayersText}>
                                <span style={styles.greenDot}>🟢</span> {livePlayerCount} players currently online
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.gameCard}>
                    <img
                        src="https://i.giphy.com/fxfmMuGbh5aPtZ9T6j.webp"
                        alt="Wasteland"
                        style={styles.gameImage}
                    />
                    <View style={styles.gameCardContent}>
                        <Text style={styles.gameTitle}>Wasteland</Text>
                        <Space size="xs" />
                        <Text style={styles.gameDescription}>FPS deathmatch. Eliminate your opponent to win money.</Text>
                        <Space size="m" />

                        <View style={styles.betSelector}>
                            <Text style={styles.betLabel}>BET AMOUNT</Text>
                            <View style={styles.betOptions}>
                                {Constants.BET_AMOUNTS.map((amount) => (
                                    <button
                                        key={amount}
                                        style={{
                                            ...styles.betButton,
                                            backgroundColor: selectedWastelandBet === amount ? '#39ff14' : '#222',
                                            color: selectedWastelandBet === amount ? '#000' : '#fff',
                                            borderColor: selectedWastelandBet === amount ? '#39ff14' : '#333',
                                        }}
                                        onClick={() => setSelectedWastelandBet(amount)}
                                        disabled={isWastelandMatchmaking}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                            </View>
                        </View>
                        <Space size="m" />

                        <button className="btn-3d" onClick={handleWastelandMatchmaking}>
                            <span className="btn-3d-top">
                                {isWastelandMatchmaking ? 'CANCEL' : `FIND $${selectedWastelandBet} MATCH`}
                            </span>
                        </button>

                        {wastelandMatchmakingStatus && (
                            <>
                                <Space size="s" />
                                <Text style={styles.statusText}>{wastelandMatchmakingStatus}</Text>
                            </>
                        )}
                    </View>
                </View>
            </View>

            <Space size="xxl" />

            {/* FAQ Section */}
            <View style={styles.faqSection}>
                <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
                <Space size="m" />
                <View style={styles.faqList}>
                    {[
                        {
                            question: "Is this legal?",
                            answer: "Yes. HARD2KILL is a skill-based gaming platform, not gambling. You compete against other players using your gaming skills, similar to chess or poker tournaments. Skill-based competitions are legal in most jurisdictions."
                        },
                        {
                            question: "How do I withdraw my winnings?",
                            answer: "Click on your balance in the top right, select 'Withdraw', choose your payment method (PayPal, Crypto, or Bank Transfer), and enter your details. Withdrawals are typically processed within 24-48 hours."
                        },
                        {
                            question: "How do I know the games aren't rigged?",
                            answer: "You play against real human opponents, not bots or the house. Our games are server-authoritative, meaning all game logic runs on our servers to prevent cheating. We have no incentive to rig games - we only take a small platform fee."
                        },
                        {
                            question: "What fees do you charge?",
                            answer: "Deposits are completely free. When you withdraw, we charge a 10% platform fee. For example, if you withdraw $100, you'll receive $90. This fee covers payment processing and platform operations."
                        },
                        {
                            question: "Is my money safe?",
                            answer: "Yes. All funds are held in secure, segregated accounts. We use bank-grade encryption and never store payment details. Your balance is always available for immediate withdrawal."
                        }
                    ].map((faq, index) => (
                        <View key={index} style={styles.faqItem}>
                            <button
                                style={styles.faqQuestion}
                                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                            >
                                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                                <Text style={styles.faqIcon}>{openFaqIndex === index ? '−' : '+'}</Text>
                            </button>
                            {openFaqIndex === index && (
                                <View style={styles.faqAnswer}>
                                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </View>

            <Space size="xl" />
            <Text style={styles.footer}>
                100% skill-based. Your wins are your earnings.
            </Text>

            {/* Floating Telegram button */}
            <a
                href="https://t.me/bsaoptima"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.telegramButton}
            >
                <span style={styles.telegramIcon}>💬</span>
                <span style={styles.telegramText}>Chat with Founder</span>
            </a>

            {showLeaderboard && (
                <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
            )}

            {showDepositModal && (
                <DepositModal
                    onClose={() => setShowDepositModal(false)}
                    onSuccess={() => {
                        setShowDepositModal(false);
                        fetchBalance();
                    }}
                />
            )}

            {showWithdrawModal && (
                <WithdrawModal
                    balance={balance || 0}
                    onClose={() => setShowWithdrawModal(false)}
                    onSuccess={() => {
                        setShowWithdrawModal(false);
                        fetchBalance();
                    }}
                />
            )}

            {showUsernameModal && userId && (
                <UsernameModal
                    userId={userId}
                    onSuccess={(name) => {
                        setUsername(name);
                        localStorage.setItem('playerName', name);
                        setShowUsernameModal(false);
                    }}
                />
            )}
        </View>
    );
}

function UsernameModal({ userId, onSuccess }: { userId: string; onSuccess: (username: string) => void }) {
    const [inputUsername, setInputUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit() {
        const trimmed = inputUsername.trim();
        if (trimmed.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (trimmed.length > 20) {
            setError('Username must be 20 characters or less');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            setError('Only letters, numbers, and underscores allowed');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: insertError } = await supabase.from('profiles').insert({
                id: userId,
                username: trimmed,
            });

            if (insertError) {
                if (insertError.code === '23505') {
                    setError('Username already taken');
                } else {
                    setError('Failed to save username');
                }
                setLoading(false);
                return;
            }

            onSuccess(trimmed);
        } catch (err) {
            setError('Failed to save username');
        }
        setLoading(false);
    }

    return (
        <div style={depositStyles.overlay}>
            <div style={depositStyles.modal}>
                <Text style={depositStyles.title}>Choose Your Username</Text>
                <Space size="s" />
                <Text style={{ color: '#888', textAlign: 'center', fontSize: 14 }}>
                    This will be displayed on the leaderboard
                </Text>
                <Space size="m" />

                <input
                    type="text"
                    placeholder="Enter username"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value)}
                    style={depositStyles.input}
                    maxLength={20}
                    autoFocus
                />

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={depositStyles.error}>{error}</Text>
                    </>
                )}

                <Space size="m" />

                <button className="btn-3d" onClick={handleSubmit} disabled={loading || inputUsername.trim().length < 3}>
                    <span className="btn-3d-top">
                        {loading ? 'Saving...' : 'CONTINUE'}
                    </span>
                </button>
            </div>
        </div>
    );
}

function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const presetAmounts = [5, 10, 25, 50, 100];

    async function handleDeposit() {
        setLoading(true);
        setError('');

        try {
            // Get user ID from localStorage cache
            let userId: string | undefined;
            try {
                const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    userId = parsed?.user?.id;
                }
            } catch (e) {}

            if (!userId) {
                setError('Not logged in');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount }),
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                setError(data.error || 'Failed to create checkout');
            }
        } catch (err) {
            console.error('Deposit error:', err);
            setError('Failed to connect');
        }

        setLoading(false);
    }

    return (
        <div style={depositStyles.overlay} onClick={onClose}>
            <div style={depositStyles.modal} onClick={(e) => e.stopPropagation()}>
                <Text style={depositStyles.title}>Deposit Credits</Text>
                <Space size="m" />

                <Text style={depositStyles.label}>Select amount</Text>
                <Space size="s" />

                <View style={depositStyles.presets}>
                    {presetAmounts.map((preset) => (
                        <button
                            key={preset}
                            style={{
                                ...depositStyles.presetButton,
                                backgroundColor: amount === preset ? '#39ff14' : '#222',
                                color: amount === preset ? '#000' : '#fff',
                            }}
                            onClick={() => setAmount(preset)}
                        >
                            ${preset}
                        </button>
                    ))}
                </View>

                <Space size="m" />

                <Text style={depositStyles.label}>Or enter custom amount</Text>
                <Space size="s" />
                <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={depositStyles.input}
                />

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={depositStyles.error}>{error}</Text>
                    </>
                )}

                <Space size="m" />

                <button className="btn-3d" onClick={handleDeposit} disabled={loading || amount < 1}>
                    <span className="btn-3d-top">
                        {loading ? 'Loading...' : `PAY $${amount}`}
                    </span>
                </button>
            </div>
        </div>
    );
}

const depositStyles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 16 : 0,
    },
    modal: {
        backgroundColor: '#111',
        border: '1px solid #333',
        padding: isMobile ? 20 : 32,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        minWidth: isMobile ? 'auto' : 350,
        width: isMobile ? '100%' : 'auto',
        maxWidth: 400,
    },
    title: {
        fontSize: isMobile ? 20 : 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    label: {
        fontSize: isMobile ? 12 : 14,
        color: '#888',
    },
    presets: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
    },
    presetButton: {
        padding: isMobile ? '10px 12px' : '12px 16px',
        border: '1px solid #333',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: isMobile ? 12 : 14,
        flex: isMobile ? '1 1 auto' : 'none',
        minWidth: isMobile ? 50 : 'auto',
    },
    input: {
        padding: isMobile ? 10 : 12,
        borderRadius: 6,
        border: '1px solid #333',
        backgroundColor: '#222',
        color: '#fff',
        fontSize: isMobile ? 14 : 16,
        width: '100%',
        boxSizing: 'border-box',
    },
    error: {
        color: '#ff4444',
        fontSize: isMobile ? 12 : 14,
    },
};

type PaymentMethod = 'paypal' | 'solana' | 'ethereum' | 'bank';

const WITHDRAWAL_FEE_PERCENT = 10; // 10% withdrawal fee

interface PaymentMethodConfig {
    id: PaymentMethod;
    label: string;
    fields: { name: string; placeholder: string; type?: string }[];
    description: string;
}

const paymentMethods: PaymentMethodConfig[] = [
    {
        id: 'paypal',
        label: 'PayPal',
        fields: [{ name: 'email', placeholder: 'PayPal email address', type: 'email' }],
        description: 'Processed within 24-48 hours'
    },
    {
        id: 'solana',
        label: 'Solana (USDC)',
        fields: [{ name: 'wallet', placeholder: 'Solana wallet address (e.g., 7xKXtg2C...)' }],
        description: 'USDC on Solana network'
    },
    {
        id: 'ethereum',
        label: 'Ethereum (USDC)',
        fields: [{ name: 'wallet', placeholder: 'Ethereum wallet address (0x...)' }],
        description: 'USDC on Ethereum (ERC-20)'
    },
    {
        id: 'bank',
        label: 'Bank Transfer',
        fields: [
            { name: 'accountHolder', placeholder: 'Full name on account' },
            { name: 'bankName', placeholder: 'Bank name' },
            { name: 'accountNumber', placeholder: 'Account/IBAN/PIX key' },
            { name: 'routingSwift', placeholder: 'Routing/SWIFT/Agency (if applicable)' }
        ],
        description: '3-7 business days'
    },
];

function WithdrawModal({ balance, onClose, onSuccess }: { balance: number; onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState<number>(balance);
    const [method, setMethod] = useState<PaymentMethod>('paypal');
    const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const selectedMethod = paymentMethods.find(m => m.id === method)!;

    // Calculate fees
    const fee = Math.round((amount * WITHDRAWAL_FEE_PERCENT) / 100);
    const youReceive = amount - fee;

    async function handleWithdraw() {
        if (amount <= 0 || amount > balance) {
            setError('Invalid amount');
            return;
        }

        // Validate all required fields are filled
        const missingFields = selectedMethod.fields.filter(field => !paymentDetails[field.name]?.trim());
        if (missingFields.length > 0) {
            setError(`Please fill in: ${missingFields.map(f => f.placeholder).join(', ')}`);
            return;
        }

        // Validate wallet addresses
        if (method === 'ethereum') {
            const ethAddress = paymentDetails['wallet'];
            if (!ethAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                setError('Invalid Ethereum address. Must start with 0x and be 42 characters');
                return;
            }
        }
        if (method === 'solana') {
            const solAddress = paymentDetails['wallet'];
            if (!solAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
                setError('Invalid Solana address');
                return;
            }
        }
        if (method === 'paypal') {
            const email = paymentDetails['email'];
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                setError('Invalid email address');
                return;
            }
        }

        setLoading(true);
        setError('');

        try {
            // Get user ID from localStorage cache
            let userId: string | undefined;
            try {
                const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    userId = parsed?.user?.id;
                }
            } catch (e) {}

            if (!userId) {
                setError('Not logged in');
                setLoading(false);
                return;
            }

            // Deduct balance first
            console.log('Fetching balance for user:', userId);
            const { data: currentBalance, error: selectError } = await supabase
                .from('balances')
                .select('balance')
                .eq('id', userId)
                .single();

            console.log('Balance result:', currentBalance, 'Error:', selectError);

            if (selectError) {
                console.error('Balance select error:', selectError);
                setError('Failed to fetch balance');
                setLoading(false);
                return;
            }

            if (!currentBalance || currentBalance.balance < amount) {
                setError('Insufficient balance');
                setLoading(false);
                return;
            }

            // Deduct full withdrawal amount (requested amount) from balance
            const { error: balanceError } = await supabase
                .from('balances')
                .update({ balance: currentBalance.balance - amount })
                .eq('id', userId);

            if (balanceError) {
                console.error('Balance update error:', balanceError);
                setError('Failed to update balance');
                setLoading(false);
                return;
            }

            // Create withdrawal request with payout amount (after 10% fee)
            const payoutAmount = youReceive;
            const paymentDetailsString = JSON.stringify({ method, ...paymentDetails });

            const { error: withdrawError } = await supabase.from('withdrawal_requests').insert({
                user_id: userId,
                amount: payoutAmount, // Amount user will receive (after fee)
                payment_method: paymentDetailsString,
                status: 'pending',
            });

            if (withdrawError) {
                console.error('Withdrawal request error:', withdrawError);
                // Don't fail - balance already deducted, just log it
            }

            // Record transaction (negative full amount deducted from balance)
            const { error: txError } = await supabase.from('transactions').insert({
                user_id: userId,
                amount: -amount,
                type: 'withdrawal',
            });

            if (txError) {
                console.error('Transaction record error:', txError);
            }

            setSuccess(true);
        } catch (err) {
            setError('Failed to process withdrawal');
        }

        setLoading(false);
    }

    if (success) {
        return (
            <div style={depositStyles.overlay} onClick={onClose}>
                <div style={depositStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <Text style={depositStyles.title}>Withdrawal Requested</Text>
                    <Space size="m" />
                    <Text style={{ color: '#22c55e', textAlign: 'center', fontWeight: 'bold' }}>
                        You will receive ${youReceive}
                    </Text>
                    <Space size="xs" />
                    <Text style={{ color: '#888', textAlign: 'center', fontSize: 12 }}>
                        (${amount} withdrawal - ${fee} fee = ${youReceive})
                    </Text>
                    <Space size="s" />
                    <Text style={{ color: '#888', textAlign: 'center', fontSize: 14 }}>
                        {selectedMethod.description}
                    </Text>
                    <Space size="m" />
                    <button className="btn-3d" onClick={onSuccess}>
                        <span className="btn-3d-top">DONE</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={depositStyles.overlay} onClick={onClose}>
            <div style={depositStyles.modal} onClick={(e) => e.stopPropagation()}>
                <Text style={depositStyles.title}>Withdraw Credits</Text>
                <Space size="m" />

                <Text style={depositStyles.label}>Withdrawal Amount (max: ${balance})</Text>
                <Space size="s" />
                <input
                    type="number"
                    min="1"
                    max={balance}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={depositStyles.input}
                />

                {amount > 0 && (
                    <>
                        <Space size="s" />
                        <View style={withdrawStyles.feeBreakdown}>
                            <View style={withdrawStyles.feeRow}>
                                <Text style={withdrawStyles.feeLabel}>Withdrawal amount:</Text>
                                <Text style={withdrawStyles.feeValue}>${amount}</Text>
                            </View>
                            <View style={withdrawStyles.feeRow}>
                                <Text style={withdrawStyles.feeLabel}>Platform fee ({WITHDRAWAL_FEE_PERCENT}%):</Text>
                                <Text style={withdrawStyles.feeValue}>-${fee}</Text>
                            </View>
                            <View style={{ ...withdrawStyles.feeRow, borderTop: '1px solid #333', paddingTop: 8, marginTop: 8 }}>
                                <Text style={{ ...withdrawStyles.feeLabel, fontWeight: 'bold', color: '#39ff14' }}>You receive:</Text>
                                <Text style={{ ...withdrawStyles.feeValue, fontWeight: 'bold', color: '#39ff14' }}>${youReceive}</Text>
                            </View>
                        </View>
                    </>
                )}

                <Space size="m" />

                <Text style={depositStyles.label}>Payment Method</Text>
                <Space size="s" />
                <View style={withdrawStyles.methodGrid}>
                    {paymentMethods.map((m) => (
                        <button
                            key={m.id}
                            style={{
                                ...withdrawStyles.methodButton,
                                backgroundColor: method === m.id ? '#39ff14' : '#222',
                                color: method === m.id ? '#000' : '#fff',
                                borderColor: method === m.id ? '#39ff14' : '#333',
                            }}
                            onClick={() => {
                                setMethod(m.id);
                                setPaymentDetails({});
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </View>

                <Space size="m" />

                <Text style={depositStyles.label}>{selectedMethod.label} Details</Text>
                <Space size="s" />
                {selectedMethod.fields.map((field) => (
                    <React.Fragment key={field.name}>
                        <input
                            type={field.type || 'text'}
                            placeholder={field.placeholder}
                            value={paymentDetails[field.name] || ''}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, [field.name]: e.target.value })}
                            style={depositStyles.input}
                        />
                        <Space size="xs" />
                    </React.Fragment>
                ))}
                <Text style={{ color: '#666', fontSize: 12 }}>{selectedMethod.description}</Text>

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={depositStyles.error}>{error}</Text>
                    </>
                )}

                <Space size="m" />

                <button className="btn-3d" onClick={handleWithdraw} disabled={loading || amount < 1 || youReceive < 1}>
                    <span className="btn-3d-top">
                        {loading ? 'Processing...' : `WITHDRAW $${amount} (Receive $${youReceive})`}
                    </span>
                </button>
            </div>
        </div>
    );
}

const withdrawStyles: { [key: string]: React.CSSProperties } = {
    methodGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
    },
    methodButton: {
        padding: '12px 8px',
        border: '1px solid #333',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: 13,
        textAlign: 'center',
    },
    feeBreakdown: {
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: isMobile ? 12 : 16,
    },
    feeRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    feeLabel: {
        fontSize: isMobile ? 13 : 14,
        color: '#888',
    },
    feeValue: {
        fontSize: isMobile ? 13 : 14,
        color: '#fff',
        fontWeight: 'bold',
    },
};

const styles: { [key: string]: React.CSSProperties } = {
    promoBanner: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: isMobile ? 40 : 50,
        backgroundColor: '#39ff14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
    },
    promoBannerText: {
        fontSize: isMobile ? 13 : 16,
        fontWeight: 'bold',
        color: '#000',
        textAlign: 'center',
        padding: '0 16px',
    },
    navbar: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: isMobile ? 60 : 80,
        backgroundColor: '#000',
        borderBottom: '1px solid #222',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 32px',
        zIndex: 1000,
    },
    // ==== Authenticated sidebar layout ====
    appShell: {
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
        backgroundColor: '#000',
    },
    sidebar: {
        width: isMobile ? '100%' : 240,
        minWidth: isMobile ? 'auto' : 240,
        height: isMobile ? 'auto' : '100vh',
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        backgroundColor: '#0a0a0a',
        borderRight: isMobile ? 'none' : '1px solid #1f1f1f',
        borderBottom: isMobile ? '1px solid #1f1f1f' : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? 20 : 28,
        overflowY: 'auto',
        boxSizing: 'border-box',
    },
    sidebarLogo: {
        fontSize: isMobile ? 28 : 36,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    sidebarBalance: {
        backgroundColor: 'rgba(57, 255, 20, 0.08)',
        border: '1px solid rgba(57, 255, 20, 0.35)',
        borderRadius: 10,
        padding: isMobile ? '10px 14px' : '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    sidebarBalanceLabel: {
        fontSize: 10,
        color: '#666',
        letterSpacing: 1.5,
    },
    sidebarBalanceValue: {
        fontSize: isMobile ? 20 : 24,
        fontWeight: 'bold',
        color: '#39ff14',
    },
    sidebarCoinsCard: {
        backgroundColor: 'rgba(245, 197, 24, 0.08)',
        border: '1px solid rgba(245, 197, 24, 0.35)',
        borderRadius: 10,
        padding: isMobile ? '10px 14px' : '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    sidebarCoinsCardValue: {
        fontSize: isMobile ? 20 : 24,
        fontWeight: 'bold',
        color: '#f5c518',
    },
    sidebarNav: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    sidebarNavItem: {
        textAlign: 'left',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        color: '#888',
        fontSize: 15,
        fontWeight: 600,
        padding: '12px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background-color 0.15s, color 0.15s',
    },
    sidebarNavItemActive: {
        backgroundColor: '#111',
        color: '#39ff14',
    },
    sidebarLogout: {
        background: 'none',
        border: '1px solid #333',
        color: '#888',
        fontSize: 13,
        fontWeight: 'bold',
        padding: '10px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        letterSpacing: 1,
        transition: 'color 0.15s, border-color 0.15s',
    },
    mainArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
    },
    topBar: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: isMobile ? 56 : 68,
        padding: isMobile ? '0 16px' : '0 32px',
        borderBottom: '1px solid #1f1f1f',
        backgroundColor: '#0a0a0a',
    },
    topBarUser: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 6,
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background-color 0.15s',
    },
    topBarUserName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
    },
    topBarAvatar: {
        width: isMobile ? 32 : 36,
        height: isMobile ? 32 : 36,
        borderRadius: '50%',
        backgroundColor: '#39ff14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarAvatarText: {
        color: '#000',
        fontSize: isMobile ? 14 : 16,
        fontWeight: 'bold',
    },
    mainContent: {
        flex: 1,
        padding: isMobile ? 20 : 40,
        overflowY: 'auto',
    },
    pageContainer: {
        width: '100%',
    },
    pageTitle: {
        fontSize: isMobile ? 28 : 40,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    pageSubtitle: {
        fontSize: isMobile ? 14 : 15,
        color: '#d4d4d4',
        lineHeight: 1.4,
    },
    claimCard: {
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 16,
        backgroundColor: 'rgba(245, 197, 24, 0.08)',
        border: '1px solid rgba(245, 197, 24, 0.35)',
        borderRadius: 12,
        padding: isMobile ? 16 : 20,
    },
    claimCardLeft: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    claimCoinIcon: {
        fontSize: isMobile ? 32 : 40,
    },
    claimTitle: {
        fontSize: isMobile ? 16 : 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    claimSubtitle: {
        fontSize: 13,
        color: '#aaa',
    },
    navbarTitle: {
        fontSize: isMobile ? 20 : 28,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    navbarRight: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: isMobile ? 8 : 12,
    },
    balanceContainer2: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        border: '1px solid #333',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    balanceValue2: {
        fontSize: isMobile ? 16 : 20,
        fontWeight: 'bold',
        color: '#fff',
        padding: isMobile ? '8px 12px' : '10px 16px',
    },
    depositButton: {
        backgroundColor: '#39ff14',
        color: '#000',
        fontWeight: 'bold',
        fontSize: isMobile ? 12 : 14,
        padding: isMobile ? '0 12px' : '0 16px',
        border: 'none',
        borderLeft: '1px solid #1a7a0f',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
    },
    profileIconButton: {
        width: isMobile ? 40 : 48,
        height: isMobile ? 40 : 48,
        borderRadius: '50%',
        border: '1px solid #333',
        backgroundColor: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
    },
    profileIcon: {
        width: isMobile ? 20 : 24,
        height: isMobile ? 20 : 24,
        color: '#fff',
    },
    tagline: {
        fontSize: isMobile ? 14 : 18,
        color: '#fff',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    mainHeading: {
        fontSize: isMobile ? 32 : 56,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: -1,
    },
    title: {
        fontSize: isMobile ? 36 : 64,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -2,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: isMobile ? 14 : 24,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        color: '#fff',
        opacity: 0.9,
        textAlign: 'center',
    },
    description: {
        fontSize: isMobile ? 16 : 20,
        color: '#fff',
        textAlign: 'center',
        padding: isMobile ? '0 16px' : 0,
    },
    gamesGrid: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 12 : 20,
        paddingLeft: isMobile ? 12 : 24,
        paddingRight: isMobile ? 12 : 24,
        width: '100%',
        maxWidth: isMobile ? 600 : 900,
    },
    gameCard: {
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 8,
        padding: isMobile ? 14 : 18,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'center' : 'stretch',
        gap: isMobile ? 16 : 20,
        width: '100%',
        boxSizing: 'border-box',
    },
    gameImage: {
        width: isMobile ? '100%' : 500,
        height: isMobile ? 200 : 350,
        objectFit: 'cover' as const,
        borderRadius: 8,
    },
    gameImagePlaceholder: {
        width: '100%',
        height: isMobile ? 180 : 240,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    playingForText: {
        fontSize: isMobile ? 18 : 24,
        fontFamily: '"Zen Dots", sans-serif',
        color: '#888',
        letterSpacing: 2,
    },
    playingForAmount: {
        fontSize: isMobile ? 48 : 72,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#39ff14',
    },
    placeholderIcon: {
        fontSize: isMobile ? 64 : 96,
        opacity: 0.5,
    },
    gameCardContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'center' : 'flex-start',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        minWidth: 0,
    },
    gameTitleRow: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    gameTitle: {
        fontSize: isMobile ? 24 : 32,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    gameDescription: {
        fontSize: isMobile ? 13 : 15,
        color: '#fff',
        lineHeight: 1.5,
        textAlign: isMobile ? 'center' : 'left',
    },
    statusText: {
        color: '#888',
        fontSize: isMobile ? 12 : 14,
    },
    livePlayersContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? '8px 12px' : '10px 16px',
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 8,
        alignSelf: 'stretch',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    },
    livePlayersText: {
        color: '#fff',
        fontSize: isMobile ? 13 : 15,
        fontWeight: 'bold',
    },
    greenDot: {
        display: 'inline-block',
        filter: 'drop-shadow(0 0 3px rgba(57, 255, 20, 0.4))',
    },
    comingSoon: {
        fontSize: isMobile ? 14 : 18,
        fontFamily: '"Zen Dots", sans-serif',
        color: '#fff',
        letterSpacing: 2,
    },
    comingSoonLarge: {
        fontSize: isMobile ? 20 : 28,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
        textAlign: 'center',
    },
    footer: {
        fontSize: isMobile ? 12 : 14,
        color: '#444',
        textAlign: 'center',
        padding: isMobile ? '0 16px' : 0,
    },
    telegramButton: {
        position: 'fixed',
        bottom: isMobile ? 20 : 32,
        right: isMobile ? 20 : 32,
        backgroundColor: '#0088cc',
        color: '#fff',
        padding: isMobile ? '12px 16px' : '14px 20px',
        borderRadius: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textDecoration: 'none',
        boxShadow: '0 4px 12px rgba(0, 136, 204, 0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        zIndex: 999,
        fontWeight: 'bold',
        fontSize: isMobile ? 13 : 14,
        cursor: 'pointer',
        animation: 'telegramPulse 2s infinite',
    },
    telegramIcon: {
        fontSize: isMobile ? 18 : 20,
    },
    telegramText: {
        display: isMobile ? 'none' : 'block',
    },
    faqSection: {
        width: '100%',
        maxWidth: isMobile ? 600 : 900,
        padding: isMobile ? '0 12px' : '0 24px',
    },
    faqTitle: {
        fontSize: isMobile ? 24 : 32,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    faqList: {
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 12 : 16,
    },
    faqItem: {
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 8,
        overflow: 'hidden',
    },
    faqQuestion: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '16px' : '20px',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    faqQuestionText: {
        fontSize: isMobile ? 16 : 18,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'left',
    },
    faqIcon: {
        fontSize: isMobile ? 24 : 28,
        color: '#39ff14',
        fontWeight: 'bold',
    },
    faqAnswer: {
        padding: isMobile ? '12px 16px 16px 16px' : '16px 20px 20px 20px',
        borderTop: '1px solid #222',
    },
    faqAnswerText: {
        fontSize: isMobile ? 14 : 16,
        color: '#ccc',
        lineHeight: 1.6,
    },
    balanceValue: {
        fontSize: isMobile ? 18 : 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    navButton: {
        width: 'auto',
        minWidth: isMobile ? 80 : 100,
    },
    balanceContainer: {
        position: 'fixed',
        top: isMobile ? 12 : 24,
        right: isMobile ? 12 : 24,
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 8,
        padding: isMobile ? '12px 16px' : '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 8 : 12,
        zIndex: 100,
    },
    balanceInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 12,
    },
    balanceLabel: {
        color: '#888',
        fontSize: isMobile ? 10 : 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    balanceText: {
        color: '#39ff14',
        fontSize: isMobile ? 18 : 24,
        fontWeight: 'bold',
    },
    balanceButtons: {
        display: 'flex',
        gap: 8,
        width: '100%',
    },
    balanceButton: {
        flex: 1,
    },
    logoutButton: {
        background: 'none',
        border: 'none',
        color: '#666',
        fontSize: isMobile ? 10 : 12,
        cursor: 'pointer',
        marginTop: 4,
    },
    betSelector: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: '100%',
    },
    betLabel: {
        color: '#888',
        fontSize: isMobile ? 10 : 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    betOptions: {
        display: 'flex',
        gap: 8,
        width: '100%',
    },
    betButton: {
        flex: 1,
        padding: isMobile ? '10px 8px' : '12px 16px',
        border: '1px solid #333',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: isMobile ? 14 : 16,
        textAlign: 'center',
    },
    noBotsText: {
        fontSize: isMobile ? 16 : 20,
        color: '#888',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    overlayTitle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: isMobile ? 36 : 56,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -2,
    },
};

// Leaderboard Modal
interface LeaderboardEntry {
    winner_id: string;
    display_name: string;
    total_winnings: number;
    games_won: number;
}

// ============================================
// Sidebar page: Leaderboard (inline, no overlay)
// ============================================
function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaderboard() {
            try {
                const { data, error } = await supabase
                    .from('game_history')
                    .select('winner_id, amount')
                    .order('ended_at', { ascending: false })
                    .limit(100);

                if (error) {
                    console.error('Leaderboard error:', error);
                    setLoading(false);
                    return;
                }

                const aggregated: { [key: string]: LeaderboardEntry } = {};
                data?.forEach((game) => {
                    if (!aggregated[game.winner_id]) {
                        aggregated[game.winner_id] = {
                            winner_id: game.winner_id,
                            display_name: '',
                            total_winnings: 0,
                            games_won: 0,
                        };
                    }
                    aggregated[game.winner_id].total_winnings += game.amount;
                    aggregated[game.winner_id].games_won += 1;
                });

                const sorted = Object.values(aggregated)
                    .sort((a, b) => b.total_winnings - a.total_winnings)
                    .slice(0, 10);

                const userIds = sorted.map((e) => e.winner_id);
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', userIds);

                    const usernameMap: { [key: string]: string } = {};
                    profiles?.forEach((p) => {
                        usernameMap[p.id] = p.username;
                    });

                    sorted.forEach((entry) => {
                        entry.display_name = usernameMap[entry.winner_id] || `Player ${entry.winner_id.slice(0, 6)}`;
                    });
                }

                setEntries(sorted);
            } catch (err) {
                console.error('Leaderboard fetch error:', err);
            }
            setLoading(false);
        }

        fetchLeaderboard();
    }, []);

    if (loading) return <Text style={{ color: '#666' }}>Loading...</Text>;
    if (entries.length === 0) return <Text style={{ color: '#666' }}>No games played yet. Be the first!</Text>;

    return (
        <View style={leaderboardStyles.table}>
            <View style={leaderboardStyles.headerRow}>
                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.rankCell }}>#</Text>
                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.nameCell }}>Player</Text>
                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.winsCell }}>Wins</Text>
                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.earningsCell }}>Earnings</Text>
            </View>
            {entries.map((entry, index) => (
                <View key={entry.winner_id} style={{
                    ...leaderboardStyles.row,
                    backgroundColor: index === 0 ? 'rgba(57, 255, 20, 0.1)' : 'transparent',
                }}>
                    <Text style={{
                        ...leaderboardStyles.cell,
                        ...leaderboardStyles.rankCell,
                        color: index === 0 ? '#39ff14' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#888',
                    }}>
                        {index + 1}
                    </Text>
                    <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.nameCell, color: '#fff' }}>
                        {entry.display_name}
                    </Text>
                    <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.winsCell }}>
                        {entry.games_won}
                    </Text>
                    <Text style={{
                        ...leaderboardStyles.cell,
                        ...leaderboardStyles.earningsCell,
                        color: '#4ade80',
                    }}>
                        ${entry.total_winnings}
                    </Text>
                </View>
            ))}
        </View>
    );
}

// ============================================
// Sidebar page: Performance (stats + history)
// ============================================
interface PerformanceGame {
    id: string;
    winner_id: string;
    loser_id: string;
    amount: number;
    ended_at: string;
    game?: string;
    isWin: boolean;
}

function PerformancePage({ userId }: { userId: string }) {
    const [loading, setLoading] = useState(true);
    const [games, setGames] = useState<PerformanceGame[]>([]);
    const [stats, setStats] = useState({ totalGames: 0, wins: 0, losses: 0, winRate: 0, totalEarnings: 0 });
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [shareGame, setShareGame] = useState<PerformanceGame | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const { data } = await supabase
                    .from('game_history')
                    .select('*')
                    .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
                    .order('ended_at', { ascending: false })
                    .limit(20);

                if (data) {
                    const history: PerformanceGame[] = data.map((g: any) => ({ ...g, isWin: g.winner_id === userId }));
                    setGames(history);
                    const wins = history.filter((g) => g.isWin).length;
                    const losses = history.filter((g) => !g.isWin).length;
                    const totalGames = wins + losses;
                    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
                    const totalEarnings = history.reduce((sum, g) => sum + (g.isWin ? g.amount : -g.amount), 0);
                    setStats({ totalGames, wins, losses, winRate, totalEarnings });
                }
            } catch (err) {
                console.error('Performance fetch error:', err);
            }
            setLoading(false);
        }
        load();
    }, [userId]);

    if (loading) return <Text style={{ color: '#666' }}>Loading...</Text>;

    return (
        <View>
            <View style={perfStyles.statsRow}>
                <View style={perfStyles.statCard}>
                    <Text style={perfStyles.statLabel}>GAMES</Text>
                    <Text style={perfStyles.statValue}>{stats.totalGames}</Text>
                </View>
                <View style={perfStyles.statCard}>
                    <Text style={perfStyles.statLabel}>WINS</Text>
                    <Text style={{ ...perfStyles.statValue, color: '#39ff14' }}>{stats.wins}</Text>
                </View>
                <View style={perfStyles.statCard}>
                    <Text style={perfStyles.statLabel}>LOSSES</Text>
                    <Text style={{ ...perfStyles.statValue, color: '#ff4444' }}>{stats.losses}</Text>
                </View>
                <View style={perfStyles.statCard}>
                    <Text style={perfStyles.statLabel}>WIN RATE</Text>
                    <Text style={perfStyles.statValue}>{stats.winRate.toFixed(0)}%</Text>
                </View>
                <View style={perfStyles.statCard}>
                    <Text style={perfStyles.statLabel}>NET EARNINGS</Text>
                    <Text style={{ ...perfStyles.statValue, color: stats.totalEarnings >= 0 ? '#39ff14' : '#ff4444' }}>
                        {stats.totalEarnings >= 0 ? '+' : ''}${stats.totalEarnings}
                    </Text>
                </View>
            </View>

            <Space size="l" />

            <Text style={perfStyles.sectionTitle}>Recent Games</Text>
            <Space size="s" />

            {games.length === 0 ? (
                <Text style={{ color: '#666' }}>No games yet.</Text>
            ) : (
                <View style={perfStyles.historyList}>
                    {shareGame && (
                        <ShareGameModal game={shareGame} onClose={() => setShareGame(null)} />
                    )}
                    {groupGamesByDay(games).map(({ label, items }) => (
                        <View key={label} style={perfStyles.historyGroup}>
                            <Text style={perfStyles.historyDayLabel}>{label}</Text>
                            {items.map((g) => (
                                <View
                                    key={g.id}
                                    style={{ ...perfStyles.historyRow, position: 'relative' }}
                                    onMouseEnter={() => setHoveredId(g.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    <View style={perfStyles.gamePill}>
                                        <Text style={perfStyles.gamePillText}>
                                            {formatGameName(g.game)}
                                        </Text>
                                    </View>
                                    <Text style={{ color: '#888', flex: 1, marginLeft: 12 }}>
                                        {formatTime(g.ended_at)}
                                    </Text>
                                    <Text style={{ color: g.isWin ? '#39ff14' : '#ff4444', fontWeight: 'bold' }}>
                                        {g.isWin ? '+' : '-'}${g.amount}
                                    </Text>

                                    {hoveredId === g.id && (
                                        <View style={perfStyles.hoverOverlay}>
                                            <button
                                                style={perfStyles.shareButton}
                                                onClick={() => setShareGame(g)}
                                            >
                                                <span>↗</span>
                                                <span>Share</span>
                                            </button>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

function formatGameName(game?: string): string {
    switch (game) {
        case 'wasteland': return 'Wasteland';
        case 'gladiatorz':
        default: return 'Gladiatorz';
    }
}

// "Today" / "Yesterday" / "Mon, Mar 15" relative to local time
function formatDayLabel(dateIso: string): string {
    const d = new Date(dateIso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(today) - startOf(d)) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// "2:45 PM" (or local 24h format)
function formatTime(dateIso: string): string {
    return new Date(dateIso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Preserve order (games already sorted desc by ended_at when queried)
function groupGamesByDay(games: PerformanceGame[]): Array<{ label: string; items: PerformanceGame[] }> {
    const groups: Array<{ label: string; items: PerformanceGame[] }> = [];
    for (const g of games) {
        const label = formatDayLabel(g.ended_at);
        const last = groups[groups.length - 1];
        if (last && last.label === label) {
            last.items.push(g);
        } else {
            groups.push({ label, items: [g] });
        }
    }
    return groups;
}

// ============================================
// Share-game modal (opened from hover overlay)
// ============================================
function ShareGameModal({ game, onClose }: { game: PerformanceGame; onClose: () => void }) {
    const [copied, setCopied] = useState(false);

    const gameName = formatGameName(game.game);
    const amountStr = `$${game.amount}`;
    const siteUrl = 'https://hard2kill.me';

    const shareText = game.isWin
        ? `Just won ${amountStr} in ${gameName} on HARD2KILL 🎮 ${siteUrl}`
        : `Took an L (${amountStr}) in ${gameName} on HARD2KILL. Come try to beat me. ${siteUrl}`;

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Copy failed', err);
        }
    }

    function handleTwitter() {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    return (
        <div style={depositStyles.overlay} onClick={onClose}>
            <div style={{ ...depositStyles.modal, minWidth: isMobile ? 'auto' : 420 }} onClick={(e) => e.stopPropagation()}>
                <Text style={depositStyles.title}>Share this game</Text>
                <Space size="m" />

                {/* Recap card */}
                <View style={shareStyles.recap}>
                    <View style={shareStyles.recapHeader}>
                        <View style={perfStyles.gamePill}>
                            <Text style={perfStyles.gamePillText}>{gameName}</Text>
                        </View>
                        <Text style={shareStyles.recapDate}>
                            {new Date(game.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                    <Space size="s" />
                    <Text style={{
                        ...shareStyles.recapAmount,
                        color: game.isWin ? '#39ff14' : '#ff4444',
                    }}>
                        {game.isWin ? '+' : '-'}{amountStr}
                    </Text>
                    <Text style={shareStyles.recapLabel}>
                        {game.isWin ? 'Won' : 'Lost'} on HARD2KILL
                    </Text>
                </View>

                <Space size="m" />
                <Text style={{ color: '#888', fontSize: 13 }}>Preview</Text>
                <Space size="xs" />
                <View style={shareStyles.textPreview}>
                    <Text style={{ color: '#ddd', fontSize: 13, lineHeight: 1.5 }}>{shareText}</Text>
                </View>

                <Space size="m" />

                <View style={shareStyles.actions}>
                    <button className="btn-3d" onClick={handleTwitter} style={{ flex: 1 }}>
                        <span className="btn-3d-top">SHARE ON X</span>
                    </button>
                    <button
                        className="btn-3d btn-3d-secondary"
                        onClick={handleCopy}
                        style={{ flex: 1 }}
                    >
                        <span className="btn-3d-top btn-3d-top-secondary">
                            {copied ? 'COPIED!' : 'COPY TEXT'}
                        </span>
                    </button>
                </View>

                <Space size="s" />
                <button
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#666',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: 8,
                        fontFamily: 'inherit',
                    }}
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

const shareStyles: { [key: string]: React.CSSProperties } = {
    recap: {
        backgroundColor: '#0a0a0a',
        border: '1px solid #222',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
    },
    recapHeader: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    recapDate: {
        color: '#666',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    recapAmount: {
        fontSize: 48,
        fontWeight: 'bold',
        fontFamily: '"Zen Dots", sans-serif',
        letterSpacing: -1,
    },
    recapLabel: {
        color: '#888',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    textPreview: {
        backgroundColor: '#0a0a0a',
        border: '1px solid #222',
        borderRadius: 8,
        padding: 12,
    },
    actions: {
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
    },
};

const perfStyles: { [key: string]: React.CSSProperties } = {
    statsRow: {
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
        gap: 12,
    },
    statCard: {
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 10,
        padding: isMobile ? 14 : 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    statLabel: {
        fontSize: 11,
        color: '#666',
        letterSpacing: 1,
    },
    statValue: {
        fontSize: isMobile ? 20 : 26,
        fontWeight: 'bold',
        color: '#fff',
    },
    sectionTitle: {
        fontSize: isMobile ? 16 : 18,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    historyList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    },
    historyGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    historyDayLabel: {
        fontSize: 12,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    historyRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        border: '1px solid #222',
        borderRadius: 8,
        padding: '12px 16px',
    },
    gamePill: {
        padding: '4px 10px',
        borderRadius: 4,
        backgroundColor: '#1a1a1a',
        border: '1px solid #2a2a2a',
    },
    hoverOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        paddingRight: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        background: 'linear-gradient(to left, rgba(17,17,17,0.98) 60%, rgba(17,17,17,0))',
        borderRadius: 8,
    },
    shareButton: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#39ff14',
        color: '#000',
        border: 'none',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 'bold',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    gamePillText: {
        fontSize: 11,
        color: '#bbb',
        letterSpacing: 0.3,
        fontWeight: 600,
    },
};

// ============================================
// Sidebar page: Wallet
// ============================================
// ============================================
// Currency toggle (Cash / Coins)
// ============================================
function CurrencyToggle({
    value,
    onChange,
    disabled,
}: {
    value: 'cash' | 'coins';
    onChange: (v: 'cash' | 'coins') => void;
    disabled?: boolean;
}) {
    const options: Array<{ id: 'cash' | 'coins'; label: string }> = [
        { id: 'cash', label: '$ Cash' },
        { id: 'coins', label: '🪙 Coins' },
    ];
    return (
        <View style={currencyToggleStyles.container}>
            {options.map((opt) => (
                <button
                    key={opt.id}
                    style={{
                        ...currencyToggleStyles.button,
                        backgroundColor: value === opt.id ? '#39ff14' : 'transparent',
                        color: value === opt.id ? '#000' : '#aaa',
                    }}
                    onClick={() => onChange(opt.id)}
                    disabled={disabled}
                >
                    {opt.label}
                </button>
            ))}
        </View>
    );
}

const currencyToggleStyles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'inline-flex',
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        alignSelf: 'flex-start',
    },
    button: {
        border: 'none',
        outline: 'none',
        padding: '6px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'inherit',
        transition: 'background-color 0.15s, color 0.15s',
    },
};

interface WithdrawalRecord {
    id: string;
    amount: number;
    payment_method: string;
    status: string;
    created_at: string;
}

function WalletPage({
    userId,
    balance,
    onDeposit,
    onWithdraw,
}: {
    userId: string;
    balance: number | null;
    onDeposit: () => void;
    onWithdraw: () => void;
}) {
    const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[] | null>(null);

    useEffect(() => {
        async function load() {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select('id, amount, payment_method, status, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Withdrawals fetch error:', error);
                setWithdrawals([]);
                return;
            }
            setWithdrawals(data || []);
        }
        load();
    }, [userId]);

    return (
        <View>
            <View style={walletStyles.balanceCard}>
                <Text style={walletStyles.balanceLabel}>CURRENT BALANCE</Text>
                <Space size="xs" />
                <Text style={walletStyles.balanceValue}>
                    ${balance !== null ? balance.toLocaleString('en-US') : '...'}
                </Text>
            </View>

            <Space size="l" />

            <View style={walletStyles.actionsRow}>
                <button className="btn-3d" onClick={onDeposit}>
                    <span className="btn-3d-top">DEPOSIT</span>
                </button>
                <button className="btn-3d btn-3d-secondary" onClick={onWithdraw}>
                    <span className="btn-3d-top btn-3d-top-secondary">WITHDRAW</span>
                </button>
            </View>

            <Space size="l" />

            <Text style={walletStyles.sectionTitle}>Withdrawal history</Text>
            <Space size="s" />

            {withdrawals === null ? (
                <Text style={{ color: '#666' }}>Loading...</Text>
            ) : withdrawals.length === 0 ? (
                <Text style={{ color: '#666' }}>No withdrawal requests yet.</Text>
            ) : (
                <View style={walletStyles.historyList}>
                    {withdrawals.map((w) => {
                        const method = parseWithdrawalMethod(w.payment_method);
                        const statusStyle = statusToStyle(w.status);
                        return (
                            <View key={w.id} style={walletStyles.historyRow}>
                                <View style={{ ...walletStyles.statusBadge, backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: statusStyle.color, letterSpacing: 0.5 }}>
                                        {w.status.toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 16, display: 'flex', flexDirection: 'column' }}>
                                    <Text style={{ color: '#fff', fontWeight: 600 }}>{method}</Text>
                                    <Text style={{ color: '#888', fontSize: 12 }}>
                                        {new Date(w.created_at).toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={{ color: '#39ff14', fontWeight: 'bold' }}>
                                    ${w.amount.toLocaleString('en-US')}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

// Parse the JSON `payment_method` string and return a short human-readable label
function parseWithdrawalMethod(raw: string): string {
    try {
        const parsed = JSON.parse(raw);
        const method = parsed.method || 'unknown';
        const labels: Record<string, string> = {
            paypal: 'PayPal',
            ethereum: 'Ethereum',
            solana: 'Solana',
            bank: 'Bank transfer',
        };
        return labels[method] || method.charAt(0).toUpperCase() + method.slice(1);
    } catch {
        return 'Unknown method';
    }
}

function statusToStyle(status: string): { bg: string; color: string } {
    switch (status) {
        case 'completed':
        case 'paid':
            return { bg: 'rgba(57, 255, 20, 0.15)', color: '#39ff14' };
        case 'rejected':
        case 'failed':
        case 'cancelled':
            return { bg: 'rgba(255, 68, 68, 0.15)', color: '#ff4444' };
        case 'pending':
        default:
            return { bg: 'rgba(245, 197, 24, 0.15)', color: '#f5c518' };
    }
}

const walletStyles: { [key: string]: React.CSSProperties } = {
    balanceCard: {
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 12,
        padding: isMobile ? 24 : 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    balanceLabel: {
        fontSize: 12,
        color: '#666',
        letterSpacing: 2,
    },
    balanceValue: {
        fontSize: isMobile ? 40 : 56,
        fontWeight: 'bold',
        fontFamily: '"Zen Dots", sans-serif',
        color: '#39ff14',
    },
    actionsRow: {
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap',
    },
    sectionTitle: {
        fontSize: isMobile ? 16 : 18,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    historyList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    historyRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        border: '1px solid #222',
        borderRadius: 8,
        padding: '12px 16px',
    },
    statusBadge: {
        padding: '4px 10px',
        borderRadius: 4,
        minWidth: 84,
        textAlign: 'center',
    },
};

function LeaderboardModal({ onClose }: { onClose: () => void }) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaderboard() {
            try {
                const { data, error } = await supabase
                    .from('game_history')
                    .select('winner_id, amount')
                    .order('ended_at', { ascending: false })
                    .limit(100);

                if (error) {
                    console.error('Leaderboard error:', error);
                    setLoading(false);
                    return;
                }

                const aggregated: { [key: string]: LeaderboardEntry } = {};
                data?.forEach((game) => {
                    if (!aggregated[game.winner_id]) {
                        aggregated[game.winner_id] = {
                            winner_id: game.winner_id,
                            display_name: '',
                            total_winnings: 0,
                            games_won: 0,
                        };
                    }
                    aggregated[game.winner_id].total_winnings += game.amount;
                    aggregated[game.winner_id].games_won += 1;
                });

                const sorted = Object.values(aggregated)
                    .sort((a, b) => b.total_winnings - a.total_winnings)
                    .slice(0, 10);

                const userIds = sorted.map(e => e.winner_id);
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', userIds);

                    const usernameMap: { [key: string]: string } = {};
                    profiles?.forEach(p => {
                        usernameMap[p.id] = p.username;
                    });

                    sorted.forEach(entry => {
                        entry.display_name = usernameMap[entry.winner_id] || `Player ${entry.winner_id.slice(0, 6)}`;
                    });
                }

                setEntries(sorted);
            } catch (err) {
                console.error('Leaderboard fetch error:', err);
            }
            setLoading(false);
        }

        fetchLeaderboard();
    }, []);

    return (
        <div style={depositStyles.overlay} onClick={onClose}>
            <div style={{ ...depositStyles.modal, minWidth: isMobile ? 'auto' : 500 }} onClick={(e) => e.stopPropagation()}>
                <Text style={depositStyles.title}>LEADERBOARD</Text>
                <Space size="m" />

                {loading ? (
                    <Text style={{ color: '#666', textAlign: 'center' }}>Loading...</Text>
                ) : entries.length === 0 ? (
                    <Text style={{ color: '#666', textAlign: 'center' }}>No games played yet. Be the first!</Text>
                ) : (
                    <View style={leaderboardStyles.table}>
                        <View style={leaderboardStyles.headerRow}>
                            <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.rankCell }}>#</Text>
                            <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.nameCell }}>Player</Text>
                            <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.winsCell }}>Wins</Text>
                            <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.earningsCell }}>Earnings</Text>
                        </View>
                        {entries.map((entry, index) => (
                            <View key={entry.winner_id} style={{
                                ...leaderboardStyles.row,
                                backgroundColor: index === 0 ? 'rgba(57, 255, 20, 0.1)' : 'transparent',
                            }}>
                                <Text style={{
                                    ...leaderboardStyles.cell,
                                    ...leaderboardStyles.rankCell,
                                    color: index === 0 ? '#39ff14' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#888',
                                }}>
                                    {index + 1}
                                </Text>
                                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.nameCell, color: '#fff' }}>
                                    {entry.display_name}
                                </Text>
                                <Text style={{ ...leaderboardStyles.cell, ...leaderboardStyles.winsCell }}>
                                    {entry.games_won}
                                </Text>
                                <Text style={{
                                    ...leaderboardStyles.cell,
                                    ...leaderboardStyles.earningsCell,
                                    color: '#4ade80',
                                }}>
                                    ${entry.total_winnings}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                <Space size="m" />
                <button className="btn-3d btn-3d-secondary" onClick={onClose}>
                    <span className="btn-3d-top btn-3d-top-secondary">CLOSE</span>
                </button>
            </div>
        </div>
    );
}

const leaderboardStyles: { [key: string]: React.CSSProperties } = {
    container: {
        width: '100%',
        maxWidth: 800,
        padding: isMobile ? '0 16px' : 0,
    },
    title: {
        fontSize: isMobile ? 20 : 28,
        fontFamily: '"Zen Dots", sans-serif',
        color: '#fff',
        textAlign: 'center',
    },
    table: {
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 12,
        overflow: 'hidden',
    },
    headerRow: {
        display: 'flex',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        padding: isMobile ? '12px 16px' : '16px 24px',
    },
    row: {
        display: 'flex',
        padding: isMobile ? '12px 16px' : '16px 24px',
        borderBottom: '1px solid #222',
    },
    cell: {
        color: '#888',
        fontSize: isMobile ? 12 : 14,
    },
    rankCell: {
        width: isMobile ? 30 : 50,
        fontWeight: 'bold',
    },
    nameCell: {
        flex: 1,
    },
    winsCell: {
        width: isMobile ? 50 : 80,
        textAlign: 'center',
    },
    earningsCell: {
        width: isMobile ? 70 : 100,
        textAlign: 'right',
        fontWeight: 'bold',
    },
};
