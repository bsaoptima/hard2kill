import React, { CSSProperties, useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { View } from '../../../../components';

export type GameResultType = 'won' | 'lost' | null;

interface GameResultProps {
    result: GameResultType;
    winnerName?: string;
    amountWon?: number | null;
    amountLost?: number | null;
}

export function GameResult({ result, winnerName, amountWon, amountLost }: GameResultProps): React.ReactElement | null {
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (result !== null) {
            setVisible(true);
            setAnimating(true);

            const timer = setTimeout(() => {
                setAnimating(false);
                setTimeout(() => setVisible(false), 500);
            }, 3500);

            return () => clearTimeout(timer);
        }
    }, [result, amountWon, amountLost]);

    if (!visible || result === null) {
        return null;
    }

    const isWin = result === 'won';
    const amount = isWin ? amountWon : amountLost;

    return (
        <View style={{ ...styles.container, opacity: animating ? 1 : 0 }}>
            <div style={{
                ...styles.resultText,
                color: isWin ? '#4ade80' : '#ff4444',
                textShadow: isWin
                    ? '0 0 40px rgba(74, 222, 128, 0.8), 0 0 80px rgba(74, 222, 128, 0.4)'
                    : '0 0 40px rgba(255, 68, 68, 0.8), 0 0 80px rgba(255, 68, 68, 0.4)',
            }}>
                {isWin ? 'YOU WIN' : 'YOU LOSE'}
                {amount !== null && amount !== undefined && amount > 0 && (
                    <span> {isWin ? '+' : '-'}${amount}</span>
                )}
            </div>
        </View>
    );
}

const styles: { [key: string]: CSSProperties } = {
    container: {
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'killRewardPulse 0.6s ease-out',
        transition: 'opacity 0.5s ease-out',
        pointerEvents: 'none',
        zIndex: 100,
    },
    resultText: {
        fontSize: isMobile ? 32 : 56,
        fontWeight: 'bold',
        letterSpacing: isMobile ? 2 : 4,
        fontFamily: '"Zen Dots", sans-serif',
        whiteSpace: 'nowrap',
    },
};
