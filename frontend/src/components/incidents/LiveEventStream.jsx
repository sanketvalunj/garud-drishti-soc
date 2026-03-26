import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Terminal,
    Activity,
    ShieldAlert,
    Search,
    Database,
    FileCode,
    Share2,
    AlertOctagon,
    CheckCircle2,
    Wifi,
    WifiOff
} from 'lucide-react';
import { usePipeline } from '../../context/PipelineContext';
import api from '../../services/api';
import clsx from 'clsx';

const STREAM_URL = 'http://127.0.0.1:8000/stream-events';

const SEV_STYLE = {
    critical: 'bg-[rgba(185,28,28,0.2)] text-[#B91C1C] border-[rgba(185,28,28,0.3)]',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const SEV_DOT = {
    critical: 'bg-[#B91C1C]',
    high: 'bg-orange-500',
    warning: 'bg-yellow-400',
    info: 'bg-blue-400',
};

// ─────────────────────────────────────────────
const LiveEventStream = () => {
    const { isRunning, lastRun } = usePipeline();

    // SSE log entries (real backend events)
    const [logs, setLogs] = useState([]);
    const [connected, setConnected] = useState(false);
    const [eventCount, setEventCount] = useState(0);
    const esRef = useRef(null);
    const logEndRef = useRef(null);

    // Pipeline animation
    const [activeStage, setActiveStage] = useState(0);

    // Incident feed
    const [incidents, setIncidents] = useState([]);
    const [newIncidentIds, setNewIncidentIds] = useState(new Set());
    const prevIncidentsRef = useRef([]);

    // ── 1. Connect to real SSE /stream-events ────────────────────────
    useEffect(() => {
        const connect = () => {
            if (esRef.current) return; // already open

            const es = new EventSource(STREAM_URL);
            esRef.current = es;

            es.onopen = () => {
                setConnected(true);
                console.log('[SSE] Connected to /stream-events');
            };

            // API to integrate — Handle real-time event ingestion from SSE
            es.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    const ts = new Date(data.timestamp).toLocaleTimeString();
                    const sev = (data.severity || 'info').toLowerCase();

                    setLogs(prev => [
                        {
                            id: Date.now() + Math.random(),
                            time: ts,
                            type: data.event_type || 'EVENT',
                            user: data.user || '—',
                            asset: data.asset || '—',
                            ip: data.source_ip || '',
                            severity: sev,
                        },
                        ...prev,
                    ].slice(0, 50)); // keep last 50

                    setEventCount(c => c + 1);
                } catch (err) {
                    console.error('[SSE] parse error', err);
                }
            };

            es.onerror = () => {
                setConnected(false);
                es.close();
                esRef.current = null;
                // reconnect after 3 s
                setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, []);

    // ── 2. Pipeline stage animation while running ─────────────────────
    useEffect(() => {
        if (!isRunning) { setActiveStage(0); return; }
        const t = setInterval(() => setActiveStage(p => p < 4 ? p + 1 : p), 1000);
        return () => clearInterval(t);
    }, [isRunning]);

    // API to integrate — Fetch real-time incidents from backend
    const fetchIncidents = async () => {
        try {
            const res = await api.getIncidents();
            const cur = res.incidents || [];
            if (prevIncidentsRef.current.length > 0) {
                const prevIds = new Set(prevIncidentsRef.current.map(i => i.incident_id));
                const newIds = new Set(cur.filter(i => !prevIds.has(i.incident_id)).map(i => i.incident_id));
                if (newIds.size > 0) {
                    setNewIncidentIds(newIds);
                    setTimeout(() => setNewIncidentIds(new Set()), 10000);
                }
            }
            setIncidents(cur);
            prevIncidentsRef.current = cur;
        } catch (e) {
            console.error('Incident fetch failed', e);
        }
    };

    useEffect(() => { fetchIncidents(); }, []);
    useEffect(() => { if (!isRunning && lastRun) { fetchIncidents(); setActiveStage(4); } }, [isRunning, lastRun]);

    // ── Stages ────────────────────────────────────────────────────────
    const stages = [
        { id: 'ingest', label: 'Ingest', icon: Database },
        { id: 'norm', label: 'Normalize', icon: FileCode },
        { id: 'detect', label: 'Detect', icon: Search },
        { id: 'correlate', label: 'Correlate', icon: Share2 },
        { id: 'response', label: 'Response', icon: ShieldAlert },
    ];

    // ─────────────────────────────────────────────────────────────────
    return (
        <div className="p-0 rounded-2xl overflow-hidden border grid grid-cols-1 lg:grid-cols-12 h-[350px]"
            style={{ 
                background: 'var(--surface-color)', 
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderColor: 'var(--glass-border)' 
            }}
        >

            {/* ── LEFT: Real SSE log stream ── */}
            <div className="lg:col-span-3 bg-slate-950/50 border-r border-slate-800 p-4 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Terminal size={14} />
                        Live Ingestion
                    </h3>
                    <span className={clsx(
                        'flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                        connected
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-slate-500 bg-slate-800 border-slate-700'
                    )}>
                        {connected
                            ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</>
                            : <><WifiOff size={10} /> OFF</>}
                    </span>
                </div>

                {/* Event count */}
                {connected && (
                    <div className="text-[10px] text-slate-600 mb-2">
                        {eventCount} events ingested this session
                    </div>
                )}

                {/* Log rows */}
                <div className="flex-1 overflow-hidden relative">
                    <div className="space-y-1.5 absolute inset-0 overflow-y-auto custom-scrollbar pr-1">
                        <AnimatePresence initial={false}>
                            {logs.map(log => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="text-[11px] p-2 rounded-lg bg-slate-900/80 border border-slate-800/80"
                                >
                                    {/* Severity dot + type */}
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', SEV_DOT[log.severity] || 'bg-slate-500')} />
                                        <span className={clsx('px-1 py-0.5 rounded text-[9px] font-bold uppercase border', SEV_STYLE[log.severity] || SEV_STYLE.info)}>
                                            {log.type}
                                        </span>
                                        <span className="text-slate-600 ml-auto">{log.time}</span>
                                    </div>
                                    {/* Details */}
                                    <div className="text-slate-400 truncate pl-3">
                                        {log.user} → <span className="text-slate-300">{log.asset}</span>
                                        {log.ip && <span className="text-slate-600 ml-1">({log.ip})</span>}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {logs.length === 0 && (
                            <div className="text-slate-600 text-xs italic text-center mt-10 flex flex-col items-center gap-2">
                                <WifiOff size={20} className="opacity-30" />
                                {connected ? 'Waiting for first event...' : 'Connecting to stream...'}
                            </div>
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            {/* ── CENTER: Pipeline animation ── */}
            <div className="lg:col-span-6 p-6 flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900/0 to-slate-900/0 pointer-events-none" />

                <div className="flex items-center gap-2 md:gap-4 relative z-10 w-full justify-center">
                    {stages.map((stage, idx) => {
                        const isActive = isRunning && activeStage === idx;
                        const isPast = activeStage > idx;

                        return (
                            <React.Fragment key={stage.id}>
                                <div className="flex flex-col items-center gap-2">
                                    <motion.div
                                        animate={{
                                            scale: isActive ? 1.1 : 1,
                                            boxShadow: isActive ? '0 0 20px rgba(59,130,246,0.3)' : '0 0 0px rgba(0,0,0,0)',
                                            borderColor: isActive || isPast ? '#3b82f6' : 'var(--glass-border)',
                                        }}
                                        className={clsx(
                                            'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
                                            isActive ? 'text-blue-400 bg-blue-900/40' :
                                                isPast ? 'text-blue-500 border-blue-500' :
                                                    'text-slate-600 bg-white/5'
                                        )}
                                        style={{ backdropFilter: 'blur(10px)' }}
                                    >
                                        <stage.icon size={20} />
                                    </motion.div>
                                    <span className={clsx(
                                        'text-[10px] font-bold uppercase tracking-wider transition-colors duration-300',
                                        isActive || isPast ? 'text-blue-400' : 'text-slate-600'
                                    )}>
                                        {stage.label}
                                    </span>
                                </div>

                                {idx < stages.length - 1 && (
                                    <div className="flex-1 max-w-[40px] h-[2px] bg-slate-800 relative overflow-hidden">
                                        {(isActive || isPast) && (
                                            <motion.div
                                                initial={{ x: '-100%' }}
                                                animate={{ x: '100%' }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                className="absolute inset-0 bg-blue-500"
                                            />
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="mt-8 h-6 text-center">
                    {isRunning ? (
                        <div className="flex items-center gap-2 text-blue-400 text-sm font-medium animate-pulse">
                            <Activity size={16} /> Processing Events...
                        </div>
                    ) : (
                        <div className="text-slate-500 text-sm flex items-center gap-2">
                            {connected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                            System Monitoring Active
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Incident feed ── */}
            <div className="lg:col-span-3 bg-slate-950/30 border-l border-slate-800 p-4 flex flex-col">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-[#B91C1C]" /> Recent Incidents
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                    <AnimatePresence>
                        {incidents.slice(0, 5).map(inc => {
                            const isNew = newIncidentIds.has(inc.incident_id);
                            return (
                                <motion.div
                                    key={inc.incident_id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1, borderColor: isNew ? '#B91C1C' : 'var(--glass-border)' }}
                                    layout
                                    className={clsx(
                                        'p-3 rounded-lg border relative overflow-hidden',
                                        isNew ? 'bg-[rgba(185,28,28,0.1)] shadow-[0_0_15px_rgba(185,28,28,0.2)]' : 'bg-white/5'
                                    )}
                                    style={{ backdropFilter: 'blur(10px)' }}
                                >
                                    {isNew && (
                                        <div className="absolute top-0 right-0 bg-[#B91C1C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl">
                                            NEW
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs text-slate-400">{inc.incident_id?.substring(0, 8)}</span>
                                        <span className={clsx(
                                            'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase',
                                            inc.severity === 'Critical' ? 'bg-[rgba(185,28,28,0.1)] text-[#B91C1C]' :
                                                inc.severity === 'High' ? 'bg-orange-500/10 text-orange-400' :
                                                    'bg-blue-500/10 text-blue-400'
                                        )}>
                                            {inc.severity || 'HIGH'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-200 line-clamp-2 font-medium">
                                        {inc.summary || inc.threat_type || 'Security Incident Detected'}
                                    </p>
                                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                        <AlertOctagon size={10} />
                                        Risk: {typeof inc.risk_score === 'number'
                                            ? (inc.risk_score > 1 ? inc.risk_score.toFixed(0) : (inc.risk_score * 100).toFixed(0) + '%')
                                            : inc.risk_score ?? '—'}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    {incidents.length === 0 && (
                        <div className="text-center py-10 text-slate-600 text-xs">
                            <CheckCircle2 size={24} className="mx-auto mb-2 opacity-20" />
                            No active incidents
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveEventStream;
