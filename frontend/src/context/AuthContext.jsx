import { createContext, useContext, useState, useEffect } from 'react'

const MOCK_USERS = {
  tier1: {
    id: 'U001',
    name: 'Sarah Chen',
    roleLabel: 'Tier 1 Analyst',
    role: 'tier1',
    avatar: 'SC',
    department: 'SOC Operations',
    permissions: {
      canActivateResponse: false,
      canIsolateUser: false,
      canRunPipeline: false,
      canViewReasoning: false,
      canViewPlaybooks: false,
      canAccessAdmin: true,
      canManageUsers: false,
      canViewAuditTrail: false,
      canRunPipelinePage: false
    },
    navItems: [
      'dashboard',
      'incidents',
      'admin'
    ]
  },
  tier2: {
    id: 'U002',
    name: 'testuser',
    roleLabel: 'Incident Responder',
    role: 'tier2',
    avatar: 'TU',
    department: 'SOC Operations',
    permissions: {
      canActivateResponse: true,
      canIsolateUser: true,
      canRunPipeline: false,
      canViewReasoning: true,
      canViewPlaybooks: true,
      canAccessAdmin: true,
      canManageUsers: false,
      canViewAuditTrail: false,
      canRunPipelinePage: false
    },
    navItems: [
      'dashboard',
      'incidents',
      'playbooks',
      'llmreasoning',
      'admin'
    ]
  },
  tier3: {
    id: 'U003',
    name: 'James Okafor',
    roleLabel: 'Threat Hunter',
    role: 'tier3',
    avatar: 'JO',
    department: 'SOC Operations',
    permissions: {
      canActivateResponse: true,
      canIsolateUser: true,
      canRunPipeline: true,
      canViewReasoning: true,
      canViewPlaybooks: true,
      canAccessAdmin: true,
      canManageUsers: false,
      canViewAuditTrail: false,
      canRunPipelinePage: true
    },
    navItems: [
      'dashboard',
      'incidents',
      'playbooks',
      'llmreasoning',
      'pipeline',
      'admin'
    ]
  },
  manager: {
    id: 'U004',
    name: 'Priya Sharma',
    roleLabel: 'SOC Manager',
    role: 'manager',
    avatar: 'PS',
    department: 'SOC Leadership',
    permissions: {
      canActivateResponse: true,
      canIsolateUser: true,
      canRunPipeline: true,
      canViewReasoning: true,
      canViewPlaybooks: true,
      canAccessAdmin: true,
      canManageUsers: true,
      canViewAuditTrail: true,
      canRunPipelinePage: true
    },
    navItems: [
      'dashboard',
      'incidents',
      'playbooks',
      'llmreasoning',
      'pipeline',
      'admin'
    ]
  }
}

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isOnboarded, setIsOnboarded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user_role')
    const storedOnboarding = localStorage.getItem('is_onboarded')
    
    if (storedUser && MOCK_USERS[storedUser]) {
      setUser(MOCK_USERS[storedUser])
      setIsAuthenticated(true)
    }
    
    if (storedOnboarding === 'true') {
      setIsOnboarded(true)
    }
    
    setLoading(false)
  }, [])

  const login = (role) => {
    const userData = MOCK_USERS[role]
    if (userData) {
      setUser(userData)
      setIsAuthenticated(true)
      localStorage.setItem('user_role', role)
    }
  }

  const completeOnboarding = () => {
    setIsOnboarded(true)
    localStorage.setItem('is_onboarded', 'true')
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    setIsOnboarded(false)
    localStorage.removeItem('user_role')
    localStorage.removeItem('is_onboarded')
  }

  const hasPermission = (permission) => {
    if (!user) return false
    return user.permissions[permission] || false
  }

  const hasNavItem = (item) => {
    if (!user) return false
    return user.navItems.includes(item)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isOnboarded,
      loading,
      login,
      logout,
      completeOnboarding,
      hasPermission,
      hasNavItem
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export default AuthContext
