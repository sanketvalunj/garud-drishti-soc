import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Activity, 
  Database, 
  Clock, 
  Shield, 
  Calendar,
  Globe,
  Zap
} from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import Tier1Stats from '../components/profile/Tier1Stats';
import Tier2Stats from '../components/profile/Tier2Stats';
import Tier3Stats from '../components/profile/Tier3Stats';

const MyActivity = () => {
  const { role, roleLabel, isTier1, isTier2, isTier3 } = useRole();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleColor = () => {
    if (isTier1) return 'rgba(0,174,239,0.3)'; // Lightest Blue
    if (isTier2) return 'rgba(0,174,239,0.6)'; // Mid Blue
    if (isTier3) return '#00AEEF';             // Solid Barclays Blue
    return '#007099';                          // Deep Blue
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div style={{ color: 'var(--accent)' }}>
              <Shield size={28} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              My Activity & Performance
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="font-medium">
             Analyst: <span style={{ color: 'var(--text-color)' }}>{user?.name}</span> · {roleLabel}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#00AEEF] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#00AEEF]">Live Feedback</span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">SOC_LEVEL: {role.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Role Specific Metrics (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-6 relative overflow-hidden">
                <div style={{ 
                    position: 'absolute', top: '-10%', right: '-5%', width: '200px', height: '200px',
                    background: getRoleColor(), opacity: 0.05, borderRadius: '50%', filter: 'blur(60px)'
                }} />
                
                <div className="flex items-center gap-3 mb-6">
                    <Activity size={18} className="text-[var(--text-muted)]" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">Real-time Performance</h2>
                </div>
                
                {isTier1 && <Tier1Stats />}
                {isTier2 && <Tier2Stats />}
                {isTier3 && <Tier3Stats />}
            </div>
        </div>

        {/* Right Column: Quick Info & Identity */}
        <div className="space-y-8">
            <div className="glass-card p-6 flex flex-col items-center text-center">
                <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', marginBottom: '20px',
                    background: '#00AEEF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', fontWeight: 800, color: 'white'
                }}>
                    {user?.avatar || 'U'}
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{user?.name}</h3>
                <div className="flex flex-col items-center gap-1 mt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                        {role.toUpperCase().replace('TIER', 'TIER ')}
                    </span>
                </div>
                
                <div className="w-full h-[1px] my-6" style={{ background: 'var(--border-subtle)' }} />
                
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Session Duration</span>
                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>04h 22m</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Commands Executed</span>
                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>1,242</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Efficiency Score</span>
                        <span className="text-sm font-mono font-bold text-[#00AEEF]">98.4%</span>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Zap size={18} style={{ color: 'var(--text-muted)' }} />
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Active Permissions</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['READ_ALERTS', 'EXEC_PLAYBOOK', 'ISOLATE_HOST', 'QUERY_VDB'].map(perm => (
                        <span key={perm} className="px-2 py-1 bg-white/5 border border-white/5 rounded text-[9px] font-mono text-[var(--text-muted)]">
                            {perm}
                        </span>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Footer Log Section - PRESERVED from Admin.jsx */}
      <div className="glass-card overflow-hidden" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.08)' }}>
         <div className="p-4 border-b border-white/5 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
               <Database size={12} className="text-[#00AEEF]" /> System Access Log
            </h3>
            <div className="flex items-center gap-3">
               <span className="text-[9px] font-mono text-white/30 tracking-tight">LOG_LEVEL: VERBOSE</span>
               <div className="w-1.5 h-1.5 rounded-full bg-[#00AEEF] animate-pulse shadow-[0_0_8px_rgba(0,174,239,0.5)]" />
            </div>
         </div>
         <div className="p-5 font-mono text-[11px] leading-relaxed space-y-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <div className="flex gap-3">
               <span className="text-white/30">[00:00:01]</span>
               <span><span style={{ color: '#00AEEF', fontWeight: 600 }}>AUTH_SUCCESS</span>: Session initialized for {user?.name} ({user?.role})</span>
            </div>
            <div className="flex gap-3">
               <span className="text-white/30">[00:00:02]</span>
               <span><span style={{ color: '#5291e2', fontWeight: 600 }}>INFO</span>: Loading {user?.role}-specific modules...</span>
            </div>
            <div className="flex gap-3">
               <span className="text-white/30">[00:00:03]</span>
               <span><span style={{ color: '#5291e2', fontWeight: 600 }}>INFO</span>: Synchronizing with vector storage...</span>
            </div>
            <div className="flex gap-3">
               <span className="text-white/30">[00:00:04]</span>
               <span><span style={{ color: '#4ade80', fontWeight: 600 }}>READY</span>: Interface operational.</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MyActivity;
