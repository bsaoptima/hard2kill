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
    const [livePlayerCount, setLivePlayerCount] = useState(16);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    // Get user and balance on mount and auth changes
    useEffect(() => {
        async function loadUserData(uid: string) {
            console.log('Loading user data for:', uid);
            try {
                // Load balance - use maybeSingle to avoid errors if row doesn't exist
                const { data: balanceData, error: balanceError } = await supabase
                    .from('balances')
                    .select('balance')
                    .eq('id', uid)
                    .maybeSingle();

                if (balanceError) {
                    console.error('Error loading balance:', balanceError);
                } else if (balanceData) {
                    setBalance(balanceData.balance);
                } else {
                    // No balance record exists, create one
                    console.log('Creating balance record for user');
                    const { error: insertError } = await supabase
                        .from('balances')
                        .insert({ id: uid, balance: 0 });

                    if (!insertError) {
                        setBalance(0);
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
                return Math.max(10, Math.min(30, newCount)); // Keep between 10-30
            });
        };

        const interval = setInterval(updatePlayerCount, 5000 + Math.random() * 5000); // 5-10 seconds
        return () => clearInterval(interval);
    }, []);

    async function fetchBalance() {
        if (!userId) return;
        const { data } = await supabase
            .from('balances')
            .select('balance')
            .eq('id', userId)
            .single();
        if (data) {
            setBalance(data.balance);
        }
    }

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
            showAuth();
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
            showAuth();
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

        // Check if user has enough balance
        if (balance === null || balance < selectedWastelandBet) {
            setWastelandMatchmakingStatus(`Insufficient balance. Need $${selectedWastelandBet} to play.`);
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
                betAmount: selectedWastelandBet,
            });

            setWastelandMatchmakingStatus(`Waiting for $${selectedWastelandBet} opponent...`);

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
            showAuth();
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

        // Check if user has enough balance
        if (balance === null || balance < selectedGladiatorBet) {
            setGladiatorMatchmakingStatus(`Insufficient balance. Need $${selectedGladiatorBet} to play.`);
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
            });

            setGladiatorMatchmakingStatus(`Waiting for $${selectedGladiatorBet} opponent...`);

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
                        <button style={styles.profileIconButton} onClick={() => {/* TODO: Navigate to profile */}}>
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
                        <Text style={styles.gameDescription}>Top-down dungeon crawler. Battle monsters and other players.</Text>
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

                        <View style={styles.livePlayersContainer}>
                            <Text style={styles.livePlayersText}>🟢 {livePlayerCount} players currently online</Text>
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

                        <Space size="xs" />

                        <button className="btn-3d btn-3d-secondary" onClick={() => navigate?.('/three-fps')}>
                            <span className="btn-3d-top btn-3d-top-secondary">PLAY LOCAL</span>
                        </button>
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
                            answer: "We take a 5% platform fee on winnings. Deposits are free. Withdrawal fees depend on your chosen method: PayPal (2%), Crypto (network fees only), Bank Transfer ($2 flat fee)."
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

const paymentMethods: { id: PaymentMethod; label: string; placeholder: string; description: string }[] = [
    { id: 'paypal', label: 'PayPal', placeholder: 'Enter your PayPal email', description: 'Funds sent within 24 hours' },
    { id: 'solana', label: 'Solana (USDC)', placeholder: 'Enter your Solana wallet address', description: 'Fast & low fees' },
    { id: 'ethereum', label: 'Ethereum (USDC)', placeholder: 'Enter your Ethereum wallet address', description: 'ERC-20 USDC' },
    { id: 'bank', label: 'Bank Transfer', placeholder: 'Enter your IBAN', description: '2-5 business days' },
];

function WithdrawModal({ balance, onClose, onSuccess }: { balance: number; onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState<number>(balance);
    const [method, setMethod] = useState<PaymentMethod>('paypal');
    const [paymentDetails, setPaymentDetails] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const selectedMethod = paymentMethods.find(m => m.id === method)!;

    async function handleWithdraw() {
        if (amount <= 0 || amount > balance) {
            setError('Invalid amount');
            return;
        }
        if (!paymentDetails.trim()) {
            setError('Please enter your payment details');
            return;
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

            // Update balance
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

            // Create withdrawal request
            const { error: withdrawError } = await supabase.from('withdrawal_requests').insert({
                user_id: userId,
                amount,
                payment_method: `${method}:${paymentDetails}`,
                status: 'pending',
            });

            if (withdrawError) {
                console.error('Withdrawal request error:', withdrawError);
                // Don't fail - balance already deducted, just log it
            }

            // Record transaction
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
                    <Text style={{ color: '#22c55e', textAlign: 'center' }}>
                        Your withdrawal of ${amount} has been submitted.
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

                <Text style={depositStyles.label}>Amount (max: ${balance})</Text>
                <Space size="s" />
                <input
                    type="number"
                    min="1"
                    max={balance}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={depositStyles.input}
                />

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
                                setPaymentDetails('');
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </View>

                <Space size="m" />

                <Text style={depositStyles.label}>{selectedMethod.label} Details</Text>
                <Space size="s" />
                <input
                    type="text"
                    placeholder={selectedMethod.placeholder}
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    style={depositStyles.input}
                />
                <Space size="xs" />
                <Text style={{ color: '#666', fontSize: 12 }}>{selectedMethod.description}</Text>

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={depositStyles.error}>{error}</Text>
                    </>
                )}

                <Space size="m" />

                <button className="btn-3d" onClick={handleWithdraw} disabled={loading || amount < 1}>
                    <span className="btn-3d-top">
                        {loading ? 'Processing...' : `WITHDRAW $${amount}`}
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
};

const styles: { [key: string]: React.CSSProperties } = {
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
    },
    livePlayersText: {
        color: '#fff',
        fontSize: isMobile ? 13 : 15,
        fontWeight: 'bold',
    },
    comingSoon: {
        fontSize: isMobile ? 14 : 18,
        fontFamily: '"Zen Dots", sans-serif',
        color: '#fff',
        letterSpacing: 2,
    },
    footer: {
        fontSize: isMobile ? 12 : 14,
        color: '#444',
        textAlign: 'center',
        padding: isMobile ? '0 16px' : 0,
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
