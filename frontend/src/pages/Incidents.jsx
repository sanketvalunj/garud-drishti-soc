import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Search, ExternalLink,
    ShieldOff, CheckCircle2, Sparkles,
    GitBranch, Clock, ArrowRight, ChevronDown, ChevronUp, Check, Brain
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ─── MOCK DATA ──────────────────────────────────────────────
export const mockIncidents = [
    {
        id: 'INC-2091',
        type: 'Privilege Escalation',
        entity: 'emp_104',
        sourceIp: '203.0.113.45',
        fidelityScore: 0.87,
        severity: 'high',
        status: 'investigating',
        mitreTactic: 'Privilege Escalation',
        mitreId: 'T1068',
        detectedAt: '2 min ago',
        summary: 'User emp_104 initiated suspicious activity from external IP, moved laterally to core-banking via auth-server.',
        killChainStage: 3,
        entities: ['emp_104', 'auth-server', 'core-banking', '203.0.113.45'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.91 },
            { label: 'Criticality', score: 0.85 },
            { label: 'Similarity', score: 0.79 }
        ]
    },
    {
        id: 'INC-2090',
        type: 'Lateral Movement',
        entity: 'auth-server',
        sourceIp: '185.220.101.1',
        fidelityScore: 0.65,
        severity: 'medium',
        status: 'investigating',
        mitreTactic: 'Lateral Movement',
        mitreId: 'T1021',
        detectedAt: '5 min ago',
        summary: 'Unusual remote service usage detected between auth-server and loan-db-01.',
        killChainStage: 2,
        entities: ['auth-server', 'loan-db-01'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.68 },
            { label: 'Criticality', score: 0.72 },
            { label: 'Similarity', score: 0.55 }
        ]
    },
    {
        id: 'INC-2089',
        type: 'Data Exfiltration',
        entity: 'db_admin',
        sourceIp: '198.51.100.22',
        fidelityScore: 0.92,
        severity: 'high',
        status: 'escalated',
        mitreTactic: 'Exfiltration',
        mitreId: 'T1041',
        detectedAt: '12 min ago',
        summary: 'Large data transfer detected from db_admin to external IP outside business hours.',
        killChainStage: 5,
        entities: ['db_admin', '198.51.100.22'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.94 },
            { label: 'Criticality', score: 0.90 },
            { label: 'Similarity', score: 0.88 }
        ]
    },
    {
        id: 'INC-2088',
        type: 'Brute Force',
        entity: 'vpn_gateway',
        sourceIp: '203.0.113.99',
        fidelityScore: 0.45,
        severity: 'low',
        status: 'contained',
        mitreTactic: 'Credential Access',
        mitreId: 'T1110',
        detectedAt: '1 hr ago',
        summary: 'Multiple failed login attempts detected on VPN gateway from single IP.',
        killChainStage: 1,
        entities: ['vpn_gateway', '203.0.113.99'],
        playbookGenerated: false,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.42 },
            { label: 'Criticality', score: 0.48 },
            { label: 'Similarity', score: 0.40 }
        ]
    },
    {
        id: 'INC-2087',
        type: 'Anomalous Login',
        entity: 'emp_221',
        sourceIp: '10.0.0.45',
        fidelityScore: 0.38,
        severity: 'low',
        status: 'contained',
        mitreTactic: 'Initial Access',
        mitreId: 'T1078',
        detectedAt: '3 hrs ago',
        summary: 'Login from unusual location detected for emp_221 outside working hours.',
        killChainStage: 1,
        entities: ['emp_221', '10.0.0.45'],
        playbookGenerated: false,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.35 },
            { label: 'Criticality', score: 0.40 },
            { label: 'Similarity', score: 0.32 }
        ]
    },
    {
        id: 'INC-2086',
        type: 'Privilege Escalation',
        entity: 'svc_account_01',
        sourceIp: '172.16.0.12',
        fidelityScore: 0.78,
        severity: 'medium',
        status: 'investigating',
        mitreTactic: 'Privilege Escalation',
        mitreId: 'T1068',
        detectedAt: '4 hrs ago',
        summary: 'Service account used to escalate privileges on file server.',
        killChainStage: 3,
        entities: ['svc_account_01', 'file-server-02'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.80 },
            { label: 'Criticality', score: 0.75 },
            { label: 'Similarity', score: 0.72 }
        ]
    },
    {
        id: 'INC-2085',
        type: 'Malware Detected',
        entity: 'user_laptop_88',
        sourceIp: '10.0.1.88',
        fidelityScore: 0.91,
        severity: 'high',
        status: 'escalated',
        mitreTactic: 'Execution',
        mitreId: 'T1059',
        detectedAt: '5 hrs ago',
        summary: 'Powershell execution detected with encoded command on user endpoint.',
        killChainStage: 2,
        entities: ['user_laptop_88', '10.0.1.88'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.93 },
            { label: 'Criticality', score: 0.89 },
            { label: 'Similarity', score: 0.85 }
        ]
    },
    {
        id: 'INC-2084',
        type: 'Suspicious Execution',
        entity: 'web_server_prod',
        sourceIp: '203.0.113.77',
        fidelityScore: 0.41,
        severity: 'low',
        status: 'contained',
        mitreTactic: 'Execution',
        mitreId: 'T1059',
        detectedAt: '6 hrs ago',
        summary: 'Unusual script execution on production web server.',
        killChainStage: 2,
        entities: ['web_server_prod'],
        playbookGenerated: false,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.44 },
            { label: 'Criticality', score: 0.38 },
            { label: 'Similarity', score: 0.40 }
        ]
    },
    {
        id: 'INC-2083',
        type: 'Data Exfiltration',
        entity: 'finance_user_03',
        sourceIp: '185.220.101.45',
        fidelityScore: 0.88,
        severity: 'high',
        status: 'investigating',
        mitreTactic: 'Exfiltration',
        mitreId: 'T1041',
        detectedAt: '8 hrs ago',
        summary: 'Sensitive financial records accessed and transferred externally.',
        killChainStage: 5,
        entities: ['finance_user_03', '185.220.101.45', 'finance-db'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.90 },
            { label: 'Criticality', score: 0.86 },
            { label: 'Similarity', score: 0.82 }
        ]
    },
    {
        id: 'INC-2082',
        type: 'Lateral Movement',
        entity: 'swift-terminal',
        sourceIp: '10.0.2.15',
        fidelityScore: 0.72,
        severity: 'medium',
        status: 'investigating',
        mitreTactic: 'Lateral Movement',
        mitreId: 'T1021',
        detectedAt: '10 hrs ago',
        summary: 'Unauthorized access attempt on SWIFT terminal from internal IP.',
        killChainStage: 3,
        entities: ['swift-terminal', '10.0.2.15'],
        playbookGenerated: true,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.75 },
            { label: 'Criticality', score: 0.70 },
            { label: 'Similarity', score: 0.68 }
        ]
    },
    {
        id: 'INC-2081',
        type: 'Brute Force',
        entity: 'admin_portal',
        sourceIp: '198.51.100.55',
        fidelityScore: 0.55,
        severity: 'medium',
        status: 'contained',
        mitreTactic: 'Credential Access',
        mitreId: 'T1110',
        detectedAt: '12 hrs ago',
        summary: 'Automated brute force attack on admin portal detected and blocked.',
        killChainStage: 1,
        entities: ['admin_portal', '198.51.100.55'],
        playbookGenerated: false,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.58 },
            { label: 'Criticality', score: 0.52 },
            { label: 'Similarity', score: 0.54 }
        ]
    },
    {
        id: 'INC-2080',
        type: 'Anomalous Login',
        entity: 'emp_089',
        sourceIp: '10.0.0.89',
        fidelityScore: 0.33,
        severity: 'low',
        status: 'contained',
        mitreTactic: 'Initial Access',
        mitreId: 'T1078',
        detectedAt: '1 day ago',
        summary: 'Login from new device detected for emp_089.',
        killChainStage: 1,
        entities: ['emp_089'],
        playbookGenerated: false,
        fidelityFactors: [
            { label: 'Behavioral', score: 0.36 },
            { label: 'Criticality', score: 0.30 },
            { label: 'Similarity', score: 0.32 }
        ]
    }
];

