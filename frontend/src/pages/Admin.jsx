import React, { useState, useEffect, useCallback } from 'react';
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
    Zap
} from 'lucide-react';
import api from '../services/api';

const Card = ({ title, icon: Icon, children, className }) => (
    <div className={`p-6 rounded-xl shadow-sm border flex flex-col ${className || ''}`} 
        style={{ 
            background: 'var(--surface-color)', 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'var(--glass-border)' 
        }}
    >
        <div className="flex items-center gap-2 mb-6 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Icon size={18} style={{ color: 'var(--text-primary)' }} />
            {title}
        </div>
        <div className="flex-1 flex flex-col">
            {children}
        </div>
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
        }
    }, [isRunning]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 2000);
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
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="p-6 rounded-xl shadow-sm border flex items-center justify-between" 
                style={{ 
                    background: 'var(--surface-color)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        <Terminal className="text-[#00AEEF]" size={28} />
                        System Control Center
                    </h1>
                    <p className="mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Manage core services, AI engines, and monitor cluster health
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Version Info</div>
                    <div className="font-mono text-sm px-3 py-1 rounded border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}>
                        v2.4.0-stable
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* 1. SYSTEM HEALTH */}
                <Card title="System Health" icon={Activity}>
                    <div className="flex items-center gap-4 mb-8">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-sm ${
                            health?.status === 'healthy' ? "bg-green-100 text-green-600" : "bg-[rgba(185,28,28,0.1)] text-[#B91C1C] animate-pulse"
                        }`}>
                            <Activity size={28} />
                        </div>
                        <div>
                            <div className={`text-2xl font-bold ${health?.status === 'healthy' ? 'text-green-600' : 'text-[#B91C1C]'}`}>
                                {health?.status === 'healthy' ? 'Healthy' : health?.status || 'Unknown'}
                            </div>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Core Backend Services</div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                        <div className="p-4 rounded-lg border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--glass-border)' }}>
                            <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Uptime</div>
                            <div className="font-mono font-medium text-base" style={{ color: 'var(--text-primary)' }}>{health?.uptime || '--'}</div>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--glass-border)' }}>
                            <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>API Latency</div>
                            <div className="font-mono font-medium text-base text-green-600">{health?.api_latency_ms || 0}ms</div>
                        </div>
                    </div>
                </Card>

                {/* 2. AI ENGINE STATUS */}
                <Card title="AI Engine Status" icon={Brain}>
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Active Model</span>
                        <span className="font-mono font-bold text-xs px-3 py-1.5 rounded border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}>
                            {model?.model_name || 'Loading...'}
                        </span>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center py-6">
                        <div className="relative w-28 h-28 mb-6">
                            {/* Base Ring */}
                            <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                            {/* Animated Activity Ring */}
                            <div className={`absolute inset-0 border-4 ${model?.llm_available ? 'border-t-indigo-500 animate-spin' : 'border-gray-300'} border-r-transparent border-b-transparent border-l-transparent rounded-full`} style={{ animationDuration: '3s' }} />
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Brain size={40} className={model?.llm_available ? "text-indigo-500" : ""} style={{ color: !model?.llm_available ? 'var(--text-muted)' : '' }} />
                            </div>
                        </div>
                        
                        <div className="text-center">
                            <div className={`text-xl font-bold mb-1 ${model?.llm_available ? "" : ""}`} style={{ color: model?.llm_available ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {model?.llm_available ? "Operational" : "Offline / Unreachable"}
                            </div>
                            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                Last Inference: {model?.last_inference ? new Date(model.last_inference).toLocaleTimeString() : '--:--:--'}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 3. PIPELINE CONTROL */}
                <Card title="Pipeline Control" icon={Zap}>
                    <div className="flex-1 flex flex-col">
                         <div className="mb-8">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Current Stage</span>
                                <span className="font-bold text-[10px] px-2 py-0.5 rounded border" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                                    {pipeline?.stage === 'idle' ? 'Idle' : pipeline?.stage === 'running' ? 'Running' : pipeline?.stage === 'completed' ? 'Completed' : (pipeline?.stage || 'Idle')}
                                </span>
                            </div>
                            
                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 mt-4">
                                <span>Progress</span>
                                <span>{pipeline?.progress || 0}%</span>
                            </div>
                            
                            <div className="w-full h-3 rounded-full overflow-hidden border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>
                                <div
                                    className="h-full bg-[#00AEEF] transition-all duration-500 ease-out relative"
                                    style={{ width: `${pipeline?.progress || 0}%` }}
                                >
                                    {isRunning && (
                                         <div className="absolute inset-0 bg-white/20 animate-[pulse_1s_ease-in-out_infinite]" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleRunPipeline}
                            disabled={isRunning}
                            className={`mt-auto w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all border ${
                                isRunning
                                    ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : "bg-[#0B1F3B] hover:bg-gray-800 text-white border-transparent shadow-sm"
                            }`}
                        >
                            {isRunning ? (
                                <>
                                    <Cpu size={18} className="animate-spin" />
                                    Processing Pipeline...
                                </>
                            ) : (
                                <>
                                    <Play size={18} fill="currentColor" />
                                    Trigger Manual Run
                                </>
                            )}
                        </button>
                    </div>
                </Card>

                {/* 4. DATA STORAGE */}
                <Card title="Data Storage" icon={HardDrive}>
                    <div className="space-y-3 mb-6">
                        {storage?.files ? Object.entries(storage.files).map(([file, exists]) => (
                            <div key={file} className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--glass-border)' }}>
                                <span className="flex items-center gap-3 text-sm font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    <Database size={16} style={{ color: 'var(--text-muted)' }} /> 
                                    {file}
                                </span>
                                {exists ? (
                                    <CheckCircle size={18} className="text-green-500" />
                                ) : (
                                    <XCircle size={18} className="text-[#B91C1C]" />
                                )}
                            </div>
                        )) : (
                            <div className="text-center py-4 text-sm text-gray-500">No storage data available</div>
                        )}
                    </div>
                    
                    <div className="mt-auto pt-4 border-t flex justify-between items-end" style={{ borderColor: 'var(--glass-border)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Total Disk Usage</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{storage?.disk_usage_mb || 0}</span>
                            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>MB</span>
                        </div>
                    </div>
                </Card>

                {/* 5. NETWORK NODES */}
                <Card title="Network Nodes" icon={Server}>
                    <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 h-[200px]">
                        {nodes && nodes.length > 0 ? nodes.map((node, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-white/5 transition-all group" style={{ borderColor: 'var(--glass-border)' }}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-2.5 h-2.5 rounded-full ${node.status === 'active' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`} />
                                    <div>
                                        <div className="text-sm font-bold group-hover:text-[#00AEEF] transition-colors" style={{ color: 'var(--text-primary)' }}>{node.name}</div>
                                        <div className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{node.type === 'database' ? 'Database' : node.type === 'gateway' ? 'Gateway' : node.type}</div>
                                    </div>
                                </div>
                                <div className="text-xs font-mono font-medium" style={{ color: 'var(--text-muted)' }}>
                                    {node.last_seen}
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-4 text-sm text-gray-500">No active nodes detected</div>
                        )}
                    </div>
                </Card>

                {/* 6. SYSTEM LOGS */}
                <Card title="System Logs" icon={Terminal} className="xl:col-span-1 border-t-4 border-t-gray-800">
                    <div className="flex-1 bg-gray-900 rounded-lg p-4 font-mono text-[11px] leading-relaxed space-y-1.5 overflow-y-auto h-[200px] custom-scrollbar shadow-inner relative">
                        {logs.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500 italic">
                                Waiting for system events...
                            </div>
                        )}
                        
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded transition-colors break-words">
                                <span className="text-gray-500 shrink-0">[{log.time}]</span>
                                <span className={`font-medium ${
                                    log.type === 'error' ? "text-[#B91C1C]" :
                                    log.severity === 'critical' ? 'text-[#B91C1C]' :
                                    "text-blue-300"
                                }`}>
                                    {log.msg}
                                </span>
                            </div>
                        ))}
                        
                        {/* Blinking Cursor */}
                        <div className="flex gap-3 px-1 py-0.5 mt-2">
                            <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
                            <div className="w-2 h-3.5 bg-gray-400 animate-pulse" />
                        </div>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Admin;
