import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
    ShieldAlert,
    Search,
    Filter,
    ChevronRight,
    AlertTriangle,
    Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const SeverityBadge = ({ severity }) => {
    const styles = {
        critical: "bg-red-500/10 text-red-500 border-red-500/20",
        high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };

    return (
        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-semibold border uppercase", styles[severity?.toLowerCase()] || styles.low)}>
            {severity}
        </span>
    );
};

const Incidents = () => {
    const [incidents, setIncidents] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            const data = await api.getIncidents();
            setIncidents(data.incidents || []);
        } catch (e) {
            console.error("Failed to fetch incidents", e);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="heading-xl text-white">Incident Feed</h2>
                    <p className="text-slate-400 mt-1">Real-time alerts requiring immediate attention</p>
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search incidents..."
                            className="bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <button className="p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white">
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* Incidents Grid */}
            <div className="space-y-4">
                {incidents.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No active incidents found.</p>
                    </div>
                ) : (
                    incidents.map((incident, idx) => (
                        <motion.div
                            key={incident.incident_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => navigate(`/incidents/${incident.incident_id}`, { state: { incident } })}
                            className="glass-panel p-5 rounded-xl cursor-pointer hover:border-blue-500/30 hover:bg-slate-800/40 transition-all group relative overflow-hidden"
                        >
                            {/* Left Stripe for Severity */}
                            <div className={clsx(
                                "absolute left-0 top-0 bottom-0 w-1",
                                incident.severity === 'high' ? "bg-orange-500" :
                                    incident.severity === 'critical' ? "bg-red-500" : "bg-blue-500"
                            )} />

                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pl-4">

                                {/* Main Info */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <SeverityBadge severity={incident.severity} />
                                        <span className="text-slate-500 text-xs font-mono">ID: {incident.incident_id?.substring(0, 8)}</span>
                                        <span className="text-slate-500 text-xs">{new Date(incident.timestamp).toLocaleString()}</span>
                                    </div>

                                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                        {incident.summary.replace(/_/g, ' ').toUpperCase()}
                                    </h3>

                                    <p className="text-slate-400 text-sm line-clamp-2 pr-4 leading-relaxed">
                                        {incident.story || "No detailed story available."}
                                    </p>
                                </div>

                                {/* Metrics */}
                                <div className="flex items-center gap-6 lg:border-l lg:border-slate-800 lg:pl-6 min-w-[300px]">

                                    {/* Risk Score */}
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Risk Score</p>
                                        <div className="flex items-end justify-center gap-1">
                                            <span className={clsx(
                                                "text-2xl font-bold font-mono",
                                                (incident.risk_score || 0) > 0.7 ? "text-red-500" : "text-amber-500"
                                            )}>
                                                {Math.round((incident.risk_score || 0) * 100)}
                                            </span>
                                            <span className="text-xs text-slate-500 mb-1">/100</span>
                                        </div>
                                    </div>

                                    {/* Related Events */}
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Events</p>
                                        <div className="text-xl font-bold text-white font-mono">
                                            {incident.related_events}
                                        </div>
                                    </div>

                                    {/* Action Arrow */}
                                    <div className="ml-auto">
                                        <div className="p-2 rounded-full bg-slate-800 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div >
    );
};

export default Incidents;
