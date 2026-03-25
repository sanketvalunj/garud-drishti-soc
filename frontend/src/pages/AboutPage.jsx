import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Zap, Eye, Users, ArrowRight, Database, Cpu, Monitor, ChevronRight } from 'lucide-react'

// DATA: Replace with GET /api/team when available
const TEAM = [
  { name: 'Sanket Valunj', branch: 'Computer Engineering', role: 'AI/ML', initial: 'S' },
  { name: 'Avantika Patil', branch: 'Computer Engineering', role: 'Backend', initial: 'A' },
  { name: 'Shreya Magar', branch: 'Information Technology', role: 'AI/ML', initial: 'S' },
  { name: 'Shruti Joshi', branch: 'Computer Engineering', role: 'Frontend', initial: 'S' },
  { name: 'Vishvesh Paturkar', branch: 'Computer Engineering', role: 'AI/ML', initial: 'V' },
]

const PROBLEMS = [
  { icon: Zap, title: 'Alert Fatigue', description: 'SOC teams drown in thousands of low-fidelity alerts daily, causing critical threats to be missed or delayed.' },
  { icon: Shield, title: 'Slow Response', description: 'Average incident response takes hours. Every minute of delay increases breach impact exponentially.' },
  { icon: Eye, title: 'Fragmented Visibility', description: 'Disconnected tools create blind spots. Analysts lack unified context across log sources and endpoints.' },
]

const PIPELINE_STEPS = [
  { num: '01', title: 'Log Ingestion', desc: 'Kafka streams + Elasticsearch indexing' },
  { num: '02', title: 'Anomaly Detection', desc: 'UEBA + statistical deviation scoring' },
  { num: '03', title: 'Correlation Engine', desc: 'Entity graph linking across sources' },
  { num: '04', title: 'Fidelity Scoring', desc: 'Bayesian multi-factor risk assessment' },
  { num: '05', title: 'AI Reasoning', desc: 'Multi-agent deliberation via LangGraph' },
  { num: '06', title: 'Response Execution', desc: 'Governance-calibrated containment' },
]

/* ── Animated wave background (reused from Landing) ─── */
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
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '65%', zIndex: 0 }}>
      <path d={generateWavePath(offset, 260, 20, 0.6, 3)} fill="rgba(0,57,93,0.25)" />
      <path d={generateWavePath(offset, 220, 30, 1.1, 1.5)} fill="rgba(0,119,182,0.15)" />
      <path d={generateWavePath(offset, 180, 45, 0.8, 0)} fill="rgba(0,174,239,0.08)" />
    </svg>
  )
}

const px = 'clamp(24px, 8vw, 120px)'

