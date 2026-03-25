import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Brain,
    Terminal,
    ShieldAlert,
    CheckCircle,
    AlertTriangle,
    Cpu,
    ArrowLeft,
    Copy,
    Lock,
    Search
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

const Reasoning = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const incidentId = location.state?.incidentId;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!incidentId) {
            // Fallback for dev/testing: fetch first incident or show error
            // For now, let's just fetch the reasoning for a hardcoded ID if missing to avoid blank page during local dev
            // or redirect back.
            // Better: Navigate back to incidents if no ID 
            // navigate('/incidents'); 
            // but for demo, let's try to fetch a known one or just fail gracefully
        }

        const fetchReasoning = async () => {
            try {
                // If no ID passed, we can't fetch. 
                if (!incidentId) throw new Error("No Incident ID provided");

                const result = await api.getIncidentReasoning(incidentId);
                setData(result);
            } catch (err) {
                console.error("Failed to fetch reasoning", err);
                setError("Could not load AI reasoning context.");
            } finally {
                setLoading(false);
            }
        };

        if (incidentId) fetchReasoning();
    }, [incidentId]);

    if (!incidentId) return (
        <div className="p-10 text-center">
            <h2 className="text-xl text-slate-400">Select an incident to view reasoning.</h2>
            <button onClick={() => navigate('/incidents')} className="mt-4 px-4 py-2 bg-blue-600 rounded">Go to Incidents</button>
        </div>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <Cpu size={48} className="text-blue-500 animate-pulse" />
            <div className="text-slate-400 text-sm">Deciphering neural pathways...</div>
        </div>
    );

    if (error) return (
        <div className="p-10 text-center text-[#B91C1C]">
            <AlertTriangle size={48} className="mx-auto mb-4" />
            {error}
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="heading-xl flex items-center gap-3">
                        <Brain className="text-violet-400" />
                        AI Decision Engine
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Trace ID: {data.incident_id} • Model: {data.model_used}
                        {data.fallback && <span className="ml-3 px-2 py-0.5 bg-amber-500/10 text-amber-500 text-xs rounded border border-amber-500/20">RULE-BASED FALLBACK</span>}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 🟢 PANEL 1: PROMPT VIEWER */}
                <div className="lg:col-span-3 rounded-2xl border overflow-hidden"
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-2">
                            <Terminal size={14} /> SYSTEM PROMPT
                        </span>
                        <button className="text-slate-500 hover:text-white transition-colors" title="Copy Prompt">
                            <Copy size={14} />
                        </button>
                    </div>
                    <div className="p-4 bg-black/50 text-xs text-slate-300 overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{data.llm_prompt}</pre>
                    </div>
                </div>

                {/* 🟣 PANEL 2: AI INTERPRETATION */}
                <div className="lg:col-span-1 p-6 rounded-2xl border relative overflow-hidden"
                    style={{ 
                        background: 'rgba(139, 92, 246, 0.05)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'rgba(139, 92, 246, 0.2)' 
                    }}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Brain size={100} />
                    </div>
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2 relative z-10">
                        <Search size={18} className="text-violet-400" /> Analysis
                    </h3>

                    <div className="space-y-6 relative z-10">
                        <div>
                            <div className="text-xs uppercase text-slate-500 font-bold mb-1">Classified Attack Type</div>
                            <div className="text-lg text-white font-bold tracking-wide">{data.analysis?.attack_type}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase text-slate-500 font-bold mb-1">Threat Objective</div>
                            <div className="text-sm text-slate-300 italic">"{data.analysis?.threat_goal}"</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase text-slate-500 font-bold mb-2">Affected Assets</div>
                            <div className="flex flex-wrap gap-2">
                                {data.analysis?.affected_assets?.map(asset => (
                                    <span key={asset} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                                        {asset}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🟡 PANEL 3: DECISION LOGIC */}
                <div className="lg:col-span-1 p-6 rounded-2xl border"
                    style={{ 
                        background: 'rgba(59, 130, 246, 0.05)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'rgba(59, 130, 246, 0.2)' 
                    }}
                >
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Cpu size={18} className="text-blue-400" /> Decision Logic
                    </h3>

                    <div className="space-y-4">
                        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-400 mb-1">Primary Factor</div>
                            <div className="text-sm font-medium text-white">{data.decision_logic?.why_high_risk}</div>
                        </div>

                        <div className="relative pl-4 space-y-4 border-l-2 border-slate-800">
                            {data.decision_logic?.reasoning_steps?.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="relative"
                                >
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900" />
                                    <p className="text-sm text-slate-300">{step}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 🔵 PANEL 5: CONFIDENCE METER (Placed here for layout balance) */}
                <div className="lg:col-span-1 p-6 rounded-2xl border flex flex-col items-center justify-center relative"
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <h3 className="absolute top-6 left-6 text-white font-bold text-sm">Confidence</h3>

                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-800" />
                            <motion.circle
                                cx="80" cy="80" r="70"
                                stroke="currentColor"
                                strokeWidth="10"
                                fill="transparent"
                                className={clsx(
                                    data.decision_logic?.confidence > 0.7 ? "text-green-500" :
                                        data.decision_logic?.confidence > 0.4 ? "text-yellow-500" : "text-[#B91C1C]"
                                )}
                                strokeDasharray={440}
                                strokeDashoffset={440 - (440 * data.decision_logic?.confidence)}
                                initial={{ strokeDashoffset: 440 }}
                                animate={{ strokeDashoffset: 440 - (440 * data.decision_logic?.confidence) }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-bold text-white">{(data.decision_logic?.confidence * 100).toFixed(0)}%</span>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Certainty</span>
                        </div>
                    </div>

                    <div className="mt-4 text-center px-4">
                        <p className="text-xs text-slate-400">
                            Based on signal correlation strength and historical pattern matching.
                        </p>
                    </div>
                </div>

                {/* 🔴 PANEL 4: RESPONSE STRATEGY */}
                <div className="lg:col-span-3 p-6 rounded-2xl border"
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <ShieldAlert size={18} className="text-emerald-400" /> Recommended Strategy
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                                <Lock size={14} /> Containment
                            </h4>
                            <ul className="space-y-3">
                                {data.recommended_strategy?.containment?.map((action, idx) => (
                                    <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)] text-red-200 text-sm">
                                        <div className="mt-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[rgba(185,28,28,0.2)] text-[10px] font-bold">!</div>
                                        {action}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                                <Search size={14} /> Investigation
                            </h4>
                            <ul className="space-y-3">
                                {data.recommended_strategy?.investigation?.map((action, idx) => (
                                    <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm">
                                        <div className="mt-0.5 text-blue-500"><CheckCircle size={14} /></div>
                                        {action}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Reasoning;
