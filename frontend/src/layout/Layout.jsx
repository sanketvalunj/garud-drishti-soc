import React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/common/Sidebar';
import AnimatedGradientBg from '../components/AnimatedGradientBg';
import { useTheme } from '../context/ThemeContext';

const Layout = () => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <div style={{ display: 'flex', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            {/* 1. ANIMATED GRADIENT BACKGROUND */}
            <AnimatedGradientBg />

            {/* 2. Sidebar with relative positioning and zIndex */}
            <Sidebar style={{ position: 'relative', zIndex: 1 }} />

            {/* 3. Main Content Layer (Above Background) */}
            <div style={{
                flex: 1,
                position: 'relative',
                zIndex: 1,
                minHeight: '100vh',
                backgroundColor: 'transparent',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Top Header Bar - Glassmorphism */}
                <header className="h-16 flex items-center justify-between px-6 shrink-0 z-10 relative mx-6 mt-4 rounded-xl"
                    style={{
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    {/* Left: Titles and Menu */}
                    <div className="flex items-center gap-4">
                        <button className="transition-colors p-1 rounded-md mb-0 lg:hidden" style={{ color: 'var(--text-secondary)' }}>
                            <Menu size={24} />
                        </button>
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-bold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                                Security Operations Center
                            </h1>
                            <p className="text-[11px] font-medium mt-1 leading-none" style={{ color: 'var(--text-secondary)' }}>
                                Real-time threat monitoring and response
                            </p>
                        </div>
                    </div>

                    {/* Right: Status and User Avatar */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                System Operational
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-[#00AEEF] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
                            TU
                        </div>
                    </div>
                </header>

                {/* Main page content */}
                <main className="flex-1 overflow-y-auto w-full relative z-0 custom-scrollbar">
                    <div className="p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
