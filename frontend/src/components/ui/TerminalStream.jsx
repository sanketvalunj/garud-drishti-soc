import React, { useEffect, useRef } from 'react';
import { Terminal, Pause, Play, Download } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const TerminalStream = ({ logs, isPaused, togglePause, onClear }) => {
    const bottomRef = useRef(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (!isPaused && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, isPaused]);

    return (
        <div className="flex flex-col h-full bg-black border-r border-slate-800 font-mono text-xs">
            {/* Terminal Header */}
            <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-400">
                    <Terminal size={14} />
                    <span className="font-bold tracking-wider">LIVE_SOC_FEED</span>
                    {!isPaused && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClear}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                        title="Clear Console"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        onClick={togglePause}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors",
                            isPaused ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-slate-800 text-slate-400 border border-slate-700"
                        )}
                    >
                        {isPaused ? <Play size={10} /> : <Pause size={10} />}
                        {isPaused ? "Resume" : "Pause"}
                    </button>
                </div>
            </div>

            {/* Log Output */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-black/90 relative">
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-2 hover:bg-white/5 p-0.5 rounded"
                        >
                            <span className="text-slate-500 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={clsx(
                                "font-bold",
                                log.severity === 'critical' ? 'text-red-500' :
                                    log.severity === 'high' ? 'text-orange-500' :
                                        log.severity === 'warning' ? 'text-yellow-400' :
                                            'text-green-400'
                            )}>
                                {log.event_type}
                            </span>
                            <span className="text-slate-300">
                                {log.user && <span className="text-blue-400 mx-1">{log.user}</span>}
                                {log.asset && <span className="text-violet-400 mx-1">@{log.asset}</span>}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={bottomRef} />

                {/* Blinking Cursor */}
                {!isPaused && (
                    <div className="inline-block w-2 h-4 bg-green-500 animate-pulse mt-1 ml-1" />
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-2 bg-slate-950 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between">
                <span>Events: {logs.length}</span>
                <span>Stream Latency: &lt;50ms</span>
            </div>
        </div>
    );
};

export default TerminalStream;