const killChainStages = [
  'Initial Access',
  'Execution', 
  'Persistence',
  'Privilege Escalation',
  'Lateral Movement',
  'Exfiltration'
];

// ─── HELPER STYLES ──────────────────────────────────────────
const glassCard = {
    background: 'var(--surface-color)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box',
};

const severityBadgeStyle = {
    high: {
        background: 'rgba(185,28,28,0.08)',
        color: '#B91C1C',
        border: '1px solid rgba(185,28,28,0.15)',
    },
    medium: {
        background: 'rgba(217,119,6,0.08)',
        color: '#D97706',
        border: '1px solid rgba(217,119,6,0.15)',
    },
    low: {
        background: 'rgba(0,174,239,0.08)',
        color: '#00AEEF',
        border: '1px solid rgba(0,174,239,0.15)',
    },
};

const getStatusDotColor = (status) => {
    switch (status.toLowerCase()) {
        case 'investigating': return '#8B5CF6';
        case 'contained': return '#15803D';
        case 'escalated': return '#B91C1C';
        default: return 'var(--text-muted)';
    }
};

const statusBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
};

const badgeBase = {
    fontSize: '12px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '8px', /* More chip styled */
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center', /* Center text */
    textTransform: 'capitalize',
};

const getFidelityColor = (score) => {
    if (score >= 0.85) return '#B91C1C';
    if (score >= 0.5) return '#D97706';
    return 'var(--text-secondary)';
};




