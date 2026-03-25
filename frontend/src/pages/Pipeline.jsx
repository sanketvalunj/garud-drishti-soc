import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { usePipeline } from '../context/PipelineContext'
import {
  Play, Loader2, Upload, FileText,
  CheckCircle2, X, Lock, Database,
  GitBranch, Brain, Users, BookOpen,
  Save, Activity, History, BarChart2,
  Clock, Check, Sparkles
} from 'lucide-react'

// ─────────────────────────────────────
// API INTEGRATION:
//
// Pipeline status: GET /admin/pipeline-status
// Run pipeline: POST /admin/run-pipeline
// Pipeline history: GET /admin/pipeline-history
// Upload logs: POST /admin/ingest-logs
//
// Replace mock data with API calls
// when backend is connected.
// Structure matches API response exactly.
// ─────────────────────────────────────

const MOCK_PIPELINE_STATUS = {
  isRunning: false,
  lastRun: {
    id: 'RUN-047',
    startTime: '12:11:47',
    endTime: '12:12:34',
    duration: '47s',
    date: '19 Feb 2026',
    incidentsGenerated: 12,
    status: 'completed'
  },
  stages: [
    {
      id: 1,
      name: 'Log Ingestion',
      description: 'Collecting events from SIEM, EDR, IAM',
      status: 'completed',
      duration: '0.8s',
      eventsProcessed: 847,
      icon: Database
    },
    {
      id: 2,
      name: 'Event Correlation',
      description: 'Correlating related events into incidents',
      status: 'completed',
      duration: '12.3s',
      eventsProcessed: 12,
      icon: GitBranch
    },
    {
      id: 3,
      name: 'AI Analysis',
      description: 'LLM generating narratives and classifications',
      status: 'completed',
      duration: '18.7s',
      eventsProcessed: 12,
      icon: Brain
    },
    {
      id: 4,
      name: 'Agent Scoring',
      description: 'Risk, Compliance and Impact agents voting',
      status: 'completed',
      duration: '8.2s',
      eventsProcessed: 36,
      icon: Users
    },
    {
      id: 5,
      name: 'Playbook Generation',
      description: 'AI generating response playbooks per incident',
      status: 'completed',
      duration: '6.9s',
      eventsProcessed: 12,
      icon: BookOpen
    },
    {
      id: 6,
      name: 'Output & Storage',
      description: 'Storing incidents and notifying analysts',
      status: 'completed',
      duration: '0.4s',
      eventsProcessed: 12,
      icon: Save
    }
  ]
}

const MOCK_PIPELINE_STATS = {
  totalRuns: 47,
  avgDuration: '48s',
  totalIncidents: 312,
  successRate: '98.9%'
}

const MOCK_PIPELINE_HISTORY = [
  {
    id: 'RUN-047',
    date: '19 Feb 2026',
    time: '12:11:47',
    duration: '47s',
    incidents: 12,
    events: 847,
    status: 'completed'
  },
  {
    id: 'RUN-046',
    date: '19 Feb 2026',
    time: '11:45:18',
    duration: '52s',
    incidents: 8,
    events: 623,
    status: 'completed'
  },
  {
    id: 'RUN-045',
    date: '19 Feb 2026',
    time: '10:22:44',
    duration: '38s',
    incidents: 3,
    events: 201,
    status: 'completed'
  },
  {
    id: 'RUN-044',
    date: '19 Feb 2026',
    time: '09:15:33',
    duration: '61s',
    incidents: 15,
    events: 1203,
    status: 'completed'
  },
  {
    id: 'RUN-043',
    date: '18 Feb 2026',
    time: '22:10:05',
    duration: '44s',
    incidents: 6,
    events: 445,
    status: 'completed'
  },
  {
    id: 'RUN-042',
    date: '18 Feb 2026',
    time: '21:33:19',
    duration: '0s',
    incidents: 0,
    events: 0,
    status: 'failed'
  }
]

