import React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/common/Sidebar';
import AnimatedGradientBg from '../components/AnimatedGradientBg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Activity, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const Layout = () => {
    const { resolvedTheme } = useTheme();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const isDark = resolvedTheme === 'dark';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

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
                flexDirection: 'column',
                overflow: 'hidden'
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
                    <div className="relative">
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-all outline-none"
                        >
                            <div className="w-9 h-9 rounded-full bg-[#00AEEF] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white/20">
                                {user?.avatar || 'U'}
                            </div>
                            <ChevronDown size={14} className={clsx("transition-transform duration-200", isUserMenuOpen ? "rotate-180" : "")} style={{ color: 'var(--text-secondary)' }} />
                        </button>

                        <AnimatePresence>
                            {isUserMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsUserMenuOpen(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 p-2 z-50 shadow-2xl overflow-hidden"
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.95)',
                                            backdropFilter: 'blur(40px)'
                                        }}
                                    >
                                        <div className="px-3 py-3 border-b border-white/5 mb-2">
                                            <div className="text-sm font-bold truncate" style={{ color: 'var(--text-color)' }}>{user?.name}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{user?.roleLabel}</div>
                                        </div>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition-all text-left mt-1"
                                        >
                                            <LogOut size={16} />
                                            <span>Log out</span>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                {/* Main page content */}
                <main className="flex-1 overflow-y-auto w-full relative z-0 custom-scrollbar" style={{ overflowX: 'hidden', minWidth: 0 }}>
                    <div className="p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
