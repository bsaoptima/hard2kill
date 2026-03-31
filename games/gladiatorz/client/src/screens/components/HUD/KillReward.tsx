import React, { CSSProperties, useEffect, useState } from 'react';
import { View } from '../../../../components';

interface KillRewardProps {
    amount: number | null;
    victimName: string | null;
}

export function KillReward({ amount, victimName }: KillRewardProps): React.ReactElement | null {
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (amount !== null && amount > 0) {
            setVisible(true);
            setAnimating(true);

            // Hide after animation completes
            const timer = setTimeout(() => {
                setAnimating(false);
                setTimeout(() => setVisible(false), 300);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [amount, victimName]);

    if (!visible || amount === null) {
        return null;
    }

    return (
        <View style={{ ...styles.container, opacity: animating ? 1 : 0 }}>
            <div style={styles.killText}>ELIMINATED</div>
            <div style={styles.victimName}>{victimName}</div>
            <div style={styles.rewardContainer}>
                <span style={styles.plusSign}>+</span>
                <span style={styles.amount}>${amount}</span>
            </div>
            <div style={styles.subtitle}>POT CLAIMED</div>
        </View>
    );
}

const styles: { [key: string]: CSSProperties } = {
    container: {
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        animation: 'killRewardPulse 0.5s ease-out',
        transition: 'opacity 0.3s ease-out',
        pointerEvents: 'none',
        zIndex: 100,
    },
    killText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ff4444',
        letterSpacing: 4,
        textShadow: '0 0 20px rgba(255, 68, 68, 0.8)',
    },
    victimName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
    },
    rewardContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    plusSign: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#4ade80',
        textShadow: '0 0 30px rgba(74, 222, 128, 0.8)',
    },
    amount: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#4ade80',
        fontFamily: 'monospace',
        textShadow: '0 0 30px rgba(74, 222, 128, 0.8), 0 0 60px rgba(74, 222, 128, 0.4)',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4ade80',
        letterSpacing: 2,
        opacity: 0.8,
    },
};
