import React, { useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Server, Globe, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

// Custom Node Component
const EntityNode = ({ data }) => {
    // Determine Icon
    let Icon = ShieldAlert;
    let colorClass = 'text-slate-400';
    let bgClass = 'bg-slate-800 border-slate-700';

    if (data.type === 'user') {
        Icon = User;
        colorClass = 'text-blue-400';
        bgClass = 'bg-blue-900/20 border-blue-500/30';
    } else if (data.type === 'asset') {
        Icon = Server;
        colorClass = 'text-violet-400';
        bgClass = 'bg-violet-900/20 border-violet-500/30';
    } else if (data.type === 'ip') {
        Icon = Globe;
        colorClass = 'text-green-400';
        bgClass = 'bg-green-900/20 border-green-500/30';
    }

    // Highlighting Logic
    const isHighlighted = data.isHighlighted;

    return (
        <div className={clsx(
            "px-4 py-3 rounded-xl border-2 min-w-[150px] transition-all duration-300 relative",
            bgClass,
            isHighlighted ? "!border-[#B91C1C] !bg-[rgba(185,28,28,0.3)] shadow-[0_0_25px_rgba(185,28,28,0.4)] scale-110 z-50" : "hover:border-white/20"
        )}>
            {isHighlighted && (
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#B91C1C] animate-ping" />
            )}

            <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-3 !h-3" />

            <div className="flex flex-col items-center gap-1">
                <Icon size={20} className={clsx(colorClass, isHighlighted && "text-[#B91C1C]")} />
                <span className={clsx("text-xs font-bold text-white", isHighlighted ? "text-red-100" : "")}>{data.label}</span>
                <span className="text-[10px] uppercase opacity-70 tracking-wider">{data.type || 'Entity'}</span>
            </div>

            {/* Tooltip */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none">
                Risk Score: High
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-3 !h-3" />
        </div>
    );
};

const nodeTypes = {
    default: EntityNode,
    user: EntityNode,
    asset: EntityNode,
    ip: EntityNode
};

const AttackGraph = ({ data, highlightEntity, onNodeClick }) => {
    // Transform graph data for React Flow
    const { flowNodes, flowEdges } = useMemo(() => {
        if (!data || !data.nodes) return { flowNodes: [], flowEdges: [] };

        const nodeIds = data.nodes;
        const edgeList = data.edges || [];

        // Dynamic Layout: Multi-column with vertical stratification
        const xSpacing = 280;
        const ySpacing = 180;
        const colMap = { user: 0, ip: 0, asset: 1, unknown: 1 };

        const flowNodes = nodeIds.map((nodeId, index) => {
            let type = 'unknown';
            if (nodeId.includes('emp') || nodeId.includes('user')) type = 'user';
            else if (nodeId.match(/^\d+\.\d+\.\d+\.\d+$/)) type = 'ip';
            else type = 'asset';

            // Calculate position based on type columns
            const col = colMap[type] || 0;
            const row = index % 5;

            return {
                id: nodeId,
                type: type,
                position: {
                    x: col * xSpacing + (Math.random() * 20),
                    y: row * ySpacing + (Math.random() * 20)
                },
                data: {
                    label: nodeId,
                    type: type,
                    isHighlighted: highlightEntity === nodeId
                }
            };
        });

        const flowEdges = edgeList.map((edge, i) => {
            const isHighRisk = edge.relation?.includes('POWERSHELL') || edge.relation?.includes('EXFIL');
            return {
                id: `e-${i}`,
                source: edge.from,
                target: edge.to,
                animated: true,
                label: edge.relation || '',
                labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: "'Inter', sans-serif" },
                labelBgPadding: [8, 4],
                labelBgBorderRadius: 4,
                labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
                style: {
                    stroke: isHighRisk ? '#B91C1C' : '#6366f1',
                    strokeWidth: isHighRisk ? 3 : 2,
                    filter: isHighRisk ? 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.5))' : 'none'
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: isHighRisk ? '#B91C1C' : '#6366f1',
                },
            };
        });

        return { flowNodes, flowEdges };
    }, [data, highlightEntity]);

    return (
        <div className="w-full h-full relative group">
            <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => onNodeClick && onNodeClick(node.data)}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.2}
                maxZoom={4}
            >
                <Background color="#1e293b" gap={25} size={1} />
                <Controls
                    showInteractive={false}
                    className="bg-slate-900 border-slate-700 !fill-white !left-4 !bottom-4 !top-auto !right-auto shadow-2xl"
                />
            </ReactFlow>

            {/* Visual Guide Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-4 text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40 p-2 rounded backdrop-blur-sm border border-slate-700/50">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Actors</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500" /> Assets</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Origins</span>
                </div>
            </div>
        </div>
    );
};

export default AttackGraph;
