import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Brain,
    Play,
    Database,
    Server,
    Terminal,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Cpu,
    HardDrive,
    Clock,
    Zap
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

const Card = ({ title, icon: Icon, children, className }) => (
    <div className={clsx("glass-panel p-5 rounded-2xl border border-slate-700/50 flex flex-col relative overflow-hidden", className)}>
        <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-wider relative z-10">
            <Icon size={16} />
            {title}
        </div>
        <div className="relative z-10 flex-1 flex flex-col">
            {children}
        </div>
        {/* Glow Effect */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
    </div>
);

const Admin = () => {
    const [health, setHealth] = useState(null);
    const [model, setModel] = useState(null);
    const [pipeline, setPipeline] = useState(null);
    const [storage, setStorage] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev.slice(-49), { id: Date.now(), msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const fetchData = useCallback(async () => {
        try {
            const [h, m, p, s, n] = await Promise.all([
                api.getSystemHealth(),
                api.getModelStatus(),
                api.getPipelineStatus(),
                api.getStorageStatus(),
                api.getNodes()
            ]);
            setHealth(h);
            setModel(m);
            setPipeline(p);
            setStorage(s);
            setNodes(n);

            if (p.status === 'running') {
                setIsRunning(true);
            } else if (isRunning && p.status === 'completed') {
                setIsRunning(false);
                addLog(`Pipeline completed. Incidents generated: ${p.incidents_generated}`, 'success');
            }
        } catch (err) {
            console.error("Admin poll failed", err);
            // Don't flood logs
        }
    }, [isRunning]);

    useEffect(() => {
        fetchData(); // Initial
        const interval = setInterval(fetchData, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRunPipeline = async () => {
        try {
            addLog("Initiating manual pipeline execution...", "info");
            setIsRunning(true);
            const res = await api.runPipeline();
            if (res.status === 'started') {
                addLog(`Pipeline started. ETA: ${res.estimated_time}`, "success");
            } else {
                addLog(`Failed to start: ${res.message}`, "error");
                setIsRunning(false);
            }
        } catch (err) {
            addLog("Error triggering pipeline", "error");
            setIsRunning(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-8">
                <div>
                    <h1 className="heading-xl flex items-center gap-3">
                        <Terminal className="text-pink-500" />
                        System Control Center
                    </h1>
                    <p className="text-slate-400 text-sm font-mono mt-1">
                        Garud Drishti SOC • v2.4.0-stable • {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 🟢 CARD 1: SYSTEM HEALTH */}
                <Card title="System Health" icon={Activity}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg",
                                health?.status === 'healthy' ? "bg-green-500 shadow-green-500/20" : "bg-red-500 animate-pulse"
                            )}>
                                <Activity size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white uppercase">{health?.status || 'Unknown'}</div>
                                <div className="text-xs text-slate-400 font-mono">Backend Service</div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="text-slate-500 mb-1">Uptime</div>
                            <div className="text-white font-mono">{health?.uptime || '--'}</div>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="text-slate-500 mb-1">Latency</div>
                            <div className="text-white font-mono text-green-400">{health?.api_latency_ms}ms</div>
                        </div>
                    </div>
                </Card>

                {/* 🟣 CARD 2: AI ENGINE STATUS */}
                <Card title="AI Engine Status" icon={Brain}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-300 font-mono text-xs">Model</span>
                        <span className="text-violet-400 font-bold text-sm bg-violet-500/10 px-2 py-1 rounded border border-violet-500/20">
                            {model?.model_name || 'Loading...'}
                        </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4">
                        <div className="relative w-24 h-24 mb-4">
                            <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                            <div className="absolute inset-0 border-4 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Brain size={32} className="text-violet-500" />
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-white font-bold text-lg">{model?.llm_available ? "Operational" : "Offline"}</div>
                            <div className="text-xs text-slate-500">Last Inference: {new Date(model?.last_inference).toLocaleTimeString()}</div>
                        </div>
                    </div>
                </Card>

                {/* 🟡 CARD 3: PIPELINE CONTROL */}
                <Card title="Pipeline Control" icon={Zap}>
                    <div className="flex-1 flex flex-col justify-center">
                        <button
                            onClick={handleRunPipeline}
                            disabled={isRunning}
                            className={clsx(
                                "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
                                isRunning
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 border border-blue-500"
                            )}
                        >
                            {isRunning ? (
                                <>
                                    <Cpu className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play fill="currentColor" />
                                    Run Pipeline
                                </>
                            )}
                        </button>

                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase text-slate-400">
                                <span>Stage: {pipeline?.stage || 'Idle'}</span>
                                <span>{pipeline?.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pipeline?.progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 🔵 CARD 4: STORAGE STATUS */}
                <Card title="Data Storage" icon={HardDrive}>
                    <div className="space-y-3">
                        {storage?.files && Object.entries(storage.files).map(([file, exists]) => (
                            <div key={file} className="flex items-center justify-between p-2 rounded bg-slate-900/30 border border-slate-800">
                                <span className="flex items-center gap-2 text-sm text-slate-300 font-mono">
                                    <Database size={12} className="text-slate-500" /> {file}
                                </span>
                                {exists ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-800/50 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Disk Usage</span>
                        <span className="text-xl font-mono font-bold text-white">{storage?.disk_usage_mb} MB</span>
                    </div>
                </Card>

                {/* 🔴 CARD 5: CONNECTED NODES */}
                <Card title="Network Nodes" icon={Server}>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {nodes?.map((node, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={clsx("w-2 h-2 rounded-full", node.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500")} />
                                    <div>
                                        <div className="text-sm font-bold text-white">{node.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase">{node.type}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{node.last_seen}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* ⚙️ CARD 6: SYSTEM LOG PANEL */}
                <Card title="System Logs" icon={Terminal} className="lg:col-span-1">
                    <div className="flex-1 bg-black/40 rounded-lg p-3 font-mono text-[10px] space-y-1 overflow-y-auto max-h-[160px] custom-scrollbar border border-slate-800/50">
                        {logs.length === 0 && <span className="text-slate-600 italic">Waiting for system events...</span>}
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-2">
                                <span className="text-slate-500">[{log.time}]</span>
                                <span className={clsx(
                                    log.type === 'error' ? "text-red-400" :
                                        log.type === 'success' ? "text-green-400" :
                                            "text-blue-300"
                                )}>
                                    {log.msg}
                                </span>
                            </div>
                        ))}
                        {/* Dummy Cursor */}
                        <div className="w-1.5 h-3 bg-blue-500 animate-pulse mt-1" />
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Admin;
