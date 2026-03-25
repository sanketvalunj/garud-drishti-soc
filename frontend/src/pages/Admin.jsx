import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Settings, 
  Users, 
  Activity, 
  Lock, 
  Database,
  GitBranch,
  FileText,
  AlertTriangle,
  Clock,
  ChevronRight,
  UserPlus,
  ArrowUpRight,
  Search,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Terminal,
  Play,
  ShieldAlert
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import clsx from 'clsx'

const Admin = () => {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ─── TIER 1: TRIAGE CENTER ────────────────────────────────────
  const TriageCenter = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Triage Time', value: '4.2m', trend: '-12%', icon: Clock, color: '#00AEEF' },
          { label: 'Queue Depth', value: '18', trend: '+3', icon: AlertTriangle, color: '#D97706' },
          { label: 'False Positive %', value: '2.4%', trend: '-0.5%', icon: CheckCircle2, color: '#15803D' },
          { label: 'Escalation Rate', value: '12%', trend: '+1%', icon: ArrowUpRight, color: '#B91C1C' }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex justify-between items-start mb-2">
              <div style={{ background: `${stat.color}15`, padding: '8px', borderRadius: '8px' }}>
                <stat.icon size={20} color={stat.icon === Clock ? '#00AEEF' : stat.color} />
              </div>
              <span className={clsx("text-xs font-bold", stat.trend.startsWith('-') ? "text-green-500" : "text-amber-500")}>
                {stat.trend}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>{stat.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card">
          <div className="p-4 border-b border-[var(--glass-border)] flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Activity size={18} color="#00AEEF" /> Incident Queue
            </h3>
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 bg-blue-500 text-white rounded">High Priority Only</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ color: 'var(--text-muted)' }} className="text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Incident</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Brute force on ATM-041', priority: 'High', status: 'Triaging', time: '2m ago' },
                  { name: 'Malware signal - Branch 12', priority: 'Medium', status: 'Pending', time: '8m ago' },
                  { name: 'Excessive API requests', priority: 'Low', status: 'Triaging', time: '14m ago' }
                ].map((row, i) => (
                  <tr key={i} className="border-t border-[var(--glass-border)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-4">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{row.time}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx("px-2 py-1 rounded-full text-[10px] font-bold uppercase", 
                        row.priority === 'High' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                      )}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs">{row.status}</td>
                    <td className="px-4 py-4">
                      <button className="text-blue-400 hover:text-blue-300">Escalate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card flex flex-col">
          <div className="p-4 border-b border-[var(--glass-border)]">
            <h3 className="font-bold">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-3 flex-1">
            <button className="w-full p-3 rounded-xl border border-[var(--glass-border)] hover:border-blue-500/50 flex items-center gap-3 text-left transition-all">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><AlertTriangle size={18} /></div>
              <div>
                <div className="text-xs font-bold">Declare Global Incident</div>
                <div className="text-[10px] text-[var(--text-muted)]">Mass escalation to Tier 2/3</div>
              </div>
            </button>
            <button className="w-full p-3 rounded-xl border border-[var(--glass-border)] hover:border-blue-500/50 flex items-center gap-3 text-left transition-all">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><Users size={18} /></div>
              <div>
                <div className="text-xs font-bold">Handover Briefing</div>
                <div className="text-[10px] text-[var(--text-muted)]">Generate report for next shift</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── TIER 2: RESPONSE CENTER ──────────────────────────────────
  const ResponseCenter = () => (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-[var(--glass-border)]">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <ShieldAlert size={22} className="text-amber-500" /> Active Containment Operations
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-bold mb-4 uppercase tracking-tighter text-[var(--text-muted)]">Suspicious Users (Isolation Required)</h3>
            <div className="space-y-4">
              {[
                { user: 'j.smith_branch01', risk: 88, reason: 'Credential Stuffing pattern', country: 'RU' },
                { user: 'legacy_svc_atm', risk: 94, reason: 'Outbound C2 connection', country: 'CN' }
              ].map((su, i) => (
                <div key={i} className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 flex justify-between items-center">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center font-bold text-orange-500">
                      {su.risk}
                    </div>
                    <div>
                      <div className="font-bold">{su.user}</div>
                      <div className="text-xs text-orange-500/70">{su.reason}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/admin')}
                    className="bg-[var(--glass-border)] text-[var(--text-secondary)] px-4 py-2 rounded-lg text-xs font-bold border border-[var(--glass-border)] hover:border-blue-500/50 transition-all uppercase"
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
            <h3 className="text-sm font-bold mb-4 uppercase tracking-tighter text-[var(--text-muted)]">Response Metrics (Real-time)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <div className="text-2xl font-bold">1.2m</div>
                <div className="text-xs text-blue-400 font-bold uppercase">Containment MTTR</div>
              </div>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                <div className="text-2xl font-bold">98%</div>
                <div className="text-xs text-green-500 font-bold uppercase">Success Rate</div>
              </div>
            </div>
            
            <div className="p-5 glass-card">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold uppercase">System Defensive Load</span>
                <span className="text-xs font-bold text-blue-400">42%</span>
              </div>
              <div className="h-2 w-full bg-gray-500/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '42%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── TIER 3: OPERATIONS CENTER ────────────────────────────────
  const OperationsCenter = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <GitBranch size={20} color="#00AEEF" /> Pipeline Controller
            </h3>
            <span className="text-xs font-bold px-2 py-1 bg-green-500/10 text-green-500 rounded uppercase">Engine V4.2</span>
          </div>
          <div className="space-y-5">
            {[
              { label: 'ML Signal Enrichment', status: 'Nominal', load: 14 },
              { label: 'Graph-DB Persistence', status: 'Nominal', load: 8 },
              { label: 'Vector Similarity Engine', status: 'Nominal', load: 32 },
              { label: 'LLM Reasoning Pool', status: 'High Load', load: 88, critical: true }
            ].map((p, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{p.label}</span>
                  <span className={clsx("font-bold", p.critical ? "text-amber-500" : "text-green-500")}>{p.status}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-500/10 rounded-full overflow-hidden">
                  <div className={clsx("h-full", p.critical ? "bg-amber-500" : "bg-[#00AEEF]")} style={{ width: `${p.load}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <button className="flex-1 py-3 bg-[#00AEEF] text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">Purge Vector Cache</button>
            <button className="flex-1 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Emergency Kill Switch</button>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <Terminal size={20} color="#00AEEF" /> Detection Engineering
            </h3>
          </div>
          <div className="flex-1 bg-black/40 rounded-xl p-4 font-mono text-[11px] text-gray-400 space-y-2 mb-4">
            <div><span className="text-green-500">PROMPT_ENGINEER</span>: Loading rule_id_1028...</div>
            <div>[OK] Syntax check passed.</div>
            <div>[INFO] Deployed to Edge-Node-04.</div>
            <div className="text-white">root@detection:~$ _</div>
          </div>
          <div className="flex gap-2">
            <input type="text" className="flex-1 bg-gray-500/5 border border-white/5 rounded-lg px-4 py-2 text-xs" placeholder="Deploy quick-surveillance rule..." />
            <button className="bg-[#00AEEF] p-2 rounded-lg text-white"><Play size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── MANAGER: COMMAND CENTER ──────────────────────────────────
  const CommandCenter = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-l-[#00AEEF]">
          <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-4">Shift Performance</h3>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold">94.2</div>
            <div className="text-xs text-green-500 font-bold mb-1">+4.2%</div>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase mt-2">Team Efficiency Index</div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-4">Personnel Status</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">
                SC
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border border-dashed border-white/10 flex items-center justify-center text-xs text-[var(--text-muted)]">
              +2
            </div>
          </div>
          <div className="text-[10px] uppercase mt-4 text-green-500 font-bold flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 6 Online
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-4">Audit Compliance</h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-[3px] border-[#00AEEF]/20 border-t-[#00AEEF] flex items-center justify-center text-xs font-bold">
              100%
            </div>
            <div>
              <div className="text-xs font-bold">All reports signed</div>
              <div className="text-[10px] text-[var(--text-muted)]">Session audit logs verified</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
           <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold">Team Management</h3>
            <button className="text-xs font-bold text-[#00AEEF] flex items-center gap-1 hover:underline">
               <UserPlus size={14} /> Add Operator
            </button>
          </div>
          <div className="space-y-4">
             {[
               { name: 'Sarah Chen', role: 'Tier 1 Analyst', load: 'Light', status: 'Online' },
               { name: 'James Okafor', role: 'Tier 3 Analyst', load: 'Heavy', status: 'Online' },
               { name: 'Marcus Wong', role: 'Tier 2 Analyst', load: 'Oversight', status: 'Offline' }
             ].map((op, i) => (
               <div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all">
                 <div className="flex gap-3 items-center">
                   <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center text-[10px] font-bold">{op.name.split(' ').map(n=>n[0]).join('')}</div>
                   <div>
                     <div className="text-sm font-semibold">{op.name}</div>
                     <div className="text-[10px] text-[var(--text-muted)]">{op.role}</div>
                   </div>
                 </div>
                 <div className="text-right">
                    <div className={clsx("text-[10px] font-bold uppercase", op.status === 'Online' ? 'text-green-500' : 'text-gray-500')}>{op.status}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{op.load} Load</div>
                 </div>
               </div>
             ))}
          </div>
        </div>

        <div className="glass-card p-5">
           <h3 className="font-bold mb-6">Security Audit Trail</h3>
           <div className="space-y-4">
              {[
                { actor: 'J. Okafor', action: 'ISOLATION_CANCEL', target: 'legacy_svc_atm', time: '4m ago' },
                { actor: 'S. Chen', action: 'INCIDENT_ESCALATE', target: 'INC-2024-04', time: '12m ago' },
                { actor: 'P. Sharma', action: 'PERM_MGR_UPDATE', target: 'M. Wong', time: '1h ago' },
                { actor: 'System', action: 'VECTOR_DB_PURGE', target: 'GlobalCache', time: '2h ago' }
              ].map((trail, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs">
                       <span className="font-bold text-[#00AEEF]">{trail.actor}</span>
                       <span className="mx-1 text-[var(--text-muted)]">executed</span>
                       <span className="font-bold text-[var(--text-color)]">{trail.action}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">Target: {trail.target} · {trail.time}</div>
                  </div>
                </div>
              ))}
           </div>
           <button className="w-full mt-6 py-2 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-widest text-[#00AEEF] hover:bg-blue-500 hover:text-white transition-all">Download Full Audit Report (CSV)</button>
        </div>
      </div>
    </div>
  )

  // ─── RENDER LOGIC ─────────────────────────────────────────────

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Settings size={28} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-color)' }}>
              {user?.role === 'tier1' && 'Triage Center'}
              {user?.role === 'tier2' && 'Response Center'}
              {user?.role === 'tier3' && 'Operations Center'}
              {user?.role === 'manager' && 'Command Center'}
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="font-medium">
            Authorized: {user?.name} · {user?.roleLabel}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-500">System Live</span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">LATENCY: 12ms</span>
          </div>
        </div>
      </header>

      {/* Role-Specific Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {user?.role === 'tier1' && <TriageCenter />}
        {user?.role === 'tier2' && <ResponseCenter />}
        {user?.role === 'tier3' && <OperationsCenter />}
        {user?.role === 'manager' && <CommandCenter />}
      </motion.div>

      {/* Shared Footer Log Section */}
      <div className="glass-card">
         <div className="p-4 border-b border-[var(--glass-border)] flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
               <Database size={14} /> System Access Log
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">LOG_LEVEL: VERBOSE</span>
         </div>
         <div className="p-4 font-mono text-[10px] text-[var(--text-muted)] space-y-1">
            <div>[00:00:01] <span className="text-green-500">AUTH_SUCCESS</span>: Session initialized for {user?.name} ({user?.role})</div>
            <div>[00:00:02] <span className="text-blue-500">INFO</span>: Loading {user?.role}-specific modules...</div>
            <div>[00:00:03] <span className="text-blue-500">INFO</span>: Synchronizing with vector storage...</div>
            <div>[00:00:04] <span className="text-green-500">READY</span>: Interface operational.</div>
         </div>
      </div>
    </div>
  )
}

export default Admin