// ─── CUSTOM SELECT COMPONENT ────────────────────────────────
const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder,
    isActive = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener(
            'mousedown', handleClickOutside
        );
    }, []);

    const selectedLabel = options.find(
        o => o.value === value
    )?.label || placeholder;

    return (
        <div
            ref={ref}
            style={{ position: 'relative', width: 'fit-content' }}
        >
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    padding: '8px 6px',
                    background: isOpen
                        ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                        : isActive
                            ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,174,239,0.1)')
                            : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    border: isOpen
                        ? (isDark ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(0,174,239,0.4)')
                        : isActive
                            ? (isDark ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(0,174,239,0.25)')
                            : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'),
                    borderRadius: '8px',
                    color: isActive 
                        ? (isDark ? '#FFFFFF' : '#007099') 
                        : 'var(--text-primary)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '13px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    ...(isOpen && {
                        boxShadow: isDark ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,174,239,0.1)'
                    })
                }}
            >
                <span>{selectedLabel}</span>
                <ChevronDown
                    size={14}
                    style={{
                        color: 'var(--text-muted)',
                        transform: isOpen
                            ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                    }}
                />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'var(--surface-color)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isDark
                        ? '1px solid rgba(255,255,255,0.1)'
                        : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    boxShadow: isDark
                        ? '0 10px 30px rgba(0,0,0,0.5)'
                        : '0 10px 30px rgba(0,0,0,0.1)',
                    minWidth: '100%'
                }}>
                    {options.map((option, index) => (
                        <div
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '9px 14px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                color: value === option.value
                                    ? isDark ? '#FFFFFF' : '#000000'
                                    : 'var(--text-primary)',
                                fontWeight: value === option.value ? 700 : 400,
                                background: value === option.value
                                    ? isDark
                                        ? 'rgba(255,255,255,0.08)'
                                        : 'rgba(0,0,0,0.04)'
                                    : 'transparent',
                                borderBottom: index < options.length - 1
                                    ? isDark
                                        ? '1px solid rgba(255,255,255,0.05)'
                                        : '1px solid rgba(0,0,0,0.05)'
                                    : 'none',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background = isDark
                                        ? 'rgba(255,255,255,0.05)'
                                        : 'rgba(0,0,0,0.03)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background =
                                        'transparent';
                                }
                            }}
                        >
                            <span>{option.label}</span>
                            {value === option.value && (
                                <Check size={13} color={isDark ? '#FFFFFF' : 'var(--text-primary)'} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── FIDELITY TOOLTIP CELL ──────────────────────────────────
const FidelityCell = ({ score }) => {
    const [hover, setHover] = useState(false);
    const risk = (score * 1.0).toFixed(2);
    const comp = (score * 0.82).toFixed(2);
    const impact = (score * 0.71).toFixed(2);

    return (
        <div
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: getFidelityColor(score),
                cursor: 'default',
            }}>
                {score.toFixed(2)}
            </span>
            {hover && (
                <div style={{
                    position: 'absolute',
                    bottom: '130%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.85)',
                    color: 'white',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    zIndex: 50,
                    pointerEvents: 'none',
                }}>
                    Risk: {risk} | Comp: {comp} | Impact: {impact}
                </div>
            )}
        </div>
    );
};

