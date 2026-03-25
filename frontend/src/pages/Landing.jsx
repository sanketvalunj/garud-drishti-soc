import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import {
  Shield, Activity, ShieldAlert, BarChart2, Lock,
  ChevronRight, Eye, EyeOff, User, Loader2,
  Zap, Brain, Users, Database, Cpu, Monitor,
  ArrowRight, CheckCircle, Play
} from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

// DATA: Replace with GET /api/platform/stats when available
const PLATFORM_STATS = [
  { value: 99.7, suffix: '%', label: 'Detection Accuracy', decimals: 1 },
  { value: 2, prefix: '<', suffix: 'min', label: 'Avg Response Time', decimals: 0 },
  { value: 3, suffix: '', label: 'AI Agents', decimals: 0 },
]

// DATA: Replace with GET /api/platform/features when available
const FEATURES = [
  {
    id: 'bfof', tag: 'BFOF', title: 'Bayesian Fidelity Orchestration',
    subtitle: 'Replace static severity with intelligence',
    description: 'Probabilistic risk scoring using multi-factor weighted inference. Every alert gets a 0-1 fidelity score based on behavioral deviation, asset criticality, historical similarity, and cross-entity correlation.',
    bullets: ['Multi-factor weighted risk scoring', 'Replaces static SIEM severity thresholds', 'SHAP-based explainability for every score'],
    visual: 'fidelity', align: 'left', accent: '#00AEEF',
  },
  {
    id: 'correlation', tag: 'GRAPH ENGINE', title: 'Incident Graph Reconstruction',
    subtitle: 'See the full attack, not just fragments',
    description: 'Links isolated alerts across users, hosts, sessions and processes into unified attack chains. Analysts see the complete kill chain narrative - not thousands of disconnected events.',
    bullets: ['Entity-linked correlation across all log sources', 'Automated kill chain reconstruction', 'Interactive attack timeline visualization'],
    visual: 'graph', align: 'right', accent: '#00AEEF',
  },
  {
    id: 'agents', tag: 'MULTI-AGENT', title: 'AI Decision Intelligence',
    subtitle: 'Three agents vote before any action',
    description: 'Risk Agent, Compliance Agent, and Business Impact Agent collaborate via LangGraph. Weighted voting replaces single-score alerts - reducing false positives and eliminating decision bias.',
    bullets: ['Risk + Compliance + Business Impact agents', 'Weighted voting engine with governance guardrails', 'Manual, Assisted, and Autonomous execution modes'],
    visual: 'agents', align: 'left', accent: '#00AEEF',
  },
  {
    id: 'airgap', tag: 'SAIA', title: 'Sovereign Air-Gapped Architecture',
    subtitle: 'Zero external data transfer. Ever.',
    description: 'All AI reasoning, MITRE mapping, and playbook generation runs entirely within your infrastructure via Ollama hosted LLMs. No cloud APIs. No data leaves your network.',
    bullets: ['Fully offline LLM execution via Ollama', 'Encrypted local model artifact store', 'Regulatory-ready audit trail built in'],
    visual: 'airgap', align: 'right', accent: '#00AEEF',
  },
]

// DATA: Replace with GET /api/roles when available
const ROLES = [
  {
    value: 'tier1', label: 'Tier 1 Analyst', sublabel: 'Triage & Monitoring', icon: Activity, color: '#15803D',
    description: 'Monitor alerts, triage incidents, escalate to Tier 2',
    capabilities: ['Alert triage queue with SLA tracking', 'Quick classify: True/False Positive', 'IoC lookup — IP, hash, domain, URL', 'Shift summary and performance metrics']
  },
  {
    value: 'tier2', label: 'Tier 2 Analyst', sublabel: 'Incident Response', icon: ShieldAlert, color: '#D97706',
    description: 'Investigate escalated incidents, execute containment',
    capabilities: ['Deep incident investigation workspace', 'Containment actions: block, isolate, disable', 'SIEM rule tuning and false positive reduction', 'Malware and IOC analysis tools']
  },
  {
    value: 'tier3', label: 'Tier 3 Analyst', sublabel: 'Threat Hunting', icon: Shield, color: '#B91C1C',
    description: 'Proactively hunt threats, forensics, detection engineering',
    capabilities: ['Threat hunt console with query interface', 'Hunt campaign manager and hypothesis tracking', 'Detection rule builder and tester', 'Attack pattern library and forensics workspace']
  },
]

