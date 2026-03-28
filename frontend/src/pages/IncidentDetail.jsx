import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { jsPDF } from 'jspdf'
import {
  ArrowLeft, Clock, AlertTriangle, Sparkles, GitBranch, Play, Network,
  Users, Server, Wifi, Shield, ShieldAlert, Brain, Scale, TrendingUp,
  BookOpen, CheckCircle2, Check, User, Zap, Share2, Download, X, ArrowRight,
  Lock, ChevronDown, Loader2
} from 'lucide-react'

const MAX_ENTITIES_VISIBLE = 2

const SOC_ESCALATION_TIERS = [
  { id: 'tier1', label: 'Tier 1 SOC' },
  { id: 'tier2', label: 'Tier 2 SOC' },
  { id: 'tier3', label: 'Tier 3 SOC' },
]

const buildDefaultPlaybookSteps = (incident, incidentId) => {
  const user = String((incident?.entities?.users || [])[0] || 'primary user account')
  const sourceIp = String((incident?.entities?.ips || [])[0] || 'source IP')

  return [
    { id: 1, title: `Isolate user account: ${user}`, type: 'automated' },
    { id: 2, title: `Block source IP: ${sourceIp}`, type: 'automated' },
    { id: 3, title: 'Revoke active authentication sessions', type: 'automated' },
    { id: 4, title: 'Audit database access for unauthorized activity', type: 'manual' },
    { id: 5, title: 'Reset credentials and enforce MFA re-enrollment', type: 'manual' },
  ].map((step) => ({ ...step, incidentId }))
}

// ─────────────────────────────────────
// HELPER FUNCTIONS & COMPONENTS
// ─────────────────────────────────────

const getSeverityStyle = (severity) => ({
  high: {
    background: 'rgba(185,28,28,0.08)',
    color: '#B91C1C',
    border: '1px solid rgba(185,28,28,0.15)',
    borderRadius: '20px'
  },
  medium: {
    background: 'rgba(217,119,6,0.08)',
    color: '#D97706',
    border: '1px solid rgba(217,119,6,0.15)',
    borderRadius: '20px'
  },
  low: {
    background: 'rgba(21,128,61,0.08)',
    color: '#15803D',
    border: '1px solid rgba(21,128,61,0.15)',
    borderRadius: '20px'
  }
}[severity] || {})

const getStatusDotColor = (status) => ({
  investigating: '#D97706',
  escalated: '#B91C1C',
  contained: '#15803D'
}[status] || '#D97706')

const getFidelityColor = (score) =>
  score >= 0.85 ? '#B91C1C'
    : score >= 0.5 ? '#D97706'
      : '#15803D'

const getFidelityBg = (score) =>
  score >= 0.85 ? 'rgba(185,28,28,0.08)'
    : score >= 0.5 ? 'rgba(217,119,6,0.08)'
      : 'rgba(21,128,61,0.08)'

const getFidelityBorder = (score) =>
  score >= 0.85 ? 'rgba(185,28,28,0.15)'
    : score >= 0.5 ? 'rgba(217,119,6,0.15)'
      : 'rgba(21,128,61,0.15)'

// SVG gauge helpers
const polarToCartesian = (cx, cy, r, angle) => {
  const rad = (angle - 90) * Math.PI / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  }
}

