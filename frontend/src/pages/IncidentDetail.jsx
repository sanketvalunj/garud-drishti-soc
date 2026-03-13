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
    BookOpen
} from 'lucide-react';
import AttackGraph from '../components/AttackGraph';
import MitreAttackOverlay from '../components/MitreAttackOverlay';
import AttackReplayTimeline from '../components/AttackReplayTimeline';
import PlaybookViewer from '../components/PlaybookViewer';
import { motion } from 'framer-motion';

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

    if (loading) return <div className="p-10 text-center text-slate-500">Loading incident details...</div>;
    if (!incident) return <div className="p-10 text-center text-red-500">Incident not found</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        {incident.summary.replace(/_/g, ' ').toUpperCase()}
                        <span className={`text-xs px-2 py-1 rounded-full border ${incident.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                            'bg-orange-500/10 border-orange-500/20 text-orange-500'
                            }`}>
                            {incident.severity}
                        </span>
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Clock size={14} /> {new Date(incident.timestamp).toLocaleString()}</span>
                        <span className="font-mono text-xs opacity-50">ID: {incident.incident_id}</span>
                    </div>
                </div>

                <div className="ml-auto flex gap-2">
                    <button className="btn-secondary flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white">
                        <Share2 size={16} /> Share
                    </button>
                    <button className="btn-primary flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white shadow-lg shadow-blue-500/20">
                        <Download size={16} /> Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content: Story & Graph */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Story Card */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="heading-lg text-white mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-blue-400" />
                            Incident Narrative
                        </h3>
                        <p className="text-slate-300 leading-relaxed text-lg">
                            {incident.story || "No narrative available for this incident."}
                        </p>
                    </div>

                    {/* LINKED PLAYBOOK - New Section */}
                    <div id="playbook-section" className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-blue-900/5">
                        <h3 className="heading-lg text-white mb-4 flex items-center gap-2">
                            <BookOpen size={20} className="text-green-400" />
                            Active Response Playbook
                        </h3>
                        {playbook ? (
                            <PlaybookViewer playbook={playbook} incident={incident} compact={true} />
                        ) : (
                            <div className="text-center py-8 text-slate-500 bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                                <p>No automated playbook generated yet.</p>
                                <button className="mt-2 text-blue-400 hover:underline text-sm">Generate manually</button>
                            </div>
                        )}
                    </div>

                    {/* MITRE ATT&CK Overlay */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="heading-lg text-white mb-4 flex items-center gap-2">
                            <ShieldAlert size={20} className="text-red-400" />
                            Kill Chain Progression
                        </h3>
                        <MitreAttackOverlay incident={incident} />
                    </div>

                    {/* Attack Replay */}
                    {incident.signals && incident.signals.length > 0 && (
                        <div className="glass-panel p-6 rounded-2xl">
                            <h3 className="heading-lg text-white mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-blue-400" />
                                Incident Replay & Chronology
                            </h3>
                            <AttackReplayTimeline
                                signals={incident.signals}
                                onSignalChange={(signal) => setHighlightedEntity(signal?.asset || signal?.source_ip || signal?.user)}
                            />
                        </div>
                    )}

                    {/* Attack Graph */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="heading-lg text-white mb-4 flex items-center gap-2">
                            <Share2 size={20} className="text-violet-400" />
                            Attack Graph Reconstruction
                        </h3>
                        <AttackGraph data={incident.graph} highlightEntity={highlightedEntity} />
                    </div>

                </div>

                {/* Sidebar Content: Entities & Risk */}
                <div className="space-y-6">

                    {/* Risk Meter */}
                    <div className="glass-panel p-6 rounded-2xl text-center">
                        <h3 className="text-slate-400 font-medium mb-4">AI Fidelity Score</h3>
                        <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-8 border-slate-800"></div>
                            <div
                                className="absolute inset-0 rounded-full border-8 border-transparent border-t-red-500 border-r-red-500 rotate-45"
                                style={{ transform: `rotate(${incident.risk_score * 3.6}deg)` }} // simplistic mock
                            ></div>
                            <div>
                                <span className="text-4xl font-bold text-white">{Math.round(incident.risk_score * 100)}</span>
                                <span className="text-sm text-slate-500 block">/100</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                            Confirmed threat with high confidence based on multi-asset correlation.
                        </p>
                    </div>

                    {/* Entities */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="heading-lg text-white mb-4">Entities Involved</h3>

                        <div className="space-y-4">
                            {incident.entities?.users?.length > 0 && (
                                <div>
                                    <h4 className="text-sm text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <User size={14} /> Users
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.users.map(u => (
                                            <span key={u} className="px-2 py-1 bg-slate-800 rounded text-sm text-blue-300 border border-slate-700">{u}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 flex-wrap">
                                <button
                                    onClick={() => navigate('/reasoning', { state: { incidentId: incident.incident_id } })}
                                    className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-all text-xs font-bold uppercase"
                                >
                                    <Brain size={14} /> Reason
                                </button>
                                <button
                                    onClick={() => navigate(`/mitre/${incident.incident_id}`, { state: { incidentId: incident.incident_id } })}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-all text-xs font-bold uppercase"
                                >
                                    <Target size={14} /> MITRE
                                </button>
                                <button
                                    onClick={() => document.getElementById('playbook-section').scrollIntoView({ behavior: 'smooth' })}
                                    className="flex items-center gap-2 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg transition-all text-xs font-bold uppercase"
                                >
                                    <BookOpen size={14} /> Response
                                </button>
                            </div>

                            {incident.entities?.assets?.length > 0 && (
                                <div>
                                    <h4 className="text-sm text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Server size={14} /> Assets
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.assets.map(a => (
                                            <span key={a} className="px-2 py-1 bg-slate-800 rounded text-sm text-violet-300 border border-slate-700">{a}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {incident.entities?.ips?.length > 0 && (
                                <div>
                                    <h4 className="text-sm text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Globe size={14} /> IPs
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.entities.ips.map(ip => (
                                            <span key={ip} className="px-2 py-1 bg-slate-800 rounded text-sm text-amber-300 border border-slate-700">{ip}</span>
                                        ))}
                                    </div>
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
