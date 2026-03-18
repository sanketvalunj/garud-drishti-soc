import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
    Shield, ShieldAlert, CheckCircle, XCircle,
    Clock, List, AlignLeft, ChevronDown, ChevronRight,
    Globe, Server, User, Lock
} from 'lucide-react';

// ─── Helper: Determine status of a step ─────────────────────────────────────
const getStepStatus = (step, automationReport) => {
    if (!automationReport) return 'pending';
    const executed = automationReport.actions_executed || [];
    const lowerStep = (step || '').toLowerCase();

    // Match by substring against executed action descriptions
    const matched = executed.find(action => {
        const label = (action.action || action.type || action.description || '').toLowerCase();
        return (
            label.includes(lowerStep.slice(0, 15)) ||
            lowerStep.includes(label.slice(0, 15))
        );
    });

    if (matched) return matched.status || 'executed';
    return 'pending';
};

// ─── Helper: Extract entities from playbook or incident ─────────────────────
const extractEntities = (playbook, incident) => {
    const pb = playbook?.playbook || playbook;

    // Try playbook.entities first (standard format)
    const entities = pb?.entities || {};
    const users = entities.users || entities.compromised_users || [];
    const assets = entities.assets || entities.isolated_hosts || [];
    const ips = entities.ips || entities.blocked_ips || [];

    // Fall back to incident data if nothing in playbook entities
    const finalUsers = users.length > 0 ? users : (incident?.user ? [incident.user] : []);
    const finalAssets = assets.length > 0 ? assets : (incident?.asset ? [incident.asset] : []);
    const finalIps = ips.length > 0 ? ips : (incident?.source_ip ? [incident.source_ip] : []);

    return { users: finalUsers, assets: finalAssets, ips: finalIps };
};

