import { createContext, useContext, useState, useEffect } from 'react'

// API to integrate
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
      'alerts',
      'incidents',
      'activity'
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
      'alerts',
      'incidents',
      'playbooks',
      'llmreasoning',
      'activity'
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
      'alerts',
      'incidents',
      'playbooks',
      'llmreasoning',
      'pipeline',
      'activity'
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
      'alerts',
      'incidents',
      'playbooks',
      'llmreasoning',
      'pipeline',
      'activity'
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
    const storedUser = localStorage.getItem('cryptix_user')
    const token = localStorage.getItem('cryptix_token')
    const storedOnboarding = localStorage.getItem('is_onboarded')

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser))
        setIsAuthenticated(true)
      } catch {
        localStorage.removeItem('cryptix_user')
      }
    } else {
      const legacyRole = localStorage.getItem('user_role')
      if (legacyRole && MOCK_USERS[legacyRole]) {
        setUser(MOCK_USERS[legacyRole])
        setIsAuthenticated(true)
      }
    }

    if (storedOnboarding === 'true') {
      setIsOnboarded(true)
    }

    setLoading(false)
  }, [])

  const login = (userData) => {
    if (userData) {
      const resolvedUser = typeof userData === 'string' ? MOCK_USERS[userData] : userData
      if (!resolvedUser) return
      setUser(resolvedUser)
      setIsAuthenticated(true)
      localStorage.setItem('cryptix_user', JSON.stringify(resolvedUser))
      localStorage.setItem('user_role', resolvedUser.role)
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
    localStorage.removeItem('cryptix_user')
    localStorage.removeItem('cryptix_token')
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
