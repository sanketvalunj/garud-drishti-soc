import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Clock, Globe, Fingerprint, Database, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useRole } from '../../context/RoleContext';

const AlertDetailsDrawer = ({ alert, isOpen, onClose, onEscalate }) => {
    const { isTier1, isTier2, isTier3 } = useRole();

    const severityColors = {
        high: "text-[#B91C1C]",
        medium: "text-[#D97706]",
        low: "text-[#00AEEF]"
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-lg glass-panel z-[101] shadow-2xl border-l border-slate-700/50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700/30 flex items-center justify-between bg-slate-800/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <ShieldAlert className="text-blue-400" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Alert Details</h2>
                                    <p className="text-xs text-blue-400 font-mono tracking-wider uppercase">{alert.id}</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Summary Section */}
                            <section>
                                <h3 className="text-xl font-bold text-white mb-2 leading-tight">{alert.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{alert.description}</p>
                            </section>

                            {/* Metadata Grid */}
                            <section className="grid grid-cols-2 gap-4">
                                <MetaItem icon={Fingerprint} label="Entity" value={alert.entity} />
                                <MetaItem icon={Database} label="Source" value={alert.source} />
                                <MetaItem icon={Clock} label="Timestamp" value={alert.timestamp} />
                                <MetaItem 
                                    icon={ShieldAlert} 
                                    label="Severity" 
                                    value={alert.severity.toUpperCase()} 
                                    valueClass={severityColors[alert.severity]}
                                />
                            </section>

                            {/* Fidelity Gauge */}
                            <section className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-blue-400" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Fidelity Score</h4>
                                    </div>
                                    <span className="text-2xl font-black text-blue-400 tracking-tighter">
                                        {Math.round(alert.fidelity * 100)}<span className="text-sm font-bold">%</span>
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${alert.fidelity * 100}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="h-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                                    />
                                </div>
                                <p className="mt-3 text-[10px] text-slate-500 font-medium italic">
                                    Score indicates likelihood of a true positive event based on historical context.
                                </p>
                            </section>

                            {/* Raw Metadata (Collapsed by default in visual style) */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Payload Mapping</h4>
                                    <div className="flex-1 h-px bg-slate-700/30" />
                                </div>
                                <div className="bg-slate-900/50 rounded-xl p-4 font-mono text-[11px] text-slate-400 leading-relaxed border border-slate-800/50">
                                    <pre className="whitespace-pre-wrap">
                                        {JSON.stringify({
                                            alert_id: alert.id,
                                            origin: alert.source,
                                            target_entity: alert.entity,
                                            detection_timestamp: new Date().toISOString(),
                                            threat_vector: "Endpoint Execution",
                                            confidence_level: alert.fidelity,
                                            mitre_technique: "T1078.003",
                                            event_type: "PROCESS_START"
                                        }, null, 2)}
                                    </pre>
                                </div>
                            </section>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-700/30 bg-slate-800/30 flex flex-col gap-3">
                            {(isTier1 || isTier2 || isTier3) && (
                                <button 
                                    onClick={() => onEscalate(alert)}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/40 group active:scale-[0.98]"
                                >
                                    <ShieldAlert size={18} className="group-hover:animate-pulse" />
                                    Convert to Incident
                                    <ChevronRight size={16} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                            
                            <button 
                                onClick={onClose}
                                className="w-full py-3.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-600/30 whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                                Dismiss Alert
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const MetaItem = ({ icon: Icon, label, value, valueClass }) => (
    <div className="p-3.5 bg-slate-800/30 border border-slate-700/20 rounded-xl flex flex-col gap-1 hover:border-slate-700/50 transition-colors">
        <div className="flex items-center gap-1.5 text-slate-500">
            <Icon size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </div>
        <div className={clsx("text-sm font-semibold truncate", valueClass || "text-slate-200")}>{value}</div>
    </div>
);

export default AlertDetailsDrawer;
