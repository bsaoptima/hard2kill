import React from 'react';

export function ThreeFPSScreen(): React.ReactElement {
    return (
        <div style={styles.container}>
            <iframe
                src="/three-fps/index.html"
                style={styles.iframe}
                title="Three FPS Game"
                allow="accelerometer; gyroscope; fullscreen"
            />
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
        margin: 0,
        padding: 0,
    },
};
