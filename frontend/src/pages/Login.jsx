import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, isOnboarded } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Small artificial delay for UX polish
        await new Promise(r => setTimeout(r, 600));

        const success = login(username, password);
        setIsLoading(false);

        if (success) {
            // If already onboarded, go straight to dashboard
            const alreadyOnboarded = localStorage.getItem('onboarded') === 'true';
            navigate(alreadyOnboarded ? '/dashboard' : '/onboarding');
        } else {
            setError('Invalid credentials. Use testuser / password');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050d1a]">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-blue-700/20 rounded-full blur-[140px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-violet-700/15 rounded-full blur-[140px]" style={{ animationDelay: '1.5s', animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[80px]" />
                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.8)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-full max-w-md z-10 mx-4"
            >
                {/* Glass Card */}
                <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-blue-950/50 overflow-hidden">
                    {/* Top Accent */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

                    <div className="p-8">
                        {/* Logo & Header */}
                        <div className="text-center mb-10">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/30 to-blue-800/20 mb-5 ring-1 ring-blue-500/30 shadow-xl shadow-blue-900/30"
                            >
                                <Shield className="w-10 h-10 text-blue-400" />
                            </motion.div>
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                <h1 className="text-3xl font-bold text-white tracking-tight mb-1">CRYPTIX SOC</h1>
                                <p className="text-slate-400 text-sm">Autonomous Cyber Defense Platform</p>
                            </motion.div>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2.5 text-sm"
                            >
                                <AlertCircle size={16} className="shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Operator ID</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-800/60 border border-slate-700/70 hover:border-blue-500/40 focus:border-blue-500 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-600 font-mono"
                                    placeholder="testuser"
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Access Code</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-800/60 border border-slate-700/70 hover:border-blue-500/40 focus:border-blue-500 rounded-xl pl-11 pr-12 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-600 font-mono"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-70 mt-2"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Authenticating...
                                    </span>
                                ) : (
                                    'Access Secure Console'
                                )}
                            </motion.button>
                        </form>

                        {/* Hint */}
                        <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-600 font-mono">
                            <span className="text-slate-500">demo:</span> testuser / password
                        </div>
                    </div>

                    {/* Bottom Accent */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                    <div className="px-8 py-3 bg-slate-950/50 text-center text-[10px] text-slate-600 tracking-widest uppercase">
                        Authorized Personnel Only · AES-256 Encrypted Session
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
