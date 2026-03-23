import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  Shield, Eye, EyeOff, ChevronRight,
  Lock, User, ShieldAlert,
  Activity, BarChart2, Loader2, CheckCircle2
} from 'lucide-react'

const Login = () => {
  const [selectedRole, setSelectedRole] = useState('tier2')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const navigate = useNavigate()

  const roles = [
    {
      value: 'tier1',
      label: 'Tier 1 Analyst',
      sublabel: 'Triage & Monitoring',
      icon: Activity,
      color: '#15803D',
      description: 'Monitor alerts, triage incidents, escalate to Tier 2'
    },
    {
      value: 'tier2',
      label: 'Tier 2 Analyst',
      sublabel: 'Incident Response',
      icon: ShieldAlert,
      color: '#D97706',
      description: 'Investigate incidents, execute containment, isolate users'
    },
    {
      value: 'tier3',
      label: 'Tier 3 Analyst',
      sublabel: 'Threat Hunting',
      icon: Shield,
      color: '#B91C1C',
      description: 'Hunt threats, manage pipeline, detection engineering'
    },
    {
      value: 'manager',
      label: 'SOC Manager',
      sublabel: 'Command & Control',
      icon: BarChart2,
      color: '#00AEEF',
      description: 'Oversee team, manage users, view reports and audit trail'
    }
  ]

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }
    if (!password.trim()) {
      setError('Please enter a password')
      return
    }
    setError('')
    setIsLoading(true)

    // Simulate auth delay
    await new Promise(resolve => setTimeout(resolve, 1200))

    login(selectedRole)
    setIsLoading(false)
    navigate('/dashboard')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  const selectedRoleData = roles.find(r => r.value === selectedRole)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-color)' }}>
      {/* LEFT PANEL - Hidden on Mobile */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0B1F3B 0%, #0077B6 50%, #00395D 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden'
      }} className="hidden lg:flex">

        {/* Background Decoration */}
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(0,174,239,0.06)',
          top: '-100px',
          right: '-100px'
        }} />
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(0,174,239,0.04)',
          bottom: '-80px',
          left: '-80px'
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#00AEEF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              color: 'white'
            }}>CX</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>CRYPTIX</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>SOC Platform</span>
            </div>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: '16px' }}>
            Autonomous Cyber Incident Response
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '48px', maxWidth: '440px' }}>
            AI-powered threat detection and response for banking infrastructure.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              { icon: Shield, title: 'Multi-Agent AI Analysis', sub: 'Risk, Compliance and Impact agents' },
              { icon: Activity, title: 'Real-time Threat Detection', sub: 'Behavioral deviation scoring' },
              { icon: Lock, title: 'Air-Gapped Architecture', sub: 'Fully offline, SAIA compliant' }
            ].map((point, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(0,174,239,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <point.icon size={16} color="#00AEEF" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{point.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{point.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '48px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#15803D' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>System Operational</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        width: '480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        margin: '0 auto'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-color)', marginBottom: '6px' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Sign in to CRYPTIX SOC Platform
          </p>
        </div>

        {/* Role Selector */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
            Login as
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {roles.map(role => (
              <div
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderRadius: '12px',
                  background: selectedRole === role.value ? `${role.color}10` : 'var(--surface-color)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: selectedRole === role.value
                    ? `1.5px solid ${role.color}60`
                    : '1px solid var(--glass-border)',
                }}
                className="hover:border-[#00AEEF33]"
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: `${role.color}1a`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <role.icon size={13} color={role.color} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-color)' }}>{role.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{role.sublabel}</span>
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '6px' }}>
                  {role.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full h-11 rounded-lg px-9 transition-all"
                style={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-11 rounded-lg px-9 transition-all"
                style={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '8px' }}>
              {error}
            </div>
          )}

          {/* Selected Role Info Bar */}
          <div style={{
            marginTop: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: '8px',
            background: `${selectedRoleData.color}0f`,
            border: `1px solid ${selectedRoleData.color}26`
          }}>
            <selectedRoleData.icon size={14} color={selectedRoleData.color} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: selectedRoleData.color }}>
              Signing in as {selectedRoleData.label}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>·</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {selectedRoleData.sublabel}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: '48px',
              marginTop: '20px',
              background: isLoading ? 'rgba(0,174,239,0.5)' : '#00AEEF',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: !isLoading ? '0 4px 16px rgba(0,174,239,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Demo mode · Select any role to explore
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Any username and password accepted
          </p>
        </div>
      </div>
    </div>
  )
}
export default Login;