/* ── Shared Navbar ─────────────────────────────────── */
const Navbar = () => (
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
      <Link to="/" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>Home</Link>
      <Link to="/about" style={{ fontSize: 14, fontWeight: 500, color: '#00AEEF', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>About Us</Link>
      <Link to="/services" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>Our Services</Link>
    </nav>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link to="/" style={{
        background: '#00AEEF', color: 'white', borderRadius: 8, padding: '9px 20px', fontSize: 13,
        fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,174,239,0.3)'
      }}>Access Secure Console</Link>
      <span style={{ fontSize: 10, color: '#00AEEF', fontWeight: 700, letterSpacing: 1.5, marginLeft: 16, opacity: 0.7 }}>🦅 BARCLAYS</span>
    </div>
  </header>
)

const AboutPage = () => {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#020B18', color: 'white', minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        minHeight: '60vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', paddingTop: 68
      }}>
        <AnimatedWaves />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 700 }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(0,174,239,0.1)',
              border: '1px solid rgba(0,174,239,0.25)', color: '#00AEEF', fontSize: 11, fontWeight: 700,
              borderRadius: 20, padding: '5px 14px', letterSpacing: 2, marginBottom: 24
            }}>
            TEAM GARUD-DRISHTI
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: -1, margin: 0 }}>
            About <span style={{ color: '#00AEEF' }}>Garud-Drishti</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginTop: 16, lineHeight: 1.6 }}>
            Built for Barclays Hack-O-Hire 2026 · PICT Pune
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginTop: 12, maxWidth: 560, margin: '12px auto 0', lineHeight: 1.7 }}>
            We're building CRYPTIX to transform fragmented security alerts into unified, high confidence incident intelligence -
            enabling banks to shift from reactive monitoring to intelligent, risk-calibrated cyber resilience.
          </motion.p>
        </div>
      </section>

      {/* Team Section */}
      <section style={{ padding: `80px ${px}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>THE TEAM</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Meet the Engineers</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {TEAM.map((m, i) => (
            <motion.div key={m.name} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{
                width: 180, flexShrink: 0, background: 'rgba(0,57,93,0.3)', border: '1px solid rgba(0,174,239,0.15)',
                borderRadius: 16, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #00AEEF, #0077B6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, marginBottom: 14
              }}>
                {m.initial}
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{m.name}</h4>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>{m.branch}</p>
              <span style={{ background: '#00AEEF26', color: '#00AEEF', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{m.role}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem We Solved */}
      <section style={{ padding: `80px ${px}`, background: 'rgba(0,57,93,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>THE CHALLENGE</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Problems We Solved</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
          {PROBLEMS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'rgba(0,57,93,0.3)', border: '1px solid rgba(0,174,239,0.12)', borderRadius: 16, padding: 28 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,174,239,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
              }}>
                <p.icon size={20} color="#00AEEF" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{p.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Our Approach — Pipeline */}
      <section style={{ padding: `80px ${px}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ color: '#00AEEF', fontSize: 11, fontWeight: 700, letterSpacing: 3, display: 'block', marginBottom: 12 }}>OUR APPROACH</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>6-Step Intelligence Pipeline</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>From raw logs to autonomous response</p>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Row 1: Steps 1–3 with dotted connectors */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {PIPELINE_STEPS.slice(0, 3).map((s, i) => (
              <React.Fragment key={s.num}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  style={{ flex: 1, background: 'rgba(0,57,93,0.3)', border: '1px solid rgba(0,174,239,0.15)',
                    borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#00AEEF', marginBottom: 6 }}>{s.num}</div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{s.title}</h4>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                </motion.div>
                {i < 2 && (
                  <div style={{ width: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="48" height="4" style={{ overflow: 'visible' }}>
                      <line x1="2" y1="2" x2="46" y2="2"
                        stroke="rgba(0,174,239,0.55)" strokeWidth="2"
                        strokeDasharray="5 4" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Hook connector: Step 3 (top-right) → Step 4 (bottom-left) */}
          <div style={{ position: 'relative', height: 44 }}>
            <svg
              width="100%" height="44"
              viewBox="0 0 100 44"
              preserveAspectRatio="none"
              style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
            >
              {/*
                Step 3 center ≈ 83.3% of width (center of rightmost card in 3-flex+2×gap layout)
                Step 4 center ≈ 16.7% of width (center of leftmost card)
                Path: drop from step3, curve left at mid, cross to step4, curve down to step4
              */}
              <path
                d="M 83.3,0 L 83.3,14 Q 83.3,22 75.3,22 L 24.7,22 Q 16.7,22 16.7,30 L 16.7,44"
                fill="none"
                stroke="rgba(0,174,239,0.55)"
                strokeWidth="1.8"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Row 2: Steps 4–6, no connectors */}
          <div style={{ display: 'flex', gap: 48 }}>
            {PIPELINE_STEPS.slice(3, 6).map((s, i) => (
              <motion.div key={s.num}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: (i + 3) * 0.1 }}
                style={{ flex: 1, background: 'rgba(0,57,93,0.3)', border: '1px solid rgba(0,174,239,0.15)',
                  borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: '#00AEEF', marginBottom: 6 }}>{s.num}</div>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{s.title}</h4>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: `80px ${px}`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>Ready to explore?</h2>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/')}
          style={{
            background: '#00AEEF', color: 'white', border: 'none', borderRadius: 8,
            padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,174,239,0.35)',
            display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
          }}>
          Explore the Platform <ArrowRight size={16} />
        </motion.button>
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

export default AboutPage
