import { RouteComponentProps } from '@reach/router';
import React, { useState, useEffect } from 'react';
import { View, Text, Space } from '../../components';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

interface ProfileScreenProps extends RouteComponentProps {}

interface GameHistoryEntry {
    id: string;
    winner_id: string;
    loser_id: string;
    amount: number;
    ended_at: string;
    isWin: boolean;
}

interface Stats {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    totalEarnings: number;
}

export function ProfileScreen({ navigate }: ProfileScreenProps) {
    const { userId } = useAuth();
    const [username, setUsername] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [stats, setStats] = useState<Stats>({ totalGames: 0, wins: 0, losses: 0, winRate: 0, totalEarnings: 0 });
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    useEffect(() => {
        if (!userId) {
            navigate?.('/');
            return;
        }

        loadProfileData();
    }, [userId]);

    async function loadProfileData() {
        if (!userId) return;

        try {
            // Load profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

            if (profileData) {
                setUsername(profileData.username);
            }

            // Load balance
            const { data: balanceData } = await supabase
                .from('balances')
                .select('balance')
                .eq('id', userId)
                .single();

            if (balanceData) {
                setBalance(balanceData.balance);
            }

            // Load game history
            const { data: gamesData } = await supabase
                .from('game_history')
                .select('*')
                .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
                .order('ended_at', { ascending: false })
                .limit(20);

            if (gamesData) {
                const history = gamesData.map(game => ({
                    ...game,
                    isWin: game.winner_id === userId
                }));
                setGameHistory(history);

                // Calculate stats
                const wins = history.filter(g => g.isWin).length;
                const losses = history.filter(g => !g.isWin).length;
                const totalGames = wins + losses;
                const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

                // Calculate total earnings (wins minus losses)
                const totalEarnings = history.reduce((sum, game) => {
                    return sum + (game.isWin ? game.amount : -game.amount);
                }, 0);

                setStats({ totalGames, wins, losses, winRate, totalEarnings });
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        navigate?.('/');
    }

    if (loading) {
        return (
            <View flex center style={styles.container}>
                <Text style={styles.loading}>Loading...</Text>
            </View>
        );
    }

    return (
        <View flex center style={styles.container}>
            {/* Navbar */}
            <View style={styles.navbar}>
                <button style={styles.backButton} onClick={() => navigate?.('/')}>
                    ← Back
                </button>
                <Text style={styles.navbarTitle}>PROFILE</Text>
                <View style={{ width: isMobile ? 60 : 80 }} />
            </View>

            <View style={styles.content}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <img src="/user.svg" alt="Profile" style={styles.avatar} />
                    </View>
                    <Text style={styles.username}>{username || 'Anonymous'}</Text>
                </View>

                <Space size="l" />

                {/* Balance Section */}
                <View style={styles.balanceSection}>
                    <Text style={styles.sectionTitle}>BALANCE</Text>
                    <Space size="s" />
                    <Text style={styles.balanceAmount}>${balance !== null ? balance.toLocaleString('en-US') : '0'}</Text>
                    <Space size="m" />
                    <View style={styles.buttonRow}>
                        <button className="btn-3d" style={styles.actionButton} onClick={() => setShowDepositModal(true)}>
                            <span className="btn-3d-top">DEPOSIT</span>
                        </button>
                        <button className="btn-3d btn-3d-secondary" style={styles.actionButton} onClick={() => setShowWithdrawModal(true)}>
                            <span className="btn-3d-top btn-3d-top-secondary">WITHDRAW</span>
                        </button>
                    </View>
                </View>

                <Space size="l" />

                {/* Stats Section */}
                <View style={styles.statsSection}>
                    <Text style={styles.sectionTitle}>STATISTICS</Text>
                    <Space size="m" />
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.totalGames}</Text>
                            <Text style={styles.statLabel}>Total Games</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.wins}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.losses}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.winRate.toFixed(1)}%</Text>
                            <Text style={styles.statLabel}>Win Rate</Text>
                        </View>
                        <View style={{ ...styles.statCard, gridColumn: isMobile ? 'span 2' : 'auto' }}>
                            <Text style={{ ...styles.statValue, color: stats.totalEarnings >= 0 ? '#4ade80' : '#ff4444' }}>
                                ${stats.totalEarnings >= 0 ? '+' : ''}{stats.totalEarnings.toLocaleString('en-US')}
                            </Text>
                            <Text style={styles.statLabel}>Total Earnings</Text>
                        </View>
                    </View>
                </View>

                <Space size="l" />

                {/* Game History */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>GAME HISTORY</Text>
                    <Space size="m" />
                    {gameHistory.length === 0 ? (
                        <Text style={styles.emptyText}>No games played yet</Text>
                    ) : (
                        <View style={styles.historyList}>
                            {gameHistory.map((game) => (
                                <View key={game.id} style={styles.historyItem}>
                                    <View style={styles.historyItemLeft}>
                                        <Text style={{
                                            ...styles.historyResult,
                                            color: game.isWin ? '#4ade80' : '#ff4444'
                                        }}>
                                            {game.isWin ? 'WIN' : 'LOSS'}
                                        </Text>
                                        <Text style={styles.historyDate}>
                                            {new Date(game.ended_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Text>
                                    </View>
                                    <Text style={{
                                        ...styles.historyAmount,
                                        color: game.isWin ? '#4ade80' : '#ff4444'
                                    }}>
                                        {game.isWin ? '+' : '-'}${game.amount}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <Space size="l" />

                {/* Logout Button */}
                <button style={styles.logoutButton} onClick={handleLogout}>
                    LOGOUT
                </button>

                <Space size="xl" />
            </View>

            {showDepositModal && (
                <DepositModal
                    onClose={() => setShowDepositModal(false)}
                    onSuccess={() => {
                        setShowDepositModal(false);
                        loadProfileData();
                    }}
                />
            )}

            {showWithdrawModal && (
                <WithdrawModal
                    balance={balance || 0}
                    onClose={() => setShowWithdrawModal(false)}
                    onSuccess={() => {
                        setShowWithdrawModal(false);
                        loadProfileData();
                    }}
                />
            )}
        </View>
    );
}

// Reuse deposit/withdraw modals from Landing.tsx
function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const presetAmounts = [5, 10, 25, 50, 100];

    async function handleDeposit() {
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not logged in');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, amount }),
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
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                <Text style={modalStyles.title}>Deposit Credits</Text>
                <Space size="m" />

                <Text style={modalStyles.label}>Select amount</Text>
                <Space size="s" />

                <View style={modalStyles.presets}>
                    {presetAmounts.map((preset) => (
                        <button
                            key={preset}
                            style={{
                                ...modalStyles.presetButton,
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

                <Text style={modalStyles.label}>Or enter custom amount</Text>
                <Space size="s" />
                <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={modalStyles.input}
                />

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={modalStyles.error}>{error}</Text>
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not logged in');
                setLoading(false);
                return;
            }

            const { data: currentBalance, error: selectError } = await supabase
                .from('balances')
                .select('balance')
                .eq('id', user.id)
                .single();

            if (selectError || !currentBalance || currentBalance.balance < amount) {
                setError('Insufficient balance');
                setLoading(false);
                return;
            }

            // Deduct full withdrawal amount (requested amount) from balance
            const { error: balanceError } = await supabase
                .from('balances')
                .update({ balance: currentBalance.balance - amount })
                .eq('id', user.id);

            if (balanceError) {
                setError('Failed to update balance');
                setLoading(false);
                return;
            }

            // Create withdrawal request with payout amount (after 10% fee)
            const payoutAmount = youReceive;
            const paymentDetailsString = JSON.stringify({ method, ...paymentDetails });

            await supabase.from('withdrawal_requests').insert({
                user_id: user.id,
                amount: payoutAmount, // Amount user will receive (after fee)
                payment_method: paymentDetailsString,
                status: 'pending',
            });

            // Record transaction (negative full amount deducted from balance)
            await supabase.from('transactions').insert({
                user_id: user.id,
                amount: -amount,
                type: 'withdrawal',
            });

            setSuccess(true);
        } catch (err) {
            setError('Failed to process withdrawal');
        }

        setLoading(false);
    }

    if (success) {
        return (
            <div style={modalStyles.overlay} onClick={onClose}>
                <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <Text style={modalStyles.title}>Withdrawal Requested</Text>
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
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                <Text style={modalStyles.title}>Withdraw Credits</Text>
                <Space size="m" />

                <Text style={modalStyles.label}>Withdrawal Amount (max: ${balance})</Text>
                <Space size="s" />
                <input
                    type="number"
                    min="1"
                    max={balance}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={modalStyles.input}
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

                <Text style={modalStyles.label}>Payment Method</Text>
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

                <Text style={modalStyles.label}>{selectedMethod.label} Details</Text>
                <Space size="s" />
                {selectedMethod.fields.map((field) => (
                    <React.Fragment key={field.name}>
                        <input
                            type={field.type || 'text'}
                            placeholder={field.placeholder}
                            value={paymentDetails[field.name] || ''}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, [field.name]: e.target.value })}
                            style={modalStyles.input}
                        />
                        <Space size="xs" />
                    </React.Fragment>
                ))}
                <Text style={{ color: '#666', fontSize: 12 }}>{selectedMethod.description}</Text>

                {error && (
                    <>
                        <Space size="s" />
                        <Text style={modalStyles.error}>{error}</Text>
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

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#000',
        flexDirection: 'column',
        position: 'relative',
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
    backButton: {
        background: 'none',
        border: 'none',
        color: '#fff',
        fontSize: isMobile ? 14 : 16,
        cursor: 'pointer',
        fontWeight: 'bold',
        width: isMobile ? 60 : 80,
        textAlign: 'left',
    },
    navbarTitle: {
        fontSize: isMobile ? 20 : 28,
        fontFamily: '"Zen Dots", sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    content: {
        width: '100%',
        maxWidth: 800,
        padding: isMobile ? '80px 16px 32px' : '100px 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    loading: {
        color: '#fff',
        fontSize: isMobile ? 16 : 20,
    },
    profileHeader: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    },
    avatarContainer: {
        width: isMobile ? 80 : 100,
        height: isMobile ? 80 : 100,
        borderRadius: '50%',
        border: '2px solid #39ff14',
        backgroundColor: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: isMobile ? 40 : 50,
        height: isMobile ? 40 : 50,
    },
    username: {
        fontSize: isMobile ? 24 : 32,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 16,
    },
    balanceSection: {
        width: '100%',
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 12,
        padding: isMobile ? 20 : 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: isMobile ? 14 : 16,
        color: '#888',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    balanceAmount: {
        fontSize: isMobile ? 36 : 48,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#39ff14',
    },
    buttonRow: {
        display: 'flex',
        gap: 12,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        width: 'auto',
    },
    statsSection: {
        width: '100%',
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 12,
        padding: isMobile ? 20 : 24,
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: isMobile ? 12 : 16,
    },
    statCard: {
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: isMobile ? 16 : 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: isMobile ? 24 : 32,
        fontFamily: '"Zen Dots", sans-serif',
        fontWeight: 'bold',
        color: '#39ff14',
    },
    statLabel: {
        fontSize: isMobile ? 12 : 14,
        color: '#888',
        marginTop: 4,
        textTransform: 'uppercase',
    },
    historySection: {
        width: '100%',
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: 12,
        padding: isMobile ? 20 : 24,
    },
    historyList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    historyItem: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: isMobile ? 12 : 16,
    },
    historyItemLeft: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    historyResult: {
        fontSize: isMobile ? 14 : 16,
        fontWeight: 'bold',
    },
    historyDate: {
        fontSize: isMobile ? 11 : 12,
        color: '#666',
    },
    historyAmount: {
        fontSize: isMobile ? 16 : 20,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        fontSize: isMobile ? 14 : 16,
    },
    logoutButton: {
        padding: isMobile ? '12px 24px' : '16px 32px',
        backgroundColor: 'transparent',
        border: '1px solid #ff4444',
        borderRadius: 8,
        color: '#ff4444',
        fontSize: isMobile ? 14 : 16,
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
};

const modalStyles: { [key: string]: React.CSSProperties } = {
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
