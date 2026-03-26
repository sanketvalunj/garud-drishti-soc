import React from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

const AlertFilters = ({ onSearch, onFilterChange, filters }) => {
    return (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                    type="text"
                    placeholder="Search alerts by ID, title or entity..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-wrap gap-3">
                {/* Severity Filter */}
                <div className="relative group">
                    <select
                        className="appearance-none pl-4 pr-10 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition-all"
                        value={filters.severity}
                        onChange={(e) => onFilterChange('severity', e.target.value)}
                    >
                        <option value="all">All Severities</option>
                        <option value="high">High Severity</option>
                        <option value="medium">Medium Severity</option>
                        <option value="low">Low Severity</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" size={14} />
                </div>

                {/* Source Filter */}
                <div className="relative group">
                    <select
                        className="appearance-none pl-4 pr-10 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition-all"
                        value={filters.source}
                        onChange={(e) => onFilterChange('source', e.target.value)}
                    >
                        <option value="all">All Sources</option>
                        <option value="SIEM">SIEM</option>
                        <option value="EDR">EDR</option>
                        <option value="UEBA">UEBA</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" size={14} />
                </div>

                {/* Status Filter */}
                <div className="relative group">
                    <select
                        className="appearance-none pl-4 pr-10 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition-all"
                        value={filters.status}
                        onChange={(e) => onFilterChange('status', e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="investigating">Investigating</option>
                        <option value="escalated">Escalated</option>
                        <option value="resolved">Resolved</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" size={14} />
                </div>

                {/* Time Range */}
                <div className="relative group">
                    <select
                        className="appearance-none pl-4 pr-10 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition-all"
                        value={filters.timeRange}
                        onChange={(e) => onFilterChange('timeRange', e.target.value)}
                    >
                        <option value="1h">Last 1h</option>
                        <option value="24h">Last 24h</option>
                        <option value="7d">Last 7d</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" size={14} />
                </div>
            </div>
        </div>
    );
};

export default AlertFilters;
