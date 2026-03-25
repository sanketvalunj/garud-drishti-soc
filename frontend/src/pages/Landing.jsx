import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  BarChart2, Shield, Lock, BookOpen, Users,
  Database, Cpu, Monitor, Hand, Zap,
  Activity, ShieldAlert, User, Eye, EyeOff, Loader2, ChevronRight, ChevronDown
} from 'lucide-react';
import AnimatedGradientBg from '../components/AnimatedGradientBg';

// DATA: Replace with API call to /api/platform/info when available
const LANDING_DATA = {
  pillars: [
    {
      id: '01', abbr: 'BFOF',
      title: 'Bayesian Fidelity Orchestration Framework',
      desc: 'Probabilistic risk scoring using multi-factor weighted inference, replacing static severity with quantified risk-based prioritization',
      icon: BarChart2, color: '#00AEEF'
    },
    {
      id: '02', abbr: 'GCAR',
      title: 'Governance-Calibrated Autonomous Response',
      desc: 'Balances automated containment with compliance mandates and business continuity safeguards',
      icon: Lock, color: '#00AEEF'
    },
    {
      id: '03', abbr: 'ITMM',
      title: 'Institutional Threat Memory Matrix',
      desc: 'Applies historical attack graph similarity scoring to recognize evolving or repeat threat patterns',
      icon: BookOpen, color: '#00AEEF'
    },
    {
      id: '04', abbr: 'AADI',
      title: 'Analyst-Augmented Decision Intelligence',
      desc: 'Combines AI reasoning with configurable human oversight across manual, assisted, and autonomous modes',
      icon: Users, color: '#00AEEF'
    }
  ],
  nodes: [
    {
      title: 'Log Storage Node',
      icon: Database, color: '#00AEEF',
      items: ['Elasticsearch', 'Log Indexing', 'Normalized Events', 'Incident History']
    },
    {
      title: 'SOC AI Processing Node',
      icon: Cpu, color: '#00AEEF', badge: 'MAIN BRAIN',
      items: ['Ingestion Engine', 'UEBA Detection', 'Correlation Engine', 'AI Reasoning']
    },
    {
      title: 'Analyst Interface Node',
      icon: Monitor, color: '#00AEEF',
      items: ['FastAPI Backend', 'Web Dashboard', 'Alert Viewer', 'Playbook Interface']
    }
  ],
  modes: [
    { title: 'Manual Mode', icon: Hand, color: '#00AEEF', desc: 'Full analyst control over every decision' },
    { title: 'Assisted Mode', icon: Zap, color: '#00AEEF', desc: 'AI suggests, analyst approves before execution' },
    { title: 'Autonomous Mode', icon: Cpu, color: '#00AEEF', desc: 'AI executes within governance guardrails automatically' }
  ],
  team: [
    { name: "Sanket Valunj", branch: "Computer Engineering", role: "AI/ML", icon: "S" },
    { name: "Avantika Patil", branch: "Computer Engineering", role: "Backend", icon: "A" },
    { name: "Shreya Magar", branch: "Information Technology", role: "AI/ML", icon: "S" },
    { name: "Shruti Joshi", branch: "Computer Engineering", role: "Frontend", icon: "S" },
    { name: "Vishvesh Paturkar", branch: "Computer Engineering", role: "AI/ML", icon: "V" }
  ],
  roles: [
    { value: 'tier1', label: 'Tier 1 Analyst', sublabel: 'Triage & Monitoring', icon: Activity, color: '#00AEEF', description: 'Monitor alerts, triage incidents, escalate to Tier 2' },
    { value: 'tier2', label: 'Tier 2 Analyst', sublabel: 'Incident Response', icon: ShieldAlert, color: '#00AEEF', description: 'Investigate incidents, execute containment, isolate users' },
    { value: 'tier3', label: 'Tier 3 Analyst', sublabel: 'Threat Hunting', icon: Shield, color: '#00AEEF', description: 'Hunt threats, manage pipeline, detection engineering' },
    { value: 'manager', label: 'SOC Manager', sublabel: 'Command & Control', icon: BarChart2, color: '#00AEEF', description: 'Oversee team, manage users, view reports and audit trail' }
  ]
};

