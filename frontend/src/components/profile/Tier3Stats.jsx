import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  ShieldCheck, 
  Activity, 
  Lock,
  Flame,
  Globe
} from 'lucide-react';

const Tier3Stats = () => {
  // API to integrate
  const stats = [
    { label: 'Resolved', value: '34', icon: ShieldCheck, color: '#00AEEF' },
    { label: 'Esc. Received', value: '28', icon: Users, color: 'rgba(0,174,239,0.7)' },
    { label: 'Isolated', value: '9', icon: Lock, color: 'rgba(0,174,239,0.5)' },
    { label: 'Pipelines run', value: '142', icon: Activity, color: 'rgba(0,174,239,0.3)' }
  ];

  const criticalActions = [
    { title: 'Global Proxy Lock', detail: '34 endpoints secured', time: '2h ago', level: 'high' },
    { title: 'Credential Reset', detail: 'Admin group isolation', time: '5h ago', level: 'medium' },
    { title: 'BGP Reroute', detail: 'Mitigated volumetric scan', time: 'Yesterday', level: 'high' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '12px' 
      }}>
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <stat.icon size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                {stat.label}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Critical Actions Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Flame size={14} color="#00AEEF" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>High Impact Containment</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {criticalActions.map((action, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{action.title}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{action.detail}</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{action.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Highlight Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ 
          width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,174,239,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Globe size={20} color="#00AEEF" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Systems Secured</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Infrastructure stability maintained at 99.99%</span>
        </div>
      </div>
    </div>
  );
};

export default Tier3Stats;
