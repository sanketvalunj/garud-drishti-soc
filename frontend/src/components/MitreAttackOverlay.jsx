import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Fingerprint,
    Terminal,
    HardDrive,
    ShieldAlert,
    Waypoints,
    UploadCloud
} from 'lucide-react';
import clsx from 'clsx';
import { MITRE_STAGES, mapIncidentToMitre } from '../utils/mitreMapper';

// Icon Map
const STAGE_ICONS = {
    initial_access: Fingerprint,
    execution: Terminal,
    persistence: HardDrive,
    privilege_escalation: ShieldAlert,
    lateral_movement: Waypoints,
    exfiltration: UploadCloud
};

const MitreAttackOverlay = ({ incident, mini = false, onStageHover }) => {
    // Memoize mapping to avoid re-calc
    const { activeStages, coverage } = useMemo(() =>
        mapIncidentToMitre(incident) || { activeStages: new Set(), coverage: [] },
        [incident]);
    const [hoveredStage, setHoveredStage] = useState(null);

    const handleHover = (stageId) => {
        setHoveredStage(stageId);
        if (onStageHover) onStageHover(stageId);
    };

    // --- MINI DASHBOARD MODE ---
    if (mini) {
        const progress = (activeStages.size / MITRE_STAGES.length) * 100;
        return (
            <div className="w-full">
                <div className="flex justify-between text-xs text-slate-400 mb-2 uppercase tracking-wider font-bold">
                    <span>Kill Chain Coverage</span>
                    <span className="text-white">{activeStages.size}/{MITRE_STAGES.length} Stages</span>
                </div>
                {/* Progress Bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    {MITRE_STAGES.map((stage, idx) => {
                        const isActive = activeStages.has(stage.id);
                        return (
                            <motion.div
                                key={stage.id}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: isActive ? '100%' : '100%', opacity: isActive ? 1 : 0.2 }}
                                transition={{ delay: idx * 0.1 }}
                                className={clsx(
                                    "flex-1 h-full border-r border-slate-900 last:border-0 transition-colors",
                                    isActive
                                        ? (stage.color === 'red' ? 'bg-red-500' : stage.color === 'orange' ? 'bg-orange-500' : 'bg-blue-500')
                                        : 'bg-slate-700'
                                )}
                            />
                        );
                    })}
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                    <span>Initial</span>
                    <span>Exfil</span>
                </div>
            </div>
        );
    }

    // --- FULL DETAIL MODE ---
    return (
        <div className="w-full relative py-6 overflow-x-auto custom-scrollbar">
            {/* Connector Line Base */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-4 z-0 mx-10" />

            <div className="flex justify-between items-start min-w-[800px] px-4 relative z-10">
                {MITRE_STAGES.map((stage, idx) => {
                    const isActive = activeStages.has(stage.id);
                    const isHovered = hoveredStage === stage.id;
                    const Icon = STAGE_ICONS[stage.id] || Fingerprint;
                    const stageDetail = coverage.find(c => c.stage === stage.id);

                    // Determine Color
                    const activeColorClass = stage.color === 'red' ? 'text-red-400 border-red-500 bg-red-900/20' :
                        stage.color === 'orange' ? 'text-orange-400 border-orange-500 bg-orange-900/20' :
                            stage.color === 'indigo' ? 'text-indigo-400 border-indigo-500 bg-indigo-900/20' :
                                stage.color === 'violet' ? 'text-violet-400 border-violet-500 bg-violet-900/20' :
                                    'text-blue-400 border-blue-500 bg-blue-900/20';

                    return (
                        <div
                            key={stage.id}
                            className="flex flex-col items-center group relative cursor-help"
                            onMouseEnter={() => handleHover(stage.id)}
                            onMouseLeave={() => handleHover(null)}
                        >
                            {/* Animated Connection to Next */}
                            {idx < MITRE_STAGES.length - 1 && isActive && activeStages.has(MITRE_STAGES[idx + 1].id) && (
                                <motion.div
                                    className={clsx(
                                        "absolute top-[18px] left-[50%] w-full h-1 z-0",
                                        stage.color === 'red' ? 'bg-red-500' : 'bg-blue-500'
                                    )}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ delay: idx * 0.2, duration: 0.5 }}
                                    style={{ transformOrigin: 'left' }}
                                />
                            )}

                            {/* Node */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0.5 }}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    opacity: isActive ? 1 : 0.4,
                                    borderColor: isActive ? undefined : '#334155'
                                }}
                                transition={{ delay: idx * 0.1 }}
                                className={clsx(
                                    "w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-xl transition-all duration-300 relative z-10 bg-slate-900",
                                    isActive ? activeColorClass : "border-slate-700 bg-slate-800 text-slate-600"
                                )}
                            >
                                <Icon size={20} />
                                {/* Pulp Effect for active */}
                                {isActive && (
                                    <div className={clsx(
                                        "absolute inset-0 rounded-full animate-ping opacity-20",
                                        stage.color === 'red' ? 'bg-red-500' : 'bg-blue-500'
                                    )} />
                                )}
                            </motion.div>

                            {/* Label */}
                            <div className="mt-3 text-center">
                                <p className={clsx(
                                    "text-xs font-bold uppercase tracking-wider transition-colors",
                                    isActive ? "text-white" : "text-slate-600"
                                )}>
                                    {stage.label}
                                </p>
                            </div>

                            {/* Tooltip */}
                            <AnimatePresence>
                                {(isHovered && isActive) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 5, scale: 0.9 }}
                                        className="absolute top-20 w-48 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-left pointer-events-none"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] uppercase font-bold text-slate-500">Evidence Found</span>
                                        </div>
                                        <p className="text-xs text-white leading-relaxed">
                                            {stageDetail?.trigger || "System activity matched this pattern."}
                                        </p>
                                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                                            Time: {new Date(stageDetail?.timestamp || incident.timestamp).toLocaleTimeString()}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MitreAttackOverlay;
