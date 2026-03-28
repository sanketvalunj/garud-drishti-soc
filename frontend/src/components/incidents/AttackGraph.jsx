import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MarkerType,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { User, Server, Globe, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

const IP_REGEX = /^\d+\.\d+\.\d+\.\d+$/;

const HIGH_RISK_KEYWORDS = [
    'EXFIL',
    'RANSOM',
    'POWERSHELL',
    'C2',
    'COMMAND',
    'PRIVILEGE',
    'LATERAL',
    'MALWARE',
    'BRUTE',
    'CREDENTIAL'
];

const MEDIUM_RISK_KEYWORDS = [
    'FAILED',
    'SUSPICIOUS',
    'ANOMALY',
    'UNUSUAL',
    'RETRY',
    'RECON',
    'SCAN'
];

const normalizeText = (value) => String(value || '').trim();

const inferNodeType = (nodeId, explicitType) => {
    const type = normalizeText(explicitType).toLowerCase();
    if (type === 'user' || type === 'ip' || type === 'asset' || type === 'virtual') {
        return type;
    }

    const id = normalizeText(nodeId).toLowerCase();
    if (IP_REGEX.test(id)) return 'ip';
    if (id.includes('emp') || id.includes('user') || id.includes('admin')) return 'user';
    if (id.includes('virtual') || id.startsWith('v-')) return 'virtual';
    return 'asset';
};

const normalizeSeverity = (edge = {}) => {
    const rawSeverity = normalizeText(edge.severity || edge.risk || edge.level).toLowerCase();
    if (rawSeverity === 'critical' || rawSeverity === 'high') return 'high';
    if (rawSeverity === 'medium' || rawSeverity === 'moderate') return 'medium';
    if (rawSeverity === 'low') return 'low';

    const relation = normalizeText(edge.relation || edge.label || edge.type || edge.event_type).toUpperCase();
    if (HIGH_RISK_KEYWORDS.some((keyword) => relation.includes(keyword))) return 'high';
    if (MEDIUM_RISK_KEYWORDS.some((keyword) => relation.includes(keyword))) return 'medium';
    return 'low';
};

const isSameEntity = (entity, node) => {
    const nodeId = normalizeText(node?.id).toLowerCase();
    const nodeLabel = normalizeText(node?.label).toLowerCase();

    if (typeof entity === 'string') {
        const probe = normalizeText(entity).toLowerCase();
        return probe && (probe === nodeId || probe === nodeLabel);
    }

    if (entity && typeof entity === 'object') {
        const id = normalizeText(entity.id).toLowerCase();
        const label = normalizeText(entity.label).toLowerCase();
        return (id && (id === nodeId || id === nodeLabel)) || (label && (label === nodeId || label === nodeLabel));
    }

    return false;
};

const buildNodeColumns = (nodes, { compact = false, mobile = false } = {}) => {
    const columnOrder = ['ip', 'user', 'asset', 'virtual'];
    const byType = new Map(columnOrder.map((type) => [type, []]));

    nodes.forEach((node) => {
        const type = byType.has(node.type) ? node.type : 'asset';
        byType.get(type).push(node);
    });

    const xSpacing = mobile ? 150 : compact ? 200 : 250;
    const ySpacing = mobile ? 90 : compact ? 108 : 125;
    const baseX = mobile ? 25 : compact ? 45 : 80;
    const baseY = mobile ? 30 : 55;

    return columnOrder.flatMap((type, colIdx) => {
        const column = byType.get(type) || [];
        const targetRows = mobile ? 6 : 5;
        const offsetY = Math.max(0, (targetRows - column.length)) * (mobile ? 18 : 24);
        return column.map((node, rowIdx) => ({
            ...node,
            position: node.position || {
                x: baseX + colIdx * xSpacing,
                y: baseY + offsetY + rowIdx * ySpacing
            }
        }));
    });
};

const getNodeRiskLevel = (nodeId, edgeByNode) => {
    const scores = edgeByNode.get(nodeId) || [];
    if (scores.includes('high')) return 'high';
    if (scores.includes('medium')) return 'medium';
    return 'low';
};

const RISK_STYLES = {
    high: { stroke: '#B91C1C', marker: '#B91C1C', width: 3, animated: true },
    medium: { stroke: '#D97706', marker: '#D97706', width: 2.4, animated: true },
    low: { stroke: '#00AEEF', marker: '#00AEEF', width: 1.8, animated: false }
};

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
    } else if (data.type === 'virtual') {
        Icon = ShieldAlert;
        colorClass = 'text-amber-300';
        bgClass = 'bg-amber-900/20 border-amber-500/40';
    }

    // Highlighting Logic
    const isHighlighted = data.isHighlighted;

    const riskLabel = normalizeText(data.riskLevel || 'low').toUpperCase();
    const riskTone = data.riskLevel === 'high'
        ? 'text-[#FCA5A5]'
        : data.riskLevel === 'medium'
            ? 'text-amber-300'
            : 'text-emerald-300';

    const isCompact = Boolean(data?.compact);
    const isMobile = Boolean(data?.mobile);
    const iconSize = isMobile ? 14 : isCompact ? 17 : 20;

    return (
        <div className={clsx(
            "group rounded-xl border-2 transition-all duration-300 relative",
            isMobile
                ? 'px-2 py-2 min-w-[112px] max-w-[132px]'
                : isCompact
                    ? 'px-3 py-2.5 min-w-[128px] max-w-[152px]'
                    : 'px-4 py-3 min-w-[150px] max-w-[176px]',
            bgClass,
            isHighlighted ? "!border-[#B91C1C] !bg-[rgba(185,28,28,0.3)] shadow-[0_0_25px_rgba(185,28,28,0.4)] scale-105 z-50" : "hover:border-white/20"
        )}>
            {isHighlighted && (
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#B91C1C] animate-ping" />
            )}

            <Handle type="target" position={Position.Top} className={clsx('!bg-slate-500', isMobile ? '!w-2 !h-2' : '!w-3 !h-3')} />

            <div className="flex flex-col items-center gap-1 max-w-full">
                <Icon size={iconSize} className={clsx(colorClass, isHighlighted && "text-[#B91C1C]")} />
                <span
                    title={data.label}
                    className={clsx(
                        'font-bold text-white max-w-full truncate',
                        isMobile ? 'text-[10px]' : 'text-xs',
                        isHighlighted ? 'text-red-100' : ''
                    )}
                >
                    {data.label}
                </span>
                <span className={clsx('uppercase opacity-70 tracking-wider', isMobile ? 'text-[9px]' : 'text-[10px]')}>
                    {data.type || 'Entity'}
                </span>
                <span className={clsx(isMobile ? 'text-[9px] font-semibold tracking-wide' : 'text-[10px] font-semibold tracking-wider', riskTone)}>
                    RISK {riskLabel}
                </span>
            </div>

            {/* Tooltip */}
            <div className={clsx(
                'absolute left-1/2 -translate-x-1/2 bg-slate-900 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none',
                isMobile ? '-top-10 text-[9px]' : '-top-12 text-[10px]'
            )}>
                In: {data.inbound || 0} | Out: {data.outbound || 0}
            </div>

            <Handle type="source" position={Position.Bottom} className={clsx('!bg-slate-500', isMobile ? '!w-2 !h-2' : '!w-3 !h-3')} />
        </div>
    );
};

