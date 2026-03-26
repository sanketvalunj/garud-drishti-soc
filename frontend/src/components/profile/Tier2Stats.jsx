import React from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  FileText, 
  CornerDownRight, 
  Zap, 
  Activity,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

const Tier2Stats = () => {
  // API to integrate
  const stats = [
    { label: 'Investigated', value: '86', icon: FileText, color: '#00AEEF' },
    { label: 'Esc. Received', value: '42', icon: ShieldAlert, color: 'rgba(0,174,239,0.7)' },
    { label: 'Esc. to Tier 3', value: '12', icon: CornerDownRight, color: 'rgba(0,174,239,0.5)' },
    { label: 'Playbooks run', value: '64', icon: Zap, color: 'rgba(0,174,239,0.3)' }
  ];

  const chartData = [
    { name: 'Brute Force', count: 24 },
    { name: 'Lateral', count: 18 },
    { name: 'Phishing', count: 12 },
    { name: 'DDoS', count: 10 }
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

      {/* Analytics Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Playbook Usage Frequency</span>
          <Activity size={14} color="var(--text-muted)" />
        </div>
        
        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                width={70}
              />
              <Tooltip 
                cursor={{ fill: 'var(--bg-card-hover)' }}
                contentStyle={{ 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '8px' 
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#00AEEF' : 'rgba(0,174,239,0.3)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accuracy Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Investigation Accuracy</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>94.2% · +2.4% this month</span>
        </div>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #00AEEF',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ArrowUpRight size={16} color="#00AEEF" />
        </div>
      </div>
    </div>
  );
};

export default Tier2Stats;
