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
import StatCard from '../components/StatCard';
import api from '../services/api';
import { usePipeline } from '../context/PipelineContext';
import LiveEventStream from '../components/LiveEventStream';

// New AI Observability Components
import AIPipeline from '../components/AIPipeline';
import AIReasoningPanel from '../components/AIReasoningPanel';
import LLMReasoningViewer from '../components/LLMReasoningViewer';
import AttackTimeline from '../components/AttackTimeline';
import RiskChart from '../components/RiskChart';
import MitreMapping from '../components/MitreMapping';
import PlaybookViewer from '../components/PlaybookViewer';
import AutomationPanel from '../components/AutomationPanel';

const Dashboard = () => {
    const navigate = useNavigate();
    const { isRunning, runPipeline } = usePipeline();
    const [stats, setStats] = useState({
        incidents: 0,
        activeThreats: 0,
        highRisk: 0,
        blockedIps: 0,
        playbooks: 0,
        aiDecisions: 0
    });

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

        } catch (error) {
            console.error("Dashboard data fetch failed", error);
        }
    };

    useEffect(() => {
        if (!isRunning) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchDashboardData();
        }
    }, [isRunning]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="heading-xl text-slate-100">AI SOC Intelligence Dashboard</h2>
                    <p className="text-slate-400 mt-1">Real-time reasoning, decision making, and automated response</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={runPipeline}
                        disabled={isRunning}
                        className={`btn-primary flex items-center gap-2 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isRunning ? <RefreshCw className="animate-spin" size={18} /> : <Activity size={18} />}
                        {isRunning ? 'Running Pipeline...' : 'Run Pipeline'}
                    </button>
                    <button
                        onClick={fetchDashboardData}
                        className="btn-primary flex items-center gap-2"
                    >
                        <RefreshCw size={18} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Live Event Stream */}
            <LiveEventStream />

            {/* SOC Overview */}
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

            {/* 1. AI SOC Pipeline Visualization */}
            <div className="w-full">
                <AIPipeline />
            </div>

            {/* 2 & 3. Multi-Agent Reasoning Panel & LLM Reasoning Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <AIReasoningPanel />
                </div>
                <div className="lg:col-span-1">
                    <LLMReasoningViewer />
                </div>
            </div>

            {/* 4, 5 & 6. Attack Timeline, Risk Chart & MITRE Mapping */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <AttackTimeline />
                </div>
                <div className="lg:col-span-1">
                    <RiskChart />
                </div>
                <div className="lg:col-span-1">
                    <MitreMapping />
                </div>
            </div>

            {/* 7 & 8. Playbook Panel & Automation Execution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PlaybookViewer />
                </div>
                <div className="lg:col-span-1">
                    <AutomationPanel />
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
