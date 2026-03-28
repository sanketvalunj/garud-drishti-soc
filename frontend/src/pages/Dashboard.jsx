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
import { useLiveStream } from '../context/LiveStreamContext';
import {
    BarChart, Bar, Cell, PieChart, Pie, XAxis, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import api from '../services/api';

// New AI Observability Components
import AIPipeline from '../components/AIPipeline';
import AIReasoningPanel from '../components/AIReasoningPanel';
import LLMReasoningViewer from '../components/LLMReasoningViewer';
import AttackTimeline from '../components/AttackTimeline';
import RiskChart from '../components/RiskChart';
import MitreMapping from '../components/MitreMapping';
import PlaybookViewer from '../components/incidents/PlaybookViewer';
import AutomationPanel from '../components/AutomationPanel';

const HISTORY_POINTS = 12;
const EMPTY_SERIES = Array(HISTORY_POINTS).fill(0);

const pushMetric = (series, value) => {
    const safeSeries = Array.isArray(series) ? series : EMPTY_SERIES;
    return [...safeSeries.slice(-(HISTORY_POINTS - 1)), value];
};

// ─── DEFAULTS (replaced at runtime via backend) ─────────────

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
    const { liveEvents, isStreamEnabled, connectionState, toggleStream } = useLiveStream();
    // API to integrate
    const [stats, setStats] = useState({
        incidents: 0,
        activeThreats: 0,
        highRisk: 0,
        blockedIps: 0,
        playbooks: 0,
        aiDecisions: 0
    });

    const [recentIncidents, setRecentIncidents] = useState([]);
    const [categoryData, setCategoryData] = useState(mockCategoryData);
    const [severityData, setSeverityData] = useState(mockSeverityData);
    const [highAlertIncidents, setHighAlertIncidents] = useState([]);
    const [showHighAlertNotifications, setShowHighAlertNotifications] = useState(false);
    const [showAllHighAlerts, setShowAllHighAlerts] = useState(false);

    // CHANGE 1 — LIVE INCIDENT FEED STATE
    const [newEventIds, setNewEventIds] = useState(new Set());
    const [showPipelineToast, setShowPipelineToast] = useState(false);
    const [borderAngle, setBorderAngle] = useState(0);
    const liveRef = React.useRef(null);
    const seenLiveEventIdsRef = React.useRef(new Set());
    const hasPrimedSeenIdsRef = React.useRef(false);

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

    // CHANGE 2 — SYSTEM HEALTH STATE (live + interactive)
    const [healthData, setHealthData] = useState({
        eventsPerMin: [...EMPTY_SERIES],
        aiLatency: [...EMPTY_SERIES],
        pipelineLoad: [...EMPTY_SERIES]
    });
    const [healthStatus, setHealthStatus] = useState({
        aiEngine: 'Checking',
        faiss: 'Checking',
        ollama: 'Checking'
    });
    const [healthMeta, setHealthMeta] = useState({
        isRefreshing: false,
        autoRefresh: true,
        lastUpdated: '--'
    });

    useEffect(() => {
        if (!Array.isArray(liveEvents)) {
            return;
        }

        if (!hasPrimedSeenIdsRef.current) {
            seenLiveEventIdsRef.current = new Set(liveEvents.map((evt) => evt.id));
            hasPrimedSeenIdsRef.current = true;
            return;
        }

        const unseen = liveEvents
            .slice(0, 8)
            .filter((evt) => evt?.id && !seenLiveEventIdsRef.current.has(evt.id))
            .map((evt) => evt.id);

        if (unseen.length === 0) {
            return;
        }

        setNewEventIds((prev) => {
            const next = new Set(prev);
            unseen.forEach((id) => next.add(id));
            return next;
        });

        unseen.forEach((id) => seenLiveEventIdsRef.current.add(id));
        if (seenLiveEventIdsRef.current.size > 500) {
            const recentIds = liveEvents.slice(0, 300).map((evt) => evt.id);
            seenLiveEventIdsRef.current = new Set(recentIds);
        }

        const timer = setTimeout(() => {
            setNewEventIds((prev) => {
                const next = new Set(prev);
                unseen.forEach((id) => next.delete(id));
                return next;
            });
        }, 3000);

        return () => clearTimeout(timer);
    }, [liveEvents]);

    const streamStatusConfig = (() => {
        if (!isStreamEnabled || connectionState === 'paused') {
            return {
                label: 'Paused',
                color: 'var(--text-muted)',
                bg: 'rgba(148,163,184,0.08)',
                border: 'rgba(148,163,184,0.2)',
                pulse: false,
            };
        }

        if (connectionState === 'live') {
            return {
                label: 'Live',
                color: '#15803D',
                bg: 'rgba(21,128,61,0.08)',
                border: 'rgba(21,128,61,0.15)',
                pulse: true,
            };
        }

        if (connectionState === 'connecting') {
            return {
                label: 'Connecting',
                color: '#D97706',
                bg: 'rgba(217,119,6,0.08)',
                border: 'rgba(217,119,6,0.2)',
                pulse: true,
            };
        }

        if (connectionState === 'reconnecting') {
            return {
                label: 'Reconnecting',
                color: '#D97706',
                bg: 'rgba(217,119,6,0.08)',
                border: 'rgba(217,119,6,0.2)',
                pulse: true,
            };
        }

        return {
            label: 'Offline',
            color: '#B91C1C',
            bg: 'rgba(185,28,28,0.08)',
            border: 'rgba(185,28,28,0.2)',
            pulse: false,
        };
    })();

    const fetchDashboardData = async () => {
        try {
            const [demoLogsCount, resPlaybooks, resRecent, resCategories, resSeverity, resCorrelatedAll] = await Promise.all([
                api.getDemoLogsCount().catch(() => ({ count: 0, by_severity: {} })),
                api.getPlaybooks().catch(() => ({ playbooks: [] })),
                api.getCorrelatedIncidents({ recentOnly: true, limit: 5 }).catch(() => ({ incidents: [] })),
                api.getAttackCategoryBreakdown().catch(() => ({ breakdown: [] })),
                api.getIncidentSeverityDistribution().catch(() => ({ high: 0, medium: 0, low: 0 })),
                api.getCorrelatedIncidents({ recentOnly: false, limit: 200 }).catch(() => ({ incidents: [] }))
            ]);

            const playbooks = resPlaybooks?.playbooks || [];
            const recent = resRecent?.incidents || [];
            const breakdown = resCategories?.breakdown || [];
            const allCorrelated = resCorrelatedAll?.incidents || [];
            const highOnly = allCorrelated.filter((inc) => String(inc?.severity || '').toLowerCase() === 'high');

            setStats(prev => ({
                ...prev,
                incidents: demoLogsCount?.count || 0,
                highRisk: resSeverity?.high || highOnly.length || 0,
                playbooks: playbooks.length,
                aiDecisions: playbooks.length
            }));

            setRecentIncidents(recent);
            setHighAlertIncidents(highOnly);

            // Attack category breakdown (real, from correlated incidents)
            const palette = ['#00395D', '#0067A5', '#00AEEF', '#3ABEF9', '#7DD3FC', '#94A3B8'];
            const cat = breakdown.slice(0, 6).map((b, idx) => ({
                name: b.category,
                value: b.count,
                color: palette[idx % palette.length],
            }));
            if (cat.length > 0) setCategoryData(cat);

            // Severity distribution from backend endpoint backed by correlated_incidents.json
            setSeverityData([
                { name: 'High', value: resSeverity?.high || 0, color: '#B91C1C' },
                { name: 'Medium', value: resSeverity?.medium || 0, color: '#D97706' },
                { name: 'Low', value: resSeverity?.low || 0, color: '#00AEEF' }
            ]);

        } catch (error) {
            console.error("Dashboard data fetch failed", error);
        }
    };

    const fetchSystemHealthMetrics = React.useCallback(async (showSpinner = false) => {
        if (showSpinner) {
            setHealthMeta(prev => ({ ...prev, isRefreshing: true }));
        }

        try {
            const [systemHealth, pipelineStatus, modelStatus, storageStatus, demoLogsCount] = await Promise.all([
                api.getSystemHealth().catch(() => ({})),
                api.getPipelineStatus().catch(() => ({})),
                api.getModelStatus().catch(() => ({})),
                api.getStorageStatus().catch(() => ({ files: {} })),
                api.getDemoLogsCount().catch(() => ({ count: 0 }))
            ]);

            const eventsProcessed = Number(pipelineStatus?.events_processed || 0);
            const startAt = pipelineStatus?.start_time ? new Date(pipelineStatus.start_time).getTime() : NaN;
            let eventsPerMin = 0;

            if (!Number.isNaN(startAt) && eventsProcessed > 0) {
                const elapsedMinutes = Math.max((Date.now() - startAt) / 60000, 0.1);
                eventsPerMin = Math.round(eventsProcessed / elapsedMinutes);
            }

            if (eventsPerMin <= 0) {
                eventsPerMin = Number(demoLogsCount?.count || 0);
            }

            const apiLatencyMs = Number(systemHealth?.api_latency_ms || 0);
            const aiLatencySec = Number((apiLatencyMs / 1000).toFixed(2));

            const pipelineState = String(pipelineStatus?.status || 'idle').toLowerCase();
            const progress = Number(pipelineStatus?.progress || 0);
            let pipelineLoad = 15;

            if (pipelineState === 'running') {
                pipelineLoad = Math.min(95, Math.max(25, Math.round(progress)));
            } else if (pipelineState === 'completed') {
                pipelineLoad = 22;
            } else if (pipelineState === 'failed') {
                pipelineLoad = 88;
            }

            setHealthData(prev => ({
                eventsPerMin: pushMetric(prev.eventsPerMin, eventsPerMin),
                aiLatency: pushMetric(prev.aiLatency, aiLatencySec),
                pipelineLoad: pushMetric(prev.pipelineLoad, pipelineLoad)
            }));

            const incidentsFileReady = Boolean(storageStatus?.files?.['incidents.json']);
            setHealthStatus({
                aiEngine: modelStatus?.llm_available ? 'Operational' : 'Offline',
                faiss: incidentsFileReady ? 'Synced' : 'Syncing',
                ollama: modelStatus?.fallback_mode ? 'Fallback' : (modelStatus?.llm_available ? 'Online' : 'Offline')
            });

            setHealthMeta(prev => ({
                ...prev,
                lastUpdated: new Date().toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            }));
        } catch (error) {
            console.error('System health fetch failed', error);
            setHealthStatus(prev => ({ ...prev, aiEngine: 'Error' }));
        } finally {
            if (showSpinner) {
                setHealthMeta(prev => ({ ...prev, isRefreshing: false }));
            }
        }
    }, []);


    useEffect(() => {
        if (!isRunning) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchDashboardData();
        }
    }, [isRunning]);

    useEffect(() => {
        fetchSystemHealthMetrics(false);
    }, [fetchSystemHealthMetrics]);

    useEffect(() => {
        if (!healthMeta.autoRefresh) {
            return;
        }

        const timer = setInterval(() => {
            fetchSystemHealthMetrics(false);
        }, 10000);

        return () => clearInterval(timer);
    }, [healthMeta.autoRefresh, fetchSystemHealthMetrics]);

    const latestEventsPerMin = healthData.eventsPerMin[healthData.eventsPerMin.length - 1] || 0;
    const latestAiLatency = healthData.aiLatency[healthData.aiLatency.length - 1] || 0;
    const latestPipelineLoad = healthData.pipelineLoad[healthData.pipelineLoad.length - 1] || 0;

    const aiLatencyColor = latestAiLatency <= 0.35 ? '#15803D' : latestAiLatency <= 0.8 ? '#D97706' : '#B91C1C';
    const aiLatencyLabel = latestAiLatency <= 0.35 ? 'Optimized' : latestAiLatency <= 0.8 ? 'Degraded' : 'High Latency';

    const getStatusColor = (status) => {
        const s = String(status || '').toLowerCase();
        if (s.includes('operational') || s.includes('online') || s.includes('synced')) {
            return '#15803D';
        }
        if (s.includes('syncing') || s.includes('fallback') || s.includes('warning') || s.includes('degraded')) {
            return '#D97706';
        }
        return '#B91C1C';
    };

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard
                    title="Total Incidents"
                    value={stats.incidents || 0}
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
                    value={stats.highRisk || 0}
                    icon={ShieldAlert}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle={`Requires immediate action \u00b7 ${Math.min(3, highAlertIncidents.length)} shown first`}
                    valueColor="#B91C1C"
                    onClick={() => {
                        setShowHighAlertNotifications(true);
                        setShowAllHighAlerts(false);
                    }}
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

            <AnimatePresence>
                {showHighAlertNotifications && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
                        style={{ background: 'rgba(2, 6, 23, 0.55)' }}
                        onClick={() => setShowHighAlertNotifications(false)}
                    >
                        <motion.div
                            initial={{ y: 24, opacity: 0, scale: 0.98 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 12, opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-2xl rounded-xl border"
                            style={{
                                background: 'var(--surface-color)',
                                borderColor: 'var(--glass-border)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--glass-border)' }}>
                                <div>
                                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>High Alert Notifications</h3>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stats.highRisk || 0} high severity incidents</p>
                                </div>
                                <button
                                    className="text-xs px-2 py-1 rounded border"
                                    style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}
                                    onClick={() => setShowHighAlertNotifications(false)}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="max-h-[420px] overflow-y-auto px-3 py-3 space-y-2">
                                {!showAllHighAlerts && (
                                    <div className="rounded-lg border px-3 py-4 text-sm" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                                        Click See more to view high alert notifications.
                                    </div>
                                )}

                                {showAllHighAlerts && highAlertIncidents.map((inc) => (
                                    <button
                                        key={inc.id}
                                        className="w-full text-left rounded-lg border px-3 py-3 hover:bg-white/10 transition-colors"
                                        style={{ borderColor: 'var(--glass-border)' }}
                                        onClick={() => {
                                            setShowHighAlertNotifications(false);
                                            navigate(`/incidents?highlight=${inc.id}`);
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold" style={{ color: '#B91C1C' }}>{inc.id}</span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{inc.detectedAt || 'recent'}</span>
                                        </div>
                                        <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{inc.type || 'Suspicious Activity'}</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{inc.summary || 'High-risk activity requires immediate action.'}</p>
                                    </button>
                                ))}

                                {showAllHighAlerts && highAlertIncidents.length === 0 && (
                                    <div className="rounded-lg border px-3 py-4 text-sm" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                                        No high alert incidents found.
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--glass-border)' }}>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Showing {Math.min(showAllHighAlerts ? highAlertIncidents.length : 3, highAlertIncidents.length)} of {highAlertIncidents.length}
                                </span>

                                {!showAllHighAlerts && highAlertIncidents.length > 3 && (
                                    <button
                                        className="text-xs font-semibold px-3 py-1.5 rounded border"
                                        style={{ borderColor: 'var(--glass-border)', color: '#00AEEF' }}
                                        onClick={() => setShowAllHighAlerts(true)}
                                    >
                                        See more
                                    </button>
                                )}

                                {showAllHighAlerts && (
                                    <button
                                        className="text-xs font-semibold px-3 py-1.5 rounded border"
                                        style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}
                                        onClick={() => setShowAllHighAlerts(false)}
                                    >
                                        Show less
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                background: streamStatusConfig.bg,
                                border: `1px solid ${streamStatusConfig.border}`,
                                borderRadius: '20px', padding: '2px 10px'
                            }}>
                                <div style={{
                                    width: '7px', height: '7px', borderRadius: '50%',
                                    background: streamStatusConfig.color,
                                    animation: streamStatusConfig.pulse ? 'pulse-ring 2s infinite' : 'none'
                                }} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: streamStatusConfig.color }}>
                                    {streamStatusConfig.label}
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
                                onClick={toggleStream}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', fontSize: '11px',
                                    display: 'flex', gap: '4px', alignItems: 'center',
                                    padding: '4px 8px', borderRadius: '4px',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-white/5"
                            >
                                {isStreamEnabled ? (
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
                        <span className="text-[11px] font-medium border px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>Correlated incidents</span>
                    </div>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={severityData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barCategoryGap="7.5%" barGap={2}>
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
                                    {severityData.map((entry, index) => (
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
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {categoryData.map((entry, index) => (
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
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
                                    {stats.incidents || 0}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total</div>
                            </div>
                        </div>
                        {/* Custom Legend */}
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                            {categoryData.map((cat, i) => (
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
                            {recentIncidents.slice(0, 5).map((inc) => (
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
                                    <td className="px-6 py-4"><FidelityBadge score={inc.fidelityScore} /></td>
                                    <td className="px-6 py-4"><StatusBadge status={(inc.status || 'investigating').charAt(0).toUpperCase() + (inc.status || 'investigating').slice(1)} /></td>
                                    <td className="px-6 py-4 font-medium text-xs text-center" style={{ color: 'var(--text-muted)' }}>{inc.detectedAt}</td>
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
                <div className="mb-4 px-1 flex items-center justify-between gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--text-secondary)' }}>System Health Metrics</h3>
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span>Updated {healthMeta.lastUpdated}</span>
                        <button
                            onClick={() => setHealthMeta(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                            className="px-2 py-1 rounded border"
                            style={{
                                borderColor: 'var(--glass-border)',
                                background: 'var(--surface-color)',
                                color: healthMeta.autoRefresh ? '#15803D' : 'var(--text-muted)'
                            }}
                        >
                            {healthMeta.autoRefresh ? 'Auto: On' : 'Auto: Off'}
                        </button>
                        <button
                            onClick={() => fetchSystemHealthMetrics(true)}
                            className="px-2 py-1 rounded border flex items-center gap-1"
                            style={{
                                borderColor: 'var(--glass-border)',
                                background: 'var(--surface-color)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <RefreshCw size={12} className={healthMeta.isRefreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

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
                            {latestEventsPerMin}
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
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: aiLatencyColor }} />
                                <span style={{ fontSize: '10px', color: aiLatencyColor, fontWeight: 600 }}>{aiLatencyLabel}</span>
                            </div>
                        </div>

                        <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: aiLatencyColor, marginBottom: '8px' }}>
                            {latestAiLatency.toFixed(2)}s
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
                                        <path d={pathData} fill="none" stroke={aiLatencyColor} strokeWidth="1.5" opacity="0.7" />
                                        <path d={pathData + ` L ${w} ${h} L 0 ${h} Z`} fill={`${aiLatencyColor}15`} />
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
                            const load = latestPipelineLoad;
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
                        { label: 'AI Engine', status: healthStatus.aiEngine },
                        { label: 'FAISS Index', status: healthStatus.faiss },
                        { label: 'Ollama', status: healthStatus.ollama }
                    ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusColor(item.status) }} />
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