const describeArc = (cx, cy, r, start, end) => {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const large = end - start <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

const formatGraphText = (value) => String(value || '').replace(/_/g, ' ').trim()

const CustomNode = ({ data }) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const isVirtual = Boolean(data?.virtual)

  const getIcon = (type) => ({
    ip: Wifi,
    user: User,
    server: Server,
    virtual: GitBranch,
  }[type] || Server)

  const Icon = getIcon(data.type)

  const statusColor = isVirtual
    ? '#00AEEF'
    : data.compromised
      ? '#B91C1C'
      : data.suspected
        ? '#D97706'
        : '#15803D'

  return (
    <div style={{
      background: isVirtual
        ? (isDark ? 'rgba(0,174,239,0.08)' : 'rgba(0,174,239,0.06)')
        : isDark
          ? 'rgba(15,25,40,0.95)'
          : 'rgba(255,255,255,0.98)',
      border: '1px solid',
      borderColor: isDark
        ? (isVirtual ? 'rgba(0,174,239,0.4)' : 'rgba(255,255,255,0.08)')
        : (isVirtual ? 'rgba(0,174,239,0.45)' : 'rgba(0,0,0,0.08)'),
      borderTop: `3px ${isVirtual ? 'dashed' : 'solid'} ${statusColor}`,
      borderStyle: isVirtual ? 'dashed' : 'solid',
      borderRadius: '8px',
      padding: '10px 14px',
      minWidth: isVirtual ? '130px' : '110px',
      textAlign: 'center',
      boxShadow: isDark
        ? '0 4px 16px rgba(0,0,0,0.4)'
        : '0 2px 8px rgba(0,0,0,0.08)',
      position: 'relative'
    }}>

      {/* Top handle — target (incoming edges) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'transparent', border: 'none', width: 8, height: 8 }}
      />

      <Icon size={13} color={statusColor} style={{ marginBottom: '5px' }} />

      <div style={{
        fontSize: '8px', color: 'var(--text-muted)',
        letterSpacing: '0.08em', marginBottom: '4px', textTransform: 'uppercase'
      }}>
        {isVirtual ? 'virtual entity' : data.type}
      </div>

      <div style={{
        fontSize: '11px', fontWeight: '700',
        color: 'var(--text-color)', whiteSpace: 'nowrap'
      }}>
        {data.label}
      </div>

      {data?.subLabel && (
        <div style={{
          marginTop: '4px',
          fontSize: '9px',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {data.subLabel}
        </div>
      )}

      {/* Bottom handle — source (outgoing edges) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'transparent', border: 'none', width: 8, height: 8 }}
      />
    </div>
  )
}

const nodeTypes = {
  customNode: ({ data }) => {
    const { resolvedTheme } = useTheme()
    return <CustomNode data={data} isDark={resolvedTheme === 'dark'} />
  }
}

// ─────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────

const IncidentDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { user } = useAuth()

  const RECIPIENTS = [
    { id: 'ciso', label: 'CISO' },
    { id: 'lead', label: 'Security Lead' },
    { id: 'compliance', label: 'Compliance Officer' }
  ]
  const [incident, setIncident] = useState(null)
  const [activeStep, setActiveStep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAllEntities, setShowAllEntities] = useState(false)
  const [showAllMitreTechniques, setShowAllMitreTechniques] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false)
  const [incidentStatus, setIncidentStatus] = useState('investigating')
  const [selectedSocTier, setSelectedSocTier] = useState('tier2')
  const [escalateRecipients, setEscalateRecipients] = useState(['ciso'])
  const [escalateReason, setEscalateReason] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Change 1 — Activation Terminal
  const [showActivationTerminal, setShowActivationTerminal] = useState(false)
  const [terminalLines, setTerminalLines] = useState([])
  const terminalBodyRef = useRef(null)

  // Change 2 — Narrative typing animation
  const [displayedNarrative, setDisplayedNarrative] = useState('')
  const fullNarrative = incident?.narrative || ''
  const [llmModel, setLlmModel] = useState('mistral')

  const playbookRef = useRef(null)
  const playbookStepLine = (() => {
    const generatedSteps = Array.isArray(incident?.playbook?.steps) ? incident.playbook.steps : []
    const steps = (generatedSteps.length ? generatedSteps : buildDefaultPlaybookSteps(incident, id)).slice(0, 6)
    const titles = steps
      .map(s => (s?.title || s?.action || '').toString().trim())
      .filter(Boolean)
    if (titles.length) return titles.join('  •  ')
    return ''
  })()

  const buildPdfText = () => {
    const title = incident?.playbook?.title || `SOC Incident Response Playbook: ${incident?.id || id}`
    const report = (incident?.playbook?.report || '').trim()
    if (report) return report

    // Dynamic fallback assembled from live incident/playbook fields only.
    const steps = (incident?.playbook?.steps || [])
      .slice(0, 6)
      .map((s, idx) => `${idx + 1}. ${(s?.title || s?.description || s?.action || '').toString().trim()}`)
      .filter(Boolean)
    const chronology = (incident?.timeline || [])
      .slice(0, 6)
      .map((e, idx) => `${idx + 1}. [${e?.timestamp || ''}] ${(e?.eventType || '').toString()}: ${(e?.description || '').toString()}`.trim())
      .filter(Boolean)
    const mitre = (incident?.mitreTechniques || [])
      .slice(0, 5)
      .map(t => `${t.id} ${t.name || ''}`.trim())
    const entities = [
      ...(incident?.entities?.users || []).map(u => `User: ${u}`),
      ...(incident?.entities?.servers || []).map(s => `Asset: ${s}`),
      ...(incident?.entities?.ips || []).map(ip => `IP: ${ip}`)
    ]
    const lines = [
      title,
      '',
      'INCIDENT OVERVIEW',
      (incident?.narrative || '').toString(),
      '',
      'RISK CONTEXT',
      `Severity: ${(incident?.agentScores?.finalDecision || incident?.severity || '').toString().toUpperCase()}`,
      `Fidelity: ${(incident?.fidelityScore ?? 0).toFixed(2)}`,
      '',
      'AFFECTED ENTITIES',
      ...(entities.length ? entities.map(x => `- ${x}`) : ['- unavailable']),
      '',
      'MITRE CONTEXT',
      ...(mitre.length ? mitre.map(x => `- ${x}`) : ['- unavailable']),
      '',
      'INCIDENT CHRONOLOGY',
      ...(chronology.length ? chronology : ['- unavailable']),
      '',
      'RESPONSE PLAYBOOK (TOP 6)',
      ...(steps.length ? steps : ['- unavailable']),
    ]
    return lines.join('\n')
  }

  const downloadPlaybookPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 48
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const maxW = pageW - margin * 2

    const text = buildPdfText()
    const lines = doc.splitTextToSize(text, maxW)

    doc.setFont('times', 'normal')
    doc.setFontSize(11)

    let y = margin
    const lineH = 14
    for (const line of lines) {
      if (y + lineH > pageH - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(String(line), margin, y)
      y += lineH
    }

    const safeId = (incident?.id || id || 'incident').replace(/[^a-zA-Z0-9_-]/g, '_')
    doc.save(`playbook_${safeId}.pdf`)
  }

  // DYNAMIC GRAPH MAPPING
  const graphNodes = useMemo(() => {
    const sourceNodes = Array.isArray(incident?.graphNodes) ? incident.graphNodes : []
    const sourceEdges = Array.isArray(incident?.graphEdges) ? incident.graphEdges : []
    if (sourceNodes.length === 0) return []

    const mappedNodes = sourceNodes.map(n => ({
      id: n.id,
      type: 'customNode',
      position: n.position,
      data: {
        label: n.label,
        type: n.type,
        compromised: n.compromised || false,
        suspected: n.suspected || false,
        virtual: false,
      }
    }))

    const nodeById = new Map(sourceNodes.map((n) => [n.id, n]))
    const virtualNodes = sourceEdges
      .map((e, idx) => {
        const srcNode = nodeById.get(e.source)
        const tgtNode = nodeById.get(e.target)
        if (!srcNode || !tgtNode) return null

        const relation = formatGraphText(e.label)
        const srcLabel = formatGraphText(srcNode.label || srcNode.id)
        const tgtLabel = formatGraphText(tgtNode.label || tgtNode.id)
        const midX = ((srcNode.position?.x ?? 0) + (tgtNode.position?.x ?? 0)) / 2 + (idx % 2 === 0 ? 170 : -170)
        const midY = ((srcNode.position?.y ?? 0) + (tgtNode.position?.y ?? 0)) / 2

        return {
          id: `v-${e.id}`,
          type: 'customNode',
          position: { x: midX, y: midY },
          data: {
            label: relation || `${srcLabel} to ${tgtLabel}`,
            subLabel: `${srcLabel} -> ${tgtLabel}`,
            type: 'virtual',
            compromised: false,
            suspected: true,
            virtual: true,
          },
        }
      })
      .filter(Boolean)

    return [...mappedNodes, ...virtualNodes]
  }, [incident])

  const graphEdges = useMemo(() => {
    const sourceNodes = Array.isArray(incident?.graphNodes) ? incident.graphNodes : []
    const sourceEdges = Array.isArray(incident?.graphEdges) ? incident.graphEdges : []
    if (sourceEdges.length === 0 || sourceNodes.length === 0) return []

    const nodeIds = new Set(sourceNodes.map((n) => n.id))

    return sourceEdges.flatMap((e) => {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
        return []
      }

      const virtualNodeId = `v-${e.id}`

      return [
        {
          id: `${e.id}-sv`,
          source: e.source,
          target: virtualNodeId,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#00AEEF',
            width: 16,
            height: 16
          },
          style: {
            stroke: '#00AEEF',
            strokeWidth: 1.8,
            strokeDasharray: '6 4',
            opacity: 0.85
          },
          labelStyle: {
            fontSize: 9,
            fill: isDark ? '#64748B' : '#94A3B8',
            fontWeight: '500'
          },
          labelBgStyle: {
            fill: isDark
              ? 'rgba(6,13,26,0.9)'
              : 'rgba(248,250,252,0.9)',
            rx: 3
          },
          labelBgPadding: [2, 4]
        },
        {
          id: `${e.id}-vt`,
          source: virtualNodeId,
          target: e.target,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#00AEEF',
            width: 16,
            height: 16
          },
          style: {
            stroke: '#00AEEF',
            strokeWidth: 1.8,
            strokeDasharray: '6 4',
            opacity: 0.85
          },
          labelStyle: {
            fontSize: 9,
            fill: isDark ? '#64748B' : '#94A3B8',
            fontWeight: '500'
          },
          labelBgStyle: {
            fill: isDark
              ? 'rgba(6,13,26,0.9)'
              : 'rgba(248,250,252,0.9)',
            rx: 3
          },
          labelBgPadding: [2, 4]
        }
      ]
    })
  }, [incident, isDark])
  const location = useLocation();
  const fromPage = location.state?.from || 'incidents';

  const handleBack = () => {
    if (fromPage === 'playbooks') {
      navigate('/playbooks');
    } else {
      navigate('/incidents');
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges)

  useEffect(() => {
    setNodes(graphNodes)
    setEdges(graphEdges)
  }, [graphNodes, graphEdges, setNodes, setEdges])

  useEffect(() => {
    setShowAllMitreTechniques(false)
  }, [incident?.id])

  // Load real correlated incident + short narrative (mistral via backend).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getCorrelatedIncidentDetail(id)
      .then((data) => {
        if (cancelled) return
        setIncident(data)
        setIncidentStatus(data?.status || 'investigating')
        setEscalateReason(`High fidelity score (${(data?.fidelityScore ?? 0).toFixed(2)}) requires senior review`)
      })
      .catch(() => {
        if (cancelled) return
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    api.getCorrelatedIncidentNarrative(id)
      .then((res) => {
        if (cancelled) return
        if (res?.narrative) {
          setIncident((prev) => ({ ...prev, narrative: res.narrative }))
        }
        if (res?.model) {
          setLlmModel(String(res.model))
        }
      })
      .catch(() => { })

    return () => { cancelled = true }
  }, [id])

  // Typing animation for narrative (Change 2)
  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < fullNarrative.length) {
        setDisplayedNarrative(fullNarrative.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 18)
    return () => clearInterval(interval)
  }, [fullNarrative])

  // Auto-scroll terminal body on new lines
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight
    }
  }, [terminalLines])

  const [stepStatuses, setStepStatuses] = useState({})

  useEffect(() => {
    const generatedSteps = Array.isArray(incident?.playbook?.steps) ? incident.playbook.steps : []
    const baselineSteps = generatedSteps.length ? generatedSteps : buildDefaultPlaybookSteps(incident, id)
    setStepStatuses(Object.fromEntries(baselineSteps.map((s, idx) => [s?.id || idx + 1, 'pending'])))
  }, [incident?.id])

  useEffect(() => {
    if (user?.role === 'tier1') {
      setSelectedSocTier('tier2')
    } else if (user?.role === 'tier2') {
      setSelectedSocTier('tier3')
    } else {
      setSelectedSocTier('tier3')
    }
  }, [user?.role])

  const toggleStepStatus = (stepId) => {
    setStepStatuses(prev => ({
      ...prev,
      [stepId]: prev[stepId] === 'pending' ? 'completed' : 'pending'
    }))
  }

  const handleGeneratePlaybook = async () => {
    setIsGeneratingPlaybook(true)
    try {
      const res = await api.generateCorrelatedIncidentPlaybook(id)
      const generatedPlaybook = res?.playbook || {}
      const generatedSteps = Array.isArray(generatedPlaybook?.steps) ? generatedPlaybook.steps : []

      setIncident((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          playbook: {
            ...(prev.playbook || {}),
            ...generatedPlaybook,
            generated: true,
          },
        }
      })
      setStepStatuses(Object.fromEntries(generatedSteps.map((s, idx) => [s?.id || idx + 1, 'pending'])))

      setToastMessage('Playbook generated successfully. PDF download is now available.')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3500)
    } catch (err) {
      console.error('Failed to generate playbook', err)
      setToastMessage('Playbook generation failed. Please try again.')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3500)
    } finally {
      setIsGeneratingPlaybook(false)
    }
  }

  const addTerminalLine = (line, delay) => {
    setTimeout(() => {
      setTerminalLines(prev => [...prev, line])
    }, delay)
  }

  const handleActivateResponse = async () => {
    setShowActivateModal(false)
    setShowActivationTerminal(true)
    setTerminalLines([])
    setIsActivating(true)

    addTerminalLine(`$ cryptix-response --incident ${incident?.id || id}`, 100)
    addTerminalLine('> Initializing response engine...', 200)
    addTerminalLine('> Connecting to IAM API...', 600)
    addTerminalLine(`> [STEP 1] Isolating ${(incident?.entities?.users || [])[0] || 'primary user'}...`, 1000)

    setStepStatuses(prev => ({ ...prev, [1]: 'running' }))
    await new Promise(r => setTimeout(r, 1500))
    setStepStatuses(prev => ({ ...prev, [1]: 'completed' }))
    addTerminalLine('[OK] emp_104 suspended -- sessions revoked', 2600)

    addTerminalLine('> [STEP 2] Blocking 203.0.113.45...', 2800)
    setStepStatuses(prev => ({ ...prev, [2]: 'running' }))
    await new Promise(r => setTimeout(r, 1500))
    setStepStatuses(prev => ({ ...prev, [2]: 'completed' }))
    addTerminalLine('[OK] IP blocked at perimeter firewall', 4400)

    addTerminalLine('> [STEP 3] Revoking auth sessions...', 4600)
    setStepStatuses(prev => ({ ...prev, [3]: 'running' }))
    await new Promise(r => setTimeout(r, 1500))
    setStepStatuses(prev => ({ ...prev, [3]: 'completed' }))
    addTerminalLine('[OK] All sessions on auth-server terminated', 6200)

    addTerminalLine('', 6400)
    addTerminalLine('> Automated steps complete.', 6600)
    addTerminalLine('> Manual steps require analyst action.', 6900)
    addTerminalLine('[OK] Incident status -> CONTAINED', 7200)
    addTerminalLine('> Audit trail updated.', 7500)

    setIsActivating(false)
    setIncidentStatus('contained')

    setTimeout(() => {
      playbookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)
  }

  const escalationTarget = SOC_ESCALATION_TIERS.find((tier) => tier.id === selectedSocTier)?.label || 'Tier 2 SOC'

  const handleEscalate = () => {
    setShowEscalateModal(false)
    setIncidentStatus('escalated')

    const notifiedList = escalateRecipients
      .map(r => RECIPIENTS.find(x => x.id === r)?.label)
      .filter(Boolean)
      .join(', ')

    // Show toast notification
    setToastMessage(
      `Incident escalated to ${escalationTarget}${notifiedList ? ` — notified ${notifiedList}` : ''}`
    )
    setShowToast(true)
    setTimeout(() => setShowToast(false), 4000)
  }

  const completedStepsCount = Object.values(stepStatuses).filter(s => s === 'completed').length
  const playbookSteps = Array.isArray(incident?.playbook?.steps) ? incident.playbook.steps : []
  const hasGeneratedPlaybook = Boolean(incident?.playbook?.generated) || playbookSteps.length > 0
  const defaultPlaybookSteps = buildDefaultPlaybookSteps(incident, id)
  const displayPlaybookSteps = hasGeneratedPlaybook ? playbookSteps : defaultPlaybookSteps
  const automatedPlaybookSteps = displayPlaybookSteps.filter((s) => s?.type === 'automated')

  const priorityConfig = {
    immediate: { label: 'Immediate', color: '#B91C1C', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.15)' },
    urgent: { label: 'Urgent', color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)' },
    within_1hr: { label: 'Within 1 hr', color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)' },
    within_4hr: { label: 'Within 4 hrs', color: '#15803D', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.15)' },
    ongoing: { label: 'Ongoing', color: '#00AEEF', bg: 'rgba(0,174,239,0.08)', border: 'rgba(0,174,239,0.15)' }
  }

  if (loading || !incident) return null

  // Change 4 — Plain English explanation helper
  const getPlainEnglishExplanation = (score, factors) => {
    const deviation = factors.find(f => f.label === 'Behavioral Deviation')?.score || 0
    const criticality = factors.find(f => f.label === 'Asset Criticality')?.score || 0
    const similarity = factors.find(f => f.label === 'Historical Similarity')?.score || 0
    return `CRYPTIX is ${Math.round(score * 100)}% confident this is a real attack. The user's behavior was ${deviation >= 0.8 ? 'extremely unusual' : deviation >= 0.5 ? 'suspicious' : 'slightly unusual'
      } compared to their baseline (${Math.round(deviation * 100)}% deviation). The systems targeted are ${criticality >= 0.8 ? 'business-critical' : 'important'
      } banking infrastructure (${Math.round(criticality * 100)}% criticality). This pattern closely matches ${similarity >= 0.7 ? 'known attack signatures' : 'some known patterns'
      } in our threat database (${Math.round(similarity * 100)}% match).`
  }

  const glassStyle = {
    background: 'var(--surface-color)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px'
  }

  const completedCount = incident.killChainStage - 1
  const currentStageName = incident.killChainStages[incident.killChainStage - 1]

  const agents = [
    { label: 'Risk Agent', score: incident.agentScores.risk, color: '#B91C1C' },
    { label: 'Compliance Agent', score: incident.agentScores.compliance, color: '#D97706' },
    { label: 'Business Impact', score: incident.agentScores.businessImpact, color: '#15803D' }
  ]

  const mitreTechniques = Array.isArray(incident?.mitreTechniques) ? incident.mitreTechniques : []
  const visibleMitreTechniques = showAllMitreTechniques ? mitreTechniques : mitreTechniques.slice(0, 4)
  const hasMoreMitre = mitreTechniques.length > 4

  return (
    <div style={{
      padding: '0px',
      minHeight: '100vh',
      backgroundColor: 'transparent'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          background: 'var(--surface-color)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}
      >
        {/* TOP BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--glass-border)',
          paddingBottom: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'transparent',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '7px 8px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-color)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <ArrowLeft size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)' }} />

            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-color)' }}>
              {incident.id}
            </div>

            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-color)' }}>
              {incident.type}
            </div>

            <div style={{
              ...getSeverityStyle(incident.severity),
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}>
              {incident.severity}
            </div>

            <div style={{
              background: 'none',
              border: 'none',
              padding: '3px 0px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textTransform: 'capitalize'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusDotColor(incidentStatus) }} />
              {incidentStatus}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Clock size={12} />
              {incident.detectedAgo}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Role-based escalation: Tier 1 → Tier 2, Tier 2 → Tier 3, Tier 3 → hidden */}
            {user?.role !== 'tier3' && (
              incidentStatus === 'escalated' ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: '#D97706' }}>
                  <CheckCircle2 size={14} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Escalated</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowEscalateModal(true)}
                  style={{
                    background: 'transparent',
                    border: '1.5px solid rgba(217,119,6,0.3)',
                    color: '#D97706',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#D97706';
                    e.currentTarget.style.color = 'white';
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.stroke = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#D97706';
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.stroke = '#D97706';
                  }}
                >
                  <AlertTriangle size={14} color="#D97706" style={{ transition: 'stroke 0.15s ease' }} />
                  Escalate
                </button>
              )
            )}

            <button
              onClick={() => setShowActivateModal(true)}
              disabled={isActivating}
              style={{
                background: '#B91C1C',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(185,28,28,0.35)',
                transition: 'all 0.15s ease',
                opacity: isActivating ? 0.6 : 1,
                pointerEvents: isActivating ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#991B1B';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(185,28,28,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#B91C1C';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(185,28,28,0.35)';
              }}
            >
              <Zap size={14} color="white" />
              {isActivating ? 'Activating...' : 'Activate Response'}
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-color)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {/* TWO COLUMN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
          {/* LEFT COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* AI Narrative */}
            <div style={{ ...glassStyle, borderLeft: '3px solid rgba(0,174,239,0.3)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Incident Narrative</div>
                <div style={{
                  background: 'rgba(0,174,239,0.08)', border: '1px solid rgba(0,174,239,0.15)',
                  borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, color: '#00AEEF',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <Sparkles size={11} />
                  AI Generated
                </div>
              </div>

              {/* Ollama Attribution Row (Change 2) */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '8px 12px', borderRadius: 8,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: '1px solid var(--glass-border)'
              }}>
                <Brain size={12} color="#00AEEF" />
                <span style={{ fontSize: 10, color: '#00AEEF', fontWeight: 600 }}>Generated by Ollama</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{String(llmModel || 'mistral').toUpperCase()}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontSize: 10, color: '#15803D', fontWeight: 600 }}>Offline</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>2,847 tokens</span>
              </div>

              <div style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {displayedNarrative}
                {displayedNarrative.length < fullNarrative.length && (
                  <span style={{
                    display: 'inline-block', width: '2px', height: '14px',
                    background: 'var(--text-color)',
                    animation: 'blink 0.7s step-end infinite',
                    verticalAlign: 'text-bottom', marginLeft: 2
                  }} />
                )}
              </div>
            </div>

            {/* Kill Chain */}
            <div style={{ ...glassStyle, borderLeft: '3px solid rgba(0,174,239,0.3)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <GitBranch size={15} color="#00AEEF" />
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Kill Chain Progression</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                {incident.killChainStages.map((stage, idx) => {
                  const state = idx < completedCount ? 'completed' : idx === completedCount ? 'current' : 'future'

                  return (
                    <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < incident.killChainStages.length - 1 ? 1 : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {state === 'completed' ? (
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: '#00AEEF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 0 4px rgba(0,174,239,0.15)'
                          }}>
                            <Check size={16} color="white" />
                          </div>
                        ) : state === 'current' ? (
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'rgba(0,174,239,0.12)', border: '2px solid #00AEEF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'pulse-ring 2s infinite'
                          }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00AEEF' }} />
                          </div>
                        ) : (
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)'
                          }} />
                        )}
                        <div style={{
                          fontSize: '10px', textAlign: 'center', marginTop: '8px',
                          maxWidth: '64px', lineHeight: 1.3,
                          color: state === 'future' ? 'var(--text-muted)' : 'var(--text-secondary)'
                        }}>
                          {stage}
                        </div>
                      </div>

                      {idx < incident.killChainStages.length - 1 && (
                        <div style={{
                          flex: 1, height: '2px', marginTop: '19px',
                          background: state === 'completed'
                            ? (idx === completedCount - 1 ? 'linear-gradient(90deg, #00AEEF, rgba(0,174,239,0.2))' : '#00AEEF')
                            : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {completedCount} of 6 stages completed · Active: {currentStageName}
                </div>
                <div style={{
                  background: 'rgba(0,174,239,0.08)',
                  border: '1px solid rgba(0,174,239,0.15)',
                  borderRadius: '20px',
                  padding: '2px 10px',
                  fontSize: '11px',
                  color: '#00AEEF'
                }}>
                  {Math.round((completedCount / 6) * 100)}% through attack chain
                </div>
              </div>
            </div>

            {/* Event Chronology */}
            <div style={{ ...glassStyle, marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Play size={15} color="#00AEEF" />
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Incident Replay & Chronology</div>
              </div>

              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                <div style={{
                  position: 'absolute', left: '8px', top: 0, bottom: 0, width: '1px',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }} />

                {incident.timeline.map((event) => (
                  <div key={event.id} style={{ position: 'relative', paddingBottom: '20px' }}>
                    <div style={{
                      position: 'absolute', left: '-20px', top: '3px',
                      width: '12px', height: '12px', borderRadius: '50%',
                      border: '2px solid var(--bg-color)',
                      background: event.severity === 'high' ? '#B91C1C' : event.severity === 'medium' ? '#D97706' : '#15803D'
                    }} />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{event.timestamp}</div>
                        <div style={{
                          background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                          borderRadius: '4px', padding: '1px 8px', fontSize: '11px', color: 'var(--text-secondary)'
                        }}>
                          {event.eventType}
                        </div>
                        <div style={{ fontSize: '11px', color: '#00AEEF' }}>{event.entity}</div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {event.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attack Correlation Graph */}
            <div style={{
              background: 'var(--surface-color)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              flex: 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Network size={15} color="#00AEEF" />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Attack Graph Reconstruction</div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#B91C1C' }} /> Compromised
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706' }} /> Suspected
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(128,128,128,0.3)' }} /> Clean
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '16px', height: '2px', borderTop: '2px dashed #00AEEF' }} /> Virtual Link
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 420, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', position: 'relative' }}>
                {/* Entry Point label */}
                <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--text-muted)', zIndex: 10, pointerEvents: 'none', letterSpacing: '0.05em' }}>Entry Point ↓</div>
                {/* Target Systems label */}
                <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--text-muted)', zIndex: 10, pointerEvents: 'none', letterSpacing: '0.05em' }}>↓ Target Systems</div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView={true}
                  fitViewOptions={{ padding: 0.15 }}
                  onInit={(instance) => { setTimeout(() => { instance.fitView({ padding: 0.15 }) }, 100) }}
                  minZoom={0.3}
                  maxZoom={2}
                  proOptions={{ hideAttribution: true }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Background
                    color={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                    variant="dots"
                    gap={20}
                    size={1}
                  />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {/* Fidelity Score */}
            <div style={{
              ...glassStyle,
              border: incident.fidelityScore > 0.7 ? '1px solid rgba(185,28,28,0.2)' : 'var(--glass-border)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>AI Fidelity Score</div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <svg width="200" height="120" viewBox="0 0 200 120" style={{ overflow: 'visible' }}>
                  <path
                    d={describeArc(100, 100, 75, -90, 90)}
                    fill="none"
                    stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d={describeArc(100, 100, 75, -90, -90 + (180 * incident.fidelityScore))}
                    fill="none"
                    stroke={getFidelityColor(incident.fidelityScore)}
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                  <text x="100" y="92" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--text-color)">
                    {incident.fidelityScore.toFixed(2)}
                  </text>
                  <text x="100" y="110" textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                    Fidelity Score
                  </text>
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                <div style={{
                  background: getFidelityBg(incident.fidelityScore),
                  border: `1px solid ${getFidelityBorder(incident.fidelityScore)}`,
                  color: getFidelityColor(incident.fidelityScore),
                  borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 600
                }}>
                  {incident.fidelityScore >= 0.85 ? "High Confidence Threat" : incident.fidelityScore >= 0.5 ? "Medium Confidence" : "Low Confidence"}
                </div>
              </div>

              {/* Factors */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                {incident.fidelityFactors.map((factor) => (
                  <div key={factor.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{factor.label}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{
                        width: '72px', height: '4px', borderRadius: '2px',
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                      }}>
                        <div style={{
                          width: `${factor.score * 100}%`, height: '100%', borderRadius: '2px',
                          background: getFidelityColor(factor.score)
                        }} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: getFidelityColor(factor.score), minWidth: '32px', textAlign: 'right' }}>
                        {factor.score.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Plain English Explanation (Change 4) */}
              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, marginTop: 14 }}>How this score was calculated</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {getPlainEnglishExplanation(incident.fidelityScore, incident.fidelityFactors)}
                </p>
              </div>
            </div>

            {/* Entities Involved */}
            <div style={{ ...glassStyle, marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Users size={15} color="#00AEEF" />
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Entities Involved</div>
              </div>

              {/* Status Breakdown Summary */}
              {(() => {
                const getEntityStatus = (label) => {
                  const node = incident.graphNodes.find(n => n.label === label)
                  const status = node?.compromised ? 'Compromised' : node?.suspected ? 'Suspected' : 'Clean'
                  const dotColor = status === 'Compromised' ? '#B91C1C' : status === 'Suspected' ? '#D97706' : '#15803D'
                  return { status, dotColor }
                }

                const allEntities = [
                  ...incident.entities.users,
                  ...incident.entities.servers,
                  ...incident.entities.ips
                ]

                const counts = allEntities.reduce((acc, label) => {
                  const { status } = getEntityStatus(label)
                  const s = status.toLowerCase()
                  acc[s] = (acc[s] || 0) + 1
                  return acc
                }, { compromised: 0, suspected: 0, clean: 0 })

                const renderRows = (list, limit = Infinity) => {
                  return list.slice(0, limit).map(item => {
                    const { status, dotColor } = getEntityStatus(item)
                    return (
                      <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-color)' }}>{item}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{status}</div>
                      </div>
                    )
                  })
                }

                const totalCount = allEntities.length
                const visibleCount = Math.min(incident.entities.users.length, MAX_ENTITIES_VISIBLE) +
                  Math.min(incident.entities.servers.length, MAX_ENTITIES_VISIBLE)
                const hasHidden = totalCount > visibleCount

                return (
                  <>
                    <div style={{
                      borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B91C1C' }} />
                          {counts.compromised} compromised
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} />
                          {counts.suspected} suspected
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#15803D' }} />
                          {counts.clean} clean
                        </div>
                      </div>

                      {incident.entities.ips.length > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          {incident.entities.ips.length} IP addresses — view details
                        </div>
                      )}
                    </div>

                    {/* USERS */}
                    {incident.entities.users.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>USERS</div>
                        {renderRows(incident.entities.users, MAX_ENTITIES_VISIBLE)}
                      </div>
                    )}

                    {/* SERVERS */}
                    {incident.entities.servers.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>SERVERS</div>
                        {renderRows(incident.entities.servers, MAX_ENTITIES_VISIBLE)}
                      </div>
                    )}

                    {hasHidden && (
                      <button
                        onClick={() => setShowAllEntities(true)}
                        style={{
                          width: '100%', marginTop: '12px', padding: '8px',
                          background: 'transparent', border: '1px solid var(--glass-border)',
                          borderRadius: '8px', color: '#00AEEF', fontSize: '12px', fontWeight: '500',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(0,174,239,0.06)'
                          e.currentTarget.style.borderColor = 'rgba(0,174,239,0.3)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = 'var(--glass-border)'
                        }}
                      >
                        <Users size={13} />
                        View all {totalCount} entities &rarr;
                      </button>
                    )}
                  </>
                )
              })()}
            </div>

            {/* MITRE ATT&CK */}
            <div style={{ ...glassStyle, marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Shield size={15} color="#00AEEF" />
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>MITRE ATT&CK</div>
              </div>

              {visibleMitreTechniques.map(tech => (
                <div key={tech.id} style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#00AEEF' }}>{tech.id}</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-color)' }}>{tech.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tech.tactic}</div>
                    </div>
                    <div style={{
                      background: 'rgba(0,174,239,0.08)', border: '1px solid rgba(0,174,239,0.15)',
                      borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, color: '#00AEEF'
                    }}>
                      {tech.confidence}%
                    </div>
                  </div>
                  <div style={{
                    marginTop: '10px', height: '3px', borderRadius: '2px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${tech.confidence}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      style={{ height: '100%', background: '#00AEEF', borderRadius: '2px' }}
                    />
                  </div>
                </div>
              ))}

              {hasMoreMitre && (
                <button
                  onClick={() => setShowAllMitreTechniques((prev) => !prev)}
                  style={{
                    width: '100%', marginTop: '8px', padding: '8px',
                    background: 'transparent', border: '1px solid var(--glass-border)',
                    borderRadius: '8px', color: '#00AEEF', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0,174,239,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(0,174,239,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--glass-border)'
                  }}
                >
                  {showAllMitreTechniques ? 'Show less' : `See more (${mitreTechniques.length - 4} more)`}
                </button>
              )}
            </div>

            {/* Multi-Agent Decision */}
            <div style={{ ...glassStyle, marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Brain size={15} color="#00AEEF" />
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Multi-Agent Reasoning</div>
              </div>

              {agents.map(agent => (
                <div key={agent.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: '120px' }}>{agent.label}</div>
                  <div style={{
                    flex: 1, height: '4px', borderRadius: '2px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                  }}>
                    <div style={{
                      width: `${agent.score * 100}%`, height: '100%', borderRadius: '2px',
                      background: agent.color, opacity: 0.85
                    }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: agent.color, minWidth: '32px', textAlign: 'right' }}>
                    {agent.score.toFixed(2)}
                  </div>
                </div>
              ))}

              <div style={{ margin: '16px 0', borderTop: '1px solid var(--glass-border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Voting Engine Decision</div>
                  <div style={{
                    ...getSeverityStyle(incident.agentScores.finalDecision.toLowerCase()),
                    borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 700,
                    minWidth: '68px', textAlign: 'center'
                  }}>
                    {incident.agentScores.finalDecision}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '11px', color: '#15803D' }}>
                  <CheckCircle2 size={13} color="#15803D" />
                  {hasGeneratedPlaybook ? 'Playbook Generated' : 'Playbook Not Generated'}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ACTIVATION TERMINAL (Change 1) — shown above playbook */}
        <AnimatePresence>
          {showActivationTerminal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ marginBottom: 20, overflow: 'hidden' }}
            >
              <div style={{
                background: '#0A0F1A', border: '1px solid rgba(0,174,239,0.2)',
                borderRadius: 12, overflow: 'hidden'
              }}>
                {/* Terminal header */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <div style={{
                    display: 'flex', gap: 6, fontSize: '10px', color: 'rgba(255,255,255,0.2)',
                    fontFamily: "'JetBrains Mono', monospace"
                  }} className="font-mono">
                    [ TERMINAL ]
                  </div>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.05em'
                  }} className="font-mono">
                    CRYPTIX INTERACTIVE SHELL v1.0.4 -- INC-2091
                  </span>
                </div>
                {/* Terminal body */}
                <div ref={terminalBodyRef} style={{
                  padding: '16px 20px', maxHeight: 200, overflowY: 'auto',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6
                }} className="font-mono">
                  {terminalLines.map((line, i) => (
                    line === '' ? (
                      <div key={i} style={{ height: 8 }} />
                    ) : (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          fontFamily: "inherit",
                          color: line.startsWith('[OK]') ? '#4EC9B0'
                            : line.startsWith('$') ? '#00AEEF'
                              : line.startsWith('>') ? 'rgba(204,204,204,0.9)'
                                : 'rgba(204,204,204,0.7)'
                        }}
                      >
                        {line}
                      </motion.div>
                    )
                  ))}
                  {isActivating && (
                    <span style={{
                      display: 'inline-block', width: 8, height: 14,
                      background: '#00AEEF',
                      fontFamily: 'inherit',
                      animation: 'blink 1s step-end infinite',
                      verticalAlign: 'text-bottom', marginLeft: 4
                    }} />
                  )}
                  {!isActivating && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <button
                        onClick={() => setShowActivationTerminal(false)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.3)', fontSize: 11
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PLAYBOOK PANEL - Full Width */}
        <div ref={playbookRef} style={{ ...glassStyle, borderLeft: '3px solid rgba(0,174,239,0.3)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={15} color="#00AEEF" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Response Playbook</div>
                  <div style={{
                    background: hasGeneratedPlaybook ? 'rgba(0,174,239,0.08)' : 'rgba(217,119,6,0.08)',
                    border: hasGeneratedPlaybook ? '1px solid rgba(0,174,239,0.15)' : '1px solid rgba(217,119,6,0.2)',
                    borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600,
                    color: hasGeneratedPlaybook ? '#00AEEF' : '#D97706',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <Sparkles size={11} /> {hasGeneratedPlaybook ? 'AI Generated' : 'Not Generated'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {completedStepsCount} of {displayPlaybookSteps.length || 0} steps completed
                  </div>
                  <div style={{
                    width: '120px',
                    height: '3px',
                    borderRadius: '2px',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(completedStepsCount / Math.max(1, displayPlaybookSteps.length || 1)) * 100}%`,
                      height: '100%',
                      background: '#15803D',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => setShowEscalateModal(true)}
                style={{
                  background: 'transparent',
                  color: '#D97706',
                  border: '1.5px solid rgba(217,119,6,0.35)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#D97706'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#D97706'
                }}
              >
                <AlertTriangle size={14} />
                Escalate to SOC Tier
              </button>

              <button
                onClick={handleGeneratePlaybook}
                disabled={isGeneratingPlaybook}
                style={{
                  background: isGeneratingPlaybook ? 'rgba(0,174,239,0.15)' : 'rgba(0,174,239,0.08)',
                  color: '#00AEEF',
                  border: '1.5px solid rgba(0,174,239,0.35)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isGeneratingPlaybook ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  opacity: isGeneratingPlaybook ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {isGeneratingPlaybook ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isGeneratingPlaybook ? 'Generating...' : hasGeneratedPlaybook ? 'Regenerate' : 'Generate Playbook'}
              </button>

              <button
                onClick={downloadPlaybookPdf}
                disabled={!hasGeneratedPlaybook || isGeneratingPlaybook}
                style={{
                  background: 'transparent',
                  color: (!hasGeneratedPlaybook || isGeneratingPlaybook) ? 'var(--text-muted)' : '#00AEEF',
                  border: (!hasGeneratedPlaybook || isGeneratingPlaybook) ? '1.5px solid var(--glass-border)' : '1.5px solid rgba(0,174,239,0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: (!hasGeneratedPlaybook || isGeneratingPlaybook) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  opacity: (!hasGeneratedPlaybook || isGeneratingPlaybook) ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!hasGeneratedPlaybook || isGeneratingPlaybook) return
                  e.currentTarget.style.background = '#00AEEF'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  if (!hasGeneratedPlaybook || isGeneratingPlaybook) return
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#00AEEF'
                }}
              >
                <Download size={14} />
                Download
              </button>

              <button style={{
                background: 'transparent',
                color: '#15803D',
                border: '1.5px solid rgba(21,128,61,0.4)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                transition: 'all 0.15s ease'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#15803D'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#15803D'
                }}
              >
                <CheckCircle2 size={14} />
                Mark Reviewed
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {`${displayPlaybookSteps.length || 0}-step response outline`}
                </div>
                <div style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {playbookStepLine}
                </div>
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                {hasGeneratedPlaybook ? 'Details in PDF' : 'Generate to enable PDF'}
              </div>
            </div>
            {displayPlaybookSteps.length > 0 && (
              <div style={{
                marginTop: 12,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                {displayPlaybookSteps.slice(0, 6).map((step, idx) => (
                  <div
                    key={`pb-step-${step?.id || idx}`}
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      marginBottom: idx < Math.min(5, displayPlaybookSteps.length - 1) ? 6 : 0
                    }}
                  >
                    {idx + 1}. {(step?.title || step?.description || step?.action || '').toString()}
                  </div>
                ))}
              </div>
            )}
            {!hasGeneratedPlaybook && (
              <div style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px dashed rgba(217,119,6,0.3)',
                background: 'rgba(217,119,6,0.06)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                lineHeight: 1.5,
              }}>
                Showing default response steps. Generate Playbook to create an AI-tailored plan and enable PDF export.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            ...glassStyle,
            maxWidth: '400px', width: '90%', padding: '24px',
            background: isDark ? 'rgba(15,25,40,0.95)' : 'rgba(255,255,255,0.95)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            position: 'relative', border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-color)' }}>Share Incident Report</div>
              <button
                onClick={() => setShowShareModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Select recipients for {incident.id} report
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['CISO', 'Compliance Team', 'Legal Team', 'External Auditor'].map((name, i) => (
                <div
                  key={name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                    borderRadius: '8px', border: '1px solid var(--glass-border)',
                    cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {/* Mock checkbox state */}
                    {i === 0 && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00AEEF' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-color)' }}>{name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {i === 0 ? "Chief Information Security Officer" :
                        i === 1 ? "Regulatory compliance review" :
                          i === 2 ? "Legal implications assessment" : "Third-party audit trail"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowShareModal(false)
                alert('Report shared successfully. Logged in audit trail.')
              }}
              style={{
                marginTop: '20px', width: '100%',
                background: '#00AEEF', color: 'white', borderRadius: '8px',
                padding: '10px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer'
              }}
            >
              Share Report
            </button>

            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              All shares are logged in the immutable audit trail
            </div>
          </div>
        </div>
      )}
      {/* MODALS */}
      <AnimatePresence>
        {showAllEntities && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowAllEntities(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '520px', width: '100%', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                background: isDark ? 'rgba(15,25,40,0.97)' : 'rgba(255,255,255,0.97)',
                border: '1px solid var(--glass-border)', borderRadius: '14px',
                overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
              }}
            >
              {/* MODAL HEADER */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-color)' }}>All Entities Involved</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {(incident.entities.users.length + incident.entities.servers.length + incident.entities.ips.length)} entities across this incident
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Summary chips */}
                    {(() => {
                      const compromised = incident.graphNodes.filter(n => n.compromised).length
                      const suspected = incident.graphNodes.filter(n => n.suspected).length
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B91C1C' }} />
                            {compromised} Compromised
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} />
                            {suspected} Suspected
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <button
                    onClick={() => setShowAllEntities(false)}
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* MODAL BODY */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                {(() => {
                  const getEntityStatus = (label) => {
                    const node = incident.graphNodes.find(n => n.label === label)
                    const status = node?.compromised ? 'Compromised' : node?.suspected ? 'Suspected' : 'Clean'
                    const dotColor = status === 'Compromised' ? '#B91C1C' : status === 'Suspected' ? '#D97706' : '#15803D'
                    return { status, dotColor }
                  }

                  const renderRows = (list) => {
                    return list.map(item => {
                      const { status, dotColor } = getEntityStatus(item)
                      return (
                        <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-color)' }}>{item}</div>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{status}</div>
                        </div>
                      )
                    })
                  }

                  return (
                    <>
                      {incident.entities.users.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>USERS</div>
                          {renderRows(incident.entities.users)}
                        </div>
                      )}
                      {incident.entities.servers.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>SERVERS</div>
                          {renderRows(incident.entities.servers)}
                        </div>
                      )}
                      {incident.entities.ips.length > 0 && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>IP ADDRESSES</div>
                          {renderRows(incident.entities.ips)}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* MODAL FOOTER */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                <button
                  onClick={() => setShowAllEntities(false)}
                  style={{
                    width: '100%', background: 'rgba(0,174,239,0.08)', border: '1px solid rgba(0,174,239,0.15)',
                    color: '#00AEEF', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showActivateModal && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowActivateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '420px', width: '100%',
                background: isDark ? 'rgba(15,25,40,0.97)' : 'rgba(255,255,255,0.97)',
                border: '1px solid var(--glass-border)', borderRadius: '14px',
                overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={16} color="#B91C1C" />
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-color)' }}>Activate Response Plan</div>
                </div>
                <button onClick={() => setShowActivateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{
                  background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.15)',
                  borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', marginBottom: '20px'
                }}>
                  <AlertTriangle size={16} color="#B91C1C" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    This will execute 3 automated containment steps on live systems. Manual steps will remain pending for analyst action.
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Automated steps to execute:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {automatedPlaybookSteps.map(step => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Zap size={12} color="#00AEEF" />
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step.title}</div>
                    </div>
                  ))}
                  {automatedPlaybookSteps.length === 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      No automated steps are currently available for this incident.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setShowActivateModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--glass-border)',
                    color: 'var(--text-muted)', borderRadius: '8px', padding: '9px 16px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivateResponse}
                  disabled={isActivating}
                  style={{
                    background: isActivating ? 'rgba(185,28,28,0.5)' : '#B91C1C', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '9px 20px', fontSize: '13px',
                    fontWeight: 700, cursor: isActivating ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(185,28,28,0.3)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <Zap size={14} />
                  {isActivating ? 'Activating...' : 'Activate Response'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showEscalateModal && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowEscalateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '440px', width: '100%',
                background: isDark ? 'rgba(15,25,40,0.97)' : 'rgba(255,255,255,0.97)',
                border: '1px solid var(--glass-border)', borderRadius: '14px',
                overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={16} color="#D97706" />
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-color)' }}>
                    Escalate Incident
                  </div>
                </div>
                <button onClick={() => setShowEscalateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Escalating <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>{incident.id}</span> · {incident.type} · Fidelity: {incident.fidelityScore}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>Escalate to</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SOC_ESCALATION_TIERS.map((tier) => {
                      const isSelected = selectedSocTier === tier.id
                      return (
                        <button
                          key={tier.id}
                          onClick={() => setSelectedSocTier(tier.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isSelected ? 'rgba(217,119,6,0.3)' : 'var(--glass-border)',
                            background: isSelected ? 'rgba(217,119,6,0.05)' : 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-color)',
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 500,
                          }}
                        >
                          <span>{tier.label}</span>
                          {isSelected ? <Check size={14} color="#D97706" /> : <ArrowRight size={14} color="var(--text-muted)" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Escalation reason</div>
                  <textarea
                    value={escalateReason}
                    onChange={e => setEscalateReason(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px',
                      color: 'var(--text-color)', fontSize: '13px', outline: 'none', resize: 'none'
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>Notify (optional)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {RECIPIENTS.map(recipient => {
                      const isSelected = escalateRecipients.includes(recipient.id)
                      return (
                        <div
                          key={recipient.id}
                          onClick={() => {
                            setEscalateRecipients(prev =>
                              prev.includes(recipient.id)
                                ? prev.filter(r => r !== recipient.id)
                                : [...prev, recipient.id]
                            )
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                            borderRadius: '8px', border: '1px solid',
                            borderColor: isSelected ? 'rgba(217,119,6,0.3)' : 'var(--glass-border)',
                            background: isSelected ? 'rgba(217,119,6,0.05)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            border: '1px solid', borderColor: isSelected ? '#D97706' : 'var(--glass-border)',
                            background: isSelected ? '#D97706' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isSelected && <Check size={11} color="white" />}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-color)', fontWeight: isSelected ? 600 : 400 }}>{recipient.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setShowEscalateModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--glass-border)',
                    color: 'var(--text-muted)', borderRadius: '8px', padding: '9px 16px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEscalate}
                  style={{
                    background: '#D97706', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '9px 20px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', opacity: 1,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <AlertTriangle size={14} />
                  Escalate
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: 0 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
                background: isDark ? 'rgba(15,25,40,0.97)' : 'rgba(255,255,255,0.97)',
                border: '1px solid rgba(217,119,6,0.3)', borderLeft: '3px solid #D97706',
                borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center',
                gap: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: '320px'
              }}
            >
              <CheckCircle2 size={16} color="#D97706" />
              <span style={{ fontSize: '13px', color: 'var(--text-color)', fontWeight: 500 }}>
                {toastMessage}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  )
}

export default IncidentDetail
