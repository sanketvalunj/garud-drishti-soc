import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Target,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Zap,
    Lock,
    Globe,
    Server,
    Database,
    FileText,
    ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

// Icon Map for Tactics
const TACTIC_ICONS = {
    "Initial Access": Lock,
    "Execution": Zap,
    "Persistence": Database,
    "Privilege Escalation": Shield,
    "Lateral Movement": Globe,
    "Exfiltration": FileText,
    "Defense Evasion": Target
};

const MitreMapping = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const incidentId = location.state?.incidentId;

    const [mapping, setMapping] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedTactic, setExpandedTactic] = useState(null);

    useEffect(() => {
        const fetchMapping = async () => {
            if (!incidentId) return;
            try {
                const data = await api.getMitreMapping(incidentId);
                setMapping(data);
                if (data.tactics.length > 0) {
                    setExpandedTactic(data.tactics[0].id);
                }
            } catch (err) {
                console.error("Failed to load MITRE data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMapping();
    }, [incidentId]);

    if (!incidentId) return (
        <div className="p-10 text-center">
            <h2 className="text-xl text-slate-400">Select an incident to view Threat Intel.</h2>
            <button onClick={() => navigate('/incidents')} className="mt-4 px-4 py-2 bg-blue-600 rounded">Go to Incidents</button>
        </div>
    );

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono">Loading Threat Intelligence...</div>;

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="heading-xl flex items-center gap-3">
                        <Target className="text-red-500" />
                        Adversary Behavior Mapping
                    </h1>
                    <p className="text-slate-400 text-sm font-mono mt-1">
                        Trace ID: {mapping?.incident_id} • Framework: MITRE ATT&CK v14
                    </p>
                </div>
            </div>

            {/* 🟢 PANEL 1: ATT&CK PHASE STRIP */}
            <div className="w-full overflow-x-auto pb-4">
                <div className="flex items-center gap-4 min-w-max px-2">
                    {mapping?.tactics.map((tactic, idx) => {
                        const Icon = TACTIC_ICONS[tactic.name] || Shield;
                        const isActive = expandedTactic === tactic.id;

                        return (
                            <React.Fragment key={tactic.id}>
                                <motion.div
                                    onClick={() => setExpandedTactic(tactic.id)}
                                    layoutId={`tactic-${tactic.id}`}
                                    className={clsx(
                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all min-w-[140px]",
                                        isActive ? "bg-red-900/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]" : "bg-slate-900 border-slate-700 hover:border-slate-500"
                                    )}
                                >
                                    <Icon size={24} className={isActive ? "text-red-400" : "text-slate-500"} />
                                    <div className="text-xs font-bold uppercase text-center">{tactic.name}</div>
                                    <div className="text-[10px] font-mono text-slate-500">{tactic.id}</div>
                                </motion.div>
                                {idx < mapping.tactics.length - 1 && (
                                    <ArrowRight className="text-slate-700" size={20} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 🟣 PANEL 2: TECHNIQUE CARDS (Active Phase) */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Shield size={18} className="text-blue-400" /> Technique Analysis
                    </h3>

                    <AnimatePresence mode="wait">
                        {mapping?.tactics.map(tactic => (
                            tactic.id === expandedTactic && (
                                <motion.div
                                    key={tactic.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-4"
                                >
                                    {tactic.techniques.map((tech) => (
                                        <div key={tech.id} className="glass-panel p-6 rounded-2xl border border-slate-700/50 bg-slate-900/50 relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />

                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-lg font-bold text-white tracking-wide">{tech.name}</span>
                                                        <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{tech.id}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-400 italic">"{tech.evidence}"</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-slate-300 mb-1">Confidence</div>
                                                    <div className={clsx(
                                                        "text-xl font-mono font-bold",
                                                        tech.confidence > 0.7 ? "text-green-400" : "text-yellow-400"
                                                    )}>
                                                        {(tech.confidence * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Confidence Bar */}
                                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${tech.confidence * 100}%` }}
                                                    className={clsx(
                                                        "h-full",
                                                        tech.confidence > 0.7 ? "bg-green-500" : "bg-yellow-500"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )
                        ))}
                    </AnimatePresence>
                </div>

                {/* 🟡 PANEL 3: ATTACK CHAIN VISUALIZATION */}
                <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-slate-700/50 bg-slate-900/50 h-fit">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Target size={18} className="text-red-400" /> Kill Chain Flow
                    </h3>

                    <div className="relative pl-6 border-l-2 border-slate-800 space-y-8">
                        {mapping?.tactics.map((tactic, idx) => (
                            <div key={idx} className="relative">
                                {/* Node */}
                                <div className={clsx(
                                    "absolute -left-[29px] top-0 w-4 h-4 rounded-full border-2 transition-colors",
                                    tactic.id === expandedTactic ? "bg-red-500 border-red-900 scale-125" : "bg-slate-900 border-slate-600"
                                )} />

                                <div className="mb-1 text-xs font-bold uppercase text-slate-500">{tactic.name}</div>
                                {tactic.techniques.map((tech) => (
                                    <div key={tech.id} className="mb-2 p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-white font-mono hover:bg-slate-800 transition-colors">
                                        {tech.id}: {tech.name}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MitreMapping;
