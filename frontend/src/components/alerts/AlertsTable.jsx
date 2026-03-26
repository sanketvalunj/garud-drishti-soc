import React from 'react';
import { MoreHorizontal, ExternalLink, ShieldAlert, Zap, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

const SeverityBadge = ({ severity }) => {
    const styles = {
        high: "bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/20",
        medium: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20",
        low: "bg-[#00AEEF]/10 text-[#00AEEF] border-[#00AEEF]/20"
    };
    return (
        <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[severity] || styles.low)}>
            {severity}
        </span>
    );
};

const StatusIndicator = ({ status }) => {
    const dots = {
        investigating: "bg-[#D97706]",
        escalated: "bg-[#B91C1C]",
        resolved: "bg-[#10B981]"
    };
    return (
        <div className="flex items-center gap-2">
            <div className={clsx("w-2 h-2 rounded-full", dots[status] || "bg-slate-500")} />
            <span className="text-xs text-slate-400 capitalize">{status}</span>
        </div>
    );
};

const AlertsTable = ({ alerts, onViewDetails, loading }) => {
    if (loading) {
        return <SkeletonTable />;
    }

    return (
        <div className="glass-panel overflow-hidden rounded-2xl border border-slate-700/30">
            <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800/50 border-b border-slate-700/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Alert ID</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Title</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Entity</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Source</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Severity</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fidelity</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Time</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {alerts.map((alert) => (
                            <tr 
                                key={alert.id}
                                className="group hover:bg-white/5 transition-all cursor-pointer"
                                onClick={() => onViewDetails(alert)}
                            >
                                <td className="px-6 py-4">
                                    <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                        {alert.id}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                                        {alert.title}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {alert.entity}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <SourceIcon source={alert.source} />
                                        <span className="text-xs text-slate-300">{alert.source}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <SeverityBadge severity={alert.severity} />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                                                style={{ width: `${alert.fidelity * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono font-bold text-slate-400">
                                            {Math.round(alert.fidelity * 100)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <StatusIndicator status={alert.status} />
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                                    {alert.timestamp}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        className="p-1.5 hover:bg-blue-500/10 rounded-lg text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewDetails(alert);
                                        }}
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SourceIcon = ({ source }) => {
    if (source === 'EDR') return <Shield size={14} className="text-blue-400" />;
    if (source === 'SIEM') return <Zap size={14} className="text-amber-400" />;
    if (source === 'UEBA') return <ShieldCheck size={14} className="text-emerald-400" />;
    return <Shield size={14} className="text-slate-400" />;
};

const SkeletonTable = () => {
    return (
        <div className="glass-panel overflow-hidden rounded-2xl border border-slate-700/30 animate-pulse">
            <div className="h-12 bg-slate-800/50 border-b border-slate-700/30" />
            <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <div className="h-4 bg-slate-800 rounded w-24" />
                        <div className="h-4 bg-slate-800 rounded flex-1" />
                        <div className="h-4 bg-slate-800 rounded w-32" />
                        <div className="h-4 bg-slate-800 rounded w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const Shield = ({ size, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

export default AlertsTable;
