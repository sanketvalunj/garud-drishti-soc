import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Zap, GitBranch, Network, ChevronRight, ChevronLeft,
    CheckCircle2, Circle, Cpu, Database, Activity, Server, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AnimatedGradientBg from '../components/AnimatedGradientBg';

// ─── Individual Steps ──────────────────────────────────────────
const WelcomeStep = () => (
    <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className="text-center space-y-8"
    >
        {/* Animated Shield */}
        <div className="flex justify-center">
            <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping scale-110" />
                <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600/40 to-blue-900/30 border border-blue-500/30 flex items-center justify-center shadow-2xl shadow-blue-900/40">
                    <Shield className="w-12 h-12 text-blue-400" />
                </div>
            </div>
        </div>

        <div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Welcome to CRYPTIX</h1>
            <p className="text-blue-400 font-semibold text-lg mb-6">Autonomous Cyber Defense Platform</p>
            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                CRYPTIX is an enterprise-grade Security Operations Center platform that automates threat detection,
                incident response, and attack reconstruction using AI-driven analysis — giving your security
                team superpowers in real time.
            </p>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
            {['AI-Powered', 'Real-time', 'Enterprise SOC'].map((tag) => (
                <span key={tag} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    {tag}
                </span>
            ))}
        </div>
    </motion.div>
);

