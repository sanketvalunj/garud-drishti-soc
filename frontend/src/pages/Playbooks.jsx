import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import {
    FileJson,
    Search,
    Clock,
    Zap,
    BookOpen,
    RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import PlaybookViewer from '../components/incidents/PlaybookViewer';

const Playbooks = () => {
    const location = useLocation();
    const [playbooks, setPlaybooks] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [automation, setAutomation] = useState([]);
    const [selectedPlaybook, setSelectedPlaybook] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        fetchData();

        // Poll every 10 seconds for real-time updates
        const interval = setInterval(() => {
            fetchData(true); // silent refresh
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [pbData, incData, autoData] = await Promise.all([
                api.getPlaybooks().catch(() => ({ playbooks: [] })),
                api.getIncidents().catch(() => ({ incidents: [] })),
                api.getAutomation().catch(() => [])
            ]);

            console.log('Playbooks:', pbData);
            console.log('Automation:', autoData);

            const fetchedPlaybooks = pbData.playbooks || [];
            const fetchedIncidents = incData.incidents || [];
            const fetchedAutomation = Array.isArray(autoData) ? autoData : (autoData?.reports || []);

            console.log('Mapped response:', { fetchedPlaybooks, fetchedIncidents, fetchedAutomation });

            setPlaybooks(fetchedPlaybooks);
            setIncidents(fetchedIncidents);
            setAutomation(fetchedAutomation);
            setLastUpdated(new Date());

            if (fetchedPlaybooks.length > 0) {
                const filterValue = location.state?.filter;
                let initial = filterValue
                    ? fetchedPlaybooks.filter(pb => {
                        const matchingInc = fetchedIncidents.find(i => i.incident_id === pb.incident_id);
                        if (!matchingInc) return false;
                        const score = matchingInc.risk_score || 0;
                        if (filterValue === 'Critical') return score > 0.9;
                        if (filterValue === 'High') return score > 0.7 && score <= 0.9;
                        if (filterValue === 'Medium') return score > 0.4 && score <= 0.7;
                        return score <= 0.4;
                    })
                    : fetchedPlaybooks;

                if (initial.length === 0) initial = fetchedPlaybooks;

                // Only auto-select first on initial load
                setSelectedPlaybook(prev => {
                    if (prev) return prev; // keep existing selection on silent refresh
                    return initial[0];
                });
                setSelectedIncident(prev => {
                    if (prev) return prev;
                    return fetchedIncidents.find(i => i.incident_id === initial[0]?.incident_id) || null;
                });
            }
        } catch (e) {
            console.error('Failed to fetch playbooks', e);
            setError('Could not load playbooks. Backend may be offline.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleSelectPlaybook = (pb) => {
        setSelectedPlaybook(pb);
        const matchingInc = incidents.find(i => i.incident_id === pb.incident_id);
        setSelectedIncident(matchingInc || null);
    };

    const filteredPlaybooks = playbooks.filter(pb =>
        pb.incident_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pb.playbook?.threat_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pb.playbook?.summary?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getAutomationForPlaybook = (pb) =>
        automation.find(a => a.incident_id === pb.incident_id) || null;

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 overflow-hidden">

            {/* LEFT PANEL: LIST */}
            <div className="md:w-1/3 flex flex-col gap-4 h-full">

                {/* Header & Search */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h2 className="heading-lg text-white">Response Playbooks</h2>
                        <div className="flex items-center gap-2">
                            {lastUpdated && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                            <button
                                onClick={() => fetchData()}
                                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by ID or threat type..."
                            className="w-full bg-white/5 border rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-500/50"
                            style={{ borderColor: 'var(--glass-border)' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500">
                            <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-30" />
                            <p className="text-sm">Loading playbooks...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-amber-500/80">
                            <p className="text-sm">{error}</p>
                            <button onClick={() => fetchData()} className="mt-2 text-xs underline text-slate-400">Retry</button>
                        </div>
                    ) : filteredPlaybooks.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 px-3">
                            <FileJson size={32} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium text-slate-400">No response actions executed yet.</p>
                            <p className="text-xs mt-1 text-slate-500">Run pipeline or wait for incident detection.</p>
                        </div>
                    ) : (
                        filteredPlaybooks.map((pb, idx) => {
                            const matchInc = incidents.find(i => i.incident_id === pb.incident_id);
                            const autoReport = getAutomationForPlaybook(pb);
                            const executedCount = autoReport?.actions_executed?.length || 0;
                            const stepCount = pb.playbook?.steps?.length || pb.playbook?.response_steps?.length || 0;
                            const severity = pb.playbook?.severity || matchInc?.threat_type || pb.summary || 'unknown';

                            return (
                                <div
                                    key={pb.incident_id || idx}
                                    onClick={() => handleSelectPlaybook(pb)}
                                    className={clsx(
                                        "p-4 rounded-xl border transition-all cursor-pointer",
                                        selectedPlaybook?.incident_id === pb.incident_id
                                            ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                                            : "hover:bg-white/5"
                                    )}
                                    style={{ 
                                        background: selectedPlaybook?.incident_id === pb.incident_id ? '' : 'rgba(255,255,255,0.03)',
                                        borderColor: selectedPlaybook?.incident_id === pb.incident_id ? '' : 'var(--glass-border)',
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)'
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                {pb.incident_id?.substring(0, 8)}
                                            </span>
                                            {matchInc?.risk_score != null && (
                                                <span className="text-[10px] uppercase font-bold text-[#B91C1C] tracking-wider">
                                                    RISK: {Math.round(matchInc.risk_score * 100)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock size={12} /> {new Date(pb.generated_at || matchInc?.timestamp || Date.now()).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-white mb-1 capitalize">
                                        {severity.replace(/_/g, ' ')} Response
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Zap size={10} className="text-green-400" />
                                            {executedCount} executed
                                        </span>
                                        <span>{stepCount} steps</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: DETAIL */}
            <div className="flex-1 h-full overflow-hidden">
                {selectedPlaybook ? (
                    <PlaybookViewer
                        playbook={selectedPlaybook}
                        incident={selectedIncident}
                        automation={getAutomationForPlaybook(selectedPlaybook)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 glass-panel rounded-2xl">
                        <BookOpen size={64} className="mb-4 opacity-10" />
                        <p className="text-lg font-medium">Select a playbook</p>
                        <p className="text-sm text-slate-600 mt-1">Choose an incident response from the list</p>
                    </div>
                )}
            </div>

        </div>
    );
};

export default Playbooks;
