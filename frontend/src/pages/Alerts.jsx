import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, 
    Search, 
    Filter, 
    LayoutGrid, 
    List as ListIcon, 
    ArrowUpRight,
    ShieldAlert,
    RefreshCcw
} from 'lucide-react';
import clsx from 'clsx';
import { fetchAlerts } from '../services/alertsService';
import AlertFilters from '../components/alerts/AlertFilters';
import AlertsTable from '../components/alerts/AlertsTable';
import AlertCard from '../components/alerts/AlertCard';
import AlertDetailsDrawer from '../components/alerts/AlertDetailsDrawer';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        severity: 'all',
        source: 'all',
        status: 'all',
        timeRange: '24h'
    });
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        const loadAlerts = async () => {
            setLoading(true);
            try {
                const data = await fetchAlerts();
                setAlerts(data);
            } catch (error) {
                console.error("Failed to fetch alerts:", error);
            } finally {
                setLoading(false);
            }
        };
        loadAlerts();
    }, []);

    const filteredAlerts = useMemo(() => {
        return alerts.filter(alert => {
            const matchesSearch = 
                alert.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                alert.entity.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesSeverity = filters.severity === 'all' || alert.severity === filters.severity;
            const matchesSource = filters.source === 'all' || alert.source === filters.source;
            const matchesStatus = filters.status === 'all' || alert.status === filters.status;

            return matchesSearch && matchesSeverity && matchesSource && matchesStatus;
        });
    }, [alerts, searchTerm, filters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleViewDetails = (alert) => {
        setSelectedAlert(alert);
        setIsDrawerOpen(true);
    };

    const handleEscalate = (alert) => {
        console.log("Escalating alert to incident:", alert.id);
        // Logic to convert to incident would go here
        setIsDrawerOpen(false);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <Bell className="text-blue-400" size={24} />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white underline decoration-blue-500/30 underline-offset-8">
                            Alerts
                        </h1>
                    </div>
                    <p className="text-slate-400 font-medium max-w-xl">
                        Normalized security alerts across your infrastructure. Review, triage, and escalate detections to managed incidents.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/50 shadow-inner">
                    <button 
                        onClick={() => setViewMode('table')}
                        className={clsx(
                            "p-2 rounded-xl transition-all duration-300",
                            viewMode === 'table' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <ListIcon size={20} />
                    </button>
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            "p-2 rounded-xl transition-all duration-300",
                            viewMode === 'grid' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <LayoutGrid size={20} />
                    </button>
                </div>
            </header>

            {/* Controls & Filters */}
            <AlertFilters 
                onSearch={setSearchTerm}
                onFilterChange={handleFilterChange}
                filters={filters}
            />

            {/* Main Content Area */}
            <main className="relative min-h-[400px]">
                {loading ? (
                    <div className="space-y-6">
                        <div className="h-12 bg-slate-800/50 rounded-xl animate-pulse w-1/4" />
                        <div className="h-64 bg-slate-800/20 rounded-2xl animate-pulse" />
                    </div>
                ) : filteredAlerts.length > 0 ? (
                    viewMode === 'table' ? (
                        <AlertsTable 
                            alerts={filteredAlerts} 
                            onViewDetails={handleViewDetails}
                            loading={false}
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredAlerts.map(alert => (
                                <AlertCard 
                                    key={alert.id}
                                    alert={alert}
                                    onClick={handleViewDetails}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 glass-panel rounded-3xl border-dashed border-2 border-slate-700/30">
                        <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 text-slate-600">
                            <ShieldAlert size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-300 mb-2">No alerts found</h3>
                        <p className="text-slate-500 text-center max-w-xs">
                            Adjust your filters or search terms to find what you're looking for.
                        </p>
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                setFilters({ severity: 'all', source: 'all', status: 'all', timeRange: '24h' });
                            }}
                            className="mt-6 flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold transition-colors"
                        >
                            <RefreshCcw size={16} />
                            Clear all filters
                        </button>
                    </div>
                )}
            </main>

            {/* Footer Stats */}
            {!loading && filteredAlerts.length > 0 && (
                <footer className="mt-8 flex items-center justify-between px-2 text-xs text-slate-500 font-bold tracking-widest uppercase">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {filteredAlerts.length} Total Alerts</span>
                        <span className="hidden sm:inline-block text-slate-700">|</span>
                        <span className="hidden sm:inline-block">Last sync: Just now</span>
                    </div>
                    <div className="flex items-center gap-1 hover:text-blue-400 cursor-pointer transition-colors group">
                        API Connectivity: <span className="text-emerald-500">Ready</span> <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                </footer>
            )}

            {/* Details Drawer */}
            {selectedAlert && (
                <AlertDetailsDrawer 
                    alert={selectedAlert}
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    onEscalate={handleEscalate}
                />
            )}
        </div>
    );
};

export default Alerts;
