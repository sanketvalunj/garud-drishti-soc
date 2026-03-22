import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import {
  Search, ChevronDown, Check, ArrowRight,
  BookOpen, Sparkles, Clock, User,
  CheckCircle2, Circle
} from 'lucide-react'

// ─────────────────────────────────────
// API INTEGRATION — Replace mock data:
//
// const [playbooks, setPlaybooks] = 
//   useState([])
// const [loading, setLoading] = 
//   useState(true)
//
// useEffect(() => {
//   api.getPlaybooks()
//     .then(data => setPlaybooks(data))
//     .catch(err => console.error(err))
//     .finally(() => setLoading(false))
// }, [])
//
// API endpoint: GET /playbooks
// Response: array matching mockPlaybooks
// structure below
// ─────────────────────────────────────

const mockPlaybooks = [
  {
    id: 'PB-2091',
    incidentId: 'INC-2091',
    type: 'Privilege Escalation',
    generatedAt: '12:14:02',
    date: '19 Feb 2026',
    fidelityScore: 0.87,
    agentDecision: 'HIGH',
    status: 'pending',
    totalSteps: 6,
    completedSteps: 2,
    mitreTactic: 'T1068',
    mitreName: 'Privilege Escalation',
    affectedEntity: 'emp_104',
    steps: [
      { id: 1, title: 'Isolate User Account', type: 'automated', status: 'completed' },
      { id: 2, title: 'Block Source IP', type: 'automated', status: 'completed' },
      { id: 3, title: 'Revoke Auth Sessions', type: 'automated', status: 'pending' },
      { id: 4, title: 'Audit Database Access', type: 'manual', status: 'pending' },
      { id: 5, title: 'Reset Credentials', type: 'manual', status: 'pending' },
      { id: 6, title: 'Monitor Core Banking', type: 'manual', status: 'pending' }
    ]
  },
  {
    id: 'PB-2089',
    incidentId: 'INC-2089',
    type: 'Data Exfiltration',
    generatedAt: '11:45:18',
    date: '19 Feb 2026',
    fidelityScore: 0.92,
    agentDecision: 'HIGH',
    status: 'executed',
    totalSteps: 5,
    completedSteps: 5,
    mitreTactic: 'T1041',
    mitreName: 'Exfiltration Over C2',
    affectedEntity: 'db_admin',
    steps: [
      { id: 1, title: 'Block External IP', type: 'automated', status: 'completed' },
      { id: 2, title: 'Revoke DB Credentials', type: 'automated', status: 'completed' },
      { id: 3, title: 'Audit Data Access Logs', type: 'manual', status: 'completed' },
      { id: 4, title: 'Notify DPO', type: 'manual', status: 'completed' },
      { id: 5, title: 'Enable DLP Monitoring', type: 'manual', status: 'completed' }
    ]
  },
  {
    id: 'PB-2088',
    incidentId: 'INC-2088',
    type: 'Brute Force',
    generatedAt: '10:22:44',
    date: '19 Feb 2026',
    fidelityScore: 0.45,
    agentDecision: 'LOW',
    status: 'reviewed',
    totalSteps: 3,
    completedSteps: 3,
    mitreTactic: 'T1110',
    mitreName: 'Brute Force',
    affectedEntity: 'vpn_gateway',
    steps: [
      { id: 1, title: 'Block Source IPs', type: 'automated', status: 'completed' },
      { id: 2, title: 'Enable Rate Limiting', type: 'automated', status: 'completed' },
      { id: 3, title: 'Review Auth Logs', type: 'manual', status: 'completed' }
    ]
  },
  {
    id: 'PB-2085',
    incidentId: 'INC-2085',
    type: 'Malware Detected',
    generatedAt: '09:15:33',
    date: '19 Feb 2026',
    fidelityScore: 0.91,
    agentDecision: 'HIGH',
    status: 'executed',
    totalSteps: 5,
    completedSteps: 4,
    mitreTactic: 'T1059',
    mitreName: 'Command Scripting',
    affectedEntity: 'user_laptop_88',
    steps: [
      { id: 1, title: 'Isolate Endpoint', type: 'automated', status: 'completed' },
      { id: 2, title: 'Kill Malicious Process', type: 'automated', status: 'completed' },
      { id: 3, title: 'Run AV Scan', type: 'automated', status: 'completed' },
      { id: 4, title: 'Reimaging Assessment', type: 'manual', status: 'completed' },
      { id: 5, title: 'User Notification', type: 'manual', status: 'pending' }
    ]
  },
  {
    id: 'PB-2082',
    incidentId: 'INC-2082',
    type: 'Lateral Movement',
    generatedAt: '08:44:11',
    date: '18 Feb 2026',
    fidelityScore: 0.72,
    agentDecision: 'MEDIUM',
    status: 'pending',
    totalSteps: 4,
    completedSteps: 0,
    mitreTactic: 'T1021',
    mitreName: 'Remote Services',
    affectedEntity: 'swift-terminal',
    steps: [
      { id: 1, title: 'Isolate Affected Systems', type: 'automated', status: 'pending' },
      { id: 2, title: 'Revoke Lateral Access', type: 'automated', status: 'pending' },
      { id: 3, title: 'Audit Movement Logs', type: 'manual', status: 'pending' },
      { id: 4, title: 'Patch Vulnerability', type: 'manual', status: 'pending' }
    ]
  },
  {
    id: 'PB-2080',
    incidentId: 'INC-2080',
    type: 'Anomalous Login',
    generatedAt: '22:10:05',
    date: '18 Feb 2026',
    fidelityScore: 0.33,
    agentDecision: 'LOW',
    status: 'reviewed',
    totalSteps: 2,
    completedSteps: 2,
    mitreTactic: 'T1078',
    mitreName: 'Valid Accounts',
    affectedEntity: 'emp_089',
    steps: [
      { id: 1, title: 'Force Re-authentication', type: 'automated', status: 'completed' },
      { id: 2, title: 'Review Login History', type: 'manual', status: 'completed' }
    ]
  }
]

