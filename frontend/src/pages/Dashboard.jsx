import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    AlertTriangle, ShieldAlert, Clock, Activity, 
    ArrowUp, ChevronRight, ExternalLink, Loader2, ArrowRight, Play
} from 'lucide-react';
import { usePipeline } from '../context/PipelineContext';
import { 
    BarChart, Bar, Cell, PieChart, Pie, XAxis, Tooltip, ResponsiveContainer, LabelList 
} from 'recharts';
import StatCard from '../components/ui/StatCard';

// ─── MOCK DATA ──────────────────────────────────────────────
const mockIncidents = [
    { id: 'INC-2091', type: 'Privilege Escalation', entity: 'emp_104', score: 0.87, severity: 'HIGH', status: 'Investigating', time: '2 min ago' },
    { id: 'INC-2090', type: 'Lateral Movement', entity: 'auth-server', score: 0.65, severity: 'HIGH', status: 'Investigating', time: '5 min ago' },
    { id: 'INC-2089', type: 'Data Exfiltration', entity: 'db_admin', score: 0.92, severity: 'HIGH', status: 'Investigating', time: '12 min ago' },
    { id: 'INC-2088', type: 'Brute Force Attempt', entity: 'vpn_gateway', score: 0.45, severity: 'MEDIUM', status: 'Contained', time: '1 hr ago' },
    { id: 'INC-2087', type: 'Anomalous Login', entity: 'emp_221', score: 0.38, severity: 'LOW', status: 'Contained', time: '3 hrs ago' },
    { id: 'INC-2086', type: 'Excessive File Access', entity: 'file_server_01', score: 0.55, severity: 'HIGH', status: 'Investigating', time: '4 hrs ago' },
    { id: 'INC-2085', type: 'Malware Detected', entity: 'user_laptop_88', score: 0.98, severity: 'HIGH', status: 'Escalated', time: '5 hrs ago' },
    { id: 'INC-2084', type: 'Suspicious Execution', entity: 'web_server_prod', score: 0.41, severity: 'MEDIUM', status: 'Contained', time: '6 hrs ago' },
];

const mockSeverityData = [
    { name: 'High', value: 23, color: '#B91C1C' },
    { name: 'Medium', value: 18, color: '#CA8A04' },
    { name: 'Low', value: 6, color: '#00AEEF' }
];

const mockCategoryData = [
    { name: 'Privilege Escalation', value: 28, color: '#00395D' },
    { name: 'Lateral Movement', value: 22, color: '#0067A5' },
    { name: 'Data Exfiltration', value: 19, color: '#00AEEF' },
    { name: 'Brute Force', value: 16, color: '#3ABEF9' },
    { name: 'Anomaly', value: 15, color: '#7DD3FC' }
];

