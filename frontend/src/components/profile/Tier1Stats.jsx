import React from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie 
} from 'recharts';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

const Tier1Stats = () => {
  const stats = [
    { label: 'Incidents handled', value: '124', icon: ShieldCheck, color: '#00AEEF' },
    { label: 'Escalations made', value: '18', icon: AlertTriangle, color: 'rgba(0,174,239,0.7)' },
    { label: 'False positives', value: '42', icon: Search, color: 'rgba(0,174,239,0.5)' },
    { label: 'Avg triage time', value: '4.2m', icon: Clock, color: 'rgba(0,174,239,0.3)' }
  ];

  const chartData = [
    { name: 'Escalated', value: 18, color: 'rgba(0,174,239,0.5)' },
    { name: 'Resolved', value: 106, color: '#00AEEF' }
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

      {/* Chart Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Outcome Distribution</span>
          <div style={{ display: 'flex', gap: '8px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(0,174,239,0.5)' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Escalated</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#00AEEF' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Resolved</span>
             </div>
          </div>
        </div>
        
        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '8px' 
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight Banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertCircle size={18} color="var(--text-muted)" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#00AEEF' }}>Actionable Insight</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>High escalation rate detected. Review Triage Playbook v4.</span>
        </div>
      </div>
    </div>
  );
};

export default Tier1Stats;