// ─── CUSTOM SELECT COMPONENT ────────────────────────────────
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder,
  isActive = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: 'fit-content' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 6px',
          background: isOpen
            ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
            : isActive
              ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,174,239,0.1)')
              : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          border: isOpen
            ? (isDark ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(0,174,239,0.4)')
            : isActive
              ? (isDark ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(0,174,239,0.25)')
              : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'),
          borderRadius: '8px',
          color: isActive ? (isDark ? '#FFFFFF' : '#007099') : 'var(--text-primary)',
          fontWeight: isActive ? 600 : 400,
          fontSize: '13px',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          outline: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: 'var(--text-muted)'
          }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 1000,
              background: 'var(--surface-color)',
              backdropFilter: 'blur(40px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              minWidth: '160px'
            }}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: value === option.value ? (isDark ? '#FFFFFF' : '#000000') : 'var(--text-primary)',
                  fontWeight: value === option.value ? 700 : 400,
                  background: value === option.value ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: index < options.length - 1 ? '1px solid var(--glass-border)' : 'none'
                }}
                className="hover-bg"
              >
                <span>{option.label}</span>
                {value === option.value && <Check size={13} />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Playbooks = () => {
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // State
  const [playbooks] = useState(mockPlaybooks)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')

  // Helper styles
  const glassStyle = {
    background: isDark ? 'var(--surface-color)' : 'rgba(255,255,255,0.65)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '14px 18px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
  }

  const getFidelityColor = (score) =>
    score >= 0.85 ? '#B91C1C'
    : score >= 0.5 ? '#D97706'
    : '#15803D'

  const getDecisionStyle = (decision) => ({
    HIGH: {
      bg: 'rgba(185,28,28,0.08)',
      border: 'rgba(185,28,28,0.15)',
      color: '#B91C1C'
    },
    MEDIUM: {
      bg: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.15)',
      color: '#D97706'
    },
    LOW: {
      bg: 'rgba(21,128,61,0.08)',
      border: 'rgba(21,128,61,0.15)',
      color: '#15803D'
    }
  }[decision] || {})

  const getStatusStyle = (status) => ({
    pending: {
      bg: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.15)',
      color: '#D97706',
      label: 'Pending Review'
    },
    executed: {
      bg: 'rgba(0,174,239,0.08)',
      border: 'rgba(0,174,239,0.15)',
      color: '#00AEEF',
      label: 'Executed'
    },
    reviewed: {
      bg: 'rgba(21,128,61,0.08)',
      border: 'rgba(21,128,61,0.15)',
      color: '#15803D',
      label: 'Reviewed'
    }
  }[status] || {})

  // Filters & Sorting
  const filteredPlaybooks = playbooks
    .filter(pb => {
      const matchSearch =
        pb.incidentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pb.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pb.affectedEntity.toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === 'all' || pb.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return 0
      if (sortBy === 'fidelity') return b.fidelityScore - a.fidelityScore
      if (sortBy === 'completed') return (b.completedSteps/b.totalSteps) - (a.completedSteps/a.totalSteps)
      return 0
    })

  // Stats
  const totalCount = playbooks.length
  const executedCount = playbooks.filter(p => p.status === 'executed').length
  const pendingCount = playbooks.filter(p => p.status === 'pending').length
  const reviewedCount = playbooks.filter(p => p.status === 'reviewed').length


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: '0',
        margin: '0'
      }}
    >
      {/* SECTION 1 — PAGE HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-color)' }}>Playbooks</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>AI-generated incident response plans</div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { label: 'Total', count: totalCount },
              { label: 'Pending', count: pendingCount },
              { label: 'Executed', count: executedCount },
              { label: 'Reviewed', count: reviewedCount }
            ].map(stat => (
              <div key={stat.label} style={{ 
                ...glassStyle, 
                background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.05)',
                padding: '10px 16px', 
                textAlign: 'center', 
                minWidth: '80px' 
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-color)' }}>{stat.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2 — FILTER BAR */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Search by incident, attack type, entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '0.6px solid white',
                borderRadius: 20,
                height: 46,
                padding: '0 20px 0 42px',
                color: 'var(--text-color)',
                fontSize: 15,
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
            isActive={statusFilter !== 'all'}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending Review' },
              { value: 'executed', label: 'Executed' },
              { value: 'reviewed', label: 'Reviewed' }
            ]}
          />

          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            placeholder="Sort By"
            isActive={sortBy !== 'latest'}
            options={[
              { value: 'latest', label: 'Latest First' },
              { value: 'fidelity', label: 'Fidelity Score' },
              { value: 'completed', label: '% Completed' }
            ]}
          />

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {filteredPlaybooks.length} playbooks found
          </div>
        </div>

        {/* SECTION 3 — PLAYBOOK CARDS GRID */}
        {filteredPlaybooks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPlaybooks.map((pb, index) => (
              <motion.div
                key={pb.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                onClick={() => navigate(`/incidents/${pb.incidentId}`, { state: { from: 'playbooks' } })}
                style={{
                  ...glassStyle,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  border: isDark ? '2px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)'
                }}
                whileHover={{
                  borderColor: '#00AEEF',
                  background: isDark ? 'var(--surface-color)' : 'rgba(255, 255, 255, 0.72)',
                  y: -1,
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.25)' : '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                {/* TOP ROW */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: 600, color: '#00AEEF', marginBottom: '3px' }}>
                      {pb.incidentId}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-color)', marginBottom: '4px' }}>
                      {pb.type}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0' }}>
                      <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pb.date} · {pb.generatedAt}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{
                      ...getStatusStyle(pb.status),
                      borderRadius: '20px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'default',
                      pointerEvents: 'none',
                      border: getStatusStyle(pb.status).border,
                      background: getStatusStyle(pb.status).bg,
                      color: getStatusStyle(pb.status).color
                    }}>
                      {getStatusStyle(pb.status).label}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>Fidelity</span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '14px', fontWeight: 700, color: getFidelityColor(pb.fidelityScore) }}>
                        {pb.fidelityScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PROGRESS ROW */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                     <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Response Progress</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pb.completedSteps} of {pb.totalSteps} steps</span>
                  </div>
                  <div style={{ 
                    height: '5px', 
                    borderRadius: '2.5px', 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    width: '100%' 
                  }}>
                    <div style={{ 
                      width: `${(pb.completedSteps / pb.totalSteps) * 100}%`, 
                      height: '100%', 
                      borderRadius: '2.5px', 
                      backgroundColor: '#00AEEF',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* STEPS PREVIEW */}
                <div style={{ marginBottom: '10px' }}>
                   <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>Steps:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {pb.steps.slice(0, 6).map(step => (
                      <div key={step.id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'default',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        ...(step.status === 'completed' 
                          ? { background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.15)', color: '#15803D' }
                          : { background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }
                        )
                      }}>
                        {step.status === 'completed' ? <Check size={10} /> : <Circle size={10} />}
                        {step.title}
                      </div>
                    ))}
                     {pb.steps.length > 6 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '3px 6px' }}>
                        +{pb.steps.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                {/* BOTTOM ROW */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <User size={12} style={{ color: 'var(--text-muted)' }} />
                       <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {pb.affectedEntity}
                      </span>
                    </div>
                    <div style={{ 
                      marginLeft: '8px',                       fontFamily: 'JetBrains Mono', 
                      fontSize: '11px', 
                      color: 'var(--text-muted)',
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '4px',
                      padding: '1px 6px'
                    }}>
                      {pb.mitreTactic} {pb.mitreName ? `· ${pb.mitreName}` : ''}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/incidents/${pb.incidentId}`, { state: { from: 'playbooks' } });
                    }}
                    className="view-playbook-btn"
                    style={{
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                       color: '#00AEEF',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    View Playbook <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* SECTION 4 — EMPTY STATE */
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '60px', 
            textAlign: 'center' 
          }}>
            <BookOpen size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>No playbooks found</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Run the pipeline to generate AI response playbooks
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: '16px',
                background: 'rgba(0,174,239,0.08)',
                border: '1px solid rgba(0,174,239,0.15)',
                color: '#00AEEF',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,174,239,0.15)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,174,239,0.08)';
                e.currentTarget.style.color = '#00AEEF';
              }}
            >
              Run Pipeline
            </button>
          </div>
        )}
      <style>{`
        .hover-bg:hover {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'} !important;
        }
        .view-playbook-btn:hover {
          color: ${isDark ? '#FFFFFF' : '#000000'} !important;
        }
      `}</style>
    </motion.div>
  )
}

export default Playbooks
