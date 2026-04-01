import { LocationProvider, Router } from '@reach/router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { GameScreen } from './screens/Game/Game';
import { HomeScreen } from './screens/Home/Home';
import { LandingScreen } from './screens/Landing/Landing';
import { FPS2Screen } from './screens/FPS2/FPS2';
import { ThreeFPSScreen } from './screens/ThreeFPS/ThreeFPS';
import { supabase } from '@hard2kill/shared';

interface AuthContextType {
    userId: string | null;
    showAuth: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    userId: null,
    showAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function App(): React.ReactElement {
    const [userId, setUserId] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

    useEffect(() => {
        // Function to ensure balance record exists
        const ensureBalanceRecord = async (userId: string) => {
            const { data, error } = await supabase
                .from('balances')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error checking balance:', error);
                return;
            }

            if (!data) {
                console.log('Creating balance record for user:', userId);
                await supabase.from('balances').insert({ id: userId, balance: 0 });
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, !!session);

            if (session) {
                setUserId(session.user.id);
                setShowAuthModal(false);

                // Ensure balance record exists for all auth events
                await ensureBalanceRecord(session.user.id);
            } else {
                setUserId(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                userId,
                showAuth: () => setShowAuthModal(true),
            }}
        >
            <LocationProvider>
                <RoutedApp />
            </LocationProvider>
            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </AuthContext.Provider>
    );
}

function RoutedApp(): React.ReactElement {
    return (
        <Router>
            <LandingScreen default path="/" />
            <HomeScreen path="/lobby" />
            <FPS2Screen path="/fps2" />
            <ThreeFPSScreen path="/three-fps" />
            <GameScreen path="/:roomId" />
        </Router>
    );
}

function AuthModal({ onClose }: { onClose: () => void }): React.ReactElement {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit() {
        setLoading(true);
        setError('');

        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
            }
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                setError(error.message);
            } else {
                setError('Check your email to confirm your account');
            }
        }

        setLoading(false);
    }

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h2 style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</h2>
                <input
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    style={styles.input}
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p style={styles.error}>{error}</p>}
                <button style={styles.button} onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
                </button>
                <p style={styles.toggle} onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
                </p>
            </div>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
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
    },
    modal: {
        backgroundColor: '#111',
        padding: 32,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 300,
    },
    title: {
        color: '#fff',
        margin: 0,
        textAlign: 'center',
    },
    input: {
        padding: 12,
        borderRadius: 6,
        border: '1px solid #333',
        backgroundColor: '#222',
        color: '#fff',
        fontSize: 16,
    },
    button: {
        padding: 12,
        borderRadius: 6,
        border: 'none',
        backgroundColor: '#fff',
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
        cursor: 'pointer',
    },
    error: {
        color: '#ff4444',
        margin: 0,
        fontSize: 14,
    },
    toggle: {
        color: '#888',
        textAlign: 'center',
        cursor: 'pointer',
        margin: 0,
        fontSize: 14,
    },
};