const nodeTypes = {
    default: EntityNode,
    user: EntityNode,
    asset: EntityNode,
    ip: EntityNode,
    virtual: EntityNode
};

const AttackGraph = ({ data, highlightEntity, onNodeClick }) => {
    const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const isMobile = viewportWidth < 640;
    const isCompact = viewportWidth < 1024;

    // Transform graph data for React Flow
    const { flowNodes, flowEdges, stats } = useMemo(() => {
        if (!data) return { flowNodes: [], flowEdges: [], stats: { high: 0, medium: 0, low: 0 } };

        const sourceNodes = Array.isArray(data.graphNodes)
            ? data.graphNodes
            : Array.isArray(data.nodes)
                ? data.nodes
                : [];

        const sourceEdges = Array.isArray(data.graphEdges)
            ? data.graphEdges
            : Array.isArray(data.edges)
                ? data.edges
                : [];

        if (sourceNodes.length === 0) {
            return { flowNodes: [], flowEdges: [], stats: { high: 0, medium: 0, low: 0 } };
        }

        const normalizedNodes = sourceNodes.map((rawNode, index) => {
            const isObjectNode = rawNode && typeof rawNode === 'object';
            const nodeId = normalizeText(isObjectNode ? (rawNode.id || rawNode.label || `node-${index}`) : rawNode);
            const nodeLabel = normalizeText(isObjectNode ? (rawNode.label || rawNode.id || `Entity ${index + 1}`) : rawNode);
            const type = inferNodeType(nodeId, isObjectNode ? rawNode.type : undefined);

            return {
                id: nodeId,
                label: nodeLabel,
                type,
                compromised: Boolean(isObjectNode && rawNode.compromised),
                suspected: Boolean(isObjectNode && rawNode.suspected),
                inbound: 0,
                outbound: 0,
                position: isObjectNode && rawNode.position && typeof rawNode.position === 'object'
                    ? rawNode.position
                    : null
            };
        });

        const nodeMap = new Map(normalizedNodes.map((node) => [node.id, node]));

        const edgeByNode = new Map();
        const stats = { high: 0, medium: 0, low: 0 };

        const flowEdges = sourceEdges
            .map((rawEdge, index) => {
                const source = normalizeText(rawEdge?.source || rawEdge?.from);
                const target = normalizeText(rawEdge?.target || rawEdge?.to);
                if (!source || !target || !nodeMap.has(source) || !nodeMap.has(target)) {
                    return null;
                }

                const severity = normalizeSeverity(rawEdge);
                stats[severity] += 1;

                if (!edgeByNode.has(source)) edgeByNode.set(source, []);
                if (!edgeByNode.has(target)) edgeByNode.set(target, []);
                edgeByNode.get(source).push(severity);
                edgeByNode.get(target).push(severity);

                nodeMap.get(source).outbound += 1;
                nodeMap.get(target).inbound += 1;

                const relation = normalizeText(rawEdge?.relation || rawEdge?.label || rawEdge?.event_type || rawEdge?.type);
                const style = RISK_STYLES[severity];
                const isDashed = Boolean(rawEdge?.dashed) || normalizeText(rawEdge?.style?.strokeDasharray) !== '';

                return {
                    id: normalizeText(rawEdge?.id || `edge-${index}`),
                    source,
                    target,
                    label: relation,
                    animated: style.animated,
                    type: rawEdge?.type || 'smoothstep',
                    labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 700 },
                    labelBgPadding: [8, 4],
                    labelBgBorderRadius: 4,
                    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.82 },
                    style: {
                        stroke: style.stroke,
                        strokeWidth: style.width,
                        strokeDasharray: isDashed ? '6 4' : undefined,
                        opacity: 0.95,
                        filter: severity === 'high' ? 'drop-shadow(0 0 4px rgba(185, 28, 28, 0.45))' : 'none'
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: style.marker,
                    },
                };
            })
            .filter(Boolean);

        const positionedNodes = buildNodeColumns(normalizedNodes, { compact: isCompact, mobile: isMobile }).map((node) => ({
            id: node.id,
            type: node.type,
            position: {
                x: Number(node.position?.x) || 0,
                y: Number(node.position?.y) || 0
            },
            data: {
                id: node.id,
                label: node.label,
                type: node.type,
                compromised: node.compromised,
                suspected: node.suspected,
                isHighlighted: isSameEntity(highlightEntity, node),
                riskLevel: getNodeRiskLevel(node.id, edgeByNode),
                inbound: node.inbound,
                outbound: node.outbound,
                compact: isCompact,
                mobile: isMobile
            }
        }));

        return { flowNodes: positionedNodes, flowEdges, stats };
    }, [data, highlightEntity, isCompact, isMobile]);

    const hasGraph = flowNodes.length > 0;

    return (
        <div className="w-full h-full relative group">
            {!hasGraph && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <div className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-900/85 text-xs text-slate-300 tracking-wide">
                        No attack-path entities available for this incident yet.
                    </div>
                </div>
            )}

            <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => onNodeClick && onNodeClick(node.data)}
                fitView
                fitViewOptions={{
                    padding: isMobile ? 0.34 : isCompact ? 0.24 : 0.16,
                    minZoom: isMobile ? 0.5 : 0.35,
                    maxZoom: isMobile ? 1.6 : 2.5
                }}
                attributionPosition="bottom-right"
                minZoom={isMobile ? 0.45 : 0.25}
                maxZoom={4}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#1e293b" gap={25} size={1} />
                {!isMobile && (
                    <Controls
                        showInteractive={false}
                        className="bg-slate-900 border-slate-700 !fill-white !left-4 !bottom-4 !top-auto !right-auto shadow-2xl"
                    />
                )}
            </ReactFlow>

            {/* Visual Guide Overlay */}
            <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-auto z-10 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-wrap gap-2 sm:gap-4 text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40 p-2 rounded backdrop-blur-sm border border-slate-700/50">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Actors</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500" /> Assets</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Origins</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> Attack Steps</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 sm:gap-3 text-[9px] sm:text-[10px] uppercase tracking-wider bg-slate-900/40 p-2 rounded backdrop-blur-sm border border-slate-700/50 text-slate-300">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#B91C1C]" /> High: {stats.high}</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Medium: {stats.medium}</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#00AEEF]" /> Low: {stats.low}</span>
                </div>
            </div>
        </div>
    );
};

export default AttackGraph;
