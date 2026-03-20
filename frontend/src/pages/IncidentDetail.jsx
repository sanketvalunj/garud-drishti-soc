import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    ArrowLeft,
    Clock,
    ShieldAlert,
    Share2,
    Download,
    FileText,
    Server,
    User,
    Globe,
    Brain,
    Target,
    BookOpen,
    Activity,
    CheckCircle
} from 'lucide-react';
import AttackGraph from '../components/incidents/AttackGraph';
import MitreAttackOverlay from '../components/incidents/MitreAttackOverlay';
import AttackReplayTimeline from '../components/incidents/AttackReplayTimeline';
import PlaybookViewer from '../components/incidents/PlaybookViewer';

const SeverityBadge = ({ severity }) => {
    const colors = {
        HIGH: { bg: 'rgba(185,28,28,0.12)', text: '#B91C1C', border: 'rgba(185,28,28,0.2)' },
        MEDIUM: { bg: 'rgba(217,119,6,0.12)', text: '#D97706', border: 'rgba(217,119,6,0.2)' },
        LOW: { bg: 'rgba(0,174,239,0.12)', text: '#00AEEF', border: 'rgba(0,174,239,0.2)' }
    };
    const s = severity?.toUpperCase() === 'CRITICAL' ? 'HIGH' : (severity?.toUpperCase() || 'LOW');
    const style = colors[s] || colors.LOW;
    return (
        <span className="px-2.5 py-0.5 rounded font-semibold text-xs border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
            {s}
        </span>
    );
};

const IncidentDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [incident, setIncident] = useState(location.state?.incident || null);
    const [playbook, setPlaybook] = useState(null);
    const [loading, setLoading] = useState(!incident);
    const [highlightedEntity, setHighlightedEntity] = useState(null);

    useEffect(() => {
        if (!incident) {
            fetchIncident();
        } else {
            fetchPlaybookForIncident(incident.incident_id);
        }
    }, [id]);

    const fetchIncident = async () => {
        try {
            const data = await api.getIncidents();
            const found = data.incidents.find(i => i.incident_id === id);
            setIncident(found);
            if (found) {
                fetchPlaybookForIncident(found.incident_id);
            }
            setLoading(false);
        } catch (e) {
            console.error("Failed to fetch incident", e);
            setLoading(false);
        }
    };

    const fetchPlaybookForIncident = async (incidentId) => {
        try {
            const data = await api.getPlaybooks();
            const found = data.playbooks.find(pb => pb.incident_id === incidentId);
            setPlaybook(found);
        } catch (e) {
            console.error("Failed to fetch playbooks", e);
        }
    }

    if (loading) return <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>Loading incident details...</div>;
    if (!incident) return <div className="p-10 text-center text-[#B91C1C]">Incident not found</div>;

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl shadow-sm border" 
                style={{ 
                    background: 'var(--surface-color)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg transition-colors mt-1"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                {incident.summary.replace(/_/g, ' ')}
                            </h1>
                            <SeverityBadge severity={incident.severity} />
                        </div>
                        <div className="flex items-center gap-4 text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                            <span className="flex items-center gap-1.5"><Clock size={16} /> {new Date(incident.timestamp).toLocaleString()}</span>
                            <span style={{ color: 'var(--text-muted)' }}>ID: {incident.incident_id}</span>
                            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-bold border border-indigo-500/20">
                                <Activity size={14} /> Investigating
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-colors" style={{ background: 'var(--glass-border)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        <Share2 size={16} /> Share
                    </button>
                    {/* <button className="flex items-center gap-2 px-4 py-2 bg-[#00AEEF] hover:bg-blue-400 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm">
                        <Download size={16} /> Export Report
                    </button> */}
                </div>
            </div>

            {/* TOP SECTION: Narrative, Gauge, Entities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Incident Narrative & Abstract Kill Chain */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 rounded-xl shadow-sm border h-full flex flex-col" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <FileText size={20} className="text-[#00AEEF]" />
                            Incident Narrative
                        </h3>
                        <p className="leading-relaxed text-[15px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                            {incident.story || "No detailed narrative available for this incident. System flagged anomalous behavior matching known threat signatures."}
                        </p>
                        
                        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                             <h4 className="text-sm font-bold mb-4" style={{ color: 'var(--text-muted)' }}>Kill Chain Progression</h4>
                             <MitreAttackOverlay incident={incident} mini={true} />
                        </div>
                    </div>
                </div>

                {/* 2. AI Fidelity Score & 3. Entities */}
                <div className="space-y-6 flex flex-col">
                    {/* Fidelity Score Gauge */}
                    <div className="p-6 rounded-xl shadow-sm border text-center flex-1 flex flex-col items-center justify-center" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="text-sm font-bold mb-6" style={{ color: 'var(--text-muted)' }}>AI Fidelity Score</h3>
                        
                        <div className="relative w-48 h-24 mb-6">
                            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                                {/* Background Arc */}
                                <path 
                                    d="M 10 50 A 40 40 0 0 1 90 50" 
                                    fill="none" stroke="var(--bg-primary)" strokeWidth="12" strokeLinecap="round" 
                                />
                                {/* Foreground Arc */}
                                <path 
                                    d={`M 10 50 A 40 40 0 0 1 ${10 + 80 * Math.min(1, Math.max(0, incident.risk_score || 0))} ${50 - 40 * Math.sin(Math.PI * Math.min(1, Math.max(0, incident.risk_score || 0)))}`} 
                                    fill="none" 
                                    stroke={(incident.risk_score || 0) > 0.7 ? "#B91C1C" : (incident.risk_score || 0) > 0.4 ? "#D97706" : "#15803D"} 
                                    strokeWidth="12" strokeLinecap="round" 
                                    className="drop-shadow-sm"
                                />
                            </svg>
                            <div className="absolute inset-x-0 bottom-[-10px] text-center">
                                <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {(incident.risk_score || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        
                        <p className="text-xs font-semibold px-4 mt-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {(incident.risk_score || 0) > 0.7 
                                ? "Critical threat confirmed with high confidence. Immediate isolation recommended."
                                : "Anomalous behavior detected. Requires further analyst verification."}
                        </p>
                    </div>

                    {/* Entities list */}
                    <div className="p-6 rounded-xl shadow-sm border" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-muted)' }}>Entities Involved</h3>
                        <div className="space-y-4">
                            {incident.entities?.users?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
                                        <User size={14} /> Users
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.users.map(u => (
                                            <span key={u} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs font-semibold border border-blue-500/20">{u}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {incident.entities?.assets?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-bold mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>
                                        <Server size={14} /> Assets
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.assets.map(a => (
                                            <span key={a} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-xs font-semibold border border-indigo-500/20">{a}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {incident.entities?.ips?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-bold mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>
                                        <Globe size={14} /> IPs
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.ips.map(ip => (
                                            <span key={ip} className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-xs font-semibold border border-amber-500/20">{ip}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTTOM SECTION: Chronology, Graph, Playbook */}
            <div className="space-y-6">
                
                {/* 4. Event Chronology */}
                {incident.signals && incident.signals.length > 0 && (
                    <div className="p-6 rounded-xl shadow-sm border" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Clock size={20} className="text-[#00AEEF]" />
                            Event Chronology
                        </h3>
                        {/* We reuse the existing component but might need to restyle it if it's too dark. 
                            Assuming AttackReplayTimeline handles its own light/dark mode internally or we accept its style 
                        */}
                        <div className="rounded-lg p-4 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}>
                             <AttackReplayTimeline
                                signals={incident.signals}
                                onSignalChange={(signal) => setHighlightedEntity(signal?.asset || signal?.source_ip || signal?.user)}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* 5. Detailed Attack Graph / MITRE */}
                    <div className="p-6 rounded-xl shadow-sm border flex flex-col h-[500px]" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Share2 size={20} className="text-indigo-500" />
                                Threat Topology
                            </h3>
                            <button
                                onClick={() => navigate(`/mitre/${incident.incident_id}`, { state: { incidentId: incident.incident_id } })}
                                className="text-sm font-semibold text-[#00AEEF] hover:underline flex items-center gap-1"
                            >
                                <Target size={16} /> Full MITRE Map
                            </button>
                        </div>
                        <div className="flex-1 rounded-lg border overflow-hidden relative" style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}>
                             <AttackGraph data={incident.graph} highlightEntity={highlightedEntity} />
                        </div>
                    </div>

                    {/* 6. Response Playbook */}
                    <div id="playbook-section" className="p-6 rounded-xl shadow-sm border flex flex-col h-[500px]" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)', 
                            borderTop: '4px solid #15803D' 
                        }}
                    >
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <BookOpen size={20} className="text-green-500" />
                                Response Playbook
                            </h3>
                             <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Recommended
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {playbook ? (
                                <PlaybookViewer playbook={playbook} incident={incident} compact={true} />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center rounded-lg border border-dashed" style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                                    <BookOpen size={32} className="mb-3 opacity-20" />
                                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No automated playbook generated yet.</p>
                                    <button className="mt-3 px-4 py-2 bg-[#0B1F3B] hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-all duration-300 shimmer-btn">
                                        Generate Manually
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default IncidentDetail;