// Helper components
const SeverityBadge = ({ severity }) => {
    const colors = {
        HIGH: { bg: 'rgba(185,28,28,0.12)', text: '#B91C1C', border: 'rgba(185,28,28,0.2)' },
        MEDIUM: { bg: 'rgba(234,179,8,0.12)', text: '#CA8A04', border: 'rgba(234,179,8,0.2)' },
        LOW: { bg: 'rgba(0,174,239,0.12)', text: '#00AEEF', border: 'rgba(0,174,239,0.2)' }
    };
    const style = colors[severity] || colors.LOW;
    return (
        <span className="px-2 py-0.5 rounded font-semibold text-xs border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
            {severity === 'HIGH' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW'}
        </span>
    );
};

const FidelityBadge = ({ score }) => {
    const isCritical = score >= 0.85;
    return (
        <span className={`font-mono text-xs ${isCritical ? 'text-[#B91C1C] font-semibold' : ''}`} style={{ color: isCritical ? '#B91C1C' : 'var(--text-secondary)' }}>
            {score.toFixed(2)}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const colors = {
        Investigating: 'bg-gray-100 text-gray-600',
        Contained: 'bg-green-100 text-green-700 border-green-200',
        Escalated: 'bg-[rgba(185,28,28,0.1)] text-[#B91C1C] border-[rgba(185,28,28,0.2)]'
    };
    const finalClasses = colors[status].includes('border-') 
        ? `border ${colors[status]}` 
        : colors[status];
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${finalClasses}`}>
            {status}
        </span>
    );
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

const polarToCartesian = (cx, cy, r, angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { isRunning, lastRun, runPipeline } = usePipeline();

    return (
        <div className="space-y-6">
            {/* Stat Cards - Moved to Top */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Incidents" 
                    value="47" 
                    icon={AlertTriangle}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle={
                        <span className="flex items-center font-medium" style={{ color: 'var(--text-muted)' }}>
                            <ArrowUp size={14} className="mr-1" /> +12 from yesterday
                        </span>
                    }
                />
                <StatCard 
                    title="High Alerts" 
                    value="23" 
                    icon={ShieldAlert}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle="Requires immediate action"
                    valueColor="#B91C1C"
                />
                <StatCard 
                    title="Avg Detection Time" 
                    value="2.4 min" 
                    icon={Clock}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    subtitle="68% faster than baseline"
                />
                <StatCard 
                    title="Pipeline Status" 
                    value="Stable" 
                    icon={Activity}
                    iconStyle={{
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,57,93,0.08)',
                        color: '#00395D'
                    }}
                    badge={
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-100">
                            Operational
                        </span>
                    }
                />
            </div>

            {/* Pipeline Control - Refactored Hero Card */}
            <div 
                className="transition-all duration-300"
                style={{ 
                    background: 'var(--surface-color)',
                    backdropFilter: 'blur(25px)',
                    WebkitBackdropFilter: 'blur(25px)',
                    border: '2.2px solid var(--glass-border)',
                    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                {/* Left side: Content */}
                <div className="flex-1 flex flex-col">
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '16.5px', fontWeight: '600' }}>
                        Pipeline Control
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                        Run the full AI detection and response pipeline
                    </p>

                    <div className="mt-3 mr-8 lg:mr-16">
                        <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
                            <div 
                                className="h-full transition-all duration-700 ease-out bg-[#00AEEF]" 
                                style={{ 
                                    width: isRunning ? '65%' : '100%',
                                    boxShadow: isRunning ? '0 0 12px rgba(0,174,239,0.5)' : 'none'
                                }} 
                            />
                            {isRunning && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
                            )}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
                            {isRunning ? 'Processing Stage 3/4 · Running...' : `100% Stage Completed · Last run: ${lastRun ? lastRun.toLocaleTimeString() : '2 mins ago'}`}
                        </p>
                    </div>
                </div>

                {/* Right side: Hero Button */}
                <button 
                    onClick={runPipeline}
                    disabled={isRunning}
                    className={`shimmer-btn ${isRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{
                        background: isRunning ? 'rgba(0,174,239,0.3)' : '#00AEEF',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '14px',
                        padding: '12px 32px',
                        borderRadius: '8px',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: isRunning ? 'none' : '0 0 20px rgba(0,174,239,0.35), 0 4px 12px rgba(0,174,239,0.2)',
                        transition: 'all 0.3s ease',
                    }}
                >
                    {isRunning ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play size={16} fill="currentColor" />
                            Run Pipeline
                        </>
                    )}
                </button>
            </div>



            {/* ROW 2 — Two columns */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* LEFT: Live Incident Feed */}
                <div className="xl:col-span-2 rounded-xl shadow-sm border flex flex-col h-[400px]" 
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--glass-border)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Live Incident Feed
                        </h3>
                        <span className="bg-[#B91C1C] text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Live
                        </span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                        <div className="space-y-[2px]">
                            {mockIncidents.map((inc) => (
                                <div 
                                    key={inc.id}
                                    onClick={() => navigate(`/incidents/${inc.id}`)}
                                    className="p-3 hover:bg-white/10 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-between group border border-transparent border-b-white/5 relative z-0 hover:z-10 hover:scale-[1.02] hover:border-white/100 hover:shadow-[0_5px_15px_rgba(255,255,255,0.15)]"
                                    style={{ background: 'transparent' }}
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-20 shrink-0">
                                            <SeverityBadge severity={inc.severity} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm group-hover:text-[#00AEEF] transition-colors" style={{ color: 'var(--text-primary)' }}>
                                                {inc.type}
                                            </p>
                                            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                                                {inc.entity}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 text-right relative z-10">
                                        <FidelityBadge score={inc.score} />
                                        <div className="flex items-center gap-2 text-xs font-medium min-w-[70px] justify-end" style={{ color: 'var(--text-muted)' }}>
                                            {inc.time}
                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Threat Fidelity Score Gauge */}
                <div className="xl:col-span-1 rounded-xl shadow-sm border p-6 flex flex-col items-center" 
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <h3 className="font-semibold self-start mb-4" style={{ color: 'var(--text-primary)' }}>Highest Thread Fidelity Score</h3>
                    
                    {/* SVG Gauge */}
                    <div className="relative w-full max-w-[200px] mb-4 mt-2 flex justify-center">
                        <svg viewBox="0 0 200 120" className="w-full h-auto overflow-visible">
                            <path 
                                d={describeArc(100, 100, 80, -90, 90)}
                                fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round" 
                            />
                            <path 
                                d={describeArc(100, 100, 80, -90, -90 + (180 * 0.87))}
                                fill="none" stroke="#00AEEF" strokeWidth="14" strokeLinecap="round" 
                                className="gauge-arc"
                            />
                            <text x="100" y="95" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--text-primary)">0.87</text>
                            <text x="100" y="112" textAnchor="middle" fontSize="11" fill="var(--text-muted)">Fidelity Score</text>
                        </svg>
                    </div>
                    
                    <div className="text-center mb-6 mt-2">
                        <span className="text-[10px] font-bold text-[#B91C1C] bg-[rgba(185,28,28,0.1)] border border-[rgba(185,28,28,0.2)] px-3 py-1 rounded-full">
                            High Confidence Threat
                        </span>
                    </div>

                    <div className="w-full space-y-4 mt-auto">
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Behavioral Deviation</span>
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>0.91</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#00395D] rounded-full" style={{ width: '91%' }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Asset Criticality</span>
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>0.85</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#0067A5] rounded-full" style={{ width: '85%' }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Historical Similarity</span>
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>0.79</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                <div className="h-full bg-[#00AEEF] rounded-full" style={{ width: '79%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3 — Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="rounded-xl shadow-sm border p-6" 
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Incident Severity Distribution</h3>
                        <span className="text-[11px] font-medium border px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>Last 24 hours</span>
                    </div>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockSeverityData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barCategoryGap="7.5%" barGap={2}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                    contentStyle={{ 
                                        borderRadius: '8px', 
                                        border: '1px solid var(--glass-border)', 
                                        backgroundColor: '#FFFFFF',
                                        color: '#0F172A', 
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        fontWeight: '700',
                                        opacity: 1
                                    }} 
                                    itemStyle={{ color: '#0F172A' }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    barSize={72} 
                                    radius={[6, 6, 0, 0]}
                                    isAnimationActive={true}
                                    animationDuration={500}
                                    animationBegin={0}
                                    animationEasing="ease-out"
                                >
                                    <LabelList dataKey="value" position="top" style={{ fontSize: '12px', fill: 'var(--text-muted)', fontWeight: 600 }} />
                                    {mockSeverityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart */}
                <div className="rounded-xl shadow-sm border p-6" 
                    style={{ 
                        background: 'var(--surface-color)', 
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: 'var(--glass-border)' 
                    }}
                >
                    <div className="flex justify-between items-center mb-0">
                        <h3 className="font-semibold text-gray-800" style={{ color: 'var(--text-primary)' }}>Attack Category Breakdown</h3>
                        <span className="text-[11px] font-medium border px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}>Last 24 hours</span>
                    </div>
                    <div className="h-64 flex flex-col relative">
                        <div style={{ position: 'relative', height: '80%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={mockCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {mockCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        wrapperStyle={{ zIndex: 100 }}
                                        contentStyle={{ 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--border-subtle)', 
                                            backgroundColor: '#FFFFFF', 
                                            color: '#0F172A', 
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            fontWeight: '700',
                                            opacity: 1
                                        }} 
                                        itemStyle={{ color: '#0F172A' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%', 
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                zIndex: 5
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>47</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total</div>
                            </div>
                        </div>
                        {/* Custom Legend */}
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                            {mockCategoryData.map((cat, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] tracking-wide font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }} />
                                    {cat.name} ({cat.value}%)
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 4 — Recent Incidents Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden" 
                style={{ 
                    background: 'var(--surface-color)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Incidents</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-sm font-semibold border-b" style={{ background: 'var(--glass-border)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            <tr>
                                <th className="px-6 py-4">Incident ID</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Affected Entity</th>
                                <th className="px-6 py-4">Fidelity Score</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Detected</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            {mockIncidents.slice(0, 5).map((inc) => (
                                <tr key={inc.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[#00AEEF] font-mono font-semibold">
                                            {inc.id}
                                            <ExternalLink size={14} className="opacity-70" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{inc.type}</td>
                                    <td className="px-6 py-4 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{inc.entity}</td>
                                    <td className="px-6 py-4"><FidelityBadge score={inc.score} /></td>
                                    <td className="px-6 py-4"><StatusBadge status={inc.status} /></td>
                                    <td className="px-6 py-4 font-medium text-xs text-center" style={{ color: 'var(--text-muted)' }}>{inc.time}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => navigate(`/incidents/${inc.id}`)}
                                            className="text-[#00AEEF] text-sm font-medium hover:underline flex items-center justify-end gap-1 ml-auto border-none bg-transparent"
                                        >
                                            View Details
                                            <ArrowRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ROW 5 — System Health Strip */}
            <div>
                <h3 className="font-semibold mb-4 px-1" style={{ color: 'var(--text-secondary)' }}>System Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* AI Engine */}
                    <div className="rounded-xl shadow-sm border p-5 flex flex-col justify-center" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h4 className="text-xs font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>AI Engine Status</h4>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>cryptix-finetuned-7b</span>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                <Loader2 size={12} className="animate-spin text-green-500" />
                                Operational
                            </div>
                        </div>
                        <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            <span>Uptime: 3h 22m</span>
                            <span>Latency: 24ms</span>
                        </div>
                    </div>

                    {/* Network Nodes */}
                    <div className="rounded-xl shadow-sm border p-5 flex flex-col justify-center" 
                        style={{ 
                            background: 'var(--surface-color)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: 'var(--glass-border)' 
                        }}
                    >
                        <h4 className="text-xs font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>Network Nodes</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_4px_#22c55e]" />
                                    <span className="font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>core-banking</span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Database</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_4px_#22c55e]" />
                                    <span className="font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>swift-terminal</span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Gateway</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );
};

export default Dashboard;