const OverviewStep = () => {
    const cards = [
        {
            icon: Activity,
            title: 'Real-time Threat Detection',
            desc: 'Live event streaming with automated anomaly scoring across all network assets.',
            color: 'blue',
        },
        {
            icon: Zap,
            title: 'Automated Response Playbooks',
            desc: 'AI-generated response strategies with step-by-step containment and remediation.',
            color: 'violet',
        },
        {
            icon: GitBranch,
            title: 'Graph-based Attack Reconstruction',
            desc: 'Visual topology mapping of attack paths with MITRE ATT&CK kill-chain alignment.',
            color: 'emerald',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Platform Overview</h2>
                <p className="text-slate-400">Everything you need, unified in one console.</p>
            </div>

            <div className="grid gap-4">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    const colorMap = {
                        blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/30 text-blue-400 shadow-blue-900/20',
                        violet: 'from-violet-600/20 to-violet-900/10 border-violet-500/30 text-violet-400 shadow-violet-900/20',
                        emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/30 text-emerald-400 shadow-emerald-900/20',
                    };
                    return (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-r border shadow-xl ${colorMap[card.color]}`}
                        >
                            <div className={`p-3 rounded-xl bg-slate-900/50`}>
                                <Icon size={22} className={colorMap[card.color].split(' ')[3]} />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
};

const ReadinessStep = () => {
    const checks = [
        { label: 'Backend connected', icon: Server, delay: 0 },
        { label: 'Pipeline available', icon: GitBranch, delay: 0.3 },
        { label: 'Storage active', icon: Database, delay: 0.6 },
        { label: 'AI engine loaded', icon: Cpu, delay: 0.9 },
    ];
    const [done, setDone] = useState([]);

    useEffect(() => {
        checks.forEach((c, idx) => {
            setTimeout(() => {
                setDone(prev => [...prev, idx]);
            }, 500 + idx * 600);
        });
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">System Readiness</h2>
                <p className="text-slate-400">Verifying all defensive systems are operational...</p>
            </div>

            <div className="space-y-3">
                {checks.map((item, idx) => {
                    const Icon = item.icon;
                    const isReady = done.includes(idx);
                    return (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${isReady
                                    ? 'bg-emerald-900/10 border-emerald-500/30'
                                    : 'bg-slate-900/30 border-slate-700/50'
                                }`}
                        >
                            <div className={`p-2.5 rounded-lg ${isReady ? 'bg-emerald-500/20' : 'bg-slate-800/50'}`}>
                                <Icon size={18} className={isReady ? 'text-emerald-400' : 'text-slate-500'} />
                            </div>
                            <span className={`flex-1 font-medium ${isReady ? 'text-white' : 'text-slate-500'}`}>
                                {item.label}
                            </span>
                            <AnimatePresence>
                                {isReady ? (
                                    <motion.div
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                    >
                                        <CheckCircle2 className="text-emerald-400" size={22} />
                                    </motion.div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence>
                {done.length === checks.length && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
                    >
                        <p className="text-emerald-400 font-semibold flex items-center justify-center gap-2">
                            <Check size={16} /> All systems operational
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const FinishStep = ({ onFinish }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className="text-center space-y-8"
    >
        <div className="flex justify-center">
            <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
                <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-600/40 to-emerald-900/30 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
            </div>
        </div>

        <div>
            <h2 className="text-3xl font-bold text-white mb-3">Setup Complete!</h2>
            <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your CRYPTIX SOC console is fully configured. Start monitoring threats,
                analyzing incidents, and responding to attacks in real time.
            </p>
        </div>

        {/* Feature preview chips */}
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-sm">
            {['Dashboard', 'Incidents', 'Threat Graph', 'Playbooks', 'Pipeline', 'Admin'].map(f => (
                <div key={f} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-slate-300 text-xs">{f}</span>
                </div>
            ))}
        </div>

        <motion.button
            onClick={onFinish}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-2xl shadow-2xl shadow-blue-600/30 transition-all"
        >
            Enter SOC Dashboard
            <ChevronRight size={20} />
        </motion.button>
        <p className="text-xs text-slate-600 uppercase tracking-widest">Mission Control Awaits</p>
    </motion.div>
);

// ─── Main Onboarding Component ─────────────────────────────────
const STEPS = [
    { id: 'welcome', label: 'Welcome', component: WelcomeStep },
    { id: 'overview', label: 'Overview', component: OverviewStep },
    { id: 'readiness', label: 'Readiness', component: ReadinessStep },
    { id: 'finish', label: 'Finish', component: FinishStep },
];

const Onboarding = () => {
    const navigate = useNavigate();
    const { completeOnboarding } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);

    const handleFinish = () => {
        completeOnboarding();
        navigate('/dashboard');
    };

    const goNext = () => {
        if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
    };
    const goPrev = () => {
        if (currentStep > 0) setCurrentStep(s => s - 1);
    };

    const StepComponent = STEPS[currentStep].component;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
            {/* ANIMATED GRADIENT BACKGROUND */}
            <AnimatedGradientBg />

            {/* Header Bar */}
            <div className="fixed top-0 inset-x-0 z-10 flex items-center justify-between px-8 py-4 bg-slate-950/70 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                    <Shield size={16} className="text-blue-400" />
                    CRYPTIX SOC
                </div>
                <div className="flex items-center gap-2">
                    {STEPS.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${idx < currentStep ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                                    idx === currentStep ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                                        'text-slate-600'
                                }`}>
                                {idx < currentStep && <Check size={10} />}
                                {step.label}
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`w-8 h-px ${idx < currentStep ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                            )}
                        </div>
                    ))}
                </div>
                <div className="text-xs text-slate-600 font-mono">Step {currentStep + 1} of {STEPS.length}</div>
            </div>

            {/* Main Content Card */}
            <div className="z-10 w-full max-w-xl mt-20 relative">
                <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-blue-950/30 overflow-hidden">
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

                    {/* Progress bar */}
                    <div className="px-8 pt-6">
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                                transition={{ duration: 0.4 }}
                            />
                        </div>
                    </div>

                    <div className="p-8">
                        <AnimatePresence mode="wait">
                            <StepComponent key={currentStep} onFinish={handleFinish} />
                        </AnimatePresence>
                    </div>

                    {/* Navigation Buttons */}
                    {currentStep < STEPS.length - 1 && (
                        <div className="px-8 pb-8 flex items-center justify-between">
                            {currentStep > 0 ? (
                                <button
                                    onClick={goPrev}
                                    className="flex items-center gap-1.5 px-4 py-2 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all text-sm"
                                >
                                    <ChevronLeft size={16} /> Back
                                </button>
                            ) : <div />}

                            <motion.button
                                onClick={goNext}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30 text-sm"
                            >
                                Continue <ChevronRight size={16} />
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
