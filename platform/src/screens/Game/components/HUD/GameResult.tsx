import React, { CSSProperties, useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { View } from '../../../../components';

export type GameResultType = 'won' | 'lost' | null;

interface GameResultProps {
    result: GameResultType;
    winnerName?: string;
    amountWon?: number | null;
    amountLost?: number | null;
    onPlayAgain?: () => void;
    onGoHome?: () => void;
    isQueuing?: boolean;
}

export function GameResult({ result, winnerName, amountWon, amountLost, onPlayAgain, onGoHome, isQueuing }: GameResultProps): React.ReactElement | null {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (result !== null) {
            setVisible(true);
        }
    }, [result]);

    useEffect(() => {
        if (!visible || isQueuing) return;

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                onPlayAgain?.();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [visible, onPlayAgain, isQueuing]);

    if (!visible || result === null) {
        return null;
    }

    const isWin = result === 'won';
    const amount = isWin ? amountWon : amountLost;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {isQueuing ? (
                    <>
                        <div style={{
                            ...styles.resultText,
                            color: '#39ff14',
                            fontSize: isMobile ? 32 : 48,
                        }}>
                            FINDING MATCH...
                        </div>
                        <div style={styles.subtitle}>
                            Waiting for a new opponent...
                        </div>
                        <button
                            className="btn-3d btn-3d-secondary"
                            style={styles.homeButton}
                            onClick={onGoHome}
                        >
                            <span className="btn-3d-top btn-3d-top-secondary">CANCEL</span>
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{
                            ...styles.resultText,
                            color: isWin ? '#39ff14' : '#ff4444',
                        }}>
                            {isWin ? 'YOU WIN!' : 'YOU LOSE!'}
                        </div>

                        {amount !== null && amount !== undefined && amount > 0 && (
                            <div style={{
                                ...styles.amountText,
                                color: isWin ? '#39ff14' : '#ff4444',
                            }}>
                                {isWin ? '+' : '-'}${amount}
                            </div>
                        )}

                        <div style={styles.subtitle}>
                            Want to play again?
                        </div>

                        <button
                            className="btn-3d"
                            style={styles.playAgainButton}
                            onClick={onPlayAgain}
                        >
                            <span className="btn-3d-top">PRESS SPACE BAR TO PLAY AGAIN</span>
                        </button>

                        <button
                            className="btn-3d btn-3d-secondary"
                            style={styles.homeButton}
                            onClick={onGoHome}
                        >
                            <span className="btn-3d-top btn-3d-top-secondary">GO HOME</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

const styles: { [key: string]: CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        pointerEvents: 'auto',
    },
    modal: {
        backgroundColor: '#111',
        border: '2px solid #333',
        padding: isMobile ? 32 : 48,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 20 : 24,
        minWidth: isMobile ? 300 : 500,
    },
    resultText: {
        fontSize: isMobile ? 40 : 64,
        fontWeight: 'bold',
        letterSpacing: isMobile ? 2 : 4,
        fontFamily: '"Zen Dots", sans-serif',
        textAlign: 'center',
    },
    amountText: {
        fontSize: isMobile ? 32 : 48,
        fontWeight: 'bold',
        fontFamily: '"Zen Dots", sans-serif',
    },
    subtitle: {
        fontSize: isMobile ? 16 : 20,
        color: '#fff',
        textAlign: 'center',
        marginTop: 8,
    },
    playAgainButton: {
        width: '100%',
        marginTop: 8,
    },
    homeButton: {
        width: '100%',
    },
};
