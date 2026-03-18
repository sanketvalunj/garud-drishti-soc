import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AnimatedGradientBg from '../components/AnimatedGradientBg';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Small artifical delay
        await new Promise(r => setTimeout(r, 600));

        // The prompt asked for strict check username="testuser" password="test123"
        if (username === 'testuser' && password === 'test123') {
            login('testuser', 'password');
            setIsLoading(false);
            navigate('/dashboard');
        } else {
            setIsLoading(false);
            setError('Invalid credentials. Use testuser / test123');
        }
    };

    return (
        <div>
            {/* ANIMATED GRADIENT BACKGROUND */}
            <AnimatedGradientBg />

            <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                overflow: 'hidden'
            }}>
                <div className="w-full max-w-md px-4">
                    {/* Glass Card */}
                    <div className="rounded-2xl shadow-2xl border overflow-hidden" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >

                        <div className="p-8">
                            {/* Logo & Header */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="mb-4">
                                    <Shield size={48} style={{ color: '#00AEEF' }} />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                                    CRYPTIX
                                </h1>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Autonomous Cyber Defense Platform
                                </p>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="mb-6 p-3 rounded-lg bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)] text-[#B91C1C] flex items-center gap-2 text-sm backdrop-blur-md">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full border focus:bg-white/5 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00AEEF] transition-all placeholder:text-gray-500/50"
                                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                                        placeholder="Username"
                                        autoComplete="username"
                                        required
                                    />
                                </div>

                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full border focus:bg-white/5 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#00AEEF] transition-all placeholder:text-gray-500/50"
                                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                                        placeholder="Password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full relative overflow-hidden font-semibold py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-70 text-white"
                                    style={{ backgroundColor: '#00AEEF' }}
                                >
                                    {isLoading ? 'Authenticating...' : 'Access Secure Console'}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                Authorized Personnel Only · Secure Connection
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
