import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ShieldAlert,
    Network,
    BookOpen,
    BrainCircuit,
    Zap,
    Activity,
    Settings,
    LogOut,
    Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePipeline } from '../context/PipelineContext';
import api from '../services/api';
import clsx from 'clsx';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const { isRunning } = usePipeline();
    const [health, setHealth] = React.useState('checking');

    React.useEffect(() => {
        const checkHealth = async () => {
            const res = await api.getHealth();
            setHealth(res.status === 'ok' ? 'online' : 'offline');
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: ShieldAlert, label: 'Incidents', path: '/incidents' },
        { icon: Network, label: 'Threat Graph', path: '/threat-graph' },
        { icon: BookOpen, label: 'Playbooks', path: '/playbooks' },
        { icon: BrainCircuit, label: 'LLM Reasoning', path: '/llm-reasoning' },
        { icon: Activity, label: 'Pipeline', path: '/pipeline' },
        { icon: Settings, label: 'Admin', path: '/admin' },
    ];

    return (
        <aside className="fixed left-4 top-4 bottom-4 w-64 glass-panel rounded-2xl flex flex-col z-50">
            {/* Header */}
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
                <div className="p-2 bg-blue-500/20 rounded-lg relative">
                    <Shield className="w-6 h-6 text-blue-400" />
                    <div className={clsx(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900",
                        health === 'online' ? "bg-green-500" : "bg-red-500"
                    )} />
                </div>
                <div>
                    <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                        CRYPTIX
                        {isRunning && <span className="animate-spin text-blue-400">⟳</span>}
                    </h1>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">SOC Platform</p>
                        {health === 'offline' && <span className="text-[10px] text-red-500 font-bold">OFFLINE</span>}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                            isActive
                                ? "bg-blue-600/10 text-blue-400"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_2px_rgba(59,130,246,0.5)]" />
                                )}
                                <item.icon size={20} className={clsx(isActive && "animate-pulse")} />
                                <span className="font-medium">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer / User */}
            <div className="p-4 border-t border-white/5">
                <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                            TU
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">testuser</p>
                            <p className="text-xs text-slate-500 truncate">Analyst</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
