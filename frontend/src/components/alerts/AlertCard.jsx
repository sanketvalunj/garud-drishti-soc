import React from 'react';
import { Shield, Zap, ShieldCheck, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const SeverityIndicator = ({ severity }) => {
    const colors = {
        high: "bg-[#B91C1C]",
        medium: "bg-[#D97706]",
        low: "bg-[#00AEEF]"
    };
    return <div className={clsx("w-1 h-12 rounded-full absolute left-0 top-1/2 -translate-y-1/2", colors[severity] || colors.low)} />;
};

const SourceIcon = ({ source }) => {
    if (source === 'EDR') return <Shield size={16} className="text-blue-400" />;
    if (source === 'SIEM') return <Zap size={16} className="text-amber-400" />;
    if (source === 'UEBA') return <ShieldCheck size={16} className="text-emerald-400" />;
    return <Shield size={16} className="text-slate-400" />;
};

const AlertCard = ({ alert, onClick }) => {
    return (
        <div 
            onClick={() => onClick(alert)}
            className="group glass-panel p-5 rounded-2xl relative overflow-hidden border border-slate-700/30 hover:border-slate-600/50 hover:bg-white/5 transition-all cursor-pointer flex flex-col gap-4"
        >
            <SeverityIndicator severity={alert.severity} />
            
            <div className="flex justify-between items-start pl-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono font-bold text-blue-400/80 uppercase tracking-widest">{alert.id}</span>
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">{alert.title}</h3>
                </div>
                <div className="p-1.5 bg-slate-800/50 rounded-lg text-slate-500 group-hover:text-blue-400 transition-colors">
                    <ExternalLink size={14} />
                </div>
            </div>

            <div className="flex items-center justify-between pl-3">
                <div className="flex items-center gap-2">
                    <SourceIcon source={alert.source} />
                    <span className="text-xs text-slate-400 font-medium">{alert.entity}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                    <Clock size={12} />
                    {alert.timestamp}
                </div>
            </div>

            <div className="flex items-center gap-2 pl-3 mt-1">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                        style={{ width: `${alert.fidelity * 100}%` }}
                    />
                </div>
                <span className="text-[10px] font-black text-slate-500">{Math.round(alert.fidelity * 100)}%</span>
            </div>
        </div>
    );
};

export default AlertCard;
