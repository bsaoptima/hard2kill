import React, { useState } from 'react';
import { supabase } from '@hard2kill/shared';
import { Button } from './Button';
import { Input } from './Input';
import { Space } from './Space';
import { Text } from './Text';
import { View } from './View';

interface AuthProps {
    onAuth: () => void;
}

export function Auth({ onAuth }: AuthProps): React.ReactElement {
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
            } else {
                onAuth();
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
        <View style={styles.container}>
            <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            <Space size="m" />
            <Input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
            />
            <Space size="xs" />
            <Input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
            />
            <Space size="m" />
            {error && (
                <>
                    <Text style={styles.error}>{error}</Text>
                    <Space size="xs" />
                </>
            )}
            <Button
                text={loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
                onClick={handleSubmit}
            />
            <Space size="s" />
            <Text
                style={styles.toggle}
                onClick={() => setIsLogin(!isLogin)}
            >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
            </Text>
        </View>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    input: {
        width: 300,
    },
    error: {
        color: 'red',
    },
    toggle: {
        cursor: 'pointer',
        color: '#666',
        textDecoration: 'underline',
    },
};
