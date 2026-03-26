import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutGrid,
  ShieldAlert,
  BookOpen,
  GitBranch,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BrainCircuit
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import ThemeToggle from '../ui/ThemeToggle'
import { useState, Fragment } from 'react'

const Sidebar = () => {
  const { user, logout, hasNavItem } = useAuth()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    {
      id: 'dashboard',
      path: '/dashboard',
      icon: LayoutGrid,
      label: 'Dashboard',
      description: 'System Overview'
    },
    {
      id: 'incidents',
      path: '/incidents',
      icon: ShieldAlert,
      label: 'Incidents',
      description: 'Threat Queue'
    },
    {
      id: 'playbooks',
      path: '/playbooks',
      icon: BookOpen,
      label: 'Playbooks',
      description: 'Response logic'
    },
    {
      id: 'llmreasoning',
      path: '/llm-reasoning',
      icon: BrainCircuit,
      label: 'AI Reasoning',
      description: 'Agent Logs'
    },
    {
      id: 'pipeline',
      path: '/pipeline',
      icon: GitBranch,
      label: 'AI Pipeline',
      description: 'Decision flow'
    },
    {
      id: 'activity',
      path: '/activity',
      icon: Settings,
      label: 'My Activity',
      description: 'Performance Metrics'
    }
  ]

  // Filter based on user permissions
  const visibleNavItems = navItems.filter(item => hasNavItem(item.id))

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      style={{
        height: '100vh',
        background: 'linear-gradient(180deg, #00395d 0%, #021425 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 50,
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
        borderRight: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      {/* Logo Section */}
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: isCollapsed ? 'column' : 'row',
        alignItems: 'center',
        gap: isCollapsed ? '16px' : '12px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isCollapsed ? 'auto' : '100%' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: '#00AEEF',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            flexShrink: 0
          }}>CX</div>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <span style={{ color: 'white', fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em', lineHeight: 1.2 }}>CRYPTIX</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 500 }}>SOC Platform</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>v2.4.9</span>
            </motion.div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: isCollapsed ? 'relative' : 'absolute',
            right: isCollapsed ? 'auto' : '16px',
            top: isCollapsed ? 'auto' : '30px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'transparent',
            border: '0.7px solid white',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'none',
            zIndex: 60,
            flexShrink: 0
          }}
          className="hover:bg-white/10 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
        </button>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visibleNavItems.map((item, index) => (
            <Fragment key={item.path}>
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '10px',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent'
                })}
                className="hover:bg-white/[0.05]"
              >
                <item.icon size={20} strokeWidth={isCollapsed ? 2.5 : 2} />
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '-2px' }}>{item.description}</span>
                  </div>
                )}
              </NavLink>
              {index < visibleNavItems.length - 1 && (
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 12px' }} />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Footer / User Info */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <ThemeToggle />
      </div>
    </motion.div>
  )
}

export default Sidebar
