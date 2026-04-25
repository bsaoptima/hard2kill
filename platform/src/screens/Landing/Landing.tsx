import { RouteComponentProps } from '@reach/router';
import { Client } from 'colyseus.js';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../App';
import { supabase } from '../../supabase';

// Matches the inlined WS_PORT in server/src/index.ts.
const WS_PORT = 3001;
const BET_AMOUNTS_CASH = [1, 5, 10];
const BET_AMOUNTS_COINS = [10, 50, 100];

type Currency = 'cash' | 'coins';

interface MatchHistoryRow {
    id: string;
    winner_id: string;
    loser_id: string;
    amount: number;
    currency: Currency;
    game: string;
    ended_at: string;
}

export function LandingScreen({ navigate }: RouteComponentProps): React.ReactElement {
    const { userId, showAuth } = useAuth();
    const [balance, setBalance] = useState<number | null>(null);
    const [coins, setCoins] = useState<number | null>(null);
    const [coinNextClaimAt, setCoinNextClaimAt] = useState<number>(0);
    const [, forceTick] = useState(0);
    const [claimingCoins, setClaimingCoins] = useState(false);
    const [currency, setCurrency] = useState<Currency>('cash');
    const [bet, setBet] = useState<number>(5);
    const [matchmaking, setMatchmaking] = useState(false);
    const [status, setStatus] = useState('');
    const [showDeposit, setShowDeposit] = useState(false);
    const [matchHistory, setMatchHistory] = useState<MatchHistoryRow[]>([]);
    const clientRef = useRef<Client | null>(null);
    const roomRef = useRef<any>(null);

    // Load balance + match history when userId changes
    useEffect(() => {
        if (!userId) {
            setBalance(null);
            setCoins(null);
            setCoinNextClaimAt(0);
            setMatchHistory([]);
            return;
        }
        loadUserData(userId);
    }, [userId]);

    async function loadUserData(uid: string) {
        const { data: balanceData } = await supabase
            .from('balances')
            .select('balance, coins, last_coin_claim')
            .eq('id', uid)
            .maybeSingle();

        if (balanceData) {
            setBalance(balanceData.balance ?? 0);
            setCoins(balanceData.coins ?? 0);
            const lastClaim = balanceData.last_coin_claim
                ? new Date(balanceData.last_coin_claim).getTime()
                : 0;
            setCoinNextClaimAt(lastClaim ? lastClaim + 60 * 60 * 1000 : 0);
        } else {
            await supabase.from('balances').insert({ id: uid });
            setBalance(0);
            setCoins(0);
        }

        const { data: history } = await supabase
            .from('game_history')
            .select('id, winner_id, loser_id, amount, currency, game, ended_at')
            .or(`winner_id.eq.${uid},loser_id.eq.${uid}`)
            .order('ended_at', { ascending: false })
            .limit(10);

        setMatchHistory((history as MatchHistoryRow[]) || []);
    }

    // Re-render every second so the coin-claim cooldown ticks down.
    useEffect(() => {
        const i = setInterval(() => forceTick((x) => x + 1), 1000);
        return () => clearInterval(i);
    }, []);

    // Reset bet to a sensible default when currency switches.
    useEffect(() => {
        setBet(currency === 'cash' ? 5 : 50);
    }, [currency]);

    async function handleClaimCoins() {
        if (!userId) {
            showAuth('Login to claim coins');
            return;
        }
        if (claimingCoins || coinNextClaimAt > Date.now()) return;
        setClaimingCoins(true);
        try {
            const res = await fetch('/api/claim-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (data.success) {
                setCoins(data.coins);
                setCoinNextClaimAt(data.nextClaimAt);
            }
        } finally {
            setClaimingCoins(false);
        }
    }

    async function handleDeposit(amount: number) {
        if (!userId) {
            showAuth('Login to deposit');
            return;
        }
        const res = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
    }

    async function cancelMatchmaking() {
        if (roomRef.current) {
            roomRef.current.leave();
            roomRef.current = null;
        }
        setMatchmaking(false);
        setStatus('');
    }

    async function handleFindMatch() {
        if (!userId) {
            showAuth('Login to play');
            return;
        }
        if (matchmaking) {
            await cancelMatchmaking();
            return;
        }
        const wallet = currency === 'cash' ? balance : coins;
        if (wallet === null || wallet < bet) {
            const prefix = currency === 'cash' ? '$' : '';
            const suffix = currency === 'coins' ? ' coins' : '';
            setStatus(`Insufficient ${currency}. Need ${prefix}${bet}${suffix}.`);
            return;
        }

        setMatchmaking(true);
        setStatus('Connecting…');

        try {
            const host = window.location.host.replace(/:.*/, '');
            const port =
                process.env.NODE_ENV !== 'production' ? WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;
            clientRef.current = new Client(url);

            const playerName = localStorage.getItem('playerName') || 'Player';

            roomRef.current = await clientRef.current.joinOrCreate('cs16-matchmaking', {
                playerName,
                odinsId: userId,
                betAmount: bet,
                currency,
            });

            const display = currency === 'coins' ? `${bet} coins` : `$${bet}`;
            setStatus(`Waiting for ${display} opponent…`);

            roomRef.current.onMessage('matchmaking:status', (data: any) => {
                setStatus(`Waiting for opponent… (Position ${data.position})`);
            });

            roomRef.current.onMessage('matchmaking:found', (data: any) => {
                setStatus('Match found! Launching…');
                if (roomRef.current) {
                    roomRef.current.leave();
                    roomRef.current = null;
                }

                const params = new URLSearchParams({
                    matchId: data.matchId,
                    token: data.token,
                    name: data.playerName || playerName,
                    opponent: data.opponentName || '',
                    connect: data.serverConnect || 'fps.hard2kill.me:27018',
                });
                const targetHost = data.serverHost || 'fps.hard2kill.me';
                window.location.href = `https://${targetHost}/?${params.toString()}`;
            });

            roomRef.current.onMessage('matchmaking:error', (data: any) => {
                setStatus(data.message || 'Matchmaking error');
                setMatchmaking(false);
            });
        } catch (err: any) {
            setStatus(err.message || 'Connection failed');
            setMatchmaking(false);
        }
    }

    async function handleLogout() {
        if (matchmaking) await cancelMatchmaking();
        await supabase.auth.signOut();
        navigate?.('/');
    }

    // Live cooldown text for coin claim.
    const cooldownMs = Math.max(0, coinNextClaimAt - Date.now());
    const cooldownText =
        cooldownMs > 0
            ? `${Math.floor(cooldownMs / 60000)}m ${Math.floor((cooldownMs % 60000) / 1000)}s`
            : null;

    const betOptions = currency === 'cash' ? BET_AMOUNTS_CASH : BET_AMOUNTS_COINS;

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h1 style={styles.brand}>
                    Hard<span style={styles.accent}>2</span>Kill
                </h1>
                {userId ? (
                    <div style={styles.headerRight}>
                        <div style={styles.walletBox}>
                            <div style={styles.walletLabel}>Cash</div>
                            <div style={styles.walletAmount}>${balance != null ? balance.toFixed(2) : '—'}</div>
                        </div>
                        <div style={styles.walletBox}>
                            <div style={styles.walletLabel}>Coins</div>
                            <div style={styles.walletAmount}>{coins ?? '—'}</div>
                        </div>
                        <button style={styles.logoutBtn} onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                ) : (
                    <button style={styles.primaryBtn} onClick={() => showAuth()}>
                        Login
                    </button>
                )}
            </header>

            <main style={styles.main}>
                <h2 style={styles.tagline}>Counter-Strike. Real money. No middleman.</h2>

                <div style={styles.gameCard}>
                    <div style={styles.cardTitle}>Counter-Strike 1.6</div>
                    <div style={styles.cardSubtitle}>Team Deathmatch · de_dust2 · instant respawn</div>

                    <div style={styles.tabs}>
                        <button
                            style={{ ...styles.tab, ...(currency === 'cash' ? styles.tabActive : {}) }}
                            onClick={() => setCurrency('cash')}
                        >
                            Cash
                        </button>
                        <button
                            style={{ ...styles.tab, ...(currency === 'coins' ? styles.tabActive : {}) }}
                            onClick={() => setCurrency('coins')}
                        >
                            Coins
                        </button>
                    </div>

                    <div style={styles.betRow}>
                        {betOptions.map((b) => (
                            <button
                                key={b}
                                style={{ ...styles.betBtn, ...(bet === b ? styles.betBtnActive : {}) }}
                                onClick={() => setBet(b)}
                            >
                                {currency === 'cash' ? `$${b}` : `${b} coins`}
                            </button>
                        ))}
                    </div>

                    <button
                        style={{ ...styles.findBtn, ...(matchmaking ? styles.findBtnCancel : {}) }}
                        onClick={handleFindMatch}
                    >
                        {matchmaking ? 'Cancel matchmaking' : 'Find Match'}
                    </button>

                    {status && <div style={styles.status}>{status}</div>}
                </div>

                {userId && (
                    <div style={styles.sidebar}>
                        <div style={styles.sidebarBox}>
                            <div style={styles.sidebarTitle}>Free Coins</div>
                            <div style={styles.sidebarText}>10 coins per hour, no deposit needed</div>
                            <button
                                style={styles.sidebarBtn}
                                disabled={claimingCoins || cooldownMs > 0}
                                onClick={handleClaimCoins}
                            >
                                {cooldownText
                                    ? `Next claim in ${cooldownText}`
                                    : claimingCoins
                                    ? 'Claiming…'
                                    : 'Claim 10 coins'}
                            </button>
                        </div>
                        <div style={styles.sidebarBox}>
                            <div style={styles.sidebarTitle}>Deposit</div>
                            <div style={styles.sidebarText}>Add real money to play cash matches</div>
                            <button style={styles.sidebarBtn} onClick={() => setShowDeposit(true)}>
                                Deposit via Stripe
                            </button>
                        </div>
                    </div>
                )}

                {userId && matchHistory.length > 0 && (
                    <div style={styles.historyBox}>
                        <div style={styles.historyTitle}>Recent Matches</div>
                        {matchHistory.map((m) => {
                            const isWin = m.winner_id === userId;
                            const sign = isWin ? '+' : '−';
                            const prefix = m.currency === 'coins' ? '' : '$';
                            const suffix = m.currency === 'coins' ? ' coins' : '';
                            return (
                                <div key={m.id} style={styles.historyRow}>
                                    <div
                                        style={{
                                            ...styles.historyResult,
                                            color: isWin ? '#39ff14' : '#ff4444',
                                        }}
                                    >
                                        {isWin ? 'Win' : 'Loss'}
                                    </div>
                                    <div style={styles.historyAmount}>
                                        {sign}
                                        {prefix}
                                        {m.amount}
                                        {suffix}
                                    </div>
                                    <div style={styles.historyGame}>{m.game}</div>
                                    <div style={styles.historyDate}>
                                        {new Date(m.ended_at).toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {showDeposit && (
                <div style={styles.overlay} onClick={() => setShowDeposit(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 style={styles.modalTitle}>Deposit</h2>
                        <p style={styles.modalText}>Choose an amount. Stripe handles the payment.</p>
                        <div style={styles.depositRow}>
                            {[5, 10, 20, 50].map((amt) => (
                                <button
                                    key={amt}
                                    style={styles.depositBtn}
                                    onClick={() => handleDeposit(amt)}
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                        <button style={styles.modalCancel} onClick={() => setShowDeposit(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        background: '#0a0a0a',
        color: '#ececec',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
        borderBottom: '1px solid #1a1a1a',
    },
    brand: {
        fontSize: 28,
        fontWeight: 900,
        margin: 0,
        letterSpacing: '-0.02em',
        textTransform: 'uppercase',
    },
    accent: { color: '#ff2e2e' },
    headerRight: { display: 'flex', gap: 12, alignItems: 'center' },
    walletBox: {
        background: '#141414',
        padding: '8px 16px',
        borderRadius: 4,
        minWidth: 90,
        textAlign: 'center',
    },
    walletLabel: {
        fontSize: 10,
        color: '#6a6a6a',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 2,
    },
    walletAmount: { fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
    logoutBtn: {
        background: 'transparent',
        color: '#6a6a6a',
        border: '1px solid #2a2a2a',
        padding: '8px 16px',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
    },
    primaryBtn: {
        background: '#ff2e2e',
        color: '#fff',
        border: 'none',
        padding: '10px 24px',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    main: { maxWidth: 880, margin: '0 auto', padding: 32 },
    tagline: {
        fontSize: 13,
        color: '#6a6a6a',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 40,
    },
    gameCard: { background: '#141414', padding: 32, borderRadius: 4, marginBottom: 24 },
    cardTitle: { fontSize: 22, fontWeight: 800, marginBottom: 4 },
    cardSubtitle: { fontSize: 13, color: '#6a6a6a', marginBottom: 24 },
    tabs: { display: 'flex', marginBottom: 24, borderBottom: '1px solid #2a2a2a' },
    tab: {
        background: 'transparent',
        color: '#6a6a6a',
        border: 'none',
        padding: '10px 24px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '2px solid transparent',
    },
    tabActive: { color: '#ececec', borderBottom: '2px solid #ff2e2e' },
    betRow: { display: 'flex', gap: 8, marginBottom: 16 },
    betBtn: {
        flex: 1,
        background: '#1e1e1e',
        color: '#ececec',
        border: '1px solid #2a2a2a',
        padding: 12,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
    },
    betBtnActive: { background: '#ff2e2e', borderColor: '#ff2e2e', color: '#fff' },
    findBtn: {
        width: '100%',
        background: '#ff2e2e',
        color: '#fff',
        border: 'none',
        padding: 16,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginTop: 8,
    },
    findBtnCancel: { background: '#3a3a3a' },
    status: { textAlign: 'center', marginTop: 16, color: '#6a6a6a', fontSize: 13 },
    sidebar: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
    sidebarBox: { background: '#141414', padding: 20, borderRadius: 4 },
    sidebarTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
    sidebarText: { fontSize: 12, color: '#6a6a6a', marginBottom: 12 },
    sidebarBtn: {
        width: '100%',
        background: 'transparent',
        color: '#ececec',
        border: '1px solid #2a2a2a',
        padding: 10,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
    },
    historyBox: { background: '#141414', padding: 20, borderRadius: 4 },
    historyTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12 },
    historyRow: {
        display: 'grid',
        gridTemplateColumns: '60px 100px 60px 1fr',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #1a1a1a',
        fontSize: 13,
        gap: 8,
    },
    historyResult: {
        fontWeight: 700,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },
    historyAmount: { fontVariantNumeric: 'tabular-nums', fontWeight: 700 },
    historyGame: { color: '#6a6a6a', fontSize: 11, textTransform: 'uppercase' },
    historyDate: { color: '#6a6a6a', fontSize: 11, textAlign: 'right' },
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    modal: { background: '#141414', padding: 32, borderRadius: 4, minWidth: 320 },
    modalTitle: { margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 700 },
    modalText: { margin: '0 0 20px 0', fontSize: 13, color: '#6a6a6a' },
    depositRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 },
    depositBtn: {
        background: '#ff2e2e',
        color: '#fff',
        border: 'none',
        padding: 16,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 700,
    },
    modalCancel: {
        width: '100%',
        background: 'transparent',
        color: '#6a6a6a',
        border: '1px solid #2a2a2a',
        padding: 10,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
    },
};
