import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart2, Lock, BookOpen, Users, Shield, Zap, Database, Cpu, Monitor,
  ArrowRight, CheckCircle, Hand, ChevronRight
} from 'lucide-react'

// DATA: Replace with GET /api/services when available
const PILLARS = [
  {
    abbr: 'BFOF', title: 'Bayesian Fidelity Orchestration Framework', color: '#00AEEF', icon: BarChart2,
    desc: 'Probabilistic risk scoring using multi-factor weighted inference, replacing static severity with quantified risk-based prioritization.',
    howItWorks: ['Ingest alert + entity metadata from SIEM', 'Compute behavioral deviation score via UEBA', 'Weight by asset criticality and historical similarity', 'Produce 0–1 fidelity score with SHAP explainability']
  },
  {
    abbr: 'SAIA', title: 'Sovereign Air-Gapped Intelligence Architecture', color: '#00AEEF', icon: Shield,
    desc: 'All AI reasoning runs entirely within your infrastructure via Ollama-hosted LLMs. Zero cloud APIs. Zero data exfiltration risk.',
    howItWorks: ['Deploy Ollama with Mistral/Llama models on-premise', 'Route all LLM calls through local inference server', 'Encrypt model artifacts at rest', 'Generate audit trail for every AI decision']
  },
  {
    abbr: 'GCAR', title: 'Governance-Calibrated Autonomous Response', color: '#00AEEF', icon: Lock,
    desc: 'Balances automated containment with compliance mandates and business continuity safeguards.',
    howItWorks: ['Multi-agent vote: Risk + Compliance + Business Impact', 'Check governance guardrails before execution', 'Execute containment within approved playbook bounds', 'Log every action to immutable audit trail']
  },
  {
    abbr: 'ITMM', title: 'Institutional Threat Memory Matrix', color: '#00AEEF', icon: BookOpen,
    desc: 'Applies historical attack graph similarity scoring to recognize evolving or repeat threat patterns.',
    howItWorks: ['Index all historical incidents as graph signatures', 'Compute similarity against incoming attack chains', 'Flag repeat patterns and escalate accordingly', 'Feed learnings back into detection models']
  },
  {
    abbr: 'AADI', title: 'Analyst-Augmented Decision Intelligence', color: '#00AEEF', icon: Users,
    desc: 'Combines AI reasoning with configurable human oversight across manual, assisted, and autonomous modes.',
    howItWorks: ['Present AI recommendations with confidence scores', 'Analyst reviews and approves/rejects/modifies', 'System learns from analyst feedback over time', 'Configurable automation levels per incident type']
  },
]

const NODES = [
  { title: 'Log Storage Node', icon: Database, color: '#00AEEF',
    items: ['Elasticsearch cluster', 'Log indexing & normalization', 'Event deduplication', 'Incident history store'] },
  { title: 'SOC AI Processing Node', icon: Cpu, color: '#D97706', badge: 'MAIN BRAIN',
    items: ['Ingestion Engine (Kafka)', 'UEBA Detection (PyOD, tsfresh)', 'Correlation Engine (graph)', 'AI Reasoning (LangGraph + Ollama)'] },
  { title: 'Analyst Interface Node', icon: Monitor, color: '#15803D',
    items: ['FastAPI Backend', 'React Web Dashboard', 'Alert Viewer & Triage', 'Playbook Interface'] },
]

const MODES = [
  { title: 'Manual Mode', icon: Hand, color: '#00AEEF', desc: 'Full analyst control. AI provides recommendations but takes no action. Best for high-stakes incidents requiring human judgment.',
    when: 'Critical financial data incidents, regulatory-sensitive situations' },
  { title: 'Assisted Mode', icon: Zap, color: '#0077B6', desc: 'AI suggests containment actions and drafts playbook steps. Analyst approves before execution. Best balance of speed and oversight.',
    when: 'Standard security incidents, known attack patterns' },
  { title: 'Autonomous Mode', icon: Cpu, color: '#005A8E', desc: 'AI executes within pre-approved governance guardrails automatically. Human review happens post-action. Fastest response time.',
    when: 'High-volume low-risk alerts, after-hours automated response' },
]

const TECH = [
  'FastAPI', 'Kafka', 'Elasticsearch', 'Redis', 'PostgreSQL',
  'Ollama', 'LangChain', 'LangGraph', 'HuggingFace',
  'React', 'tsfresh', 'PyOD', 'Scikit-learn', 'Docker'
]

