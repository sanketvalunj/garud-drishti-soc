import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Filter,
    Download,
    ChevronDown,
    ShieldAlert,
    Clock,
    CheckCircle
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';

const mockIncidents = [
    { id: 'INC-2091', title: 'Privilege Escalation on DB Server', entity: 'db-prod-01', score: 0.92, severity: 'HIGH', status: 'Investigating', time: '2 mins ago', owner: 'Unassigned', source: 'EDR' },
    { id: 'INC-2090', title: 'Suspicious Powershell Execution', entity: 'user-laptop-88', score: 0.85, severity: 'HIGH', status: 'Open', time: '15 mins ago', owner: 'testuser', source: 'Sysmon' },
    { id: 'INC-2089', title: 'Multiple Failed Logins', entity: 'vpn-gateway', score: 0.45, severity: 'MEDIUM', status: 'Escalated', time: '1 hr ago', owner: 'SOC L1', source: 'Active Directory' },
    { id: 'INC-2088', title: 'Unusual Data Transfer', entity: 'sales-db', score: 0.78, severity: 'HIGH', status: 'Contained', time: '2 hrs ago', owner: 'testuser', source: 'Network Firewall' },
    { id: 'INC-2087', title: 'Malware Signature Detected', entity: 'dev-workstation-12', score: 0.98, severity: 'HIGH', status: 'Investigating', time: '3 hrs ago', owner: 'SOC L2', source: 'Antivirus' },
    { id: 'INC-2086', title: 'Anomalous User Agent', entity: 'web-front-02', score: 0.35, severity: 'LOW', status: 'Closed', time: '5 hrs ago', owner: 'System', source: 'WAF' },
    { id: 'INC-2085', title: 'Lateral Movement Attempt', entity: 'auth-server', score: 0.82, severity: 'HIGH', status: 'Contained', time: '1 day ago', owner: 'testuser', source: 'EDR' },
    { id: 'INC-2084', title: 'Ransomware Canary Triggered', entity: 'file-share-04', score: 0.99, severity: 'HIGH', status: 'Escalated', time: '1 day ago', owner: 'SOC Lead', source: 'FIM' },
    { id: 'INC-2083', title: 'Impossible Travel Alert', entity: 'emp_104', score: 0.65, severity: 'MEDIUM', status: 'Open', time: '1 day ago', owner: 'Unassigned', source: 'Identity' },
    { id: 'INC-2082', title: 'Cloud Configuration Change', entity: 'aws-s3-bucket', score: 0.55, severity: 'MEDIUM', status: 'Investigating', time: '2 days ago', owner: 'Cloud Sec', source: 'CloudTrail' },
    { id: 'INC-2081', title: 'Port Scan Detected', entity: 'dmz-ext-interface', score: 0.25, severity: 'LOW', status: 'Closed', time: '2 days ago', owner: 'System', source: 'IDS' },
    { id: 'INC-2080', title: 'Command & Control Traffic', entity: 'guest-wifi-vlan', score: 0.89, severity: 'HIGH', status: 'Investigating', time: '3 days ago', owner: 'SOC L2', source: 'NDR' },
];

const SeverityBadge = ({ severity }) => {
    const colors = {
        HIGH: { bg: 'rgba(185,28,28,0.12)', text: '#B91C1C', border: 'rgba(185,28,28,0.2)' },
        MEDIUM: { bg: 'rgba(234,179,8,0.12)', text: '#CA8A04', border: 'rgba(234,179,8,0.2)' },
        LOW: { bg: 'rgba(0,174,239,0.12)', text: '#00AEEF', border: 'rgba(0,174,239,0.2)' }
    };
    const style = colors[severity] || colors.LOW;
    return (
        <span className="px-2 py-0.5 rounded font-semibold text-[10px] border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
            {severity === 'HIGH' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW'}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const colors = {
        Open: 'bg-gray-100 text-gray-700',
        Investigating: 'bg-indigo-100 text-indigo-700',
        Escalated: 'bg-[rgba(185,28,28,0.1)] text-[#B91C1C]',
        Contained: 'bg-amber-100 text-amber-700',
        Closed: 'bg-green-100 text-green-700'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[status]}`}>
            {status}
        </span>
    );
};

const ScoreIndicator = ({ score }) => {
    let colorClass = 'text-green-600 bg-green-50';
    if (score > 0.8) return (
        <span className="px-2 py-1 rounded font-mono text-xs font-bold text-[#B91C1C] bg-[rgba(185,28,28,0.05)]">
            {score.toFixed(2)}
        </span>
    );
    else if (score > 0.5) colorClass = 'text-amber-600 bg-amber-50';
    
    return (
        <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${colorClass}`}>
            {score.toFixed(2)}
        </span>
    );
}