/* ── Helper: SVG wave path generator ───────────────────── */
const generateWavePath = (time, baseline, amplitude, freq, phase) => {
  const points = []
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 1440
    const y = baseline + amplitude * Math.sin((i / steps) * Math.PI * 2 * freq + time * 0.5 + phase)
    points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`)
  }
  points.push('L1440,420 L0,420 Z')
  return points.join(' ')
}

/* ── AnimatedWaves component ───────────────────────────── */
const AnimatedWaves = () => {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let frame, start = null
    const animate = (ts) => {
      if (!start) start = ts
      setOffset((ts - start) / 1000)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: '-10%', width: '120%', height: '78%', zIndex: 0 }}>
      <path d={generateWavePath(offset, 290, 42, 0.6, 3)} fill="rgba(0,57,93,0.25)" />
      <path d={generateWavePath(offset, 240, 60, 1.1, 1.5)} fill="rgba(0,119,182,0.15)" />
      <path d={generateWavePath(offset, 190, 85, 0.8, 0)} fill="rgba(0,174,239,0.08)" />
    </svg>
  )
}

/* ── AnimatedCounter ───────────────────────────────────── */
const AnimatedCounter = ({ value, suffix = '', prefix = '', decimals = 0, label }) => {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 2000, step = (value / duration) * 16
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setCount(value); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [inView, value])
  return (
    <div ref={ref} style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: '42px', fontWeight: 900, color: 'white' }}>
        {prefix}{decimals ? count.toFixed(decimals) : Math.floor(count)}{suffix}
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>{label}</div>
    </div>
  )
}

/* ── Feature Visuals ───────────────────────────────────── */
const FidelityVisual = () => {
  const factors = [{ l: 'Behavioral', v: 0.91 }, { l: 'Asset Criticality', v: 0.88 }, { l: 'Historical', v: 0.79 }, { l: 'Cross-Entity', v: 0.85 }]
  return (
    <div>
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ width: 140, height: 70, margin: '0 auto', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius={50}
            outerRadius={70}
            barSize={10}
            data={[{ value: 87, fill: '#00AEEF' }]}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.1)" }}
              dataKey="value"
              cornerRadius={10}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: 'white', marginTop: -15 }}>0.87</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>High Confidence</div>
    </div>
      {factors.map(f => (
        <div key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', width: 100, flexShrink: 0 }}>{f.l}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(0,174,239,0.15)' }}>
            <motion.div initial={{ width: 0 }} whileInView={{ width: `${f.v * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.2 }}
              style={{ height: '100%', borderRadius: 3, background: '#00AEEF' }} />
          </div>
          <span style={{ fontSize: 11, color: '#00AEEF', fontWeight: 700, width: 32 }}>{f.v}</span>
        </div>
      ))}
    </div>
  )
}

const GraphVisual = () => {
  const nodes = [
    { id: 'auth', x: 40, y: 30, label: 'auth-server', c: '#00AEEF' },
    { id: 'emp', x: 140, y: 70, label: 'emp_104', c: '#D97706' },
    { id: 'loan', x: 260, y: 30, label: 'loan-db', c: '#B91C1C' },
    { id: 'vpn', x: 80, y: 140, label: 'vpn-gw', c: '#00AEEF' },
    { id: 'exfil', x: 220, y: 140, label: 'exfil-point', c: '#B91C1C' },
    { id: 'c2', x: 300, y: 100, label: 'c2-server', c: '#B91C1C' },
  ]
  const edges = [[0, 1], [1, 2], [1, 3], [3, 4], [2, 5], [4, 5]]
  return (
    <svg viewBox="0 0 360 180" style={{ width: '100%' }}>
      {edges.map(([a, b], i) => (
        <motion.line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(124,58,237,0.4)" strokeWidth={1.5} strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.15 }} />
      ))}
      {nodes.map((n, i) => (
        <motion.g key={n.id} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
          <circle cx={n.x} cy={n.y} r={14} fill={`${n.c}33`} stroke={n.c} strokeWidth={1.5} />
          <text x={n.x} y={n.y + 28} fill="rgba(255,255,255,0.5)" fontSize={8} textAnchor="middle">{n.label}</text>
        </motion.g>
      ))}
    </svg>
  )
}