/* ── Wave bg ─────────────────────────────────────── */
const generateWavePath = (time, baseline, amplitude, freq, phase) => {
  const points = []
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * 1440
    const y = baseline + amplitude * Math.sin((i / 20) * Math.PI * 2 * freq + time * 0.5 + phase)
    points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`)
  }
  points.push('L1440,420 L0,420 Z')
  return points.join(' ')
}
const AnimatedWaves = () => {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let frame, start = null
    const animate = (ts) => { if (!start) start = ts; setOffset((ts - start) / 1000); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '65%', zIndex: 0 }}>
      <path d={generateWavePath(offset, 260, 20, 0.6, 3)} fill="rgba(0,57,93,0.25)" />
      <path d={generateWavePath(offset, 220, 30, 1.1, 1.5)} fill="rgba(0,119,182,0.15)" />
      <path d={generateWavePath(offset, 180, 45, 0.8, 0)} fill="rgba(0,174,239,0.08)" />
    </svg>
  )
}

const px = 'clamp(24px, 8vw, 120px)'

const Navbar = () => (
  <header style={{
    position: 'fixed', top: 0, width: '100%', height: 68, zIndex: 100,
    background: 'rgba(2,11,24,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    borderBottom: '1px solid rgba(0,174,239,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `0 ${px}`, boxSizing: 'border-box'
  }}>
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#00AEEF', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>CX</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>CRYPTIX</span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>SOC Platform</span>
      </div>
    </Link>
    <nav style={{ display: 'flex', gap: 8 }}>
      <Link to="/" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>Home</Link>
      <Link to="/about" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>About Us</Link>
      <Link to="/services" style={{ fontSize: 14, fontWeight: 500, color: '#00AEEF', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>Our Services</Link>
    </nav>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link to="/" style={{ background: '#00AEEF', color: 'white', borderRadius: 8, padding: '9px 20px', fontSize: 13,
        fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,174,239,0.3)' }}>Access Secure Console</Link>
      <span style={{ fontSize: 10, color: '#00AEEF', fontWeight: 700, letterSpacing: 1.5, marginLeft: 16, opacity: 0.7 }}>🦅 BARCLAYS</span>
    </div>
  </header>
)

const ServicesPage = () => {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#020B18', color: 'white', minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <section style={{ minHeight: '60vh', position: 'relative', overflow: 'hidden', display: 'flex',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 68 }}>
        <AnimatedWaves />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 700 }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(0,174,239,0.1)',
              border: '1px solid rgba(0,174,239,0.25)', color: '#00AEEF', fontSize: 11, fontWeight: 700,
              borderRadius: 20, padding: '5px 14px', letterSpacing: 2, marginBottom: 24 }}>
            PLATFORM CAPABILITIES
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: -1, margin: 0 }}>
            Our <span style={{ color: '#00AEEF' }}>Services</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginTop: 16 }}>
            Five strategic innovation pillars
          </motion.p>
        </div>
      </section>

      {/* Pillar Cards */}
      <section style={{ padding: `80px ${px}` }}>
        {PILLARS.map((p, idx) => (
          <motion.div key={p.abbr} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
            style={{ background: 'rgba(0,57,93,0.3)', border: `1px solid ${p.color}33`, borderRadius: 20,
              padding: 36, marginBottom: 24, maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32 }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${p.color}26`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.icon size={20} color={p.color} />
                  </div>
                  <span style={{ background: `${p.color}26`, color: p.color, fontSize: 11, fontWeight: 700,
                    padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>{p.abbr}</span>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>{p.title}</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
              </div>
              <div style={{ flex: '0 0 320px' }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 12, marginTop: 0, letterSpacing: 1 }}>HOW IT WORKS</h4>
                {p.howItWorks.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${p.color}26`, color: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* 3-Node Architecture */}
      <section style={{ padding: `80px ${px}`, background: 'rgba(0,57,93,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>ARCHITECTURE</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>3-Node Distributed Architecture</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Optimized for security, scale, and sovereignty</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
          {NODES.map((n, i) => (
            <React.Fragment key={n.title}>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                style={{ background: 'rgba(0,57,93,0.4)', border: `1px solid ${n.color}33`, borderRadius: 16,
                  padding: 24, flex: '1 1 280px', position: 'relative' }}>
                {n.badge && <span style={{ position: 'absolute', top: -10, right: 20, background: '#D97706', color: 'white',
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{n.badge}</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${n.color}26`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <n.icon size={20} color={n.color} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{n.title}</span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {n.items.map(item => (
                    <li key={item} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: n.color }} />{item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              {i < NODES.length - 1 && (
                <svg width="60" height="24" viewBox="0 0 60 24" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="12" x2="50" y2="12" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 4" />
                  <polygon points="50,8 60,12 50,16" fill="rgba(255,255,255,0.4)" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Execution Modes */}
      <section style={{ padding: `80px ${px}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>EXECUTION MODES</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Three Levels of Autonomy</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          {MODES.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'rgba(0,57,93,0.3)', border: `1px solid ${m.color}33`, borderRadius: 16, padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${m.color}26`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <m.icon size={22} color={m.color} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{m.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 16px' }}>{m.desc}</p>
              <div style={{ background: 'rgba(2,11,24,0.5)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                <span style={{ color: m.color, fontWeight: 700 }}>Best for: </span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{m.when}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section style={{ padding: `80px ${px}`, background: 'rgba(0,57,93,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>TECHNOLOGY</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Tech Stack</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 800, margin: '0 auto' }}>
          {TECH.map(t => (
            <motion.div key={t} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              style={{ background: 'rgba(0,57,93,0.4)', border: '1px solid rgba(0,174,239,0.15)', borderRadius: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t}</motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: `80px ${px}`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Ready to see it in action?</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Experience the full CRYPTIX platform</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/')}
            style={{ background: '#00AEEF', color: 'white', border: 'none', borderRadius: 8,
              padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(0,174,239,0.35)' }}>
            Access Secure Console <ArrowRight size={16} style={{ marginLeft: 8, verticalAlign: 'middle' }} />
          </motion.button>
          <button onClick={() => navigate('/about')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, padding: '14px 24px', fontSize: 15, cursor: 'pointer' }}>
            Learn About Our Team
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#020B18', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
          © 2026 CRYPTIX · Team Garud-Drishti · PICT Pune · Sanket Valunj · Avantika Patil · Shreya Magar · Shruti Joshi · Vishvesh Paturkar
        </p>
      </footer>
    </div>
  )
}

export default ServicesPage