const Incidents = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredIncidents = mockIncidents.filter(inc => 
        inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.entity.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Incident Management</h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Review, investigate, and respond to security alerts</p>
                </div>
                
                {/* <button className="btn-primary flex items-center gap-2">
                    <Download size={18} />
                    Export Report
                </button> */}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                    title="Open Incidents" 
                    value="24" 
                    icon={ShieldAlert}
                    iconStyle={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(0,174,239,0.08)', color: '#00AEEF' }}
                />
                <StatCard 
                    title="High Severity" 
                    value="12" 
                    icon={AlertTriangle}
                    iconStyle={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(185,28,28,0.08)', color: '#B91C1C' }}
                    valueColor="#B91C1C"
                />
                <StatCard 
                    title="Investigations" 
                    value="8" 
                    icon={Clock}
                    iconStyle={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}
                />
                <StatCard 
                    title="Contained Today" 
                    value="15" 
                    icon={CheckCircle}
                    iconStyle={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(34,197,94,0.08)', color: '#22C55E' }}
                />
            </div>

            {/* Filter Bar */}
            <div className="p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 items-center justify-between" 
                style={{ 
                    background: 'var(--surface-color)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={18} />
                    <input
                        type="text"
                        placeholder="Search by ID, Title, or Entity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 transition-shadow transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button className="flex items-center justify-between gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-white/10 w-full md:w-auto transition-colors" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        Severity <ChevronDown size={14} />
                    </button>
                    <button className="flex items-center justify-between gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-white/10 w-full md:w-auto transition-colors" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        Status <ChevronDown size={14} />
                    </button>
                    <button className="flex items-center justify-between gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-white/10 w-full md:w-auto transition-colors" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        Time <ChevronDown size={14} />
                    </button>
                    <button className="p-2 border rounded-lg hover:bg-white/10 shrink-0 transition-colors" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Incident Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden" 
                style={{ 
                    background: 'var(--surface-color)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'var(--glass-border)' 
                }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-[13px] font-semibold border-b" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                            <tr>
                                <th className="px-6 py-4">Incident ID</th>
                                <th className="px-6 py-4">Severity</th>
                                <th className="px-6 py-4">Title & Entity</th>
                                <th className="px-6 py-4">Fidelity</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Owner</th>
                                <th className="px-6 py-4 text-right pr-6">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            {filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                                        <div className="flex flex-col items-center justify-center">
                                            <Search size={40} className="mb-4" style={{ color: 'var(--border-accent)' }} />
                                            <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No matching incidents found</p>
                                            <p className="text-sm">Try adjusting your search or filters to find what you're looking for.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredIncidents.map((inc) => (
                                    <tr 
                                        key={inc.id} 
                                        onClick={() => navigate(`/incidents/${inc.id}`)}
                                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-[#00AEEF]">
                                            {inc.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <SeverityBadge severity={inc.severity} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold group-hover:text-[#00AEEF] transition-colors" style={{ color: 'var(--text-primary)' }}>
                                                {inc.title}
                                            </p>
                                            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {inc.entity}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <ScoreIndicator score={inc.score} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={inc.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                {inc.owner !== 'Unassigned' && (
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                                        {inc.owner.substring(0,2).toUpperCase()}
                                                    </div>
                                                )}
                                                {inc.owner}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right pr-6">
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {inc.time}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {inc.source}
                                            </p>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination (Visual Only) */}
                <div className="px-6 py-4 border-t flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--glass-border)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Showing 1 to {filteredIncidents.length} of 24 entries
                    </span>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 border rounded text-sm cursor-not-allowed" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-muted)', opacity: 0.5 }}>
                            Previous
                        </button>
                        <button className="px-3 py-1 bg-[#00AEEF] text-white rounded text-sm font-medium">
                            1
                        </button>
                        <button className="px-3 py-1 border rounded text-sm hover:bg-white/10 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            2
                        </button>
                        <button className="px-3 py-1 border rounded text-sm hover:bg-white/10 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Incidents;