// DATA: Tune these for feel — no API replacement needed
const PARTICLE_COUNT_DESKTOP = 150
const PARTICLE_COUNT_MOBILE = 80
const SPRING_STRENGTH = 0.042      // higher = snappier
const DAMPING = 0.82               // lowered slightly to absorb vibration better
const ATTRACT_RADIUS = 500         // px
const REPEL_RADIUS = 45            // px inner dead zone
const ATTRACT_FORCE = 1.8          // cursor pull strength
const TILT_X_STRENGTH = 28         // horizontal field tilt
const TILT_Y_STRENGTH = 18         // vertical field tilt
const CONNECTION_DIST = 120        // px max line distance
const PULSE_RADIUS = 220           // px click wave radius
const PULSE_FORCE = 5.5            // click burst strength

const ThreatCanvas = () => {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const animFrameRef = useRef(null)
  const isPulsingRef = useRef(false)
  const pulseOriginRef = useRef({ x: 0, y: 0 })
  const pulseStartRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // ── RESIZE ─────────────────────────────────────
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    // ── PARTICLE FACTORY ───────────────────────────
    const initParticles = () => {
      const isMobile = window.innerWidth < 768
      const COUNT = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP
      particlesRef.current = []

      for (let i = 0; i < COUNT; i++) {
        // Fake Z depth — random between 0.2 and 1.0
        const z = 0.2 + Math.random() * 0.8

        // Determine particle type
        const rand = Math.random()
        let color, glowColor
        if (rand < 0.65) {
          // Blue — normal network traffic
          color = `rgba(0, 174, 239, ${0.4 + z * 0.5})`
          glowColor = `rgba(0, 174, 239, ${0.08 + z * 0.12})`
        } else if (rand < 0.85) {
          // Ghost white — background noise
          color = `rgba(255, 255, 255, ${0.1 + z * 0.2})`
          glowColor = `rgba(255, 255, 255, ${0.03 + z * 0.05})`
        } else {
          // Red — threat signatures
          color = `rgba(185, 28, 28, ${0.5 + z * 0.4})`
          glowColor = `rgba(185, 28, 28, ${0.08 + z * 0.1})`
        }

        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
          z,
          radius: ((2 + z * 5) * (Math.random() * 0.6 + 0.7)) * 0.34,
          color,
          glowColor,
          driftSpeedX: (Math.random() - 0.5) * 0.030,
          driftSpeedY: (Math.random() - 0.5) * 0.020,
          driftPhaseX: Math.random() * Math.PI * 2,
          driftPhaseY: Math.random() * Math.PI * 2,
          driftRadius: 15 + Math.random() * 35,
        })
        const p = particlesRef.current[particlesRef.current.length - 1]
        p.ox = p.x
        p.oy = p.y
      }
    }

    // ── MOUSE TRACKING ─────────────────────────────
    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    // ── CLICK PULSE ────────────────────────────────
    const onClick = (e) => {
      isPulsingRef.current = true
      pulseOriginRef.current = { x: e.clientX, y: e.clientY }
      pulseStartRef.current = performance.now()
    }

    // ── DRAW SINGLE PARTICLE ───────────────────────
    const drawParticle = (ctx, p) => {
      const glowRadius = p.radius * 4.5
      const grd = ctx.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, glowRadius
      )
      grd.addColorStop(0, p.color)
      grd.addColorStop(0.3, p.glowColor)
      grd.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
    }

    // ── DRAW CONNECTIONS ──────────────────────────
    const drawConnections = (ctx, particles) => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DIST) {
            // Only draw connector lines between larger and smaller dots
            // by enforcing a minimum Z-depth (size) difference
            const isDifferentSize = Math.abs(a.z - b.z) > 0.25;

            if (isDifferentSize) {
              const alpha = (1 - dist / CONNECTION_DIST) * 0.65 * ((a.z + b.z) / 2)
              ctx.beginPath()
              ctx.moveTo(a.x, a.y)
              ctx.lineTo(b.x, b.y)
              ctx.strokeStyle = `rgba(0, 174, 239, ${alpha})`
              ctx.lineWidth = 1.0
              ctx.stroke()
            }
          }
        }
      }
    }

    // ── MAIN ANIMATION LOOP ────────────────────────
    let time = 0

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      time += 0.016

      // Clear with slight trail effect + transparency to see background gradient
      ctx.fillStyle = 'rgba(2, 11, 24, 0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const mouse = mouseRef.current
      const now = performance.now()

      drawConnections(ctx, particlesRef.current)

      particlesRef.current.forEach((p, i) => {
        const driftX = Math.sin(time * p.driftSpeedX * 60 + p.driftPhaseX) * p.driftRadius * 0.3
        const driftY = Math.cos(time * p.driftSpeedY * 60 + p.driftPhaseY) * p.driftRadius * 0.2

        const dynamicOx = p.ox + driftX
        const dynamicOy = p.oy + driftY

        p.vx += (dynamicOx - p.x) * SPRING_STRENGTH
        p.vy += (dynamicOy - p.y) * SPRING_STRENGTH
        p.vx *= DAMPING
        p.vy *= DAMPING

        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < ATTRACT_RADIUS && dist > 1) {
          if (dist < REPEL_RADIUS) {
            // Linear repel - gets weaker as you move toward REPEL_RADIUS
            const repelStrength = (REPEL_RADIUS - dist) / REPEL_RADIUS
            p.vx -= (dx / dist) * repelStrength * 3.5
            p.vy -= (dy / dist) * repelStrength * 3.5
          } else {
            // Attract - fades to 0 exactly at REPEL_RADIUS and ATTRACT_RADIUS
            // to ensure zero jitter/vibration at the boundary
            const range = ATTRACT_RADIUS - REPEL_RADIUS
            const progress = (dist - REPEL_RADIUS) / range
            const smoothForce = Math.sin(progress * Math.PI) * ATTRACT_FORCE
            p.vx += (dx / dist) * smoothForce * p.z
            p.vy += (dy / dist) * smoothForce * p.z
          }
        }

        if (isPulsingRef.current) {
          const elapsed = now - pulseStartRef.current
          const duration = 900
          if (elapsed < duration) {
            const pdx = p.x - pulseOriginRef.current.x
            const pdy = p.y - pulseOriginRef.current.y
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
            if (pdist < PULSE_RADIUS && pdist > 0) {
              const progress = elapsed / duration
              const wave = Math.sin(progress * Math.PI)
              const force = wave * (1 - pdist / PULSE_RADIUS) * PULSE_FORCE
              p.vx += (pdx / pdist) * force
              p.vy += (pdy / pdist) * force
            }
          } else {
            isPulsingRef.current = false
          }
        }

        p.x += p.vx
        p.y += p.vy
        drawParticle(ctx, p)
      })

      if (isPulsingRef.current) {
        const elapsed = now - pulseStartRef.current
        const progress = elapsed / 900
        const ringRadius = progress * PULSE_RADIUS
        const ringAlpha = (1 - progress) * 0.35
        ctx.beginPath()
        ctx.arc(pulseOriginRef.current.x, pulseOriginRef.current.y, ringRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 174, 239, ${ringAlpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      if (mouse.x > 0 && mouse.y > 0) {
        const cursorGrd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80)
        cursorGrd.addColorStop(0, 'rgba(0, 174, 239, 0.06)')
        cursorGrd.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 80, 0, Math.PI * 2)
        ctx.fillStyle = cursorGrd
        ctx.fill()
      }
    }

    resize()
    animate()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0, display: 'block'
      }}
    />
  )
}