const AgentsVisual = () => {
  const agents = [
    { name: 'Risk Agent', score: 0.91, status: 'HIGH', color: '#B91C1C' },
    { name: 'Compliance Agent', score: 0.88, status: 'CRITICAL', color: '#D97706' },
    { name: 'Business Impact', score: 0.79, status: 'MEDIUM', color: 'rgba(0,174,239,0.7)' },
  ]
  return (
    <div>
      {agents.map((a, i) => (
        <motion.div key={a.name} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.15 }}
          style={{
            background: 'rgba(2,11,24,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{a.name}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{a.score}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: a.color, background: `${a.color}22`, padding: '2px 6px', borderRadius: 4 }}>{a.status}</span>
          </div>
        </motion.div>
      ))}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <span style={{
          background: 'rgba(0,174,239,0.15)', color: '#00AEEF', fontSize: 10, fontWeight: 700,
          padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,174,239,0.3)'
        }}>Voting Engine → AUTONOMOUS</span>
      </div>
    </div>
  )
}

const AirgapVisual = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
    {[
      { label: 'Your Infrastructure', icon: Database },
      { label: 'CRYPTIX Engine', icon: Cpu },
      { label: 'SOC Dashboard', icon: Activity }
    ].map((box, i) => (
      <React.Fragment key={box.label}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2 }}
          style={{
            background: 'rgba(2,11,24,0.8)', border: '1px solid rgba(0,174,239,0.3)', borderRadius: 12,
            padding: '16px 24px', textAlign: 'center', width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
          }}>
          <box.icon size={24} color="#00AEEF" />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{box.label}</div>
        </motion.div>
        {i < 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 2, height: 16, background: 'rgba(0,174,239,0.4)' }} />
            {i === 0 && <span style={{ fontSize: 8, color: '#00AEEF', fontWeight: 700 }}>NO EXTERNAL CALLS</span>}
            <div style={{ width: 2, height: 8, background: 'rgba(0,174,239,0.4)' }} />
          </div>
        )}
      </React.Fragment>
    ))}
    <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
      style={{
        background: 'rgba(0,174,239,0.2)', border: '1px solid rgba(0,174,239,0.4)', borderRadius: 20,
        padding: '4px 14px', fontSize: 10, fontWeight: 700, color: '#00AEEF'
      }}>
      <Lock size={10} style={{ display: 'inline', marginRight: 4 }} /> FULLY OFFLINE
    </motion.div>
  </div>
)

const FeatureVisual = ({ type }) => {
  const map = { fidelity: FidelityVisual, graph: GraphVisual, agents: AgentsVisual, airgap: AirgapVisual }
  const Comp = map[type]
  return Comp ? <Comp /> : null
}

/* ═══════════════════════════════════════════════════════════
   LANDING COMPONENT
   ═══════════════════════════════════════════════════════════ */
