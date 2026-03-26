import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle, ShieldAlert, Clock, Activity,
    ArrowUp, ChevronRight, ExternalLink, Loader2, ArrowRight, Play, RefreshCw,
    Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePipeline } from '../context/PipelineContext';
import { useAuth } from '../context/AuthContext';
import {
    BarChart, Bar, Cell, PieChart, Pie, XAxis, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import api from '../services/api';
import LiveEventStream from '../components/incidents/LiveEventStream';

// New AI Observability Components
import AIPipeline from '../components/AIPipeline';
import AIReasoningPanel from '../components/AIReasoningPanel';
import LLMReasoningViewer from '../components/LLMReasoningViewer';
import AttackTimeline from '../components/AttackTimeline';
import RiskChart from '../components/RiskChart';
import MitreMapping from '../components/MitreMapping';
import PlaybookViewer from '../components/incidents/PlaybookViewer';
import AutomationPanel from '../components/AutomationPanel';

// ─── LIVE STREAM CONSTANTS ──────────────────────────────────
// API to integrate
const INITIAL_LIVE_EVENTS = [
    { id: 'evt-001', time: '12:13:45', type: 'Login Failed', entity: 'swift-terminal', severity: 'medium', source: 'IAM', isNew: false, incidentId: 'INC-2091' },
    { id: 'evt-002', time: '12:13:01', type: 'Access Attempt', entity: 'core-banking', severity: 'high', source: 'EDR', isNew: false, incidentId: 'INC-2090' },
    { id: 'evt-003', time: '12:12:33', type: 'Lateral Movement', entity: 'loan-db', severity: 'high', source: 'SIEM', isNew: false, incidentId: 'INC-2089' }
];

// API to integrate
const NEW_EVENTS_POOL = [
    { type: 'Anomalous Login', entity: 'emp_201', severity: 'medium', source: 'IAM', incidentId: 'INC-2091' },
    { type: 'Port Scan Detected', entity: 'vpn-gateway', severity: 'low', source: 'SIEM', incidentId: 'INC-2088' },
    { type: 'Privilege Escalation', entity: 'emp_088', severity: 'high', source: 'EDR', incidentId: 'INC-2091' },
    { type: 'Data Transfer', entity: 'file-server', severity: 'medium', source: 'DLP', incidentId: 'INC-2089' },
    { type: 'Failed Auth', entity: 'api-gateway', severity: 'low', source: 'WAF', incidentId: 'INC-2087' }
];

const generateSparkline = (points, min, max) => {
    return Array.from({ length: points }, () => Math.floor(Math.random() * (max - min) + min));
};

// ─── MOCK DATA ──────────────────────────────────────────────
// API to integrate
const mockIncidents = [
    { id: 'INC-2091', type: 'Privilege Escalation', entity: 'emp_104', score: 0.87, severity: 'HIGH', status: 'Investigating', time: '2 min ago' },
    { id: 'INC-2090', type: 'Lateral Movement', entity: 'auth-server', score: 0.65, severity: 'HIGH', status: 'Investigating', time: '5 min ago' },
    { id: 'INC-2089', type: 'Data Exfiltration', entity: 'db_admin', score: 0.92, severity: 'HIGH', status: 'Investigating', time: '12 min ago' },
    { id: 'INC-2088', type: 'Brute Force Attempt', entity: 'vpn_gateway', score: 0.45, severity: 'MEDIUM', status: 'Contained', time: '1 hr ago' },
    { id: 'INC-2087', type: 'Anomalous Login', entity: 'emp_221', score: 0.38, severity: 'LOW', status: 'Contained', time: '3 hrs ago' },
    { id: 'INC-2086', type: 'Excessive File Access', entity: 'file_server_01', score: 0.55, severity: 'HIGH', status: 'Investigating', time: '4 hrs ago' },
    { id: 'INC-2085', type: 'Malware Detected', entity: 'user_laptop_88', score: 0.98, severity: 'HIGH', status: 'Escalated', time: '5 hrs ago' },
    { id: 'INC-2084', type: 'Suspicious Execution', entity: 'web_server_prod', score: 0.41, severity: 'MEDIUM', status: 'Contained', time: '6 hrs ago' },
];

// API to integrate
const mockSeverityData = [
    { name: 'High', value: 23, color: '#B91C1C' },
    { name: 'Medium', value: 18, color: '#D97706' },
    { name: 'Low', value: 6, color: '#00AEEF' }
];

// API to integrate
const mockCategoryData = [
    { name: 'Privilege Escalation', value: 28, color: '#00395D' },
    { name: 'Lateral Movement', value: 22, color: '#0067A5' },
    { name: 'Data Exfiltration', value: 19, color: '#00AEEF' },
    { name: 'Brute Force', value: 16, color: '#3ABEF9' },
    { name: 'Anomaly', value: 15, color: '#7DD3FC' }
];

// Helper components
const SeverityBadge = ({ severity }) => {
    const colors = {
        HIGH: { bg: 'rgba(185,28,28,0.12)', text: '#B91C1C', border: 'rgba(185,28,28,0.2)' },
        MEDIUM: { bg: 'rgba(217,119,6,0.12)', text: '#D97706', border: 'rgba(217,119,6,0.2)' },
        LOW: { bg: 'rgba(0,174,239,0.12)', text: '#00AEEF', border: 'rgba(0,174,239,0.2)' }
    };
    const style = colors[severity] || colors.LOW;
    return (
        <span className="px-2 py-0.5 rounded font-semibold text-xs border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
            {severity === 'HIGH' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW'}
        </span>
    );
};

const FidelityBadge = ({ score }) => {
    const isCritical = score >= 0.85;
    return (
        <span className={`text-xs ${isCritical ? 'text-[#B91C1C] font-semibold' : ''}`} style={{ color: isCritical ? '#B91C1C' : 'var(--text-secondary)' }}>
            {score.toFixed(2)}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const colors = {
        Investigating: 'bg-gray-100 text-gray-600',
        Contained: 'bg-green-100 text-green-700 border-green-200',
        Escalated: 'bg-[rgba(185,28,28,0.1)] text-[#B91C1C] border-[rgba(185,28,28,0.2)]'
    };
    const finalClasses = colors[status]?.includes('border-')
        ? `border ${colors[status]}`
        : colors[status] || 'bg-gray-100 text-gray-600';
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${finalClasses}`}>
            {status}
        </span>
    );
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

const polarToCartesian = (cx, cy, r, angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { isRunning, lastRun, runPipeline } = usePipeline();
    const { user } = useAuth();
    // API to integrate
    const [stats, setStats] = useState({
        incidents: 0,
        activeThreats: 0,
        highRisk: 0,
        blockedIps: 0,
        playbooks: 0,
        aiDecisions: 0
    });

    // CHANGE 1 — LIVE INCIDENT FEED STATE
    const [liveEvents, setLiveEvents] = useState(INITIAL_LIVE_EVENTS);
    const [isStreamActive, setIsStreamActive] = useState(true);
    const [newEventIds, setNewEventIds] = useState(new Set());
    const [showPipelineToast, setShowPipelineToast] = useState(false);
    const [borderAngle, setBorderAngle] = useState(0);
    const liveRef = React.useRef(null);

    useEffect(() => {
        if (!isRunning) {
            setBorderAngle(0);
            return;
        }

        const interval = setInterval(() => {
            setBorderAngle(prev => prev >= 360 ? 0 : prev + 1);
        }, 16); // ~60fps

        return () => clearInterval(interval);
    }, [isRunning]);

    // CHANGE 2 — SYSTEM HEALTH STATE
    // API to integrate
    const [healthData] = useState({
        eventsPerMin: generateSparkline(12, 40, 120),
        aiLatency: generateSparkline(12, 0.8, 2.4),
        pipelineLoad: generateSparkline(12, 20, 80)
    });

    // API to integrate — Real-time simulation
    useEffect(() => {
        if (!isStreamActive) return;

        const interval = setInterval(() => {
            const template = NEW_EVENTS_POOL[
                Math.floor(Math.random() * NEW_EVENTS_POOL.length)
            ];
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            const newEvent = {
                ...template,
                id: `evt-${Date.now()}`,
                time: timeStr,
                isNew: true
            };

            setLiveEvents(prev => {
                const updated = [newEvent, ...prev];
                return updated.slice(0, 8); // keep last 8
            });

            setNewEventIds(prev => new Set([...prev, newEvent.id]));

            // Remove "new" highlight after 3s
            setTimeout(() => {
                setNewEventIds(prev => {
                    const next = new Set(prev);
                    next.delete(newEvent.id);
                    return next;
                });
            }, 3000);

        }, 4000); // new event every 4 seconds

        return () => clearInterval(interval);
    }, [isStreamActive]);

    const fetchDashboardData = async () => {
        try {
            const [resIncidents, resPlaybooks] = await Promise.all([
                api.getIncidents().catch(() => ({ incidents: [] })),
                api.getPlaybooks().catch(() => ({ playbooks: [] }))
            ]);

            const incidents = resIncidents.incidents || [];
            const playbooks = resPlaybooks.playbooks || [];

            // Calculate stats
            const totalIncidents = incidents.length;
            const highRiskCount = incidents.filter(i => (i.risk_score || 0) > 0.7).length;
            const activeThreats = incidents.length;

            setStats({
                incidents: totalIncidents,
                activeThreats: activeThreats,
                highRisk: highRiskCount,
                blockedIps: incidents.reduce((acc, curr) => acc + (curr.entities?.ips?.length || 0), 0),
                playbooks: playbooks.length,
                aiDecisions: playbooks.length
            });

        } catch (error) {
            console.error("Dashboard data fetch failed", error);
        }
    };


    useEffect(() => {
        if (!isRunning) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchDashboardData();
        }
    }, [isRunning]);

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard
                    title="Total Incidents"
                    value={stats.incidents || "47"}
                    icon={AlertTriangle}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle={
                        <span className="flex items-center font-medium" style={{ color: 'var(--text-muted)' }}>
                            <ArrowUp size={14} className="mr-1" /> +12 from yesterday
                        </span>
                    }
                    onClick={() => navigate('/incidents')}
                />
                <StatCard
                    title="High Alerts"
                    value="23"
                    icon={ShieldAlert}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle="Requires immediate action"
                    valueColor="#B91C1C"
                />
                <StatCard
                    title="Avg Detection Time"
                    value="2.4 min"
                    icon={Clock}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle="68% faster than baseline"
                />
                <StatCard
                    title="Pipeline Status"
                    value="Stable"
                    icon={Activity}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    badge={
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-100">
                            Operational
                        </span>
                    }
                />
            </div>

            {/* Pipeline Control - Only visible for Tier 3 and Manager */}
            {(user?.role === 'tier3' || user?.role === 'manager') && (
                <div
                    className={isRunning ? 'pipeline-card-running' : 'pipeline-card-idle'}
                    style={{
                        position: 'relative',
                        overflow: 'visible',
                        borderRadius: '12px',
                        zIndex: 0,
                        transition: 'all 0.3s ease'
                    }}
                >
                    {/* JS Fallback / CSS Animated Border */}
                    {isRunning && (
                        <div style={{
                            position: 'absolute',
                            inset: -2,
                            borderRadius: 14,
                            background: `conic-gradient(
                            from ${borderAngle}deg,
                            transparent 0deg,
                            transparent 270deg,
                            rgba(0,174,239,0.9) 300deg,
                            rgba(0,174,239,1) 330deg,
                            rgba(255,255,255,0.8) 345deg,
                            rgba(0,174,239,1) 355deg,
                            transparent 360deg
                        )`,
                            WebkitMask: `
                            linear-gradient(#fff 0 0) content-box,
                            linear-gradient(#fff 0 0)
                        `,
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                            padding: 2,
                            zIndex: 0,
                            pointerEvents: 'none'
                        }} />
                    )}

                    {/* Inner Content Wrapper */}
                    <div style={{
                        position: 'relative',
                        zIndex: 1,
                        borderRadius: '12px',
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        padding: '24px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: isRunning ? 'inset 0 0 20px rgba(0,174,239,0.04)' : 'none',
                        transition: 'box-shadow 0.3s ease'
                    }}>
                        {/* Left side: Content */}
                        <div className="flex-1 flex flex-col">
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '16.5px', fontWeight: '600' }}>
                                Pipeline Control
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                                Run the full AI detection and response pipeline
                            </p>

                            <div className="mt-3 mr-8 lg:mr-16">
                                <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
                                    <div
                                        className="h-full transition-all duration-700 ease-out bg-[#00AEEF]"
                                        style={{
                                            width: isRunning ? '65%' : '100%',
                                            boxShadow: isRunning ? '0 0 12px rgba(0,174,239,0.5)' : 'none'
                                        }}
                                    />
                                    {isRunning && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
                                    )}
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
                                    {isRunning ? 'Processing Stage 3/4 · Running...' : `100% Stage Completed · Last run: ${lastRun ? lastRun.toLocaleTimeString() : '2 mins ago'}`}
                                </p>
                            </div>
                        </div>

                        {/* Right side: Hero Button */}
                        <button
                            onClick={() => {
                                runPipeline();
                                setShowPipelineToast(true);
                                setTimeout(() => setShowPipelineToast(false), 6000);
                            }}
                            disabled={isRunning}
                            className={`shimmer-btn ${isRunning ? 'opacity-70 cursor-not-allowed pipeline-btn-running' : ''}`}
                            style={{
                                background: isRunning ? 'rgba(0,174,239,0.3)' : '#00AEEF',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '14px',
                                padding: '12px 32px',
                                borderRadius: '8px',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: isRunning ? 'none' : '0 0 20px rgba(0,174,239,0.35), 0 4px 12px rgba(0,174,239,0.2)',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play size={16} fill="currentColor" />
                                    Run Pipeline
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}



            {/* ROW 2 — Two columns */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* LEFT: Live Incident Feed (Change 1) */}
                <div className="xl:col-span-2 rounded-xl shadow-sm border flex flex-col h-[400px]"
                    style={{
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)'
                    }}
                >
                    {/* LIVE FEED HEADER */}
                    <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--glass-border)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Activity size={15} color="#00AEEF" />
                            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                Live Event Stream
                            </h3>

                            <div style={{
                                display: 'flex', gap: '6px', alignItems: 'center',
                                background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.15)',
                                borderRadius: '20px', padding: '2px 10px'
                            }}>
                                <div style={{
                                    width: '7px', height: '7px', borderRadius: '50%',
                                    background: '#15803D',
                                    animation: isStreamActive ? 'pulse-ring 2s infinite' : 'none'
                                }} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#15803D' }}>
                                    {isStreamActive ? 'Live' : 'Paused'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{
                                background: 'rgba(0,174,239,0.08)', border: '1px solid rgba(0,174,239,0.15)',
                                borderRadius: '20px', padding: '2px 10px', fontSize: '10px', color: '#00AEEF'
                            }}>
                                {liveEvents.length} events
                            </div>

                            <button
                                onClick={() => setIsStreamActive(!isStreamActive)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', fontSize: '11px',
                                    display: 'flex', gap: '4px', alignItems: 'center',
                                    padding: '4px 8px', borderRadius: '4px',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-white/5"
                            >
                                {isStreamActive ? (
                                    <><Pause size={14} /> Pause</>
                                ) : (
                                    <><Play size={14} /> Resume</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* LIVE FEED ITEMS */}
                    <div
                        ref={liveRef}
                        style={{ maxHeight: '280px', overflowY: 'auto' }}
                        className="flex-1 p-2 custom-scrollbar"
                    >
                        <div className="space-y-[4px]">
                            <AnimatePresence initial={false}>
                                {liveEvents.map((event) => {
                                    const isNew = newEventIds.has(event.id);
                                    const severityColor = event.severity === 'high' ? '#B91C1C'
                                        : event.severity === 'medium' ? '#FACC15'
                                            : '#00AEEF';

                                    return (
                                        <motion.div
                                            key={event.id}
                                            initial={{ opacity: 0, y: -12, x: 0 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.25 }}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                marginBottom: '4px',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                gap: '10px',
                                                alignItems: 'center',
                                                background: isNew
                                                    ? 'rgba(0,174,239,0.06)'
                                                    : 'var(--surface-color)',
                                                border: isNew
                                                    ? '1px solid rgba(0,174,239,0.15)'
                                                    : '1px solid var(--glass-border)'
                                            }}
                                            onClick={() => navigate(`/incidents?highlight=${event.incidentId || 'INC-2091'}`)}
                                            className="hover:bg-white/10 rounded-lg cursor-pointer transition-all duration-300 group relative z-0 hover:z-10 hover:scale-[1.02] hover:border-white/100 hover:shadow-[0_5px_15px_rgba(255,255,255,0.15)]"
                                        >
                                            {/* Severity dot */}
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                flexShrink: 0,
                                                background: severityColor,
                                                animation: (isNew && event.severity === 'high') ? 'pulse-ring 1.5s infinite' : 'none',
                                                boxShadow: `0 0 4px ${severityColor}`
                                            }} />

                                            {/* Time */}
                                            <div style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '11px',
                                                color: 'var(--text-muted)',
                                                minWidth: ' map', // wait, users says 56px
                                                minWidth: '56px'
                                            }}>
                                                {event.time}
                                            </div>

                                            {/* Event type */}
                                            <div style={{
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                flex: 1
                                            }}>
                                                {event.type}
                                            </div>

                                            {/* Entity */}
                                            <div style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '11px',
                                                color: '#00AEEF'
                                            }}>
                                                {event.entity}
                                            </div>

                                            {/* Source badge */}
                                            <div style={{
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '4px',
                                                padding: '1px 6px',
                                                fontSize: '9px',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                color: 'var(--text-muted)'
                                            }}>
                                                {event.source}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Threat Fidelity Score Gauge */}
                <div className="xl:col-span-1 rounded-xl shadow-sm border p-6 flex flex-col items-center"
                    style={{
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)'
                    }}
                >
                    <h3 className="font-semibold self-start mb-4" style={{ color: 'var(--text-primary)' }}>Highest Thread Fidelity Score</h3>

                    {/* SVG Gauge */}
                    <div className="relative w-full max-w-[200px] mb-4 mt-2 flex justify-center">
                        <svg viewBox="0 0 200 120" className="w-full h-auto overflow-visible">
                            <path
                                d={describeArc(100, 100, 80, -90, 90)}
                                fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round"
                            />
                            <path
                                d={describeArc(100, 100, 80, -90, -90 + (180 * 0.87))}
                                fill="none" stroke="#00AEEF" strokeWidth="14" strokeLinecap="round"
                                className="gauge-arc"
                            />
                            <text x="100" y="95" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--text-primary)">0.87</text>
                            <text x="100" y="112" textAnchor="middle" fontSize="11" fill="var(--text-muted)">Fidelity Score</text>
                        </svg>
                    </div>

                    <div className="text-center mb-6 mt-2">
                        <span className="text-[10px] font-bold text-[#B91C1C] bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)] px-3 py-1 rounded-full">
                            High Confidence Threat
                        </span>
                    </div>

                    <div className="w-full space-y-4 mt-auto">
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>0.91</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#00395D] rounded-full" style={{ width: '91%' }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>0.85</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#0067A5] rounded-full" style={{ width: '85%' }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>0.79</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#00AEEF] rounded-full" style={{ width: '79%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3 — Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="rounded-xl shadow-sm border p-6"
                    style={{
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)'
                    }}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Incident Severity Distribution</h3>
                        <span className="text-[11px] font-medium border px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>Last 24 hours</span>
                    </div>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockSeverityData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barCategoryGap="7.5%" barGap={2}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: '1px solid var(--glass-border)',
                                        backgroundColor: '#FFFFFF',
                                        color: '#0F172A',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        fontWeight: '700',
                                        opacity: 1
                                    }}
                                    itemStyle={{ color: '#0F172A' }}
                                />
                                <Bar
                                    dataKey="value"
                                    barSize={72}
                                    radius={[6, 6, 0, 0]}
                                    isAnimationActive={true}
                                    animationDuration={500}
                                    animationBegin={0}
                                    animationEasing="ease-out"
                                >
                                    <LabelList dataKey="value" position="top" style={{ fontSize: '12px', fill: 'var(--text-muted)', fontWeight: 600 }} />
                                    {mockSeverityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart */}
                <div className="rounded-xl shadow-sm border p-6"
                    style={{
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)'
                    }}
                >
                    <div className="flex justify-between items-center mb-0">
                        <h3 className="font-semibold text-gray-800" style={{ color: 'var(--text-primary)' }}>Attack Category Breakdown</h3>
                        <span className="text-[11px] font-medium border px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>Last 24 hours</span>
                    </div>
                    <div className="h-64 flex flex-col relative">
                        <div style={{ position: 'relative', height: '80%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={mockCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {mockCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        wrapperStyle={{ zIndex: 100 }}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-subtle)',
                                            backgroundColor: '#FFFFFF',
                                            color: '#0F172A',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            fontWeight: '700',
                                            opacity: 1
                                        }}
                                        itemStyle={{ color: '#0F172A' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                zIndex: 5
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>47</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total</div>
                            </div>
                        </div>
                        {/* Custom Legend */}
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                            {mockCategoryData.map((cat, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] tracking-wide font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }} />
                                    {cat.name} ({cat.value}%)
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 4 — Recent Incidents Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden"
                style={{
                    background: 'var(--surface-color)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)'
                }}
            >
                <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Incidents</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-sm font-semibold border-b" style={{ background: 'var(--glass-border)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            <tr>
                                <th className="px-6 py-4">Incident ID</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Affected Entity</th>
                                <th className="px-6 py-4">Fidelity Score</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Detected</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            {mockIncidents.slice(0, 5).map((inc) => (
                                <tr
                                    key={inc.id}
                                    onClick={() => navigate(`/incidents?highlight=${inc.id}`)}
                                    className="hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[#00AEEF] font-semibold">
                                            {inc.id}
                                            <ExternalLink size={14} className="opacity-70" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{inc.type}</td>
                                    <td className="px-6 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>{inc.entity}</td>
                                    <td className="px-6 py-4"><FidelityBadge score={inc.score} /></td>
                                    <td className="px-6 py-4"><StatusBadge status={inc.status} /></td>
                                    <td className="px-6 py-4 font-medium text-xs text-center" style={{ color: 'var(--text-muted)' }}>{inc.time}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/incidents?highlight=${inc.id}`);
                                            }}
                                            className="text-[#00AEEF] text-sm font-medium hover:underline flex items-center justify-end gap-1 ml-auto border-none bg-transparent"
                                        >
                                            View Details
                                            <ArrowRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ROW 5 — System Health (Change 2) */}
            <div className="mt-8">
                <h3 className="font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)' }}>System Health Metrics</h3>

                {/* Health Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* CARD 1 — Events/Min */}
                    <div className="rounded-xl shadow-sm border p-4 flex flex-col"
                        style={{
                            background: 'var(--surface-color)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)'
                        }}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Events / Min</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                                <span style={{ fontSize: '10px', color: '#15803D', fontWeight: 600 }}>Live</span>
                            </div>
                        </div>

                        <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#00AEEF', marginBottom: '8px' }}>
                            {healthData.eventsPerMin[healthData.eventsPerMin.length - 1]}
                        </div>

                        {/* Sparkline SVG */}
                        <div style={{ width: '100%', height: '40px' }}>
                            {(() => {
                                const points = healthData.eventsPerMin;
                                const max = Math.max(...points) || 1;
                                const min = Math.min(...points) || 0;
                                const w = 200, h = 40;
                                const range = max - min || 1;
                                const pathData = points.map((val, i) => {
                                    const x = (i / (points.length - 1)) * w;
                                    const y = h - ((val - min) / range * h);
                                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                }).join(' ');
                                return (
                                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
                                        <path d={pathData} fill="none" stroke="#00AEEF" strokeWidth="1.5" opacity="0.7" />
                                        <path d={pathData + ` L ${w} ${h} L 0 ${h} Z`} fill="rgba(0,174,239,0.08)" />
                                    </svg>
                                );
                            })()}
                        </div>
                    </div>

                    {/* CARD 2 — AI Latency */}
                    <div className="rounded-xl shadow-sm border p-4 flex flex-col"
                        style={{
                            background: 'var(--surface-color)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)'
                        }}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>AI Processing Latency</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                                <span style={{ fontSize: '10px', color: '#15803D', fontWeight: 600 }}>Optimized</span>
                            </div>
                        </div>

                        <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#15803D', marginBottom: '8px' }}>
                            {healthData.aiLatency[healthData.aiLatency.length - 1].toFixed(1)}s
                        </div>

                        {/* Sparkline SVG */}
                        <div style={{ width: '100%', height: '40px' }}>
                            {(() => {
                                const points = healthData.aiLatency;
                                const max = Math.max(...points) || 1;
                                const min = Math.min(...points) || 0;
                                const w = 200, h = 40;
                                const range = max - min || 1;
                                const pathData = points.map((val, i) => {
                                    const x = (i / (points.length - 1)) * w;
                                    const y = h - ((val - min) / range * h);
                                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                }).join(' ');
                                return (
                                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
                                        <path d={pathData} fill="none" stroke="#15803D" strokeWidth="1.5" opacity="0.7" />
                                        <path d={pathData + ` L ${w} ${h} L 0 ${h} Z`} fill="rgba(21,128,61,0.08)" />
                                    </svg>
                                );
                            })()}
                        </div>
                    </div>

                    {/* CARD 3 — Pipeline Load */}
                    <div className="rounded-xl shadow-sm border p-4 flex flex-col"
                        style={{
                            background: 'var(--surface-color)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)'
                        }}
                    >
                        {(() => {
                            const load = healthData.pipelineLoad[healthData.pipelineLoad.length - 1];
                            const loadColor = load < 60 ? '#15803D' : load < 80 ? '#D97706' : '#B91C1C';
                            return (
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Pipeline Load</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: loadColor }} />
                                            <span style={{ fontSize: '10px', color: loadColor, fontWeight: 600 }}>
                                                {load < 80 ? 'Normal' : 'High Load'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: loadColor, marginBottom: '8px' }}>
                                        {load}%
                                    </div>

                                    {/* Sparkline SVG */}
                                    <div style={{ width: '100%', height: '40px' }}>
                                        {(() => {
                                            const points = healthData.pipelineLoad;
                                            const max = Math.max(...points) || 1;
                                            const min = Math.min(...points) || 0;
                                            const w = 200, h = 40;
                                            const range = max - min || 1;
                                            const pathData = points.map((val, i) => {
                                                const x = (i / (points.length - 1)) * w;
                                                const y = h - ((val - min) / range * h);
                                                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                            }).join(' ');
                                            return (
                                                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
                                                    <path d={pathData} fill="none" stroke={loadColor} strokeWidth="1.5" opacity="0.7" />
                                                    <path d={pathData + ` L ${w} ${h} L 0 ${h} Z`} fill={`${loadColor}15`} />
                                                </svg>
                                            );
                                        })()}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Status Strip Footer */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    {[
                        { label: 'AI Engine', status: 'Operational' },
                        { label: 'FAISS Index', status: 'Synced' },
                        { label: 'Ollama', status: 'Online' }
                    ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            <span>&middot;</span>
                            <span>{item.status}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pipeline Toast Notification */}
            <AnimatePresence>
                {showPipelineToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            bottom: '32px',
                            right: '32px',
                            zIndex: 9999,
                            background: 'var(--surface-color)',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            border: '1px solid #00AEEF50',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 10px 40px rgba(0,174,239,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        <div className="w-2 h-2 rounded-full bg-[#00AEEF] animate-pulse" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Pipeline running
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>·</span>
                        <button
                            onClick={() => navigate('/pipeline')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#00AEEF',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            className="hover:underline"
                        >
                            View details <ArrowRight size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Dashboard;
