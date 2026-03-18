import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    AlertTriangle,
    Network,
    BookOpen,
    Brain,
    Zap,
    GitBranch,
    Map,
    Settings,
    LogOut,
    Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
        { icon: Network, label: 'Threat Graph', path: '/threat-graph' },
        { icon: BookOpen, label: 'Playbooks', path: '/playbooks' },
        { icon: Brain, label: 'LLM Reasoning', path: '/llm-reasoning' },
        { icon: Zap, label: 'Response', path: '/response' },
        { icon: GitBranch, label: 'Pipeline', path: '/pipeline' },
        { icon: Map, label: 'MITRE Mapping', path: '/mitre-mapping' },
        { icon: Settings, label: 'Admin', path: '/admin' },
    ];

    return (
        <aside
            className="fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-50 shadow-xl"
            style={{
                background: 'linear-gradient(180deg, #003A5C 0%, #002D4A 35%, #002040 65%, #001830 100%)',
                borderRight: '1px solid rgba(0,174,239,0.08)'
            }}
        >
            {/* Header / Logo */}
            <div className="h-16 flex items-center px-6 border-b shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                    <div style={{
                        background: 'rgba(0,174,239,0.85)',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '13px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>CX</div>
                    <div className="flex flex-col">
                        <h1 style={{ color: 'white', fontWeight: '700', fontSize: '16px' }} className="tracking-tight leading-none">
                            CRYPTIX
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }} className="leading-none mt-1">
                            SOC Platform
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }} className="mt-0.5">
                            v2.4.9
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-0 custom-scrollbar">
                {navItems.map((item, index) => (
                    <React.Fragment key={item.path}>
                        <NavItem item={item} />
                        {index < navItems.length - 1 && (
                            <div style={{ margin: '4px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />
                        )}
                    </React.Fragment>
                ))}
            </nav>

            {/* Footer / User Info */}
            <div className="p-4 shrink-0 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
                {/* Theme Toggle Button */}
                <div className="px-1">
                    <ThemeToggle />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#00AEEF] flex items-center justify-center text-white font-bold text-sm shrink-0">
                            TU
                        </div>
                        <div className="truncate flex flex-col justify-center">
                            <p className="truncate leading-none" style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>
                                testuser
                            </p>
                            <p className="truncate mt-1 leading-none" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                                Threat Analyst
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="transition-colors shrink-0 group hover:text-white"
                        title="Logout"
                    >
                        <LogOut size={16} className="text-[rgba(255,255,255,0.4)] group-hover:text-white" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

// Internal sub-component for nav items
const NavItem = ({ item }) => {
    const location = useLocation();
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));

    return (
        <NavLink
            to={item.path}
            className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-150 group ${isActive
                ? 'bg-[rgba(0,174,239,0.12)] text-white font-[500]'
                : 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                }`}
        >
            <item.icon
                size={20}
                className={`transition-colors duration-150 ${isActive ? 'text-[#00AEEF]' : 'text-[rgba(255,255,255,0.5)] group-hover:text-white'
                    }`}
            />
            <span>{item.label}</span>
        </NavLink>
    );
};

export default Sidebar;