const Landing = () => {
  const [loginRole, setLoginRole] = useState('tier1')
  const [activeRole, setActiveRole] = useState('tier1')
  const [direction, setDirection] = useState(0)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    if (!username.trim()) { setError('Please enter a username'); return }
    if (!password.trim()) { setError('Please enter a password'); return }
    setError('')
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    login(loginRole)
    setIsLoading(false)
    navigate('/dashboard')
  }

  const scrollToLogin = () => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const onTabChange = (newRole) => {
    const currentIndex = ROLES.findIndex(r => r.value === activeRole)
    const newIndex = ROLES.findIndex(r => r.value === newRole)
    setDirection(newIndex > currentIndex ? 1 : -1)
    setActiveRole(newRole)
  }

  const activeRoleData = ROLES.find(r => r.value === activeRole)
  const loginRoleData = ROLES.find(r => r.value === loginRole)

  const px = 'clamp(24px, 8vw, 120px)'

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#020B18', color: 'white', minHeight: '100vh' }}>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translateX(120%) translateY(0)} 50%{transform:translateX(120%) translateY(-8px)} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ════ SECTION 1 — NAVBAR ════ */}
      {/* PHASE 20%: Navbar, hero layout, stats bar, footer render */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', height: 68, zIndex: 100,
        background: 'rgba(2,11,24,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(0,174,239,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${px}`, boxSizing: 'border-box'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: '#00AEEF', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16
          }}>CX</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>CRYPTIX</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>SOC Platform</span>
          </div>
        </Link>

        <nav style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Home', action: scrollToTop },
            { label: 'About Us', to: '/about' },
            { label: 'Our Services', to: '/services' },
          ].map(n => n.to ? (
            <Link key={n.label} to={n.to} style={{
              fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px',
              borderRadius: 8, textDecoration: 'none', transition: 'all 0.2s'
            }}>{n.label}</Link>
          ) : (
            <button key={n.label} onClick={n.action} style={{
              fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px',
              borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
            }}>{n.label}</button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={scrollToLogin} style={{
            background: '#00AEEF', color: 'white', borderRadius: 8, padding: '9px 20px', fontSize: 13,
            fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,174,239,0.3)'
          }}>Login</button>
        </div>
      </header>

      {/* ════ SECTION 2 — HERO ════ */}
      <section style={{
        minHeight: '100vh', background: '#020B18', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', padding: `68px ${px} 0`
      }}>
        <AnimatedWaves />

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', gap: 60, alignItems: 'center', width: '100%', maxWidth: 1400, margin: '0 auto' }}>
          {/* Left Column */}
          <div style={{ flex: '0 0 55%' }}>
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(0,174,239,0.1)',
                border: '1px solid rgba(0,174,239,0.25)', color: '#00AEEF', fontSize: 11, fontWeight: 700,
                borderRadius: 20, padding: '5px 14px', letterSpacing: 2, marginBottom: 24
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00AEEF', animation: 'pulse 2s infinite' }} />
              BARCLAYS HACK-O-HIRE 2026
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{
                fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, color: 'white', lineHeight: 1.1,
                letterSpacing: -1.5, margin: 0
              }}>
              Autonomous Cyber<br /><span style={{ color: '#00AEEF' }}>Incident Response</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginTop: 16, lineHeight: 1.5, maxWidth: 480 }}>
              The AI engine for detecting hidden threats
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {['✓ Air-Gapped AI', '✓ Multi-Agent', '✓ MITRE ATT&CK'].map((pill, i) => (
                <motion.span key={pill} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)', fontSize: 12, borderRadius: 20, padding: '5px 12px'
                  }}>{pill}</motion.span>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              style={{ display: 'flex', gap: 12, marginTop: 36 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={scrollToLogin}
                style={{
                  background: '#00AEEF', color: 'white', borderRadius: 8, padding: '14px 28px', fontSize: 15,
                  fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,174,239,0.35)',
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                }}>
                <span>Access Secure Console</span><ArrowRight size={16} />
              </motion.button>
            </motion.div>
          </div>

          {/* Right Column — SOC Dashboard Mockup */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
            style={{ flex: '0 0 45%', position: 'relative' }}>
            <div style={{
              background: 'rgba(0,57,93,0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,174,239,0.2)',
              borderRadius: 20, padding: 24, boxShadow: '0 40px 80px rgba(0,0,0,0.4)', maxWidth: 440
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>🛡 CRYPTIX SOC</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D' }} />
                  <span style={{ fontSize: 12, color: '#D97706' }}>Live 3 Active Threats</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                  </div>
                </div>
              </div>

              {[
                { sev: '#B91C1C', name: 'Privilege Escalation - emp_104', score: '0.94', sc: '#B91C1C' },
                { sev: '#D97706', name: 'Lateral Movement detected', score: '0.71', sc: '#D97706' },
                { sev: '#15803D', name: 'Suspicious Login - resolved', score: '0.32', sc: '#15803D' },
              ].map(row => (
                <div key={row.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.sev, flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', flex: 1 }}>{row.name}</span>
                  <span style={{
                    background: `${row.sc}22`, color: row.sc, fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 6
                  }}>{row.score}</span>
                </div>
              ))}

              <div style={{ marginTop: 16, textAlign: 'center', position: 'relative' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>AI Fidelity Score</div>
                
                <div style={{ width: 160, height: 90, margin: '0 auto', position: 'relative' }}>
                  <div style={{ width: '100%', height: '100%', position: 'absolute', top: -15 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        cx="50%"
                        cy="100%"
                        innerRadius={55}
                        outerRadius={75}
                        barSize={10}
                        data={[{ value: 87, fill: '#00AEEF' }]}
                        startAngle={180}
                        endAngle={0}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar
                          background={{ fill: "rgba(255,255,255,0.1)" }}
                          dataKey="value"
                          cornerRadius={10}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                    textAlign: 'center', width: '100%'
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>0.87</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>High Confidence</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card: Multi-Agent Vote */}
            <div style={{
              position: 'absolute', top: -10, right: 40, background: 'rgba(2,11,24,0.9)',
              border: '1px solid rgba(0,174,239,0.3)', borderRadius: 12, padding: 12, fontSize: 11,
              zIndex: 30, boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ fontWeight: 700, color: '#00AEEF', marginBottom: 6 }}>Multi-Agent Vote</div>
              {[{ n: 'Risk', v: '0.91' }, { n: 'Compliance', v: '0.88' }, { n: 'Impact', v: '0.79' }].map(a => (
                <div key={a.n} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                  <span>{a.n}</span><span style={{ color: 'white', fontWeight: 700 }}>{a.v}</span>
                </div>
              ))}
            </div>

            {/* Floating card: Response Executed */}
            <div style={{
              position: 'absolute', bottom: -10, left: -30, background: 'rgba(21,128,61,0.27)',
              border: '1px solid rgba(21,128,61,0.42)', borderRadius: 12, padding: 12, fontSize: 11,
              zIndex: 20
            }}>
              <div style={{ fontWeight: 700, color: '#15803D', marginBottom: 4 }}>✓ Response Executed</div>
              <div style={{ color: 'rgba(255,255,255,0.6)' }}>IP 203.0.113.45 blocked</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════ SECTION 3 — STATS BAR ════ */}
      <section style={{
        background: 'rgba(0,57,93,0.4)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,174,239,0.1)', borderBottom: '1px solid rgba(0,174,239,0.1)',
        padding: `40px ${px}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0
      }}>
        {PLATFORM_STATS.map((s, i) => (
          <React.Fragment key={s.label}>
            <AnimatedCounter {...s} />
            {i < PLATFORM_STATS.length - 1 && (
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </section>

      {/* ════ SECTION 4 — FEATURES ════ */}
      {/* PHASE 50%: Animated waves, feature sections, role showcase */}
      <section style={{ padding: `100px ${px}`, background: '#020B18' }}>
        {FEATURES.map((f, idx) => (
          <div key={f.id}>
            {idx > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '80px 0' }} />}
            <div style={{
              display: 'flex', gap: 80, alignItems: 'center', maxWidth: 1200, margin: '0 auto',
              flexDirection: f.align === 'right' ? 'row-reverse' : 'row'
            }}>
              {/* Text */}
              <motion.div style={{ flex: 1 }}
                initial={{ opacity: 0, x: f.align === 'left' ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <span style={{
                  background: `${f.accent}26`, color: f.accent, fontSize: 11, fontWeight: 700,
                  letterSpacing: 2, borderRadius: 20, padding: '4px 12px'
                }}>{f.tag}</span>
                <h3 style={{
                  color: 'white', fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800,
                  marginTop: 12, lineHeight: 1.2, marginBottom: 0
                }}>{f.title}</h3>
                <p style={{ color: f.accent, fontSize: 16, fontWeight: 600, marginTop: 8, marginBottom: 0 }}>{f.subtitle}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, marginTop: 16, maxWidth: 480 }}>{f.description}</p>
                <div style={{ marginTop: 24 }}>
                  {f.bullets.map(b => (
                    <div key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                      <CheckCircle size={16} color={f.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Visual */}
              <motion.div style={{
                flex: 1, background: 'rgba(0,57,93,0.35)', backdropFilter: 'blur(20px)',
                border: `1px solid ${f.accent}33`, borderRadius: 20, padding: 32, minHeight: 280
              }}
                initial={{ opacity: 0, x: f.align === 'left' ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <FeatureVisual type={f.visual} />
              </motion.div>
            </div>
          </div>
        ))}
      </section>

      {/* ════ SECTION 5 — ROLE SHOWCASE ════ */}
      <section style={{ padding: `100px ${px}`, background: 'rgba(0,57,93,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>ROLE-BASED ACCESS</span>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: 'white', margin: 0 }}>Purpose-built for every SOC role</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Each analyst gets a workspace designed for their exact responsibilities</p>
        </div>

        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 40 }}>
          {ROLES.map(r => {
            const isActive = activeRole === r.value
            return (
              <button key={r.value} onClick={() => onTabChange(r.value)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8,
                border: isActive ? '1px solid #00AEEF' : '1px solid transparent',
                background: isActive ? 'rgba(0,174,239,0.15)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s'
              }}>
                <r.icon size={16} /> {r.label}
              </button>
            )
          })}
        </div>

        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 400 }}>
          <AnimatePresence mode="popLayout" custom={direction}>
            {activeRoleData && (
              <motion.div key={activeRole} 
                custom={direction}
                initial={{ x: direction > 0 ? '100%' : '-100%', opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }} 
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                style={{ display: 'flex', gap: 60, maxWidth: 1200, margin: '0 auto', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,174,239,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
                }}>
                  <activeRoleData.icon size={24} color="#00AEEF" />
                </div>
                <h3 style={{ color: 'white', fontSize: 28, fontWeight: 800, margin: 0 }}>{activeRoleData.label}</h3>
                <p style={{ color: '#00AEEF', fontSize: 14, fontWeight: 600, margin: '4px 0 0 0' }}>{activeRoleData.sublabel}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 12 }}>{activeRoleData.description}</p>

                <div style={{ marginTop: 28 }}>
                  {activeRoleData.capabilities.map(c => (
                    <div key={c} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                      <CheckCircle size={16} color="#00AEEF" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{c}</span>
                    </div>
                  ))}
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setLoginRole(activeRole); scrollToLogin() }}
                  style={{
                    background: '#00AEEF', color: 'white', borderRadius: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 32,
                    display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
                  }}>
                  Enter as {activeRoleData.label} <ArrowRight size={14} style={{ flexShrink: 0 }} />
                </motion.button>
              </div>

              {/* Role-specific dashboard preview */}
              <div style={{
                flex: 1, background: 'rgba(0,57,93,0.4)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,174,239,0.2)', borderRadius: 20, padding: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00AEEF' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{activeRoleData.label} Dashboard</span>
                </div>
                {activeRoleData.capabilities.map((c, i) => (
                  <div key={c} style={{
                    background: 'rgba(2,11,24,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00AEEF' }} />
                    {c}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>

      {/* ════ SECTION 6 — LOGIN ════ */}
      {/* PHASE 100%: Login form functional, About+Services pages, all animations, floating cards, visual mockups */}
      <section id="login" style={{ padding: `100px ${px}`, background: '#020B18', borderTop: '1px solid rgba(0,174,239,0.08)' }}>
        <div style={{ display: 'flex', gap: 60, maxWidth: 1200, margin: '0 auto', alignItems: 'center' }}>
          {/* Login Form */}
          <div style={{ width: 480, flexShrink: 0 }}>
            <div style={{
              background: 'rgba(0,57,93,0.3)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,174,239,0.6)', borderRadius: 20, padding: 40,
              boxShadow: '0 0 18px rgba(0,174,239,0.18)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,174,239,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                }}>
                  <Lock size={22} color="#00AEEF" />
                </div>
                <h3 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: 0 }}>Secure Access</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '4px 0 0' }}>Sign in to CRYPTIX SOC Platform</p>
              </div>

              {/* Role selector 2x2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                {ROLES.map(r => {
                  const sel = loginRole === r.value
                  const isTier3 = r.value === 'tier3'
                  return (
                    <div key={r.value} onClick={() => setLoginRole(r.value)} style={{
                      padding: 12, cursor: 'pointer', borderRadius: 12, transition: 'all 0.15s',
                      background: sel ? `${r.color}15` : 'rgba(255,255,255,0.03)',
                      border: sel ? '1.5px solid #00AEEF' : '1px solid rgba(255,255,255,0.08)'
                      , ...(isTier3 ? { gridColumn: '1 / span 2', justifySelf: 'center', width: 'calc(50% - 4px)' } : {})
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{r.sublabel}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'block' }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username"
                      style={{
                        width: '100%', height: 44, padding: '0 16px 0 36px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                      }} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'block' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                      style={{
                        width: '100%', height: 44, padding: '0 40px 0 36px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                      }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)'
                      }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 8 }}>{error}</div>}

                {loginRoleData && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.36)', marginBottom: 16,
                    backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)'
                  }}>
                    <loginRoleData.icon size={14} color="white" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Signing in as {loginRoleData.label}</span>
                  </div>
                )}

                <button type="submit" disabled={isLoading} style={{
                  width: '100%', minHeight: 44, height: 'auto', background: isLoading ? 'rgba(0,174,239,0.5)' : '#00AEEF',
                  color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px',
                  whiteSpace: 'nowrap'
                }}>
                  {isLoading ? (<><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Authenticating...</>) :
                    (<React.Fragment><span>Sign In</span> <ChevronRight size={16} style={{ flexShrink: 0 }} /></React.Fragment>)}
                </button>
              </form>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
                Demo mode · Any username and password accepted
              </p>
            </div>
          </div>

          {/* Info Panel */}
          <div style={{ flex: 1, paddingLeft: 60 }}>
            <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 2, display: 'block', marginBottom: 16 }}>WHY CRYPTIX?</span>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 24, marginTop: 0 }}>
              Intelligence-driven security for modern banks
            </h2>

            {[
              { icon: Shield, color: '#00AEEF', title: 'Air-Gapped & Compliant', desc: 'All AI runs within your infrastructure. Zero external calls.' },
              { icon: Zap, color: '#00AEEF', title: 'Sub-2 Minute Response', desc: 'From alert ingestion to containment action.' },
              { icon: Users, color: '#00AEEF', title: 'Role-Based Intelligence', desc: 'Every analyst gets a purpose-built workspace.' },
            ].map(pt => (
              <div key={pt.title} style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: `${pt.color}26`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <pt.icon size={18} color={pt.color} />
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>{pt.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>{pt.desc}</div>
                </div>
              </div>
            ))}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 32, marginTop: 32 }} />
          </div>
        </div>
      </section>

      {/* ════ SECTION 7 — FOOTER ════ */}
      <footer style={{ background: '#020B18', borderTop: '1px solid rgba(255,255,255,0.06)', padding: `40px ${px}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', maxWidth: 1200, margin: '0 auto', flexWrap: 'wrap', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#00AEEF', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12
              }}>CX</div>
              <span style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>CRYPTIX</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, maxWidth: 260, margin: 0 }}>The AI engine for detecting hidden threats</p>
          </div>

          <div style={{ display: 'flex', gap: 60 }}>
            <div>
              <h4 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Product</h4>
              {['Dashboard', 'Incidents', 'Playbooks', 'Pipeline'].map(l => (
                <div key={l} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 8, cursor: 'default' }}>{l}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Platform</h4>
              <Link to="/about" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, display: 'block', marginBottom: 8, textDecoration: 'none' }}>About Us</Link>
              <Link to="/services" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, display: 'block', marginBottom: 8, textDecoration: 'none' }}>Our Services</Link>
            </div>
            <div>
              <h4 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Legal</h4>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Demo Project · Not for production</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#00AEEF', fontWeight: 700, letterSpacing: 1.5 }}>🦅 BARCLAYS</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Hack-O-Hire 2026</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 32, paddingTop: 24, textAlign: 'center', maxWidth: 1200, margin: '32px auto 0' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
            © 2026 CRYPTIX · Team Garud-Drishti · PICT Pune · Sanket Valunj · Avantika Patil · Shreya Magar · Shruti Joshi · Vishvesh Paturkar
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
