import React, { useState } from 'react';
import api from '../services/api'; // kept for direct access if needed
import { usePipeline } from '../context/PipelineContext';
import { motion } from 'framer-motion';
import {
    Database,
    FileCode,
    Cpu,
    Search,
    Share2,
    FileJson,
    Play,
    CheckCircle,
    Loader2,
    AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import LiveEventStream from '../components/incidents/LiveEventStream';

const PipelineStep = ({ title, icon: Icon, status, count, time, index }) => {
    const statusColors = {
        idle: "bg-slate-800 border-slate-700 text-slate-500",
        processing: "bg-blue-900/20 border-blue-500/50 text-blue-400 animate-pulse",
        completed: "bg-green-900/20 border-green-500/50 text-green-400",
        failed: "bg-[rgba(185,28,28,0.1)] border-[rgba(185,28,28,0.2)] text-[#B91C1C]",
    };

    return (
        <div className="flex flex-col items-center relative z-10 w-full">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={clsx(
                    "w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all duration-500",
                    statusColors[status]
                )}
            >
                {status === 'processing' ? (
                    <Loader2 size={32} className="animate-spin" />
                ) : status === 'completed' ? (
                    <CheckCircle size={32} />
                ) : status === 'failed' ? (
                    <AlertCircle size={32} />
                ) : (
                    <Icon size={32} />
                )}
            </motion.div>

            <div className="mt-4 text-center">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-mono">
                    {status}
                </p>
            </div>

            {(status === 'completed' || status === 'processing') && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-xs text-slate-300 w-32"
                >
                    <div className="flex justify-between">
                        <span>Processed:</span>
                        <span className="font-mono text-white">{count}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="font-mono text-white">{time}s</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

const Pipeline = () => {
    const { isRunning, runPipeline } = usePipeline();
    const [steps, setSteps] = useState([
        { id: 'ingest', title: 'Log Ingestion', icon: Database, status: 'idle', count: 0, time: 0 },
        { id: 'normalize', title: 'Normalization', icon: FileCode, status: 'idle', count: 0, time: 0 },
        { id: 'features', title: 'Feature Extraction', icon: Cpu, status: 'idle', count: 0, time: 0 },
        { id: 'detect', title: 'Anomaly Detection', icon: Search, status: 'idle', count: 0, time: 0 },
        { id: 'correlate', title: 'Correlation Engine', icon: Share2, status: 'idle', count: 0, time: 0 },
        { id: 'playbooks', title: 'Playbook Generation', icon: FileJson, status: 'idle', count: 0, time: 0 },
    ]);

    // Sync visual steps with global isRunning state
    React.useEffect(() => {
        if (isRunning) {
            setSteps(prev => prev.map(s => ({ ...s, status: 'processing' })));
        } else {
            // Reset to completed after run (visual only)
            setSteps(prev => prev.map(s => ({
                ...s,
                status: s.status === 'processing' ? 'completed' : s.status
            })));
        }
    }, [isRunning]);

    const handleRun = async () => {
        setSteps(prev => prev.map(s => ({ ...s, status: 'idle', count: 0, time: 0 })));
        await runPipeline();
    };


    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="heading-xl text-white">SOC Data Pipeline</h2>
                    <p className="text-slate-400 mt-1">Monitor ingestion, detection, and response flows</p>
                </div>
                <button
                    onClick={handleRun}
                    disabled={isRunning}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 rounded-xl shadow-xl transition-all font-bold text-white",
                        isRunning ? "opacity-50 cursor-not-allowed bg-slate-800" : "hover:scale-105 active:scale-95 bg-[#00AEEF] hover:shadow-[0_0_20px_rgba(0,174,239,0.4)]"
                    )}
                >
                    {isRunning ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
                    {isRunning ? "Running Pipeline..." : "Execute Pipeline"}
                </button>
            </div>

            {/* Visual Flow */}
            <LiveEventStream />

            {/* Logs / Terminal Output Mock */}
            <div className="p-6 rounded-2xl font-mono text-sm text-slate-400 h-48 overflow-y-auto custom-scrollbar border" 
                style={{ 
                    background: 'rgba(0,0,0,0.4)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div className="flex items-center gap-2 mb-4 text-slate-500 border-b border-white/5 pb-2">
                    <div className="w-3 h-3 rounded-full bg-[#B91C1C]" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="ml-2">System Logs</span>
                </div>
                <div className="space-y-1">
                    <p>[SYSTEM] Ready to process incoming stream.</p>
                    {isRunning && (
                        <>
                            <p className="text-blue-400">[INFO] Ingesting logs from SIEM simulator...</p>
                            <p className="text-blue-300">[INFO] Normalizing structure to ECS format...</p>
                            <p className="text-violet-400">[AI] Extracting behavioral features...</p>
                            <p className="text-orange-400">[DETECT] Anomaly threshold exceeded (Score: 0.85)</p>
                            <p className="text-green-400">[SUCCESS] Incident #492 correlated successfully.</p>
                            <p className="text-green-300">[RESPONSE] Playbook generated for Brute Force attempt.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pipeline;