// ─── KILL CHAIN STEPPER ─────────────────────────────────────
const KillChainStepper = ({ stage }) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const connectorFuture = isDark
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.12)';

    const connectorCompleted = '#00AEEF';

    const connectorCurrent = isDark
        ? 'linear-gradient(90deg, #00AEEF, rgba(0,174,239,0.2))'
        : 'linear-gradient(90deg, #00AEEF, rgba(0,174,239,0.15))';

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                {killChainStages.map((s, i) => {
                    const isCompleted = i < stage - 1;
                    const isCurrent = i === stage - 1;
                    const isFuture = i >= stage;

                    const dotStyle = {
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontWeight: 700,
                        ...(isCompleted
                            ? { background: '#00AEEF', color: 'white' }
                            : isCurrent
                                ? { 
                                    background: 'rgba(0,174,239,0.15)', 
                                    border: '2px solid #00AEEF', 
                                    color: '#00AEEF',
                                    boxShadow: '0 0 0 4px rgba(0,174,239,0.15)'
                                  }
                                : { 
                                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', 
                                    color: 'var(--text-muted)', 
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'}` 
                                  }
                        ),
                    };

                    const lineStyle = {
                        flex: 1,
                        height: 2,
                        marginTop: 12,
                        background: isCompleted 
                            ? connectorCompleted 
                            : isCurrent 
                                ? connectorCurrent 
                                : connectorFuture,
                    };

                    return (
                        <div key={s} style={{ display: 'flex', alignItems: 'flex-start', flex: i < killChainStages.length - 1 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <motion.div 
                                    style={dotStyle}
                                    animate={isCurrent ? {
                                        scale: [1, 1.08, 1],
                                        boxShadow: [
                                            '0 0 0 0px rgba(0,174,239,0.2)',
                                            '0 0 0 10px rgba(0,174,239,0)',
                                            '0 0 0 0px rgba(0,174,239,0.2)'
                                        ]
                                    } : {}}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    {i + 1}
                                </motion.div>
                                <div style={{
                                    fontSize: 9,
                                    color: isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                                    textAlign: 'center',
                                    marginTop: 4,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {s}
                                </div>
                            </div>
                            {i < killChainStages.length - 1 && <div style={lineStyle} />}
                        </div>
                    );
                })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                {stage - 1} of 6 stages completed · Active: {killChainStages[stage - 1]}
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────
const Incidents = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const [searchQuery, setSearchQuery] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState('24hr');
    const [sortBy, setSortBy] = useState('fidelity');
    const [expandedRow, setExpandedRow] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);

    useEffect(() => {
        const incidentId = searchParams.get('highlight');
        if (incidentId) {
            setHighlightedId(incidentId);
            setExpandedRow(incidentId);
            setTimeout(() => setHighlightedId(null), 4000);
        }
    }, []);

    const filteredIncidents = mockIncidents
        .filter(inc => {
            const matchSearch =
                inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                inc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                inc.entity.toLowerCase().includes(searchQuery.toLowerCase());
            const matchSeverity = severityFilter === 'all' || inc.severity === severityFilter;
            const matchStatus = statusFilter === 'all' || inc.status === statusFilter;
            return matchSearch && matchSeverity && matchStatus;
        })
        .sort((a, b) => {
            if (sortBy === 'fidelity') return b.fidelityScore - a.fidelityScore;
            if (sortBy === 'time') return 0;
            if (sortBy === 'severity') {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.severity] - order[b.severity];
            }
            return 0;
        });

    const activeFiltersCount = [
        severityFilter !== 'all',
        statusFilter !== 'all',
        timeFilter !== '24hr',
        sortBy !== 'fidelity'
    ].filter(Boolean).length;

    const counts = {
        investigating: mockIncidents.filter(i => i.status === 'investigating').length,
        contained: mockIncidents.filter(i => i.status === 'contained').length,
        escalated: mockIncidents.filter(i => i.status === 'escalated').length,
    };

    const handleRowClick = (id) => {
        setExpandedRow(prev => (prev === id ? null : id));
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSeverityFilter('all');
        setStatusFilter('all');
        setTimeFilter('24hr');
        setSortBy('fidelity');
    };

    const gridCols = '120px 1fr 1fr 120px 110px 140px 120px 40px';

    return (
        <div className="space-y-2">

            {/* ── SECTION 1: Page Header ── */}
            <div style={{ padding: '0 0 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Incidents</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                        Security incident tracking and investigation
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {[
                        { value: mockIncidents.length, label: 'Total' },
                        { value: counts.investigating, label: 'Investigating' },
                        { value: counts.contained, label: 'Contained' },
                        { value: counts.escalated, label: 'Escalated' },
                    ].map(chip => (
                        <div key={chip.label} style={{
                            background: isDark 
                                ? 'rgba(255,255,255,0.05)' 
                                : 'rgba(255,255,255,0.2)',
                            border: isDark
                                ? '1px solid rgba(255,255,255,0.08)'
                                : 'none',
                            borderRadius: 8,
                            padding: '10px 20px',
                            textAlign: 'center',
                            minWidth: 80,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                        }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{chip.value}</div>
                            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{chip.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SECTION 2: Filter Bar (Standalone, no card background) ── */}
            <div>

                {/* Filter Bar */}
                {/* Filter Bar */}
                <div style={{ marginBottom: '16px', position: 'relative', zIndex: 50 }}>
                {/* Main Filter Row: Search + Chips */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '0 0 8px 0',
                }}>
                {/* Search */}
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={18} style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                    }} />
                    <input
                        type="text"
                        placeholder="Search incidents, entities, IDs..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '0.6px solid white',
                            borderRadius: 20,
                            height: 46,
                            padding: '0 20px 0 42px',
                            color: 'var(--text-color)',
                            fontSize: 15,
                            width: '100%',
                            outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Severity dropdown */}
                <CustomSelect
                    value={severityFilter}
                    onChange={setSeverityFilter}
                    placeholder="All Severity"
                    isActive={severityFilter !== 'all'}
                    options={[
                        { value: 'all', label: 'All Severity' },
                        { value: 'high', label: 'High Severity' },
                        { value: 'medium', label: 'Medium Severity' },
                        { value: 'low', label: 'Low Severity' }
                    ]}
                />

                {/* Status dropdown */}
                <CustomSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="All Status"
                    isActive={statusFilter !== 'all'}
                    options={[
                        { value: 'all', label: 'All Status' },
                        { value: 'investigating', label: 'Investigating' },
                        { value: 'contained', label: 'Contained' },
                        { value: 'escalated', label: 'Escalated' }
                    ]}
                />

                {/* Time Range dropdown */}
                <CustomSelect
                    value={timeFilter}
                    onChange={setTimeFilter}
                    placeholder="Last 24 Hours"
                    isActive={timeFilter !== '24hr'}
                    options={[
                        { value: '1hr', label: 'Last 1 Hour' },
                        { value: '6hr', label: 'Last 6 Hours' },
                        { value: '24hr', label: 'Last 24 Hours' },
                        { value: '7days', label: 'Last 7 Days' }
                    ]}
                />

                {/* Sort By dropdown */}
                <CustomSelect
                    value={sortBy}
                    onChange={setSortBy}
                    placeholder="Sort By"
                    isActive={sortBy !== 'fidelity'}
                    options={[
                        { value: 'fidelity', label: 'Sort by Fidelity' },
                        { value: 'time', label: 'Sort by Time' },
                        { value: 'severity', label: 'Sort by Severity' }
                    ]}
                />

                {/* Results count (Always show in Row 1) */}
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {filteredIncidents.length} incidents found
                </span>
                </div>

                {/* Sub-row: Applied filters indicator and Reset button (Aligned Right) */}
                {activeFiltersCount > 0 && (
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end', 
                        minHeight: '24px',
                        marginTop: '4px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Filters Applied ({activeFiltersCount})
                            </span>
                            <button
                                onClick={clearFilters}
                                style={{
                                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    height: '22px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                            >
                                Reset All
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* ── SECTION 3: Incidents Table (Inside card) ── */}
            <div style={{ ...glassCard, overflow: 'hidden', width: '100%', tableLayout: 'fixed', padding: '8px' }}>

                {/* Table Header */}
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'grid',
                    gridTemplateColumns: gridCols,
                    gap: 12,
                }}>
                    {['Incident ID', 'Attack Type', 'Affected Entity', 'Fidelity', 'Severity', 'Status', 'Detected'].map(h => (
                        <span key={h} style={{ 
                            fontFamily: "'Inter', sans-serif", 
                            fontSize: 13, 
                            color: 'var(--text-muted)', 
                            fontWeight: 600,
                            textAlign: (h === 'Severity' || h === 'Status') ? 'center' : 'left'
                        }}>{h}</span>
                    ))}
                </div>

                {/* Rows */}
                {filteredIncidents.length === 0 ? (
                    /* ── SECTION 4: Empty State ── */
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <ShieldOff size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>
                            No incidents match your filters
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            Try adjusting your search or filter criteria
                        </p>
                        <button
                            onClick={clearFilters}
                            style={{
                                marginTop: 16,
                                background: 'rgba(0,174,239,0.1)',
                                border: '1px solid rgba(0,174,239,0.2)',
                                color: '#00AEEF',
                                padding: '8px 20px',
                                borderRadius: 8,
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    filteredIncidents.map(incident => {
                        const isHighlighted = highlightedId === incident.id;
                        const isExpanded = expandedRow === incident.id;
                        const sevStyle = severityBadgeStyle[incident.severity] || severityBadgeStyle.low;

                        return (
                            <div 
                                key={incident.id}
                                className={`group transition-all duration-300 hover:scale-[1.01] relative z-0 hover:z-20 mx-2 rounded-lg border-white/10
                                    ${!isDark ? 'hover:border-white/80' : 'hover:border-white/40'} 
                                    ${isExpanded ? (isDark ? 'border-white/20' : 'border-white/60') : 'border-transparent'}`}
                                style={{
                                    marginBottom: '6px',
                                    marginTop: '2px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderWidth: '0.5px',
                                    borderStyle: 'solid',
                                    boxShadow: isExpanded ? '0 0 15px rgba(255,255,255,0.05)' : 'none'
                                }}
                            >
                                {/* Background layer for expanded state and highlight hover effect */}
                                <div className={`absolute inset-0 transition-all duration-300 pointer-events-none -z-10 
                                    ${isHighlighted ? 'bg-[rgba(0,174,239,0.08)]' : isExpanded ? (isDark ? 'bg-[rgba(0,174,239,0.05)]' : 'bg-[rgba(0,174,239,0.03)]') : ''} 
                                    group-hover:opacity-75`} />

                                {/* Left Highlight Indicator Strip */}
                                {isHighlighted && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '4px',
                                        background: '#00AEEF',
                                        borderRadius: '12px 0 0 12px',
                                        zIndex: 10,
                                        pointerEvents: 'none'
                                    }} />
                                )}

                                {/* Main Row */}
                                <div
                                    onClick={() => handleRowClick(incident.id)}
                                    className={`${isHighlighted ? 'pulse-highlight-row' : ''} transition-all duration-300 group-hover:bg-white/5`}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: gridCols,
                                        gap: 12,
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        alignItems: 'center',
                                        background: 'transparent'
                                    }}
                                >
                                    {/* Cell 1: Incident ID */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                        <span
                                            style={{ color: '#00AEEF', fontSize: 13, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            onClick={e => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                                        >
                                            {incident.id}
                                        </span>
                                        <ExternalLink
                                            size={12}
                                            style={{ color: '#00AEEF', cursor: 'pointer', flexShrink: 0 }}
                                            onClick={e => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                                        />
                                    </div>

                                    {/* Cell 2: Attack Type */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
                                        <span style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text-color)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incident.type}</span>
                                    </div>

                                    {/* Cell 3: Affected Entity */}
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                        {incident.entity}
                                    </span>


                                    {/* Cell 5: Fidelity Score */}
                                    <div style={{
                                      display: 'inline-flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-start',
                                      gap: '3px'
                                    }}>
                                      <span style={{
                                        fontFamily: "'Inter', sans-serif",
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        color: 'var(--text-primary)'
                                      }}>
                                        {incident.fidelityScore}
                                      </span>
                                      <div style={{
                                        width: '48px',
                                        height: '3px',
                                        borderRadius: '2px',
                                        background: isDark 
                                          ? 'rgba(255,255,255,0.08)' 
                                          : 'rgba(0,0,0,0.08)',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          height: '100%',
                                          borderRadius: '2px',
                                          width: `${incident.fidelityScore * 100}%`,
                                          background: incident.fidelityScore >= 0.85 
                                            ? '#B91C1C' 
                                            : incident.fidelityScore >= 0.5 
                                              ? '#D97706' 
                                              : '#15803D'
                                        }} />
                                      </div>
                                    </div>

                                    {/* Cell 6: Severity Badge */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <span style={{ ...badgeBase, ...sevStyle }}>{incident.severity}</span>
                                    </div>

                                    {/* Cell 7: Status Badge */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <span style={statusBadgeStyle}>
                                            <span style={{ 
                                                width: 6, 
                                                height: 6, 
                                                borderRadius: '50%', 
                                                background: getStatusDotColor(incident.status),
                                                flexShrink: 0 
                                            }} />
                                            {incident.status}
                                        </span>
                                    </div>


                                    {/* Cell 9: Detected */}
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                        {incident.detectedAt}
                                    </span>

                                    {/* Arrow icon */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isExpanded ? (
                                            <ChevronUp size={14} color="var(--text-muted)" style={{ transition: 'transform 0.2s ease' }} />
                                        ) : (
                                            <ChevronDown size={14} color="var(--text-muted)" style={{ transition: 'transform 0.2s ease' }} />
                                        )}
                                    </div>


                                </div>

                                {/* Expanded Row */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <div 
                                                className="transition-all duration-300"
                                                style={{
                                                    padding: '0 24px 24px 24px',
                                                    display: 'flex',
                                                    gap: 32,
                                                    marginBottom: '6px'
                                                }}>
                                                {/* Left: Triage Information */}
                                                <div style={{ flex: 1 }}>
                                                    {/* Block 1: Kill Chain */}
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <GitBranch size={11} color="#00AEEF" />
                                                        Kill Chain Progress
                                                    </div>
                                                    <KillChainStepper stage={incident.killChainStage} />

                                                    {/* Block 2: AI Summary */}
                                                    <div style={{ marginTop: 16 }}>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <Sparkles size={11} color="#00AEEF" />
                                                            AI Analysis
                                                        </div>

                                                        {/* Ollama Header */}
                                                        <div style={{
                                                            display: 'flex',
                                                            gap: '8px',
                                                            alignItems: 'center',
                                                            marginBottom: '8px',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            background: isDark ? 'rgba(0,174,239,0.04)' : 'rgba(0,174,239,0.03)',
                                                            border: '1px solid rgba(0,174,239,0.1)'
                                                        }}>
                                                            <Brain size={11} color="#00AEEF" />
                                                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#00AEEF', fontFamily: 'monospace' }}>
                                                                Ollama · Llama 3.1 8B
                                                            </span>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>·</span>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Offline inference</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontFamily: 'monospace',
                                                                color: getFidelityColor(incident.fidelityScore),
                                                                fontWeight: 600
                                                            }}>
                                                                {Math.round(incident.fidelityScore * 100)}% confidence
                                                            </span>
                                                        </div>

                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                                                            {incident.summary}
                                                        </div>

                                                        {/* Scoring Breakdown Row */}
                                                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                                                            {incident.fidelityFactors?.map(factor => {
                                                                const factorColor = getFidelityColor(factor.score);
                                                                return (
                                                                    <div key={factor.label} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{factor.label}:</span>
                                                                        <div style={{
                                                                            width: '40px',
                                                                            height: '3px',
                                                                            borderRadius: '2px',
                                                                            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                                                            overflow: 'hidden'
                                                                        }}>
                                                                            <div style={{
                                                                                height: '100%',
                                                                                width: `${factor.score * 100}%`,
                                                                                background: factorColor,
                                                                                borderRadius: '2px'
                                                                            }} />
                                                                        </div>
                                                                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: factorColor, fontWeight: 600 }}>
                                                                            {Math.round(factor.score * 100)}%
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Block 3: Entities */}
                                                    <div style={{ marginTop: 14 }}>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                                                            Affected Entities
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                                                            {incident.entities.map(ent => (
                                                                <span key={ent} style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    background: isDark 
                                                                      ? 'rgba(255,255,255,0.05)' 
                                                                      : 'rgba(0,0,0,0.04)',
                                                                    border: isDark
                                                                      ? '1px solid rgba(255,255,255,0.1)'
                                                                      : '1px solid rgba(0,0,0,0.1)',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 10px',
                                                                    fontSize: '11px',
                                                                    fontFamily: "'Inter', sans-serif",
                                                                    color: 'var(--text-secondary)',
                                                                    margin: '3px'
                                                                }}>
                                                                    {ent}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Block 4: Status Row */}
                                                    <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                                                        {incident.playbookGenerated ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#15803D', fontSize: 12 }}>
                                                                <CheckCircle2 size={13} />
                                                                Playbook ready
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                                                                <Clock size={13} />
                                                                Playbook pending
                                                            </div>
                                                        )}
                                                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                                                        <span style={{
                                                            background: 'rgba(0,174,239,0.08)',
                                                            border: '1px solid rgba(0,174,239,0.15)',
                                                            borderRadius: 4,
                                                            padding: '2px 8px',
                                                            fontSize: 11,
                                                            fontFamily: "'Inter', sans-serif",
                                                            color: '#00AEEF',
                                                        }}>
                                                            {incident.mitreId} · {incident.mitreTactic}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Right: Action Area */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                    {/* Fidelity Score */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Fidelity Score</div>
                                                        <div style={{ 
                                                            fontSize: 28, 
                                                            fontWeight: 700, 
                                                            fontFamily: "'Inter', sans-serif", 
                                                            color: incident.fidelityScore >= 0.85 ? '#B91C1C' : incident.fidelityScore >= 0.5 ? '#D97706' : '#15803D',
                                                            textAlign: 'right'
                                                        }}>
                                                            {incident.fidelityScore.toFixed(2)}
                                                        </div>
                                                        <div style={{ 
                                                            fontSize: 11, 
                                                            textAlign: 'right',
                                                            color: incident.fidelityScore >= 0.85 ? '#B91C1C' : incident.fidelityScore >= 0.5 ? '#D97706' : '#15803D',
                                                        }}>
                                                            {incident.fidelityScore >= 0.85 ? 'High confidence threat' : incident.fidelityScore >= 0.5 ? 'Medium confidence' : 'Low confidence'}
                                                        </div>
                                                    </div>

                                                    {/* CTA Button */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 }}>
                                                        <button
                                                            onClick={() => navigate(`/incidents/${incident.id}`, { state: { from: 'incidents' } })}
                                                            style={{
                                                                background: '#00AEEF',
                                                                color: 'white',
                                                                fontWeight: 600,
                                                                fontSize: 13,
                                                                padding: '10px 24px',
                                                                borderRadius: 8,
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                boxShadow: '0 0 20px rgba(0,174,239,0.25)',
                                                                transition: 'all 0.2s ease',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.background = '#0096CC';
                                                                e.currentTarget.style.boxShadow = '0 0 28px rgba(0,174,239,0.4)';
                                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.background = '#00AEEF';
                                                                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,174,239,0.25)';
                                                                e.currentTarget.style.transform = 'translateY(0px)';
                                                            }}
                                                        >
                                                            View Full Details <ArrowRight size={14} />
                                                        </button>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                                                            Full investigation · Playbook · Graph
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })
                )}
                </div>
            </div>
    );
};

export default Incidents;
