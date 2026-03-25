import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const AnimatedGradientBg = ({ isLanding = false }) => {
    const { resolvedTheme } = useTheme()
    const [position, setPosition] = useState({
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        x3: 50,
        y3: 50,
        x4: 20,
        y4: 80,
        x5: 80,
        y5: 20
    })

    useEffect(() => {
        let animationId
        let time = 0

        const animate = () => {
            time += 0.015 // Increased base speed

            // Three gradient positions that move
            // independently using sine/cosine

            // Glow 1 — Top area, moves side to side
            const x1 = 30 + Math.sin(time * 0.8) * 25
            const y1 = 20 + Math.cos(time * 0.6) * 15

            // Glow 2 — Bottom area, moves diagonally
            const x2 = 70 + Math.cos(time * 0.7) * 25
            const y2 = 80 + Math.sin(time * 0.5) * 20

            // Glow 3 — Center area, moves slower
            const x3 = 50 + Math.sin(time * 0.4) * 30
            const y3 = 50 + Math.cos(time * 0.3) * 25

            // Glow 4 — Aqua blue, moves in a wide arc
            const x4 = 20 + Math.cos(time * 0.5) * 40
            const y4 = 80 + Math.sin(time * 0.45) * 30

            // Glow 5 — Light blue, floats in top-right area
            const x5 = 80 + Math.sin(time * 0.35) * 20
            const y5 = 20 + Math.cos(time * 0.4) * 15

            setPosition({
                x1: Math.round(x1),
                y1: Math.round(y1),
                x2: Math.round(x2),
                y2: Math.round(y2),
                x3: Math.round(x3),
                y3: Math.round(y3),
                x4: Math.round(x4),
                y4: Math.round(y4),
                x5: Math.round(x5),
                y5: Math.round(y5)
            })

            animationId = requestAnimationFrame(animate)
        }

        animate()

        return () => cancelAnimationFrame(animationId)
    }, [])

    const isDark = resolvedTheme === 'dark'

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0,
                pointerEvents: 'none',
                background: `
                    radial-gradient(
                        ellipse 100% 90% at ${position.x1}% ${position.y1}%,
                        ${isDark ? 'rgba(0, 119, 182, 0.4)' : 'rgba(0, 119, 182, 0.25)'},
                        transparent 75%
                    ),
                    radial-gradient(
                        ellipse 50% 50% at ${position.x2}% ${position.y2}%,
                        ${isDark ? 'rgba(0, 57, 93, 0.05)' : 'rgba(0, 57, 93, 0.03)'},
                        transparent 50%
                    ),
                    radial-gradient(
                        ellipse 90% 80% at ${position.x3}% ${position.y3}%,
                        ${isDark ? 'rgba(0, 87, 149, 0.3)' : 'rgba(0, 87, 149, 0.2)'},
                        transparent 65%
                    ),
                    radial-gradient(
                        ellipse 80% 70% at ${position.x4}% ${position.y4}%,
                        ${isDark ? (isLanding ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 255, 255, 0.15)') : 'rgba(0, 255, 255, 0.12)'},
                        transparent 60%
                    ),
                    radial-gradient(
                        ellipse 70% 60% at ${position.x5}% ${position.y5}%,
                        ${isDark ? (isLanding ? 'rgba(144, 202, 249, 0.2)' : 'rgba(144, 202, 249, 0.2)') : 'rgba(144, 202, 249, 0.15)'},
                        transparent 55%
                    ),
                    ${isDark 
                        ? (isLanding ? 'linear-gradient(135deg, #020B18 0%, #020B18 100%)' : 'linear-gradient(135deg, #060D1A 0%, #0A1428 100%)')
                        : 'linear-gradient(135deg, #F5F7FA 0%, #EEF2F8 100%)'}
                `
            }}
        />
    )
}

export default AnimatedGradientBg
