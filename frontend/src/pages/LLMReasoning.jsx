import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import {
  ShieldAlert, Scale, TrendingUp,
  Check, X, ChevronDown, CheckCircle2,
  Database, FileText, Hash, Cpu, Wifi,
  Search, Brain
} from 'lucide-react'

// ─────────────────────────────────────
// API INTEGRATION:
// When backend is ready replace
// handleSearch with:
//
// const handleSearch = async () => {
//   setHasSearched(true)
//   setLoading(true)
//   try {
//     const data = await 
//       api.getReasoning(searchQuery)
//     setReasoning(data)
//     setNotFound(false)
//   } catch (err) {
//     setNotFound(true)
//   } finally {
//     setLoading(false)
//   }
// }
//
// API endpoint: GET /reasoning/:incidentId
// ─────────────────────────────────────

// API to integrate
const ALL_MOCK_REASONING = {
  'INC-2091': {
    incidentId: 'INC-2091',
    attackType: 'Privilege Escalation',
    model: 'Llama 3.1 8B',
    mode: 'offline',
    vectorDb: 'FAISS offline index',
    eventsProcessed: 847,
    incidentObjectTokens: 2847,
    status: 'complete',
    orchestratorTrace: [
      {
        phase: 'ORCHESTRATOR — LangGraph',
        color: '#00AEEF',
        lines: [
          'Incident INC-2091 received.',
          'Pipeline processed 847 events →',
          'extracted structured incident object.',
          'Incident object: 2,847 tokens.',
          'Dispatching to 3 agents...'
        ],
        duration: '0.04s'
      },
      {
        phase: 'RISK AGENT — started',
        color: '#B91C1C',
        lines: [
          'Analyzing incident object...',
          'Behavioral deviation: 0.91',
          'Asset criticality: 0.89',
          '',
          'Techniques evaluated:',
          '✓ T1078 Valid Accounts: 0.87',
          '✓ T1059 Command Scripting: 0.91',
          '✓ T1068 Privilege Escalation: 0.84',
          '✗ T1055 Process Injection: 0.52 — rejected',
          '✗ T1027 Obfuscation: 0.41 — rejected',
          '',
          'Technical severity: 0.91',
          'Vote: CONTAIN IMMEDIATELY'
        ],
        duration: '3.2s'
      },
      {
        phase: 'COMPLIANCE AGENT — started',
        color: '#D97706',
        lines: [
          'Checking regulatory scope...',
          'PCI-DSS controls: triggered',
          'SWIFT dual-control bypass: detected',
          'FCA notification window: 6 hours',
          '',
          '✓ Data breach notification required',
          '✓ Audit trail must be preserved',
          '✗ GDPR breach threshold: not yet met',
          '',
          'Compliance risk: 0.84',
          'Vote: CONTAIN + PRESERVE EVIDENCE'
        ],
        duration: '2.8s'
      },
      {
        phase: 'BUSINESS IMPACT AGENT — started',
        color: '#15803D',
        lines: [
          'Evaluating asset criticality...',
          'swift-terminal → CRITICAL',
          'core-banking → CRITICAL',
          '',
          'Fraud exposure: $4.8M estimated',
          'Containment outage cost: $120K',
          'Net: CONTAIN — accept downtime',
          '',
          'Business impact: 0.79',
          'Vote: CONTAIN — ACCEPT DOWNTIME'
        ],
        duration: '2.4s'
      },
      {
        phase: 'VOTING ENGINE',
        color: '#00AEEF',
        lines: [
          'Aggregating agent votes...',
          '',
          '(0.91 × 0.50) = 0.455  [Risk]',
          '(0.84 × 0.30) = 0.252  [Compliance]',
          '(0.79 × 0.20) = 0.158  [Impact]',
          '─────────────────────────',
          'Fidelity Score: 0.87',
          'Final decision: HIGH'
        ],
        duration: '0.08s'
      },
      {
        phase: 'PLAYBOOK GENERATION',
        color: '#00AEEF',
        lines: [
          'Attack: Privilege Escalation',
          '✓ Step 1: Isolate User Account [Auto]',
          '✓ Step 2: Block Source IP [Auto]',
          '✓ Step 3: Revoke Auth Sessions [Auto]',
          '✓ Step 4: Audit Database [Manual]',
          '✓ Step 5: Reset Credentials [Manual]',
          '✓ Step 6: Monitor Core Banking [Manual]',
          '',
          '6 steps generated.',
          'Estimated containment: 12 minutes'
        ],
        duration: '4.1s'
      },
      {
        phase: 'COMPLETE',
        color: '#15803D',
        lines: [
          'Analysis complete.',
          'Fidelity Score: 0.87',
          'Decision: HIGH',
          'Playbook: READY'
        ],
        duration: '0.04s'
      }
    ],
    agents: [
      {
        name: 'Risk Agent',
        iconName: 'ShieldAlert',
        color: '#B91C1C',
        score: 0.91,
        considered: [
          'External IP login from 203.0.113.45',
          'PowerShell execution with elevation',
          'Core banking system accessed',
          'Off-hours activity pattern',
          'Lateral movement across 4 systems'
        ],
        rejected: [
          'T1055 Process Injection (0.52)',
          'T1027 Obfuscation (0.41)',
          'Insider threat hypothesis (0.38)'
        ],
        reasoning: 'High technical risk confirmed. Critical asset access combined with anomalous behavioral patterns indicates active exploitation.',
        prompt: `SYSTEM: You are a cybersecurity risk analyst.
Analyze this incident and provide a risk score.

INCIDENT: {
  "id": "INC-2091",
  "type": "Privilege Escalation",
  "techniques": ["T1078","T1059","T1068"],
  "killChainStage": 4
}

Return: { "score": float, "reasoning": string }`
      },
      {
        name: 'Compliance Agent',
        iconName: 'Scale',
        color: '#D97706',
        score: 0.84,
        considered: [
          'Customer PII potentially exposed',
          'PCI-DSS controls triggered',
          'SWIFT dual-control bypass detected',
          'FCA notification window: 6 hours'
        ],
        rejected: [
          'GDPR breach — threshold not met',
          'SOX violation — insufficient evidence'
        ],
        reasoning: 'Moderate-high compliance risk. PCI-DSS and FCA requirements triggered. Notification may be required within 6 hours.',
        prompt: `SYSTEM: You are a banking compliance officer.
Assess regulatory risk of this incident.

INCIDENT: {
  "id": "INC-2091",
  "affectedSystems": ["loan-db","core-banking"],
  "regulations": ["PCI-DSS","FCA","GDPR"]
}

Return: { "score": float, "reasoning": string }`
      },
      {
        name: 'Business Impact Agent',
        iconName: 'TrendingUp',
        color: '#15803D',
        score: 0.79,
        considered: [
          'swift-terminal: CRITICAL asset',
          'core-banking: CRITICAL asset',
          'Fraud exposure: $4.8M estimated',
          'Containment outage cost: $120K'
        ],
        rejected: [
          'Reputational damage — unquantifiable',
          'Stock price impact — indirect only'
        ],
        reasoning: 'Moderate business impact. Operations not yet disrupted. Containment within 15 minutes prevents customer-facing impact.',
        prompt: `SYSTEM: You are a business continuity manager.
Assess operational impact of this incident.

INCIDENT: {
  "id": "INC-2091",
  "criticalSystems": ["swift-terminal"],
  "fraudExposure": 4800000,
  "containmentCost": 120000
}

Return: { "score": float, "reasoning": string }`
      }
    ]
  },
  'INC-2089': {
    incidentId: 'INC-2089',
    attackType: 'Data Exfiltration',
    model: 'Llama 3.1 8B',
    mode: 'offline',
    vectorDb: 'FAISS offline index',
    eventsProcessed: 623,
    incidentObjectTokens: 2241,
    status: 'complete',
    orchestratorTrace: [
      {
        phase: 'ORCHESTRATOR — LangGraph',
        color: '#00AEEF',
        lines: [
          'Incident INC-2089 received.',
          'Pipeline processed 623 events →',
          'extracted structured incident object.',
          'Dispatching to 3 agents...'
        ],
        duration: '0.04s'
      },
      {
        phase: 'RISK AGENT — started',
        color: '#B91C1C',
        lines: [
          'Analyzing incident object...',
          'Large data transfer detected: 2.3GB',
          'Destination: external IP 185.234.x.x',
          '',
          '✓ T1041 Exfiltration over C2: 0.94',
          '✓ T1048 Exfil over web: 0.89',
          '✗ T1567 Cloud exfiltration: 0.43 — rejected',
          '',
          'Technical severity: 0.95',
          'Vote: IMMEDIATE ISOLATION'
        ],
        duration: '3.1s'
      },
      {
        phase: 'COMPLIANCE AGENT — started',
        color: '#D97706',
        lines: [
          'Data classification: CONFIRMED breach',
          'Customer records affected: ~12,000',
          'GDPR Article 33: notification required',
          'FCA breach report: mandatory',
          '',
          'Compliance risk: 0.96',
          'Vote: CONTAIN + NOTIFY REGULATORS'
        ],
        duration: '2.9s'
      },
      {
        phase: 'BUSINESS IMPACT AGENT — started',
        color: '#15803D',
        lines: [
          'Customer data confirmed exfiltrated',
          'Estimated regulatory fine: $2.1M',
          'Reputational exposure: HIGH',
          '',
          'Business impact: 0.88',
          'Vote: IMMEDIATE RESPONSE'
        ],
        duration: '2.2s'
      },
      {
        phase: 'VOTING ENGINE',
        color: '#00AEEF',
        lines: [
          '(0.95 × 0.50) = 0.475  [Risk]',
          '(0.96 × 0.30) = 0.288  [Compliance]',
          '(0.88 × 0.20) = 0.176  [Impact]',
          '─────────────────────────',
          'Fidelity Score: 0.94',
          'Final decision: HIGH'
        ],
        duration: '0.06s'
      },
      {
        phase: 'COMPLETE',
        color: '#15803D',
        lines: [
          'Analysis complete.',
          'Fidelity Score: 0.94',
          'Decision: HIGH',
          'Playbook: READY'
        ],
        duration: '0.04s'
      }
    ],
    agents: [
      {
        name: 'Risk Agent',
        iconName: 'ShieldAlert',
        color: '#B91C1C',
        score: 0.95,
        considered: [
          '2.3GB data transfer to external IP',
          'db_admin credentials used',
          'Off-hours exfiltration detected',
          'T1041 Exfiltration over C2'
        ],
        rejected: [
          'T1567 Cloud storage (0.43)',
          'Insider threat — no motive evidence'
        ],
        reasoning: 'Confirmed data exfiltration. Large volume transfer to known malicious IP with admin credentials indicates sophisticated breach.',
        prompt: `SYSTEM: You are a cybersecurity risk analyst.
Analyze this incident.

INCIDENT: {
  "id": "INC-2089",
  "type": "Data Exfiltration",
  "dataVolume": "2.3GB",
  "destination": "185.234.x.x"
}

Return: { "score": float, "reasoning": string }`
      },
      {
        name: 'Compliance Agent',
        iconName: 'Scale',
        color: '#D97706',
        score: 0.96,
        considered: [
          '~12,000 customer records exposed',
          'GDPR Article 33 triggered',
          'FCA mandatory breach report',
          'PCI-DSS cardholder data exposed'
        ],
        rejected: [
          'Internal audit only — insufficient'
        ],
        reasoning: 'Critical compliance breach. GDPR notification required within 72 hours. FCA report mandatory. Highest compliance risk in current incident pool.',
        prompt: `SYSTEM: You are a banking compliance officer.

INCIDENT: {
  "id": "INC-2089",
  "recordsExposed": 12000,
  "dataTypes": ["customer_pii","card_data"]
}

Return: { "score": float, "reasoning": string }`
      },
      {
        name: 'Business Impact Agent',
        iconName: 'TrendingUp',
        color: '#15803D',
        score: 0.88,
        considered: [
          'Customer PII confirmed exfiltrated',
          'Regulatory fine estimate: $2.1M',
          'Reputational damage: significant',
          'Customer churn risk: elevated'
        ],
        rejected: [
          'Stock impact — cannot quantify now'
        ],
        reasoning: 'High business impact. Customer data confirmed lost. Regulatory fines and reputational damage inevitable. Immediate containment and notification required.',
        prompt: `SYSTEM: You are a business continuity manager.

INCIDENT: {
  "id": "INC-2089",
  "customerRecordsExposed": 12000,
  "estimatedFine": 2100000
}

Return: { "score": float, "reasoning": string }`
      }
    ]
  }
}

