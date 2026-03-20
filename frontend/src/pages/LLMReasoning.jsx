import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Brain, Cpu, ShieldAlert, CheckCircle, AlertTriangle,
    Lock, Search, RefreshCw, Terminal, Zap, ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

// ─── Sub-Components ────────────────────────────────────────────

const LoadingState = () => (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Cpu size={48} className="text-blue-500 animate-pulse" />
        <div className="text-slate-400 text-sm">Deciphering neural pathways...</div>
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500"
                animate={{ x: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            />
        </div>
    </div>
);

const EmptyState = ({ onNavigate }) => (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
            <Brain size={48} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Reasoning Available Yet</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-6">
                No reasoning data yet. Run the pipeline to generate AI analysis, then navigate here from an incident.
            </p>
            <button
                onClick={() => onNavigate('/pipeline')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all flex items-center gap-2 mx-auto"
            >
                <Zap size={16} /> Run Pipeline
            </button>
        </div>
    </div>
);

const ErrorState = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
        <AlertTriangle size={48} className="text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Could Not Load Reasoning</h3>
        <p className="text-slate-400 text-sm">{message}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all flex items-center gap-2">
            <RefreshCw size={14} /> Retry
        </button>
    </div>
);

// ─── Main Component ────────────────────────────────────────────
const LLMReasoning = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLatestReasoning = async () => {
        setLoading(true);
        setError(null);
        try {
            // Step 1: Get incidents list
            const incData = await api.getIncidents();
            const incidents = incData.incidents || [];
            console.log('LLM reasoning:', 'incidents loaded', incidents.length);

            if (incidents.length === 0) {
                setData(null);
                setLoading(false);
                return;
            }

            // Step 2: Try fetching reasoning for the most recent incident
            const latest = incidents[incidents.length - 1];
            const result = await api.getIncidentReasoning(latest.incident_id);
            console.log('LLM reasoning:', result);
            setData({ ...result, _incident: latest });
        } catch (err) {
            console.error('LLM reasoning:', err);
            setError(err.message || 'Failed to load AI reasoning. Backend may be offline.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLatestReasoning(); }, []);

    const confidence = data?.decision_logic?.confidence ?? 0;
    const confidencePct = Math.round(confidence * 100);
    const confidenceColor = confidence > 0.7 ? 'text-green-500' : confidence > 0.4 ? 'text-yellow-500' : 'text-[#B91C1C]';

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Brain className="text-violet-400" /> AI Decision Engine
                        </h1>
                        <p className="text-slate-400 text-sm mt-0.5">
                            {data ? `Incident: ${data.incident_id || data._incident?.incident_id} · Model: ${data.model_used || 'gpt-4'}` : 'Latest incident analysis'}
                            {data?.fallback && <span className="ml-3 px-2 py-0.5 bg-amber-500/10 text-amber-500 text-xs rounded border border-amber-500/20">RULE-BASED FALLBACK</span>}
                        </p>
                    </div>
                </div>
                <button onClick={fetchLatestReasoning} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 transition-all text-sm">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* States */}
            {loading && <LoadingState />}
            {!loading && error && <ErrorState message={error} onRetry={fetchLatestReasoning} />}
            {!loading && !error && !data && <EmptyState onNavigate={navigate} />}

            {/* Data View */}
            {!loading && !error && data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* AI Narrative Card */}
                    {data.llm_prompt && (
                        <div className="lg:col-span-3 rounded-2xl border overflow-hidden"
                            style={{ 
                                background: 'var(--surface-color)', 
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                borderColor: 'var(--glass-border)' 
                            }}
                        >
                            <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-700 flex items-center gap-2">
                                <Terminal size={14} className="text-slate-400" />
                                <span className="text-xs text-slate-400 uppercase tracking-wider">AI Narrative / System Prompt</span>
                            </div>
                            <div className="p-4 bg-black/50 text-xs text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
                                <pre className="whitespace-pre-wrap">{data.llm_prompt}</pre>
                            </div>
                        </div>
                    )}

                    {/* Analysis Panel */}
                    <div className="lg:col-span-1 p-6 rounded-2xl border relative overflow-hidden"
                        style={{ 
                            background: 'rgba(139, 92, 246, 0.05)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'rgba(139, 92, 246, 0.2)' 
                        }}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-10"><Brain size={80} /></div>
                        <h3 className="text-white font-bold mb-5 flex items-center gap-2 relative z-10">
                            <Search size={16} className="text-violet-400" /> Analysis
                        </h3>
                        <div className="space-y-5 relative z-10">
                            <div>
                                <div className="text-xs uppercase text-slate-500 font-bold mb-1">Attack Type</div>
                                <div className="text-base text-white font-bold">{data.analysis?.attack_type || '—'}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase text-slate-500 font-bold mb-1">Threat Objective</div>
                                <div className="text-sm text-slate-300 italic">"{data.analysis?.threat_goal || 'Unknown'}"</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase text-slate-500 font-bold mb-2">Affected Assets</div>
                                <div className="flex flex-wrap gap-2">
                                    {(data.analysis?.affected_assets || [data._incident?.asset].filter(Boolean)).map(asset => (
                                        <span key={asset} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">{asset}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decision Logic */}
                    <div className="lg:col-span-1 p-6 rounded-2xl border"
                        style={{ 
                            background: 'rgba(59, 130, 246, 0.05)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'rgba(59, 130, 246, 0.2)' 
                        }}
                    >
                        <h3 className="text-white font-bold mb-5 flex items-center gap-2">
                            <Cpu size={16} className="text-blue-400" /> Decision Logic
                        </h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                <div className="text-xs text-slate-400 mb-1">Primary Factor</div>
                                <div className="text-sm font-medium text-white">{data.decision_logic?.why_high_risk || 'Pattern correlation detected'}</div>
                            </div>
                            <div className="space-y-3 border-l-2 border-slate-800 pl-4">
                                {(data.decision_logic?.reasoning_steps || ['Analyzed event correlation', 'Cross-referenced threat intelligence', 'Applied behavioral baselining']).map((step, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900" />
                                        <p className="text-sm text-slate-300">{step}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Confidence Meter */}
                    <div className="lg:col-span-1 p-6 rounded-2xl border flex flex-col items-center justify-center relative"
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="absolute top-5 left-5 text-white font-bold text-sm">Confidence</h3>
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="72" cy="72" r="60" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                                <motion.circle
                                    cx="72" cy="72" r="60"
                                    stroke="currentColor"
                                    strokeWidth="10" fill="transparent"
                                    className={confidenceColor}
                                    strokeDasharray={377}
                                    initial={{ strokeDashoffset: 377 }}
                                    animate={{ strokeDashoffset: 377 - (377 * confidence) }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-bold text-white">{confidencePct}%</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Certainty</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 text-center mt-4 px-4">
                            Based on signal correlation strength and historical pattern matching.
                        </p>
                    </div>

                    {/* Response Strategy */}
                    <div className="lg:col-span-3 p-6 rounded-2xl border"
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="text-white font-bold mb-5 flex items-center gap-2">
                            <ShieldAlert size={16} className="text-emerald-400" /> Recommended Containment Strategy
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2 flex items-center gap-2">
                                    <Lock size={12} /> Containment Actions
                                </h4>
                                <ul className="space-y-2">
                                    {(data.recommended_strategy?.containment || ['Isolate affected endpoints immediately', 'Block suspicious IP ranges', 'Revoke active sessions for flagged users']).map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)] text-red-200 text-sm">
                                            <div className="mt-0.5 min-w-4 h-4 flex items-center justify-center rounded-full bg-[rgba(185,28,28,0.2)] text-[10px] font-bold">!</div>
                                            {action}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2 flex items-center gap-2">
                                    <Search size={12} /> Investigation Steps
                                </h4>
                                <ul className="space-y-2">
                                    {(data.recommended_strategy?.investigation || ['Review authentication logs for anomalies', 'Correlate with SIEM alerts from last 24h', 'Check lateral movement indicators']).map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm">
                                            <CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                            {action}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LLMReasoning;