const AnimatedStat = ({ end, label, suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>
        {end === 0 && count === 0 ? '0' : count >= end ? end : count.toFixed(end % 1 !== 0 && end !== 0 ? 1 : 0)}{suffix}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>{label}</span>
    </div>
  );
};

const Landing = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedRole, setSelectedRole] = useState('tier2');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1200));

    login(selectedRole);
    setIsLoading(false);
    navigate('/dashboard'); // TODO: Route to role-specific dashboard based on role
  };

  const scrollTo = (id) => {
    setActiveTab(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectedRoleData = LANDING_DATA.roles.find(r => r.value === selectedRole);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'login', 'services', 'about'];
      let current = '';
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el && window.scrollY >= (el.offsetTop - 200)) {
          current = section;
        }
      }
      if (current) setActiveTab(current);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: 'transparent' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <AnimatedGradientBg isLanding={true} />
      </div>
      <style>{`
        @keyframes radar-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes bounce-down {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @keyframes arrow-flow {
          to { stroke-dashoffset: -20; }
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* SECTION 1 — STICKY NAVBAR */}
      {/* PHASE 20%: Navbar, hero text, static sections render */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', height: '64px', zIndex: 100,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        background: 'rgba(2, 11, 24, 0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px'
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#00AEEF', color: 'white', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px'
          }}>CX</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', lineHeight: 1.1 }}>CRYPTIX</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>SOC Platform</span>
          </div>
        </div>

        {/* Center */}
        <div style={{ display: 'flex', gap: '32px' }} className="hidden md:flex">
          {['home', 'login', 'services', 'about'].map((id) => {
            const labels = { home: 'Home', login: 'Login', services: 'Our Services', about: 'About Us' };
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500,
                  color: isActive ? '#00AEEF' : 'rgba(255,255,255,0.6)',
                  textDecoration: isActive ? 'underline' : 'none',
                  textUnderlineOffset: '4px'
                }}
              >
                {labels[id]}
              </button>
            );
          })}
        </div>

      </header>

      {/* SECTION 2 — HERO */}
      <section id="home" style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(to bottom, #00395D 0%, #00395D 50%, rgba(0, 174, 239, 0.15) 80%, var(--bg-color) 100%)'
      }}>

        <ThreatCanvas />

        {/* Hero Text */}
        <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '64px' }}>
          <span style={{
            background: 'rgba(0,174,239,0.1)', border: '1px solid rgba(0,174,239,0.3)',
            color: '#00AEEF', fontSize: '11px', fontWeight: 700, borderRadius: '20px',
            padding: '4px 12px', letterSpacing: '2px', marginBottom: '24px'
          }}>
            BARCLAYS HACK-O-HIRE 2026
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            style={{ fontSize: '72px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0, textShadow: '0 0 120px rgba(0,174,239,0.25), 0 0 40px rgba(0,174,239,0.1)' }}
          >
            CRYPTIX
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)', maxWidth: '600px', lineHeight: 1.6, textAlign: 'center' }}
          >
            The AI Engine for Detecting Hidden Threats
          </motion.p>

          <div style={{ display: 'flex', gap: '48px', marginTop: '40px' }}>
            <AnimatedStat end={99.7} label="Detection Accuracy" suffix="%" />
            <div style={{ width: '1px', borderLeft: '1px solid rgba(255,255,255,0.08)' }} />
            <AnimatedStat end={0.1} label="Avg Response Time" suffix="min" />
            <div style={{ width: '1px', borderLeft: '1px solid rgba(255,255,255,0.08)' }} />
            <AnimatedStat end={3} label="AI Agents" />
            <div style={{ width: '1px', borderLeft: '1px solid rgba(255,255,255,0.08)' }} />
            <AnimatedStat end={0} label="External Data Transfers" />
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => scrollTo('login')}
            style={{
              marginTop: '40px', background: '#00AEEF', color: 'white', borderRadius: '8px',
              padding: '14px 32px', fontSize: '15px', fontWeight: 700, border: 'none',
              cursor: 'pointer', boxShadow: '0 8px 40px rgba(0,174,239,0.35)',
              transition: 'box-shadow 0.3s ease'
            }}
          >
            Access Secure Console →
          </motion.button>
        </div>

        {/* Scroll Indicator */}
        <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '8px' }}>scroll to explore</span>
          <ChevronDown size={16} color="rgba(255,255,255,0.3)" style={{ animation: 'bounce-down 2s infinite' }} />
        </div>
        {/* Fade Overlay to next section */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '128px', pointerEvents: 'none', zIndex: 11 }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, var(--bg-color))', backdropFilter: 'blur(6px)' }} />
        </div>
      </section>

      {/* SECTION 3 — LOGIN */}
      {/* PHASE 100%: Login form functional, auth flow, all animations */}
      <section id="login" style={{
        padding: '100px 24px',
        background: 'linear-gradient(to bottom, var(--bg-color) 0%, rgba(0, 174, 239, 0.05) 50%, var(--bg-color) 100%)',
        width: '100%',
        border: 'none',
        boxShadow: 'none'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h4 style={{ color: '#00AEEF', fontSize: '11px', letterSpacing: '3px', fontWeight: 700, margin: '0 0 12px 0' }}>SECURE ACCESS</h4>
          <h2 style={{ fontSize: '36px', fontWeight: 800, color: 'white', margin: '0' }}>Select your role to continue</h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '8px 0 0 0' }}>Each role provides a purpose-built workspace for your responsibilities</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', maxWidth: '1100px', margin: '0 auto 40px auto' }}>
          {LANDING_DATA.roles.map((role) => {
            const isSelected = selectedRole === role.value;
            return (
              <motion.div
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                animate={{ scale: isSelected ? 1.02 : 1, opacity: isSelected ? 1 : 0.7 }}
                whileHover={{ scale: isSelected ? 1.02 : 1.02, opacity: 1 }}
                style={{
                  padding: '20px', cursor: 'pointer', borderRadius: '12px',
                  background: isSelected ? `${role.color}15` : 'rgba(255,255,255,0.03)',
                  border: isSelected ? `1.5px solid #00AEEF` : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${role.color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <role.icon size={18} color={role.color} />
                  </div>
                  <div>
                    <h4 style={{ color: 'white', fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{role.label}</h4>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>{role.sublabel}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedRole}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ maxWidth: '400px', margin: '0 auto', background: 'rgba(255,255,255,0.02)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '8px', display: 'block' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={14} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={{
                      width: '100%', height: '44px', padding: '0 16px 0 36px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white', fontSize: '14px', outline: 'none'
                    }}
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '8px', display: 'block' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: '100%', height: '44px', padding: '0 40px 0 36px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white', fontSize: '14px', outline: 'none'
                    }}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <div style={{ fontSize: '12px', color: '#B91C1C' }}>{error}</div>}

              {selectedRoleData && (
                <div style={{
                  display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px',
                  borderRadius: '8px', background: `${selectedRoleData.color}15`, border: `1px solid ${selectedRoleData.color}33`, marginTop: '8px'
                }}>
                  <selectedRoleData.icon size={14} color={selectedRoleData.color} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: selectedRoleData.color }}>Signing in as {selectedRoleData.label}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', height: '44px', marginTop: '16px',
                  background: isLoading ? 'rgba(0,174,239,0.5)' : '#00AEEF', color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Authenticating...</>
                ) : (
                  <>Sign In <ChevronRight size={16} /></>
                )}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
        {/* Fade Overlay to services section */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '160px', pointerEvents: 'none', zIndex: 11 }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, var(--bg-color))', backdropFilter: 'blur(8px)' }} />
        </div>
      </section>

      {/* SECTION 4 — OUR SERVICES */}
      <section id="services" style={{
        padding: '100px 24px',
        background: 'linear-gradient(to bottom, var(--bg-color), transparent)',
        position: 'relative',
        width: '100%',
        margin: '0',
        zIndex: 1
      }}>
        <h4 style={{ color: '#00AEEF', fontSize: '11px', letterSpacing: '3px', fontWeight: 700, margin: '0 0 12px 0' }}>OUR SERVICES</h4>
        <h2 style={{ fontSize: '36px', fontWeight: 800, color: 'white', margin: '0' }}>Enterprise-Grade Cyber Defense</h2>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '8px 0 60px 0' }}>Four strategic innovation pillars powering CRYPTIX</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {LANDING_DATA.pillars.map((pillar, i) => (
            <motion.div
              key={pillar.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ borderColor: `#00AEEF` }}
              style={{
                background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px',
                position: 'relative', transition: 'border-color 0.3s ease'
              }}
            >
              <div style={{ position: 'absolute', top: '28px', right: '28px' }}>
                <span style={{ background: `${pillar.color}26`, color: pillar.color, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>
                  {pillar.abbr}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', background: `${pillar.color}26`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <pillar.icon size={16} color="white" />
                </div>
                <span style={{ color: pillar.color, fontSize: '11px', fontWeight: 700 }}>{pillar.id}</span>
              </div>
              <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 12px 0' }}>{pillar.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{pillar.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* 3-Node Architecture */}
        <div style={{ marginTop: '80px' }}>
          <h3 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', textAlign: 'center' }}>3-Node Distributed Architecture</h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 40px 0', textAlign: 'center' }}>Optimized for security and scale</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', alignItems: 'center' }}>
            {LANDING_DATA.nodes.map((node, i) => (
              <React.Fragment key={node.title}>
                <motion.div
                  whileHover={{ borderColor: '#00AEEF' }}
                  style={{
                    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px', padding: '24px', minWidth: '220px', flex: '1 1 250px', position: 'relative',
                    transition: 'border-color 0.3s ease'
                  }}
                >
                  {node.badge && (
                    <span style={{ position: 'absolute', top: '-10px', right: '20px', background: node.badge === 'MAIN BRAIN' ? '#D97706' : node.color, color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                      {node.badge}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${node.color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <node.icon size={20} color="white" />
                    </div>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{node.title}</span>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {node.items.map(item => (
                      <li key={item} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: node.color }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                {i < LANDING_DATA.nodes.length - 1 && (
                  <svg className="hidden lg:block" width="80" height="24" viewBox="0 0 80 24" style={{ flexShrink: 0 }}>
                    <line x1="0" y1="12" x2="70" y2="12" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 4" style={{ animation: 'arrow-flow 1s linear infinite' }} />
                    <polygon points="70,8 80,12 70,16" fill="rgba(255,255,255,0.5)" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Execution Modes */}
        <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {LANDING_DATA.modes.map((mode, i) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${mode.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <mode.icon size={20} color="white" />
              </div>
              <div>
                <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{mode.title}</h4>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>{mode.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 5 — ABOUT US */}
      <section id="about" style={{ padding: '100px 24px', background: 'transparent', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h4 style={{ color: '#00AEEF', fontSize: '11px', letterSpacing: '3px', fontWeight: 700, margin: '0 0 12px 0' }}>ABOUT US</h4>
          <h2 style={{ fontSize: '36px', fontWeight: 800, color: 'white', margin: '0' }}>Built by Garud-Drishti</h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '8px 0 0 0' }}>A team of aspiring engineers from PICT, Pune - built for Barclays Hack-O-Hire 2026</p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {LANDING_DATA.team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              style={{
                width: '200px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}
            >
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #00AEEF 0%, #0077B6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', fontWeight: 'bold', marginBottom: '16px'
              }}>
                {member.icon}
              </div>
              <h4 style={{ color: 'white', fontSize: '15px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{member.name}</h4>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 12px 0' }}>{member.branch}</p>
              <span style={{ background: '#00AEEF26', color: '#00AEEF', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                {member.role}
              </span>
            </motion.div>
          ))}
        </div>

        <div style={{ marginTop: '60px', maxWidth: '700px', margin: '60px auto 0 auto' }}>
          <p style={{
            fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontStyle: 'italic',
            borderLeft: '3px solid #00AEEF', paddingLeft: '24px', margin: 0
          }}>
            "CRYPTIX transforms fragmented security alerts into unified, high-confidence incident intelligence - enabling banks to shift from reactive monitoring to intelligent, risk-calibrated cyber resilience."
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          CRYPTIX · Barclays Hack-O-Hire 2026 · Team Garud-Drishti · PICT Pune
        </p>
      </footer>
    </div>
  );
};

export default Landing;
