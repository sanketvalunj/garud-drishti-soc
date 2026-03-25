/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                navy: {
                    900: '#0F1C3F',
                    800: '#1A2A56',
                    700: '#263B72',
                },
                cyan: {
                    500: '#00C2A8',
                    400: '#33D1BA',
                },
                blue: {
                    500: '#2F80ED',
                },
                violet: {
                    500: '#7A6FF0',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}
