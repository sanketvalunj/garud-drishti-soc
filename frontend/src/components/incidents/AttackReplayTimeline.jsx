import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    FastForward,
    Clock,
    Terminal,
    ShieldAlert,
    User,
    Server,
    Globe,
    Activity
} from 'lucide-react';
import clsx from 'clsx';

const AttackReplayTimeline = ({ signals = [], onSignalChange }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x

    // sorting signals by timestamp just in case
    const sortedSignals = React.useMemo(() => {
        return [...signals].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }, [signals]);

    const scrollRef = useRef(null);
    const itemRefs = useRef([]);

    // Notify parent of active signal
    useEffect(() => {
        if (sortedSignals.length > 0 && onSignalChange) {
            onSignalChange(sortedSignals[currentIndex]);
        }
    }, [currentIndex, sortedSignals, onSignalChange]);

    // Playback Timer
    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev < sortedSignals.length - 1) {
                        return prev + 1;
                    } else {
                        setIsPlaying(false);
                        return prev;
                    }
                });
            }, 2000 / playbackSpeed); // Base 2 seconds per event
        }
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, sortedSignals.length]);

    // Auto-scroll to active item
    useEffect(() => {
        if (itemRefs.current[currentIndex] && scrollRef.current) {
            itemRefs.current[currentIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentIndex]);


    // Handlers
    const togglePlay = () => setIsPlaying(!isPlaying);
    const stepForward = () => setCurrentIndex(prev => Math.min(prev + 1, sortedSignals.length - 1));
    const stepBack = () => setCurrentIndex(prev => Math.max(prev - 1, 0));
    const handleSliderChange = (e) => setCurrentIndex(parseInt(e.target.value));

    if (!sortedSignals.length) return <div className="text-slate-500 text-sm">No events to replay.</div>;

    const currentSignal = sortedSignals[currentIndex];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">

            {/* LEFT: Controls & Active State */}
            <div className="md:col-span-1 flex flex-col gap-4">

                {/* Control Panel */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-700/50 bg-slate-900/50">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-blue-400" /> Replay Controls
                    </h3>

                    {/* Progress Bar */}
                    <input
                        type="range"
                        min="0"
                        max={sortedSignals.length - 1}
                        value={currentIndex}
                        onChange={handleSliderChange}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-4"
                    />

                    {/* Buttons */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={stepBack} className="p-2 text-slate-400 hover:text-white transition-colors">
                            <SkipBack size={20} />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={stepForward} className="p-2 text-slate-400 hover:text-white transition-colors">
                            <SkipForward size={20} />
                        </button>
                    </div>

                    {/* Speed Toggle */}
                    <div className="flex justify-center gap-2">
                        {[1, 2, 4].map(s => (
                            <button
                                key={s}
                                onClick={() => setPlaybackSpeed(s)}
                                className={clsx(
                                    "px-3 py-1 rounded-md text-xs font-mono font-bold transition-colors",
                                    playbackSpeed === s ? "bg-slate-700 text-blue-400" : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active Entity Info Box */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-700/50 bg-slate-900/50 flex-1 relative overflow-hidden">
                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-4 tracking-wider">Active Context</h4>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 relative z-10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-slate-800 text-blue-400">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">Timestamp</div>
                                    <div className="text-sm font-mono text-white">
                                        {new Date(currentSignal.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-slate-800 text-violet-400">
                                    <User size={16} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">User</div>
                                    <div className="text-sm font-mono text-white truncate max-w-[150px]">
                                        {currentSignal.user || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-slate-800 text-amber-400">
                                    <Server size={16} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">Asset</div>
                                    <div className="text-sm font-mono text-white truncate max-w-[150px]">
                                        {currentSignal.asset || 'N/A'}
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    </AnimatePresence>

                    {/* Background Pulse */}
                    <div className={clsx(
                        "absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500",
                        currentSignal.severity === 'high' ? 'bg-red-500' : 'bg-blue-500'
                    )} />
                </div>
            </div>

            {/* RIGHT: Vertical Timeline */}
            <div className="md:col-span-2 glass-panel rounded-2xl border border-slate-700/50 bg-slate-900/50 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        Event Chronology
                        <span className="text-xs font-normal text-slate-400 ml-2">({currentIndex + 1}/{sortedSignals.length})</span>
                    </h3>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4 custom-scrollbar scroll-smooth" ref={scrollRef}>
                    {sortedSignals.map((signal, idx) => {
                        const isActive = idx === currentIndex;
                        const isPast = idx < currentIndex;

                        return (
                            <div
                                key={idx}
                                ref={el => itemRefs.current[idx] = el}
                                onClick={() => setCurrentIndex(idx)}
                                className={clsx(
                                    "relative pl-8 pr-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer group",
                                    isActive ? "bg-slate-800 border-blue-500 shadow-lg shadow-blue-900/20 scale-[1.02]" :
                                        isPast ? "bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-100" :
                                            "bg-slate-900 border-slate-800 opacity-40 hover:opacity-100"
                                )}
                            >
                                {/* Timeline Line */}
                                {idx !== sortedSignals.length - 1 && (
                                    <div className="absolute left-[15px] top-8 bottom-[-16px] w-[2px] bg-slate-800" />
                                )}

                                {/* Dot Marker */}
                                <div className={clsx(
                                    "absolute left-2 top-4 w-3 h-3 rounded-full border-2 transition-all duration-300 z-10",
                                    isActive ? "bg-blue-500 border-white scale-125" :
                                        isPast ? "bg-slate-700 border-slate-600" : "bg-slate-800 border-slate-700"
                                )} />

                                <div className="flex justify-between items-start mb-1">
                                    <span className={clsx(
                                        "text-xs font-mono font-bold",
                                        isActive ? "text-blue-400" : "text-slate-500"
                                    )}>
                                        {new Date(signal.timestamp).toLocaleTimeString()}
                                    </span>
                                    {signal.severity === 'high' && (
                                        <span className="bg-red-500/10 text-red-500 text-[10px] px-1.5 rounded uppercase font-bold border border-red-500/20">
                                            High Risk
                                        </span>
                                    )}
                                </div>

                                <h4 className={clsx(
                                    "font-medium text-sm mb-1 transition-colors",
                                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                                )}>
                                    {signal.event_type.replace(/_/g, ' ')}
                                </h4>

                                <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                                    {signal.asset && (
                                        <span className="flex items-center gap-1">
                                            <Server size={10} /> {signal.asset}
                                        </span>
                                    )}
                                    {signal.source_ip && (
                                        <span className="flex items-center gap-1">
                                            <Globe size={10} /> {signal.source_ip}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default AttackReplayTimeline;