const ICON_MAP = {
  ShieldAlert: ShieldAlert,
  Scale: Scale,
  TrendingUp: TrendingUp
}

const LLMReasoning = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [reasoning, setReasoning] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [visibleLines, setVisibleLines] = useState({})
  const [expandedPrompts, setExpandedPrompts] = useState({})

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    
    setHasSearched(true)
    setVisibleLines({})
    setExpandedPrompts({})
    
    const query = searchQuery.trim().toUpperCase()
    const id = query.startsWith('INC-') ? query : `INC-${query}`
    
    const found = ALL_MOCK_REASONING[id]
    
    if (found) {
      setReasoning(found)
      setNotFound(false)
      // Trigger line animation
      found.orchestratorTrace.forEach((phase, phaseIndex) => {
        phase.lines.forEach((line, lineIndex) => {
          setTimeout(() => {
            setVisibleLines(prev => ({
              ...prev,
              [`${phaseIndex}-${lineIndex}`]: true
            }))
          }, (phaseIndex * 500) + (lineIndex * 60))
        })
      })
    } else {
      setReasoning(null)
      setNotFound(true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const togglePrompt = (name) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const glassStyle = {
    background: 'var(--surface-color)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
  }
  
  const renderAgentCards = (isEmptyState) => {
    const defaultAgents = [
      { name: 'Risk Agent', color: '#B91C1C', icon: ShieldAlert },
      { name: 'Compliance Agent', color: '#D97706', icon: Scale },
      { name: 'Business Impact Agent', color: '#15803D', icon: TrendingUp }
    ]

    const agentsList = isEmptyState ? defaultAgents : reasoning?.agents || defaultAgents

    return agentsList.map((agent, i) => {
      const IconCmp = isEmptyState ? agent.icon : ICON_MAP[agent.iconName] || ShieldAlert

      return (
        <div key={i} style={{ ...glassStyle, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <IconCmp size={16} color={isEmptyState ? 'var(--text-muted)' : agent.color} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: isEmptyState ? 'var(--text-muted)' : agent.color }}>
                {agent.name}
              </span>
            </div>
            {!isEmptyState && (
              <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: agent.color }}>
                {agent.score.toFixed(2)}
              </span>
            )}
            {isEmptyState && (
              <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                —
              </span>
            )}
          </div>

          <div style={{ height: '4px', borderRadius: '2px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', marginBottom: '14px', overflow: 'hidden' }}>
            {!isEmptyState ? (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${agent.score * 100}%` }}
                transition={{ duration: 1, delay: 0.2 }}
                style={{ height: '100%', background: agent.color, opacity: 0.7 }}
              />
            ) : (
              <div style={{ height: '100%', width: '0%', background: 'rgba(255,255,255,0.1)' }} />
            )}
          </div>

          <div style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', marginBottom: '12px' }} />

          {isEmptyState ? (
            <>
              {["Considered", "Rejected", "Reasoning"].map((label, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ height: '8px', borderRadius: '4px', width: '100%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                    <div style={{ height: '8px', borderRadius: '4px', width: '80%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                    <div style={{ height: '8px', borderRadius: '4px', width: '90%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px', textTransform: 'uppercase' }}>Considered</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {agent.considered.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <Check size={11} color="#15803D" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px', textTransform: 'uppercase' }}>Rejected</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {agent.rejected.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <X size={11} color="rgba(185,28,28,0.6)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, fontStyle: 'italic' }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', padding: '10px 12px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
                {agent.reasoning}
              </div>

              <button
                onClick={() => togglePrompt(agent.name)}
                style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '12px' }}
              >
                <ChevronDown
                  size={13}
                  color="#00AEEF"
                  style={{ transform: expandedPrompts[agent.name] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
                <span style={{ fontSize: '11px', color: '#00AEEF', fontWeight: 500 }}>View Prompt</span>
              </button>

              <AnimatePresence>
                {expandedPrompts[agent.name] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ background: '#0A0F1A', borderRadius: '8px', padding: '12px', border: '1px solid rgba(0,174,239,0.15)', marginTop: '8px' }}>
                      <pre className="font-mono" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {agent.prompt}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
        {/* 
          Blink animation moved to index.css for consistency 
        */}

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-color)', margin: 0 }}>Agent Deliberation Log</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>AI decision trace</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {['Llama 3.1 8B', 'Offline', 'Air-gapped', 'FAISS index'].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item}</span>
                {i < arr.length - 1 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>·</span>}
              </div>
            ))}
          </div>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
                zIndex: 10
              }} />
              <input
                type="text"
                placeholder="Search incident ID e.g. INC-2091"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: isDark ? '0.6px solid rgba(255,255,255,0.2)' : '0.6px solid rgba(0,0,0,0.1)',
                  borderRadius: 20,
                  height: 46,
                  padding: '0 20px 0 42px',
                  color: 'var(--text-color)',
                  fontSize: '15px',
                  width: '100%',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>

            <button
              onClick={handleSearch}
              style={{
                background: '#00AEEF',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                height: '46px',
                padding: '0 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              Analyze Incident
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', paddingLeft: '14px' }}>
            Available for demo: INC-2091, INC-2089
          </div>
        </div>

        {/* EMPTY STATE */}
        {!hasSearched && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '100%', background: '#0A0F1A', border: '1px solid rgba(0,174,239,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5F57' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#28C840' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                    cryptix-agent-trace
                  </span>
                </div>
                <div style={{ padding: '60px 20px', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={32} color="rgba(0,174,239,0.3)" style={{ marginBottom: '12px' }} />
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="font-mono" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      Enter an incident ID to view the AI deliberation trace
                    </span>
                    <div style={{ 
                      display: 'inline-block', 
                      width: '8px', 
                      height: '14px', 
                      background: '#00AEEF', 
                      opacity: 0.8,
                      marginLeft: '8px',
                      verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite'
                    }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {renderAgentCards(true)}
            </div>
          </>
        )}

        {/* NOT FOUND STATE */}
        {hasSearched && notFound && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '100%', background: '#0A0F1A', border: '1px solid rgba(0,174,239,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5F57' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#28C840' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                    cryptix-agent-trace
                  </span>
                </div>
                <div className="font-mono" style={{ padding: '40px 30px', minHeight: '300px', fontSize: '13px', lineHeight: 1.8 }}>
                  <div style={{ color: 'rgba(185,28,28,0.8)', marginBottom: '16px' }}>
                    ✗ Incident '{searchQuery}' not found
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                    Available incidents:
                  </div>
                  <div style={{ color: 'rgba(0,174,239,0.6)', paddingLeft: '16px' }}>
                    <div>· INC-2091 (Privilege Escalation)</div>
                    <div>· INC-2089 (Data Exfiltration)</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {renderAgentCards(true)}
            </div>
          </>
        )}

        {/* RESULTS STATE */}
        {hasSearched && !notFound && reasoning && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '100%', background: '#0A0F1A', border: '1px solid rgba(0,174,239,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5F57' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#28C840' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                    cryptix-agent-trace — {reasoning.incidentId}
                  </span>
                </div>
                <div className="font-mono" style={{ 
                  padding: '20px', 
                  minHeight: '400px', 
                  maxHeight: '600px', 
                  overflowY: 'auto', 
                  fontSize: '13px', 
                  lineHeight: '1.6',
                  letterSpacing: '0.02em',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0,174,239,0.3) transparent'
                }}>
                  {reasoning.orchestratorTrace.map((phase, pIdx) => (
                    <div key={pIdx} style={{ marginBottom: '12px' }}>
                      <div style={{ color: '#00AEEF', fontWeight: '600', fontSize: '13px', marginBottom: '6px', marginTop: pIdx === 0 ? '0' : '16px' }}>
                        $ [{phase.phase}] 
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', fontWeight: '400', marginLeft: '8px' }}>
                          ({phase.duration})
                        </span>
                      </div>
                      {phase.lines.map((line, lIdx) => {
                        const isVisible = visibleLines[`${pIdx}-${lIdx}`]
                        if (!isVisible && line !== '') return null
                        
                        let color = 'rgba(204, 204, 204, 0.9)'
                        if (line.startsWith('✓')) color = '#4EC9B0'
                        else if (line.startsWith('✗')) color = 'rgba(185,28,28,0.7)'
                        else if (line.startsWith('─')) color = 'rgba(255,255,255,0.1)'
                        
                        if (line === '') return <div key={lIdx} style={{ height: '8px' }} />

                        return (
                          <motion.div
                            key={lIdx}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{ color }}
                          >
                            {line}
                          </motion.div>
                        )
                      })}
                    </div>
                  ))}
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '14px',
                    background: '#00AEEF',
                    opacity: 0.8,
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'blink 1s step-end infinite'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {renderAgentCards(false)}
            </div>
            
            <div style={{ ...glassStyle, marginTop: '20px', padding: '12px 24px', display: 'flex', alignItems: 'center' }}>
              {[
                { icon: Cpu, label: 'Model', value: reasoning.model },
                { icon: Wifi, label: 'Mode', value: 'Offline · Air-gapped', chip: true },
                { icon: Database, label: 'Vector DB', value: reasoning.vectorDb },
                { icon: FileText, label: 'Events processed', value: reasoning.eventsProcessed },
                { icon: Hash, label: 'Incident object', value: `${reasoning.incidentObjectTokens} tokens` },
                { icon: CheckCircle2, label: 'Status', value: reasoning.status, status: true }
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <item.icon size={13} color="var(--text-muted)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', fontWeight: 600 }}>{item.label}</span>
                      {item.chip ? (
                        <div style={{ background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.15)', color: '#15803D', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', marginTop: '2px', width: 'fit-content' }}>
                          {item.value}
                        </div>
                      ) : item.status ? (
                        <div style={{ background: 'rgba(21,128,61,0.08)', color: '#15803D', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', marginTop: '2px', width: 'fit-content', textTransform: 'capitalize' }}>
                          {item.value}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginTop: '1px' }}>{item.value}</span>
                      )}
                    </div>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: '1px', height: '30px', background: 'var(--glass-border)', margin: '0 24px' }} />}
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    );
};

export default LLMReasoning;
