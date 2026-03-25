import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Shield, Network, RefreshCw, Search, X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

// ─── Fallback Demo Graph ───────────────────────────────────────
const DEMO_GRAPH = {
    nodes: ['emp_101', 'core_banking', '192.168.1.55', 'hr_portal', 'admin_user'],
    edges: [
        { from: 'emp_101', to: 'core_banking', relation: 'LOGIN_FAILED' },
        { from: '192.168.1.55', to: 'core_banking', relation: 'ACCESS' },
        { from: 'admin_user', to: 'hr_portal', relation: 'POWERSHELL_EXEC' },
        { from: '192.168.1.55', to: 'hr_portal', relation: 'ACCESS' },
    ]
};

// ─── Simple SVG-based Graph Renderer (no ReactFlow dependency) ─
const SimpleGraph = ({ nodes, edges, onNodeClick, highlightEntity }) => {
    const COLORS = { user: '#3b82f6', ip: '#22c55e', asset: '#a855f7', unknown: '#64748b' };
    const W = 900, H = 500;

    const getType = (id) => {
        if (id.includes('emp') || id.includes('user') || id.includes('admin')) return 'user';
        if (id.match(/^\d+\.\d+\.\d+\.\d+$/)) return 'ip';
        return 'asset';
    };

    // Layout: left = users/IPs, right = assets
    const userNodes = nodes.filter(n => getType(n) === 'user' || getType(n) === 'ip');
    const assetNodes = nodes.filter(n => getType(n) === 'asset' || getType(n) === 'unknown');

    const positions = {};
    userNodes.forEach((n, i) => {
        positions[n] = { x: 150, y: 60 + i * 110 };
    });
    assetNodes.forEach((n, i) => {
        positions[n] = { x: W - 200, y: 80 + i * 110 };
    });

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
                <marker id="arrow-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#B91C1C" />
                </marker>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Edges */}
            {edges.map((edge, i) => {
                const src = positions[edge.from];
                const tgt = positions[edge.to];
                if (!src || !tgt) return null;
                const isHighRisk = edge.relation?.includes('POWERSHELL') || edge.relation?.includes('EXFIL');
                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;
                return (
                    <g key={i}>
                        <line
                            x1={src.x + 70} y1={src.y + 22} x2={tgt.x} y2={tgt.y + 22}
                            stroke={isHighRisk ? '#B91C1C' : '#6366f1'}
                            strokeWidth={isHighRisk ? 2.5 : 1.5}
                            strokeDasharray={isHighRisk ? '0' : '6,4'}
                            markerEnd={isHighRisk ? 'url(#arrow-red)' : 'url(#arrow)'}
                            opacity={0.7}
                        />
                        <rect x={midX - 40} y={midY - 9} width={80} height={16} rx={4}
                            fill="#0f172a" stroke="#334155" strokeWidth={1} opacity={0.85} />
                        <text x={midX} y={midY + 4} textAnchor="middle" fontSize={8}
                            fill={isHighRisk ? '#B91C1C' : '#94a3b8'} fontWeight="bold">
                            {edge.relation?.substring(0, 14)}
                        </text>
                    </g>
                );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
                const pos = positions[node];
                if (!pos) return null;
                const type = getType(node);
                const color = COLORS[type];
                const isHighlighted = highlightEntity === node;

                return (
                    <g key={node} onClick={() => onNodeClick && onNodeClick({ label: node, type })}
                        className="cursor-pointer">
                        <rect x={pos.x} y={pos.y} width={140} height={44} rx={10}
                            fill={isHighlighted ? 'rgba(185,28,28,0.2)' : '#1e293b'}
                            stroke={isHighlighted ? '#B91C1C' : color}
                            strokeWidth={isHighlighted ? 2.5 : 1.5}
                            filter={isHighlighted ? 'url(#glow)' : ''}
                        />
                        <text x={pos.x + 70} y={pos.y + 16} textAnchor="middle" fontSize={9}
                            fill={color} fontWeight="bold" textTransform="uppercase">
                            {type.toUpperCase()}
                        </text>
                        <text x={pos.x + 70} y={pos.y + 32} textAnchor="middle" fontSize={10}
                            fill="white" fontWeight="600">
                            {node.substring(0, 16)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

// ─── Main ThreatGraph Page ─────────────────────────────────────
const ThreatGraph = () => {
    const [events, setEvents] = useState([]);
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [activeEntity, setActiveEntity] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const [streamStatus, setStreamStatus] = useState('connecting');

    const stats = {
        total: events.length,
        suspicious: events.filter(e => e.severity === 'high' || e.severity === 'critical').length,
        assets: graphData.nodes.filter(n => !n.match(/^\d+\.\d+\.\d+\.\d+$/)).length,
    };

    const addToGraph = useCallback((inc) => {
        if (isPaused) return;
        setGraphData(prev => {
            const nextNodes = [...prev.nodes];
            const nextEdges = [...prev.edges];
            const add = (id) => { if (id && !nextNodes.includes(id)) nextNodes.push(id); };
            if (inc.user) add(inc.user);
            if (inc.asset) add(inc.asset);
            if (inc.source_ip) add(inc.source_ip);
            if (inc.user && inc.asset && !nextEdges.find(e => e.from === inc.user && e.to === inc.asset)) {
                nextEdges.push({ from: inc.user, to: inc.asset, relation: inc.event_type || inc.type || 'ACCESS' });
            }
            if (inc.source_ip && inc.asset && !nextEdges.find(e => e.from === inc.source_ip && e.to === inc.asset)) {
                nextEdges.push({ from: inc.source_ip, to: inc.asset, relation: 'ACCESS' });
            }
            return { nodes: nextNodes, edges: nextEdges };
        });
    }, [isPaused]);

    const handleNewEvent = useCallback((event) => {
        console.log('ThreatGraph data:', event);
        if (isPaused) return;
        const newEvent = { ...event, id: Date.now() + Math.random() };
        setEvents(prev => [...prev.slice(-99), newEvent]);
        addToGraph(event);
        if (event.severity === 'high' || event.severity === 'critical') {
            setActiveEntity(null); // clear first
            setTimeout(() => setActiveEntity(event.asset), 50);
            setTimeout(() => setActiveEntity(null), 3000);
        }
    }, [isPaused, addToGraph]);

    // Prime from API, then connect SSE
    useEffect(() => {
        let evtSource = null;
        let mounted = true;

        const prime = async () => {
            try {
                const data = await api.getIncidents();
                console.log('ThreatGraph data:', data);
                if (!mounted) return;
                const incidents = data.incidents || [];
                if (incidents.length === 0) throw new Error('no incidents');
                incidents.slice(0, 15).forEach(inc => addToGraph({
                    user: inc.user || 'unknown',
                    asset: inc.asset || 'server',
                    source_ip: inc.source_ip,
                    event_type: inc.type || 'INCIDENT',
                    severity: inc.severity
                }));
                setEvents(incidents.slice(0, 15).map(i => ({ ...i, id: i.incident_id })));
                setStreamStatus('live');
            } catch {
                if (!mounted) return;
                // Use fallback demo graph
                setGraphData(DEMO_GRAPH);
                setIsDemo(true);
                setStreamStatus('demo');
            }
        };

        prime();

        // Try SSE connection
        try {
            evtSource = new EventSource('http://127.0.0.1:8000/stream-events');
            evtSource.onmessage = (e) => {
                try { handleNewEvent(JSON.parse(e.data)); setStreamStatus('live'); } catch { }
            };
            evtSource.onerror = () => { setStreamStatus('offline'); };
        } catch { }

        return () => {
            mounted = false;
            evtSource?.close();
        };
    }, [addToGraph, handleNewEvent]);

    const handleNodeClick = (nodeData) => {
        setActiveEntity({
            id: nodeData.label,
            type: nodeData.type,
            lastSeen: new Date().toLocaleTimeString(),
            status: 'stable',
            associatedEvents: events.filter(e =>
                e.user === nodeData.label || e.asset === nodeData.label || e.source_ip === nodeData.label
            )
        });
    };

    const handleClear = () => {
        setEvents([]);
        setGraphData({ nodes: [], edges: [] });
        setActiveEntity(null);
        setIsDemo(false);
        setStreamStatus('connecting');
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            {/* Demo Banner */}
            {isDemo && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-semibold">
                    <AlertTriangle size={14} />
                    Showing demo topology — backend offline or no incidents found. Real data will load automatically.
                </div>
            )}

            {/* Stats */}
            <div className="flex gap-4">
                {[
                    { label: 'Events', value: stats.total, icon: Activity, color: 'blue' },
                    { label: 'Anomalies', value: stats.suspicious, icon: Shield, color: 'red' },
                    { label: 'Topology Nodes', value: graphData.nodes.length, icon: Network, color: 'violet' },
                ].map(s => {
                    const Icon = s.icon;
                    const col = { blue: 'blue-400 blue-500/10 blue-500/30', red: '[#B91C1C] [rgba(185,28,28,0.1)] [rgba(185,28,28,0.3)]', violet: 'violet-400 violet-500/10 violet-500/30' }[s.color].split(' ');
                    return (
                        <div key={s.label} className={`flex-1 p-5 rounded-2xl flex items-center gap-4 border transition-all`}
                            style={{ 
                                background: 'var(--surface-color)', 
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                borderColor: 'var(--glass-border)' 
                            }}
                        >
                            <div className={`p-3 bg-${s.color}-500/10 rounded-xl text-${s.color}-400`}><Icon size={22} /></div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
                                <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main: Graph + Inspector */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Graph Canvas */}
                <div className={clsx('transition-all duration-500 relative rounded-2xl border overflow-hidden flex flex-col', activeEntity ? 'flex-1' : 'w-full')}
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    {/* Toolbar */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        <h3 className="text-white font-bold flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700/50 text-sm backdrop-blur-md">
                            <Network size={16} className="text-blue-400" /> Interactive Threat Topology
                        </h3>
                        <button onClick={handleClear} className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-700/50 transition-colors" title="Reset">
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {/* Status Chip */}
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50 text-[10px] backdrop-blur-md">
                        <div className={clsx('w-2 h-2 rounded-full', streamStatus === 'live' ? 'bg-green-500 animate-pulse' : streamStatus === 'demo' ? 'bg-amber-500' : 'bg-slate-500')} />
                        <span className="text-slate-300">{streamStatus === 'live' ? 'LIVE' : streamStatus === 'demo' ? 'DEMO' : 'OFFLINE'}</span>
                    </div>

                    {/* Graph */}
                    <div className="absolute inset-0 pt-14">
                        {graphData.nodes.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-600 flex-col gap-3">
                                <Activity size={40} className="animate-pulse opacity-50" />
                                <span className="text-xs uppercase tracking-widest">Awaiting data...</span>
                            </div>
                        ) : (
                            <SimpleGraph
                                nodes={graphData.nodes}
                                edges={graphData.edges}
                                onNodeClick={handleNodeClick}
                                highlightEntity={typeof activeEntity === 'string' ? activeEntity : activeEntity?.id}
                            />
                        )}
                    </div>
                </div>

                {/* Entity Inspector */}
                <AnimatePresence>
                    {activeEntity && typeof activeEntity === 'object' && activeEntity.id && (
                        <motion.div
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className="w-72 rounded-2xl border flex flex-col overflow-hidden shadow-2xl flex-shrink-0"
                            style={{ 
                                background: 'var(--surface-color)', 
                                backdropFilter: 'blur(30px)',
                                WebkitBackdropFilter: 'blur(30px)',
                                borderColor: 'var(--glass-border)' 
                            }}
                        >
                            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-white font-bold flex items-center gap-2 text-sm">
                                    <Search size={16} className="text-violet-400" /> Entity Inspector
                                </h4>
                                <button onClick={() => setActiveEntity(null)} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                <div className="text-center py-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                    <div className="text-xl font-bold text-white mb-1 truncate px-3">{activeEntity.id}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{activeEntity.type}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-slate-800/20 rounded-xl border border-slate-800/50">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</div>
                                        <div className={clsx('text-xs font-bold', (activeEntity.status === 'active_threat' || activeEntity.status === 'compromised') ? 'text-[#B91C1C]' : 'text-green-400')}>
                                            {activeEntity.status?.replace('_', ' ').toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-800/20 rounded-xl border border-slate-800/50">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Last Seen</div>
                                        <div className="text-xs text-white">{activeEntity.lastSeen}</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1.5">
                                        <Activity size={12} /> Interaction History ({activeEntity.associatedEvents?.length || 0})
                                    </div>
                                    {(activeEntity.associatedEvents?.length === 0) && (
                                        <div className="text-[10px] text-slate-600 italic">No recent events logged.</div>
                                    )}
                                    {activeEntity.associatedEvents?.slice(0, 5).map((evt, idx) => (
                                        <div key={idx} className="p-2.5 bg-slate-950/30 rounded-lg border border-slate-800/50 text-[10px] mb-1.5">
                                            <div className="flex justify-between mb-1">
                                                <span className={clsx('font-bold', evt.severity === 'critical' || evt.severity === 'high' ? 'text-[#B91C1C]' : 'text-blue-400')}>
                                                    {evt.event_type || evt.type}
                                                </span>
                                                <span className="text-slate-600">{new Date(evt.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="text-slate-400 truncate">Target: {evt.asset || '—'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ThreatGraph;