// ─── Helper: Build timeline entries ─────────────────────────────────────────
const buildTimeline = (playbook, incident, automationReport) => {
    const pb = playbook?.playbook || playbook;
    const steps = pb?.steps || pb?.response_steps || [];
    const baseTime = incident?.timestamp ? new Date(incident.timestamp) : new Date();

    const entries = [];

    // Initial detection event
    entries.push({
        time: baseTime,
        label: `${(incident?.threat_type || 'Incident').replace(/_/g, ' ')} detected`,
        type: 'detection'
    });

    // Each step as a timeline entry
    steps.forEach((step, idx) => {
        const t = new Date(baseTime.getTime() + (idx + 1) * 8000); // +8s per step
        const status = getStepStatus(step, automationReport);
        entries.push({ time: t, label: step, type: status === 'executed' ? 'action' : 'pending', status });
    });

    // Automation actions if they have timestamps
    if (automationReport?.actions_executed) {
        automationReport.actions_executed.forEach(action => {
            if (action.timestamp) {
                entries.push({
                    time: new Date(action.timestamp),
                    label: action.action || action.description || 'Automated action',
                    type: 'automated'
                });
            }
        });
    }

    return entries.sort((a, b) => a.time - b.time);
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const StepStatus = ({ status }) => {
    if (status === 'executed') return <CheckCircle size={16} className="text-green-500 shrink-0" />;
    if (status === 'failed') return <XCircle size={16} className="text-[#B91C1C] shrink-0" />;
    return <div className="w-4 h-4 rounded-full border-2 border-yellow-500/70 shrink-0" />;
};

const StepCard = ({ text, status, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className={clsx(
            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
            status === 'executed' ? "bg-green-900/10 border-green-700/20" :
                status === 'failed' ? "bg-[rgba(185,28,28,0.1)] border-[rgba(185,28,28,0.2)]" :
                    "bg-white/5"
        )}
        style={{
            background: status === 'pending' ? 'rgba(255,255,255,0.03)' : '',
            borderColor: status === 'pending' ? 'var(--glass-border)' : '',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
        }}
    >
        <div className="mt-0.5"><StepStatus status={status} /></div>
        <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm">{text}</p>
            <span className={clsx(
                "text-[10px] uppercase font-bold mt-1 inline-block",
                status === 'executed' ? "text-green-500" :
                    status === 'failed' ? "text-[#B91C1C]" :
                        "text-yellow-500"
            )}>
                {status === 'executed' ? '✔ Executed' : status === 'failed' ? '✕ Failed' : '◌ Pending'}
            </span>
        </div>
    </motion.div>
);

const EntityTag = ({ label }) => (
    <span className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-slate-300 border border-slate-700 inline-block">
        {label}
    </span>
);

const SectionHeader = ({ icon: Icon, label, color, count }) => (
    <h3 className={clsx(
        "text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 border-b pb-2",
        `text-${color}-400 border-${color}-500/20`
    )}>
        <Icon size={14} /> {label} {count > 0 && <span className="text-slate-500">({count})</span>}
    </h3>
);

// ─── Main PlaybookViewer ─────────────────────────────────────────────────────
const PlaybookViewer = ({ playbook, incident, automation, compact = false }) => {
    const [viewMode, setViewMode] = useState('steps'); // 'steps' | 'timeline'
    const [entitiesOpen, setEntitiesOpen] = useState(true);

    if (!playbook) return null;

    const pb = playbook.playbook || playbook;
    const steps = pb.steps || pb.response_steps || [];
    const entities = extractEntities(playbook, incident);
    const timeline = buildTimeline(playbook, incident, automation);
    const incidentId = playbook.incident_id || incident?.incident_id || '—';
    // severity: prefer pb.severity, then incident threat_type, then playbook-level summary
    const severity = pb.severity || incident?.threat_type || playbook.summary || 'unknown';
    const riskScore = incident?.risk_score ?? incident?.fidelity_score;
    const timestamp = incident?.timestamp || playbook.generated_at;

    const executedSteps = steps.filter(s => getStepStatus(s, automation) === 'executed').length;
    const pendingSteps = steps.length - executedSteps;

    const severityColor = (() => {
        const s = (severity || '').toLowerCase();
        if (s.includes('critical') || s.includes('escalation') || s.includes('privilege')) return 'red';
        if (s.includes('high') || s.includes('unauthorized') || s.includes('execution') || s.includes('powershell')) return 'orange';
        if (s.includes('medium') || s.includes('download')) return 'yellow';
        return 'blue';
    })();

    return (
        <div className={clsx("flex flex-col h-full", compact ? "" : "rounded-2xl overflow-hidden border")}
            style={compact ? {} : {
                background: 'var(--surface-color)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderColor: 'var(--glass-border)'
            }}
        >

            {/* ── HEADER CARD ── */}
            {!compact && (
                <div className="p-5 border-b border-white/5 bg-slate-800/30 shrink-0">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                    INC: {incidentId.substring(0, 8)}
                                </span>
                                <span className={clsx(
                                    "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1 border",
                                    `bg-${severityColor}-500/10 border-${severityColor}-500/30 text-${severityColor}-400`
                                )}>
                                    <ShieldAlert size={11} /> {severity.replace(/_/g, ' ')}
                                </span>
                                {riskScore != null && (
                                    <span className="text-xs text-slate-400 font-mono">
                                        Risk: <span className="text-[#B91C1C] font-bold">{riskScore > 1 ? Math.round(riskScore) : Math.round(riskScore * 100)}</span>
                                    </span>
                                )}
                            </div>
                            {timestamp && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock size={11} />
                                    {new Date(timestamp).toLocaleString()}
                                </p>
                            )}
                        </div>

                        {/* View toggle */}
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 shrink-0">
                            <button
                                onClick={() => setViewMode('steps')}
                                title="Steps view"
                                className={clsx("p-2 rounded transition-all", viewMode === 'steps' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200")}
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('timeline')}
                                title="Timeline view"
                                className={clsx("p-2 rounded transition-all", viewMode === 'timeline' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200")}
                            >
                                <AlignLeft size={16} />
                            </button>
                        </div>
                        <ChevronRight className="text-slate-500 flex-shrink-0" size={16} />
                        <span className="text-slate-200 font-medium">
                            {step}
                        </span>
                    </div>
                </div>
            )}

            {/* ── CONTENT ── */}
            <div className={clsx("flex-1 overflow-y-auto custom-scrollbar", compact ? "pr-2" : "p-5")} style={{ minHeight: 0 }}>
                <div className="space-y-6">

                    {/* === STEPS VIEW === */}
                    {viewMode === 'steps' && (
                        <>
                            {/* Response Steps Panel */}
                            <div>
                                <SectionHeader icon={Shield} label="Response Timeline" color="blue" count={steps.length} />
                                {steps.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-4">No steps defined in this playbook.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {steps.map((step, i) => (
                                            <StepCard
                                                key={i}
                                                text={step}
                                                status={getStepStatus(step, automation)}
                                                index={i}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Executed Actions / Entities Panel */}
                            <div>
                                <button
                                    onClick={() => setEntitiesOpen(v => !v)}
                                    className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-emerald-500/20 pb-2 mb-3 hover:text-emerald-300 transition-colors"
                                >
                                    <span className="flex items-center gap-2"><Lock size={14} /> Executed Actions</span>
                                    {entitiesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>

                                <AnimatePresence>
                                    {entitiesOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Blocked IPs */}
                                                <div className="p-3 rounded-lg bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)]">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#B91C1C] mb-2">
                                                        <Globe size={12} /> Blocked IPs
                                                    </div>
                                                    {entities.ips.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entities.ips.map(ip => <EntityTag key={ip} label={ip} />)}
                                                        </div>
                                                    ) : <p className="text-xs text-slate-600 italic">None recorded</p>}
                                                </div>

                                                {/* Isolated Devices */}
                                                <div className="p-3 rounded-lg bg-orange-900/10 border border-orange-800/20">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 mb-2">
                                                        <Server size={12} /> Isolated Devices
                                                    </div>
                                                    {entities.assets.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entities.assets.map(a => <EntityTag key={a} label={a} />)}
                                                        </div>
                                                    ) : <p className="text-xs text-slate-600 italic">None recorded</p>}
                                                </div>

                                                {/* Locked Users */}
                                                <div className="p-3 rounded-lg bg-yellow-900/10 border border-yellow-800/20">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 mb-2">
                                                        <User size={12} /> Locked Users
                                                    </div>
                                                    {entities.users.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entities.users.map(u => <EntityTag key={u} label={u} />)}
                                                        </div>
                                                    ) : <p className="text-xs text-slate-600 italic">None recorded</p>}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    )}

                    {/* === TIMELINE VIEW === */}
                    {viewMode === 'timeline' && (
                        <div>
                            <SectionHeader icon={Clock} label="Action Timeline" color="violet" count={timeline.length} />
                            <div className="relative pl-6 border-l-2 border-slate-800 space-y-5 py-1">
                                {timeline.map((entry, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="relative pl-5"
                                    >
                                        {/* Timeline dot */}
                                        <div className={clsx(
                                            "absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-slate-900",
                                            entry.type === 'detection' ? "bg-[#B91C1C]" :
                                                entry.type === 'action' || entry.type === 'executed' ? "bg-green-500" :
                                                    entry.type === 'automated' ? "bg-violet-500" :
                                                        "bg-yellow-500/60"
                                        )} />
                                        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-3">
                                            <span className="text-[10px] font-mono text-slate-500 block mb-0.5">
                                                {entry.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <p className="text-sm text-slate-200 capitalize">{entry.label}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PlaybookViewer;
