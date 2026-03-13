import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldAlert,
    Activity,
    Users,
    FileJson,
    BrainCircuit,
    Ban,
    RefreshCw
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import StatCard from '../components/StatCard';
import api from '../services/api';
import { usePipeline } from '../context/PipelineContext';
import LiveEventStream from '../components/LiveEventStream';
import MitreAttackOverlay from '../components/MitreAttackOverlay';

const Dashboard = () => {
    const navigate = useNavigate();
    const { isRunning } = usePipeline();
    const [stats, setStats] = useState({
        incidents: 0,
        activeThreats: 0,
        highRisk: 0,
        blockedIps: 0,
        playbooks: 0,
        aiDecisions: 0
    });

    const [incidentData, setIncidentData] = useState([]);
    const [riskDistribution, setRiskDistribution] = useState([]);

    useEffect(() => {
        if (!isRunning) {
            fetchDashboardData();
        }
    }, [isRunning]);

    const fetchDashboardData = async () => {
        try {
            const [resIncidents, resPlaybooks] = await Promise.all([
                api.getIncidents().catch(() => ({ incidents: [] })),
                api.getPlaybooks().catch(() => ({ playbooks: [] }))
            ]);

            const incidents = resIncidents.incidents || [];
            const playbooks = resPlaybooks.playbooks || [];

            // Calculate stats
            const totalIncidents = incidents.length;
            const highRiskCount = incidents.filter(i => (i.risk_score || 0) > 0.7).length;
            const activeThreats = incidents.length;

            setStats({
                incidents: totalIncidents,
                activeThreats: activeThreats,
                highRisk: highRiskCount,
                blockedIps: incidents.reduce((acc, curr) => acc + (curr.entities?.ips?.length || 0), 0),
                playbooks: playbooks.length,
                aiDecisions: playbooks.length
            });

            // Prepare chart data
            const severityCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
            incidents.forEach(i => {
                const score = i.risk_score || 0;
                if (score > 0.9) severityCounts.Critical++;
                else if (score > 0.7) severityCounts.High++;
                else if (score > 0.4) severityCounts.Medium++;
                else severityCounts.Low++;
            });

            setRiskDistribution([
                { name: 'Low', value: severityCounts.Low, color: '#3b82f6' },
                { name: 'Medium', value: severityCounts.Medium, color: '#f59e0b' },
                { name: 'High', value: severityCounts.High, color: '#f97316' },
                { name: 'Critical', value: severityCounts.Critical, color: '#ef4444' },
            ]);

            // Mock timeline for now if timestamp distribution is complex to calc on frontend
            setIncidentData([
                { time: '00:00', count: Math.floor(totalIncidents * 0.1) },
                { time: '04:00', count: Math.floor(totalIncidents * 0.05) },
                { time: '08:00', count: Math.floor(totalIncidents * 0.2) },
                { time: '12:00', count: Math.floor(totalIncidents * 0.4) },
                { time: '16:00', count: Math.floor(totalIncidents * 0.15) },
                { time: '20:00', count: Math.floor(totalIncidents * 0.1) },
            ]);

        } catch (error) {
            console.error("Dashboard data fetch failed", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="heading-xl text-slate-100">Security Overview</h2>
                    <p className="text-slate-400 mt-1">Real-time threat monitoring and AI response status</p>
                </div>
                <button
                    onClick={fetchDashboardData}
                    className="btn-primary flex items-center gap-2"
                >
                    <RefreshCw size={18} />
                    Refresh Data
                </button>
            </div>

            {/* Live Event Stream */}
            <LiveEventStream />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard
                    title="Total Incidents"
                    value={stats.incidents}
                    icon={ShieldAlert}
                    color="blue"
                    delay={0}
                    onClick={() => navigate('/incidents')}
                />
                <StatCard
                    title="Active Threats"
                    value={stats.activeThreats}
                    icon={Activity}
                    color="red"
                    trend="up"
                    trendValue="12%"
                    delay={1}
                    onClick={() => navigate('/incidents')}
                />
                <StatCard
                    title="High Risk"
                    value={stats.highRisk}
                    icon={ShieldAlert}
                    color="red"
                    delay={2}
                    onClick={() => navigate('/incidents')}
                />
                <StatCard
                    title="Blocked IPs"
                    value={stats.blockedIps}
                    icon={Ban}
                    color="amber"
                    delay={3}
                    onClick={() => navigate('/incidents')}
                />
                <StatCard
                    title="Playbooks"
                    value={stats.playbooks}
                    icon={FileJson}
                    color="green"
                    delay={4}
                    onClick={() => navigate('/playbooks')}
                />
                <StatCard
                    title="AI Decisions"
                    value={stats.aiDecisions}
                    icon={BrainCircuit}
                    color="violet"
                    delay={5}
                    onClick={() => navigate('/reasoning')}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Timeline Chart */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                    <h3 className="heading-lg text-white mb-6">Incident Timeline</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={incidentData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#94a3b8"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                    itemStyle={{ color: '#3b82f6' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Risk Distribution */}
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="heading-lg text-white mb-6">Risk Distribution</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskDistribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#94a3b8"
                                    tickLine={false}
                                    axisLine={false}
                                    width={60}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                    {riskDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-6 space-y-3">
                        {riskDistribution.map((item) => (
                            <div key={item.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-300">{item.name}</span>
                                </div>
                                <span className="font-mono font-medium text-white">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Risks & Suggested Responses */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 glass-panel p-6 rounded-2xl border border-blue-500/20 bg-blue-900/5">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="heading-lg text-white flex items-center gap-2">
                            <ShieldAlert size={20} className="text-red-400" />
                            Top Risks & Suggested Responses
                        </h3>
                        <button onClick={() => navigate('/playbooks')} className="text-sm text-blue-400 hover:underline">View all Playbooks</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {riskDistribution.map((risk, idx) => (
                            <div
                                key={idx}
                                onClick={() => navigate('/playbooks', { state: { filter: risk.name } })}
                                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-blue-500/50 cursor-pointer transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{risk.name} Severity</span>
                                    <span className="text-xl font-bold text-white">{risk.value}</span>
                                </div>
                                <div className="text-sm text-slate-300 group-hover:text-blue-400 transition-colors">
                                    {risk.name === 'Critical' ? "Immediate Containment Required" :
                                        risk.name === 'High' ? "Review Suggested Playbooks" :
                                            "Monitor Behavioral Patterns"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mini MITRE Overlay for recent high risk */}
            <div className="mt-6 pt-6 border-t border-slate-800">
                <MitreAttackOverlay
                    incident={incidentData.length > 0 ? {
                        story: "login failed powershell execution lateral movement",
                        summary: "Advanced Persistent Threat"
                    } : null}
                    mini={true}
                />
            </div>
        </div>
    );
};

export default Dashboard;