const Pipeline = () => {
  const { isRunning, lastRun, runPipeline, currentStage } = usePipeline()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [pipelineStatus] = useState(MOCK_PIPELINE_STATUS)
  const [history] = useState(MOCK_PIPELINE_HISTORY)
  const [stats] = useState(MOCK_PIPELINE_STATS)
  
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSource, setUploadSource] = useState('windows_event')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Pipeline run is now handled globally via context
  const handleRunPipeline = () => {
    runPipeline();
  }

  // File upload handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(f => 
      ['.log', '.json', '.csv', '.txt', '.evtx', '.xml'].some(ext => 
        f.name.endsWith(ext)
      )
    )
    setUploadedFiles(prev => [...prev, ...validFiles])
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files)
    setUploadedFiles(prev => [...prev, ...files])
  }

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return
    setIsUploading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsUploading(false)
    setUploadSuccess(true)
    setUploadedFiles([])
    setTimeout(() => setUploadSuccess(false), 3000)
  }

  const sourceOptions = [
    { value: 'windows_event', label: 'Windows Event Log' },
    { value: 'syslog', label: 'Syslog / Linux' },
    { value: 'aws_cloudtrail', label: 'AWS CloudTrail' },
    { value: 'azure_sentinel', label: 'Azure Sentinel' },
    { value: 'splunk', label: 'Splunk Export' },
    { value: 'custom_json', label: 'Custom JSON' },
    { value: 'csv', label: 'CSV Format' }
  ]

  const getStageStatus = (stageId) => {
    if (!isRunning && currentStage === 6) return 'completed'
    if (stageId < currentStage) return 'completed'
    if (stageId === currentStage) return 'running'
    return 'pending'
  }

  const getStageColor = (status) => ({
    completed: '#15803D',
    running: '#00AEEF',
    pending: 'var(--text-muted)',
    failed: '#B91C1C'
  }[status] || 'var(--text-muted)')

  const glassStyle = {
    background: 'var(--surface-color)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '20px'
  }

  const formattedLastRunDate = lastRun ? new Date(lastRun).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : pipelineStatus.lastRun.date;
  const formattedLastRunTime = lastRun ? new Date(lastRun).toLocaleTimeString() : pipelineStatus.lastRun.startTime;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* SECTION 1 — PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-color)', margin: 0 }}>Pipeline</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Last run: {formattedLastRunDate} · {formattedLastRunTime} · {pipelineStatus.lastRun.duration}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isRunning ? '#00AEEF' : '#15803D',
                animation: isRunning ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: '12px', color: isRunning ? '#00AEEF' : '#15803D' }}>
                {isRunning ? 'Pipeline Running...' : 'System Ready'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleRunPipeline}
          disabled={isRunning}
          style={{
            background: isRunning ? 'rgba(0,174,239,0.1)' : '#00AEEF',
            color: isRunning ? '#00AEEF' : 'white',
            border: isRunning ? '1px solid rgba(0,174,239,0.3)' : 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            boxShadow: !isRunning ? '0 2px 8px rgba(0,174,239,0.3)' : 'none'
          }}
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {isRunning ? 'Running...' : 'Run Pipeline'}
        </button>
      </div>

      {/* SECTION 2 — STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Runs', value: stats.totalRuns },
          { label: 'Avg Duration', value: stats.avgDuration, color: '#00AEEF' },
          { label: 'Incidents Found', value: stats.totalIncidents },
          { label: 'Success Rate', value: stats.successRate, color: '#15803D' }
        ].map((stat, i) => (
          <div key={i} style={{ ...glassStyle, padding: '14px 18px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color || 'var(--text-color)', fontFamily: 'monospace' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 3 — TWO COLUMN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>
        {/* LEFT COLUMN — Pipeline Stages */}
        <div style={glassStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={15} color="#00AEEF" />
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Pipeline Stages</span>
            </div>
            {isRunning && (
              <div style={{
                background: 'rgba(0,174,239,0.08)',
                border: '1px solid rgba(0,174,239,0.15)',
                borderRadius: '20px',
                padding: '2px 10px',
                fontSize: '11px',
                color: '#00AEEF',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00AEEF', animation: 'pulse 2s infinite' }} />
                Live
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pipelineStatus.stages.map((stage, idx) => {
              const status = getStageStatus(stage.id)
              const StageIcon = stage.icon

              return (
                <div key={stage.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '14px 0', borderBottom: idx === 5 ? 'none' : '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: status === 'completed' ? 'rgba(21,128,61,0.1)' : status === 'running' ? 'rgba(0,174,239,0.1)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      border: status === 'completed' ? '1px solid rgba(21,128,61,0.2)' : status === 'running' ? '2px solid #00AEEF' : '1px solid var(--glass-border)'
                    }}>
                      {status === 'completed' ? <Check size={14} color="#15803D" /> : status === 'running' ? <Loader2 size={14} color="#00AEEF" className="animate-spin" /> : <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{stage.id}</span>}
                    </div>
                    {idx < 5 && (
                      <div style={{
                        width: '1px',
                        height: '16px',
                        marginTop: '4px',
                        backgroundColor: status === 'completed' ? 'rgba(21,128,61,0.3)' : 'var(--glass-border)'
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: getStageColor(status) }}>
                        {stage.name}
                      </div>
                      
                      {status === 'completed' ? (
                        <div style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}>{stage.duration}</div>
                      ) : status === 'running' ? (
                        <div style={{ fontSize: '10px', color: '#00AEEF' }}>Processing...</div>
                      ) : (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Waiting...</div>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {stage.description}
                    </div>

                    {status === 'completed' && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        <div style={{
                          background: 'rgba(21,128,61,0.06)',
                          border: '1px solid rgba(21,128,61,0.12)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          color: '#15803D'
                        }}>
                          {stage.id === 1 && `${stage.eventsProcessed} events ingested`}
                          {stage.id === 2 && `${stage.eventsProcessed} incidents found`}
                          {stage.id === 3 && `${stage.eventsProcessed} narratives generated`}
                          {stage.id === 4 && `${stage.eventsProcessed} agent decisions`}
                          {stage.id === 5 && `${stage.eventsProcessed} playbooks generated`}
                          {stage.id === 6 && `${stage.eventsProcessed} incidents stored`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CARD 1 — Manual Log Upload */}
          <div style={glassStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Upload size={15} color="#00AEEF" />
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Manual Log Ingestion</span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Upload log files for manual processing
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #00AEEF' : '2px dashed var(--glass-border)',
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                background: isDragging ? 'rgba(0,174,239,0.04)' : 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              <input
                type="file"
                multiple
                accept=".log,.json,.csv,.txt,.evtx,.xml"
                onChange={handleFileInput}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <Upload size={28} color={isDragging ? '#00AEEF' : 'var(--text-muted)'} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 500, color: isDragging ? '#00AEEF' : 'var(--text-secondary)' }}>
                Drop log files here
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                or click to browse
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                .log .json .csv .txt .evtx .xml
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {uploadedFiles.map((file, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--glass-border)'
                  }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <FileText size={12} color="#00AEEF" />
                      <div style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        maxWidth: '160px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {(file.size/1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Source System
              </label>
              <select
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface-color)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '8px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {sourceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || isUploading}
              style={{
                width: '100%',
                background: uploadSuccess ? 'rgba(21,128,61,0.1)' : uploadedFiles.length === 0 ? 'rgba(0,174,239,0.1)' : '#00AEEF',
                color: uploadSuccess ? '#15803D' : uploadedFiles.length === 0 ? 'rgba(0,174,239,0.5)' : 'white',
                border: uploadSuccess ? '1px solid rgba(21,128,61,0.2)' : 'none',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: (uploadedFiles.length === 0 || isUploading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Processing...
                </>
              ) : uploadSuccess ? (
                <>
                  <CheckCircle2 size={14} />
                  Upload Successful
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Upload & Process
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px' }}>
              <Lock size={11} color="var(--text-muted)" />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Files processed within air-gapped environment only
              </span>
            </div>
          </div>

          {/* CARD 2 — Pipeline Stats Summary */}
          <div style={glassStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={15} color="#00AEEF" />
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Processing Summary</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Run ID', value: pipelineStatus.lastRun.id, mono: true },
                { label: 'Started', value: pipelineStatus.lastRun.startTime },
                { label: 'Duration', value: pipelineStatus.lastRun.duration, color: '#00AEEF' },
                { label: 'Incidents', value: pipelineStatus.lastRun.incidentsGenerated, color: '#B91C1C' },
                { label: 'Events', value: pipelineStatus.lastRun.id === 'RUN-047' ? 847 : 0 },
                { label: 'Status', value: 'Completed', chip: true }
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.label}</span>
                  {row.chip ? (
                    <div style={{
                      background: 'rgba(21,128,61,0.08)',
                      border: '1px solid rgba(21,128,61,0.15)',
                      color: '#15803D',
                      borderRadius: '20px',
                      padding: '2px 8px',
                      fontSize: '10px'
                    }}>
                      {row.value}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: row.color || 'var(--text-color)',
                      fontFamily: row.mono ? 'monospace' : 'inherit'
                    }}>
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 — PIPELINE HISTORY */}
      <div style={glassStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={15} color="#00AEEF" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>Pipeline History</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Last {history.length} runs
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 80px 80px 80px 80px 100px', gap: '8px', padding: '8px 12px', marginBottom: '4px' }}>
          {['RUN ID', 'DATE', 'TIME', 'DURATION', 'INCIDENTS', 'EVENTS', 'STATUS'].map(h => (
            <div key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {h}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((run, i) => (
            <div
              key={i}
              className="hover-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 120px 80px 80px 80px 80px 100px',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                transition: 'background 0.15s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#00AEEF' }}>{run.id}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{run.date}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{run.time}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-color)' }}>{run.duration}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: run.incidents > 0 ? '#B91C1C' : 'var(--text-muted)' }}>{run.incidents}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{run.events}</div>
              <div>
                <div style={{
                  display: 'inline-block',
                  background: run.status === 'completed' ? 'rgba(21,128,61,0.08)' : 'rgba(185,28,28,0.08)',
                  border: run.status === 'completed' ? '1px solid rgba(21,128,61,0.15)' : '1px solid rgba(185,28,28,0.15)',
                  color: run.status === 'completed' ? '#15803D' : '#B91C1C',
                  borderRadius: '20px',
                  padding: '2px 8px',
                  fontSize: '10px'
                }}>
                  {run.status === 'completed' ? 'Completed' : 'Failed'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default Pipeline
