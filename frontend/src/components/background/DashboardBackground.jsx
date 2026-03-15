import React, { useEffect, useState } from 'react';
import Prism from '../Prism';
import { useTheme } from '../../context/ThemeContext';

export default function DashboardBackground() {
    const { isDark } = useTheme();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Add cursor tracking without triggering heavy React repaints for Prism
        const handleMouseMove = (e) => {
            setMousePos({
                x: e.clientX / window.innerWidth,
                y: e.clientY / window.innerHeight
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Map the mouse positions to the subtle shader modulation requested 
    const mouseHueOffset = mousePos.x * 50;
    const mouseTimeScale = 0.5 + (mousePos.y * 0.5);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,     // Stay below the layout
                opacity: 0.85,  // Slight transparency
                pointerEvents: 'none', // Allow clicks to pass through to UI behind
                transition: 'opacity 300ms ease'
            }}
        >
            <Prism
                animationType="rotate"
                timeScale={mouseTimeScale}
                height={3.5}
                baseWidth={5.5}
                scale={3.6}
                hueShift={(isDark ? 180 : 0) + mouseHueOffset}
                colorFrequency={isDark ? 1.3 : 1}
                noise={0}
                glow={isDark ? 1.6 : 0.8}
            />
        </div>
    );
}
