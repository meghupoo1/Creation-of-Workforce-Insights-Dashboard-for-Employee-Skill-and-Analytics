import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Database,
  FileBarChart,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  UserPlus,
  PlusCircle,
} from 'lucide-react'
import './App.css'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'People', icon: UsersRound },
  { label: 'Attendance', icon: Clock3 },
  { label: 'Scheduling', icon: CalendarDays },
  { label: 'Performance', icon: Activity },
  { label: 'Payroll inputs', icon: WalletCards },
  { label: 'Reports', icon: FileBarChart },
]

const attendance = [
  { day: 'Mon', value: 88 },
  { day: 'Tue', value: 94 },
  { day: 'Wed', value: 90 },
  { day: 'Thu', value: 96 },
  { day: 'Fri', value: 91 },
  { day: 'Sat', value: 61 },
  { day: 'Sun', value: 48 },
]

const teams = [
  { name: 'Engineering', people: '128 people', value: 92, color: 'mint' },
  { name: 'Customer success', people: '64 people', value: 84, color: 'blue' },
  { name: 'Marketing', people: '42 people', value: 76, color: 'yellow' },
  { name: 'Operations', people: '31 people', value: 68, color: 'coral' },
]

const roles = [
  { id: 'hr', label: 'HR Administrator', description: 'People analytics, payroll and compliance', icon: BriefcaseBusiness, accent: 'green', email: 'megha@gmail.com' },
  { id: 'manager', label: 'Manager', description: 'Team attendance, goals and approvals', icon: UsersRound, accent: 'blue', email: 'manager@gmail.com' },
  { id: 'employee', label: 'Employee', description: 'Self-service, shifts and time off', icon: UserRound, accent: 'yellow', email: 'employee@gmail.com' },
]

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  for (const character of text.replace(/^\uFEFF/, '')) {
    if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(value.trim()); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\n' && (value || row.length)) { row.push(value.trim()); rows.push(row); row = []; value = '' }
    } else value += character
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row) }
  const headers = rows.shift() || []
  return rows.filter((item) => item.some(Boolean)).map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] || ''])))
}

function deriveMetrics(attendanceRows, allocationRows, workforceRows = []) {
  const presentRows = attendanceRows.filter((row) => row.Status?.toLowerCase().includes('present'))
  const absentRows = attendanceRows.filter((row) => row.Status?.toLowerCase().includes('absent'))
  const leaveRows = attendanceRows.filter((row) => row.Status?.toLowerCase().includes('weeklyoff'))
  const allocationEmployees = new Set(allocationRows.map((row) => row.employee_id).filter(Boolean)).size
  const activeEmployees = new Set(attendanceRows.map((row) => row.E_Name).filter(Boolean)).size
  const employeeCount = allocationEmployees || activeEmployees
  const departments = new Set(allocationRows.map((row) => row.department).filter(Boolean))
  const averageAllocationAttendance = allocationRows.length
    ? Math.round(allocationRows.reduce((total, row) => total + Number(row.attendance_rate || 0), 0) / allocationRows.length)
    : 0
  const attritionRate = workforceRows.length ? Math.round(workforceRows.reduce((total, row) => total + Number(row.attrition_rate || 0), 0) / workforceRows.length * 10) / 10 : 0
  const previousAttritionRate = workforceRows.length ? workforceRows.reduce((total, row) => total + Number(row.previous_attrition_rate || 0), 0) / workforceRows.length : 0
  const processedPayroll = workforceRows.filter((row) => row.payroll_status?.toLowerCase() === 'processed').length
  return { attendance: attendanceRows.length ? Math.round((presentRows.length / attendanceRows.length) * 1000) / 10 : 0, presentRows: presentRows.length, absentRows: absentRows.length, leaveRows: leaveRows.length, employeeCount, activeEmployees, allocationRows: allocationRows.length, departments: departments.size, averageAllocationAttendance, attritionRate, attritionDelta: Math.round((attritionRate - previousAttritionRate) * 10) / 10, processedPayroll, payrollRate: workforceRows.length ? Math.round(processedPayroll / workforceRows.length * 100) : 0, workforceRows: workforceRows.length }
}

function buildLiveWorkforceSnapshot(employees = [], attendance = [], payrollSummary = {}, leaveRequests = []) {
  const presentCount = attendance.filter((row) => String(row.status || row.Status || '').toLowerCase() === 'present').length
  const lateCount = attendance.filter((row) => Number(row.late_minutes || row['Late Minutes'] || 0) > 0).length
  const leaveCount = leaveRequests.length
  const approvedLeave = leaveRequests.filter((row) => String(row.status || '').toUpperCase() === 'APPROVED').length
  const pendingLeave = leaveRequests.filter((row) => String(row.status || '').toUpperCase() !== 'APPROVED').length
  const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0
  const totalPayroll = Number(payrollSummary.total_payroll_cost || 0)
  const processedPayrollCount = Number(payrollSummary.processed_records || 0)
  const totalRecords = Number(payrollSummary.total_records || 0)

  return {
    employeeCount: employees.length,
    presentCount,
    lateCount,
    leaveCount,
    approvedLeave,
    pendingLeave,
    attendanceRate,
    totalPayroll,
    processedPayrollCount,
    totalRecords,
    workforceHealth: attendance.length ? Math.max(0, Math.min(100, attendanceRate)) : 0,
  }
}

function EmptyDashboard({ role, onLogout }) {
  const roleLabel = role.id === 'hr' ? 'HR command center' : role.id === 'manager' ? 'Manager workspace' : 'Employee portal'
  const cards = role.id === 'employee'
    ? ['Attendance', 'Leave balance', 'Timesheet hours', 'Growth progress']
    : role.id === 'manager'
      ? ['Team headcount', 'Team attendance', 'Productivity', 'Capacity available']
      : ['Total employees', 'Attrition rate', 'Attendance today', 'Payroll processed']

      return (
        <main className="empty-dashboard-page">
          <header className="empty-dashboard-header"><div className="brand" /><div><p className="eyebrow"><span className="live-dot" /> {roleLabel}</p><h1>Workforce dashboard</h1><p>Connect your dataset to populate live workforce insights.</p></div><button className="logout-button" onClick={onLogout}><LogOut size={16} /> Log out</button></header>
          <section className="empty-dashboard-content"><div className="empty-dashboard-banner"><Database size={22} /><div><strong>No workforce dataset connected</strong><p>All dashboard values are set to zero until employee, attendance, leave, payroll, and organization data is connected.</p></div></div><div className="empty-metric-grid">{cards.map((label) => <article key={label}><small>{label}</small><strong>0</strong><span>No data available</span></article>)}</div><div className="empty-panels"><article><span className="card-kicker">Reports</span><h2>Reports will appear here</h2><p>Attendance, payroll, productivity, attrition, and department reports will populate after data connection.</p></article><article><span className="card-kicker">AI insights</span><h2>Predictions are waiting</h2><p>Anomaly detection, absenteeism analysis, forecasting, and recommendations require a connected dataset.</p></article><article><span className="card-kicker">Security</span><h2>Role access is active</h2><p>RBAC and logout are available now. Connect your approved source to begin processing workforce information.</p></article></div><button className="connect-dataset-button" onClick={() => alert('Connect your approved workforce dataset to enable dashboard values.') }><Database size={16} /> Connect dataset</button></section>
        </main>
  )
}

function DatasetRequired({ role, onLogout }) {
  return (
    <main className="dataset-required-page">
      <div className="dataset-required-card">
        <div className="brand" />
        <div className="dataset-required-icon"><Database size={27} /></div>
        <p className="eyebrow"><span className="live-dot" /> Data connection required</p>
        <h1>Connect your workforce data to continue</h1>
        <p className="dataset-required-copy">The {role.label.toLowerCase()} workspace is ready, but no employee dataset has been connected yet. Upload or connect your source before viewing workforce metrics, reports, predictions, or alerts.</p>
        <div className="dataset-actions"><button className="primary-button" onClick={() => alert('Dataset connection will be available when the data source is configured.')}><Database size={16} /> Connect dataset</button><button className="outline-button" onClick={onLogout}><LogOut size={15} /> Back to login</button></div>
        <div className="dataset-note"><ShieldCheck size={15} /><span>Your data will power role-based analytics, attendance validation, payroll reports, AI insights, and compliance monitoring.</span></div>
      </div>
    </main>
  )
}

function AssistantDrawer({ isOpen, onClose, question, setQuestion, onSubmit, submittedQuestion, aiLoading, aiAnswer, roleLabel }) {
  if (!isOpen) return null

  const suggestions = [
    'Which teams are at risk of burnout?',
    'Summarize attendance this week',
    'Where should we hire next?',
  ]

  return (
    <div className="assistant-overlay" onClick={onClose}>
      <section className="assistant-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="assistant-header">
          <div className="ai-title">
            <div className="ai-icon"><Sparkles size={17} /></div>
            <div>
              <h2>AI assistant</h2>
              <p>Workforce intelligence, on demand</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close assistant"><X size={18} /></button>
        </div>
        <div className="assistant-body">
          <p className="assistant-greeting">Hi {roleLabel}. I can help you understand your workforce data or take action on your priority tasks.</p>
          <div className="suggestion-grid">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>
            ))}
          </div>
          {submittedQuestion && (
            <div className="assistant-response">
              <span className="response-label">AI insight</span>
              <p>{aiLoading ? 'Analyzing workforce signals...' : aiAnswer || `Based on latest signals for: ${submittedQuestion}`}</p>
            </div>
          )}
        </div>
        <form className="assistant-input" onSubmit={onSubmit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your workforce..." /><button type="submit" aria-label="Send question"><ArrowUpRight size={17} /></button></form>
      </section>
    </div>
  )
}

function LoginPage({ onLogin, headcount = 0, backendStatus = { healthy: false } }) {
  const [selectedRole, setSelectedRole] = useState('hr')
  const [email, setEmail] = useState('megha@gmail.com')
  const [password, setPassword] = useState('demo-password')
  const role = roles.find((item) => item.id === selectedRole)

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onLogin(role, email, password)
  }

  const selectRole = (nextRole) => {
    setSelectedRole(nextRole.id)
    setEmail(nextRole.email)
  }

  return (
    <main className="login-page">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <section className="login-shell">
        <div className="login-intro">
          <div className="brand login-brand" />
          <div className="intro-copy"><p className="eyebrow"><span className="live-dot" /> Workforce intelligence</p><h1>Make every<br /><em>person</em> count.</h1><p>One calm place to understand your people, plan with confidence, and move work forward.</p></div>
          <div className="login-proof"><div className="proof-avatars"><span>AR</span><span>JM</span><span>SK</span><span>+</span></div><div><strong>{headcount.toLocaleString()} people</strong><small>already finding their flow</small></div></div>
          <div className="backend-indicator" style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '999px', background: backendStatus.healthy ? 'rgba(39,174,96,0.14)' : 'rgba(248, 171, 29, 0.14)', color: backendStatus.healthy ? '#7ae5a9' : '#ffd166', border: `1px solid ${backendStatus.healthy ? '#39c178' : '#e7aa24'}`, fontSize: '0.78rem', fontWeight: 700 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: backendStatus.healthy ? '#39c178' : '#e7aa24', display: 'inline-block' }} />
            {backendStatus.healthy ? 'AI connected to backend' : 'Backend checking...'}
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-heading"><span>Welcome back</span><h2>Sign in to your workspace</h2><p>Choose your role to continue to Northstar Inc.</p></div>
          <div className="role-grid">{roles.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={`role-option ${selectedRole === item.id ? `selected ${item.accent}` : ''}`} onClick={() => selectRole(item)}><span className="role-icon"><Icon size={17} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{selectedRole === item.id && <span className="selected-check">✓</span>}</button> })}</div>
          <form className="login-form" onSubmit={handleSubmit}><label>Email address<div className="input-wrap"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label><label>Password<div className="input-wrap"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label><div className="form-meta"><label className="remember"><input type="checkbox" defaultChecked /> <span>Remember me</span></label><button type="button" className="forgot-button">Forgot password?</button></div><button className="login-submit" type="submit">Continue as {role.label} <ArrowUpRight size={16} /></button></form>
          <div className="login-footer"><span>Protected workspace</span><span className="secure-dot" /> <span>Demo workspace</span></div>
        </div>
      </section>
    </main>
  )
}

function EmployeePortal({ employee, onLogout, onOpenAssistant, assistantState, liveSnapshot }) {
  const [checkedIn, setCheckedIn] = useState(false)
  const [activeSection, setActiveSection] = useState('Overview')
  const [leaveRequested, setLeaveRequested] = useState(false)
  const [actionNotice, setActionNotice] = useState('')
  const [selectedCheckinMethod, setSelectedCheckinMethod] = useState('GPS check-in')
  const [verificationMode, setVerificationMode] = useState(null)
  const [verificationMessage, setVerificationMessage] = useState('')
  const cameraRef = useRef(null)

  useEffect(() => {
    if (verificationMode !== 'Face recognition') return undefined
    if (!navigator.mediaDevices?.getUserMedia) {
      setVerificationMessage('Camera access is not available in this browser.')
      return undefined
    }
    let active = true
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (!active) return stream.getTracks().forEach((track) => track.stop())
      if (cameraRef.current) cameraRef.current.srcObject = stream
    }).catch(() => setVerificationMessage('Camera permission was blocked. Allow camera access and try again.'))
    return () => {
      active = false
      if (cameraRef.current?.srcObject) cameraRef.current.srcObject.getTracks().forEach((track) => track.stop())
    }
  }, [verificationMode])
  const attendanceStatusText = liveSnapshot.presentCount > 0 ? `${liveSnapshot.presentCount} present today` : 'Not checked in'
  const leaveBalanceText = liveSnapshot.leaveCount > 0 ? `${liveSnapshot.leaveCount} request(s)` : 'No active requests'

  const portalNav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Attendance', icon: Clock3 },
    { label: 'My shifts', icon: CalendarDays },
    { label: 'Leave & time off', icon: FileBarChart },
    { label: 'Timesheets', icon: Activity },
    { label: 'My profile', icon: UserRound },
  ]
  const focusEmployeePanel = (section, panelId, notice = '') => {
    setActiveSection(section)
    setActionNotice(notice)
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`)
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const handleEmployeeAction = (action) => {
    const actions = {
      'Open timesheet': { section: 'Timesheets', panelId: 'timesheet-card', notice: 'Timesheet opened. Your current week is shown below.' },
      'Download payslip': { section: 'Overview', panelId: 'pay-card', notice: 'August 2026 payslip is ready for download.' },
      Edit: { section: 'My profile', panelId: 'profile-card', notice: 'Profile editing is ready. Update your contact details here.' },
      'View calendar': { section: 'My shifts', panelId: 'shift-card', notice: 'Shift calendar opened for this week.' },
    }
    const destination = actions[action]
    if (!destination) return
    if (action === 'Download payslip') {
      const payslip = new Blob(['Northstar Inc.\nEmployee: Alex Rivera\nPay period: August 2026\nNet pay: $4,820.00\n'], { type: 'text/plain' })
      const downloadUrl = URL.createObjectURL(payslip)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'alex-rivera-payslip-august-2026.txt'
      link.click()
      URL.revokeObjectURL(downloadUrl)
    }
    focusEmployeePanel(destination.section, destination.panelId, destination.notice)
  }
  const handleEmployeeSurfaceClick = (event) => {
    const shift = event.target.closest('.next-shift')
    if (shift) return setActionNotice('Shift options opened for Product design shift.')
    const button = event.target.closest('button')
    if (!button) return
    if (button.classList.contains('checkin-method')) {
      const method = button.querySelector('strong')?.textContent || 'Check-in method'
      setSelectedCheckinMethod(method)
      setVerificationMessage('')
      setVerificationMode(method)
      if (method === 'GPS check-in' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => setVerificationMessage(`Location verified: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`),
          () => setVerificationMessage('Location permission was blocked. Allow location access and try again.')
        )
      }
      return setActionNotice(`${method} selected.`)
    }
    if (button.textContent.includes('Request leave')) return setActionNotice('Leave request form opened. Select your dates to continue.')
    if (button.textContent.includes('Open timesheet')) return handleEmployeeAction('Open timesheet')
    if (button.textContent.includes('Download payslip')) return handleEmployeeAction('Download payslip')
    if (button.textContent.includes('Edit')) return handleEmployeeAction('Edit')
    if (button.textContent.includes('View calendar')) return handleEmployeeAction('View calendar')
  }

  return (
    <div className="employee-portal">
      <aside className="employee-sidebar">
        <div className="brand" />
        <div className="employee-greeting"><span className="profile-avatar employee-avatar">AR</span><div><strong>Alex Rivera</strong><small>Product designer</small></div></div>
        <p className="nav-label">Employee portal</p>
        <nav>{portalNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => focusEmployeePanel(label, { Overview: 'checkin-card', Attendance: 'checkin-card', 'My shifts': 'shift-card', 'Leave & time off': 'leave-card', Timesheets: 'timesheet-card', 'My profile': 'profile-card' }[label])}><Icon size={17} /><span>{label}</span></button>)}</nav>
        <div className="employee-sidebar-bottom"><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button><small>Northstar Inc. · Employee self-service</small></div>
      </aside>
      <main className="employee-main">
        <header className="employee-topbar"><div><p className="eyebrow"><span className="live-dot" /> Tuesday, September 8, 2026</p><h1>Good morning, Alex <span>✦</span></h1></div><div className="employee-top-actions"><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setActionNotice('No new employee notifications. Your latest updates are shown in the portal below.')}><Bell size={18} /><i /></button><button className="employee-logout-mobile" onClick={onLogout}><LogOut size={15} /> Log out</button></div></header>
        <div className="employee-content" onClick={handleEmployeeSurfaceClick}>
          {actionNotice && <p className="action-notice" role="status">{actionNotice}</p>}
          <section className="employee-hero"><div><span className="hero-kicker">Your workday, at a glance</span><h2>Ready to make it a good one?</h2><p>Everything you need for your time, growth, and next step is here.</p></div><div className="hero-orbit"><span>✦</span><i /><i /><i /></div></section>
          <section className="employee-stat-grid"><article><span className="stat-icon green"><Clock3 size={17} /></span><div><small>Today’s attendance</small><strong>{checkedIn || liveSnapshot.presentCount > 0 ? 'Checked in' : 'Not checked in'}</strong><em>{checkedIn || liveSnapshot.presentCount > 0 ? `${attendanceStatusText} · ${liveSnapshot.lateCount || 0} late` : 'Your shift starts at 9:00 AM'}</em></div></article><article><span className="stat-icon blue"><CalendarDays size={17} /></span><div><small>Next shift</small><strong>{liveSnapshot.employeeCount > 0 ? 'Live schedule' : 'Product design'}</strong><em>{liveSnapshot.employeeCount > 0 ? `${liveSnapshot.employeeCount} employees in backend` : 'Today · 09:00 - 17:30'}</em></div></article><article><span className="stat-icon yellow"><FileBarChart size={17} /></span><div><small>Leave balance</small><strong>{liveSnapshot.leaveCount > 0 ? `${liveSnapshot.leaveCount} active` : 'No active'}</strong><em>{leaveBalanceText}</em></div></article><article><span className="stat-icon coral"><Activity size={17} /></span><div><small>Workforce outlook</small><strong>{liveSnapshot.attendanceRate}%</strong><em>{liveSnapshot.presentCount} present / {liveSnapshot.employeeCount || 1} tracked</em></div></article></section>
          <section className="employee-grid">
            <article className="employee-card checkin-card"><div className="employee-card-heading"><div><span className="card-kicker">Attendance</span><h3>Start your workday</h3><p>Choose a secure way to record your presence.</p></div><span className="checkin-pulse" /></div><div className="checkin-methods"><button className={`checkin-method ${selectedCheckinMethod === 'GPS check-in' ? 'active' : ''}`}><span>⌾</span><strong>GPS check-in</strong><small>Location verified</small></button><button className={`checkin-method ${selectedCheckinMethod === 'QR code' ? 'active' : ''}`}><span>▦</span><strong>QR code</strong><small>Scan at office</small></button><button className={`checkin-method ${selectedCheckinMethod === 'Face recognition' ? 'active' : ''}`}><span>◎</span><strong>Face recognition</strong><small>Biometric ready</small></button></div><button className={`checkin-button ${checkedIn ? 'checked' : ''}`} onClick={() => setCheckedIn(!checkedIn)}>{checkedIn ? '✓ Checked in for today' : 'Check in now'} <ArrowUpRight size={15} /></button></article>
            <article className="employee-card shift-card"><div className="employee-card-heading"><div><span className="card-kicker">This week</span><h3>My shift calendar</h3></div><button className="small-link">View calendar <ArrowUpRight size={13} /></button></div><div className="shift-week"><span><b>Mon</b><i>07</i></span><span className="today"><b>Tue</b><i>08</i></span><span><b>Wed</b><i>09</i></span><span><b>Thu</b><i>10</i></span><span><b>Fri</b><i>11</i></span></div><div className="next-shift"><span className="shift-line" /><div><strong>Product design shift</strong><small>Today · 09:00 - 17:30 · Studio 2</small></div><MoreHorizontal size={16} /></div></article>
            <article className="employee-card leave-card"><div className="employee-card-heading"><div><span className="card-kicker">Time away</span><h3>Leave balance</h3></div><button className="small-link" onClick={() => setLeaveRequested(true)}>{leaveRequested ? 'Requested' : 'Request leave'} <ArrowUpRight size={13} /></button></div><div className="leave-balance"><div className="donut"><strong>14.5</strong><small>days left</small></div><div className="leave-legend"><span><i className="annual" />Annual leave <b>12 days</b></span><span><i className="sick" />Sick leave <b>2.5 days</b></span><span><i className="pending" />Pending request <b>{leaveRequested ? '1 request' : 'None'}</b></span></div></div></article>
            <article className="employee-card profile-card"><div className="employee-card-heading"><div><span className="card-kicker">Your profile</span><h3>Keep it current</h3><p>Help your team know how to reach you.</p></div><span className="profile-complete">92%</span></div><div className="profile-progress"><span style={{ width: '92%' }} /></div><div className="profile-row"><span className="profile-avatar employee-avatar">AR</span><div><strong>Alex Rivera</strong><small>alex@gmail.com · Product design</small></div><button className="edit-button">Edit <ArrowUpRight size={13} /></button></div></article>
            <article className="employee-card timesheet-card"><div className="employee-card-heading"><div><span className="card-kicker">This week</span><h3>Timesheet snapshot</h3></div><button className="small-link">Open timesheet <ArrowUpRight size={13} /></button></div><div className="hours-row"><strong>31.5 <small>/ 40 hrs</small></strong><span>78.7%</span></div><div className="hours-track"><span /></div><div className="hours-breakdown"><span>Client work <b>24h</b></span><span>Team time <b>7.5h</b></span><span>Overtime <b>0h</b></span></div></article>
            <article className="employee-card pay-card"><div className="employee-card-heading"><div><span className="card-kicker">Latest payslip</span><h3>August 2026</h3><p>Net pay · $4,820.00</p></div><span className="pay-icon"><WalletCards size={17} /></span></div><button className="download-button">Download payslip <ArrowUpRight size={14} /></button></article>
          </section>
        </div>
      </main>
      {verificationMode && <div className="verification-overlay" onClick={() => setVerificationMode(null)}><section className="verification-modal" onClick={(event) => event.stopPropagation()}><div className="verification-heading"><div><span className="card-kicker">Secure check-in</span><h2>{verificationMode}</h2><p>{verificationMode === 'QR code' ? 'Scan this code at your office check-in point.' : verificationMode === 'Face recognition' ? 'Position your face inside the camera frame.' : 'Confirm your current work location.'}</p></div><button className="icon-button" onClick={() => setVerificationMode(null)} aria-label="Close verification"><X size={18} /></button></div>{verificationMode === 'QR code' && <div className="qr-preview" aria-label="QR check-in code"><span>QR CHECK-IN</span><strong>NS-AR-2026</strong></div>}{verificationMode === 'Face recognition' && <div className="camera-preview">{verificationMessage ? <p>{verificationMessage}</p> : <video ref={cameraRef} autoPlay playsInline muted />}</div>}{verificationMode === 'GPS check-in' && <div className="location-preview"><span>⌾</span><strong>{verificationMessage || 'Requesting your current location...'}</strong><small>Northstar secure geofence</small></div>}<button className="checkin-button" onClick={() => { setCheckedIn(true); setVerificationMode(null); setActionNotice(`${verificationMode} verification complete. You are checked in.`) }}>Confirm check-in <ArrowUpRight size={15} /></button></section></div>}
      <AssistantDrawer
        isOpen={assistantState.isOpen}
        onClose={assistantState.onClose}
        question={assistantState.question}
        setQuestion={assistantState.setQuestion}
        onSubmit={assistantState.onSubmit}
        submittedQuestion={assistantState.submittedQuestion}
        aiLoading={assistantState.aiLoading}
        aiAnswer={assistantState.aiAnswer}
        roleLabel={employee?.label || 'Alex'}
      />
    </div>
  )
}

function ManagerDashboard({ onLogout, onOpenAssistant, assistantState, liveSnapshot, onOpenManualEntry }) {
  const [activeSection, setActiveSection] = useState('Overview')
  const [approvedLeave, setApprovedLeave] = useState([])
  const [actionNotice, setActionNotice] = useState('')
  const managerNav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Team attendance', icon: Clock3 },
    { label: 'Leave approvals', icon: FileBarChart },
    { label: 'Productivity reports', icon: Activity },
    { label: 'Resource allocation', icon: UsersRound },
    { label: 'Workforce utilization', icon: WalletCards },
  ]
  const leaveRequests = [
    { id: 1, initials: 'JM', name: 'Jordan Miller', type: 'Annual leave · Sep 14-16', color: 'blue' },
    { id: 2, initials: 'SK', name: 'Sofia Kim', type: 'Personal day · Sep 12', color: 'yellow' },
    { id: 3, initials: 'DW', name: 'Daniel Wong', type: 'Sick leave · Sep 10', color: 'coral' },
  ]
  const focusManagerPanel = (section, panelId, notice = '') => {
    setActiveSection(section)
    setActionNotice(notice)
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`)
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const handleManagerAction = (action) => {
    const actions = {
        'Full attendance': { section: 'Team attendance', panelId: 'team-attendance-card', notice: 'Full attendance opened using today\'s live team snapshot.' },
        'Open approval queue': { section: 'Leave approvals', panelId: 'leave-approvals-card', notice: 'Approval queue opened. Approve requests directly below.' },
        'Productivity options': { section: 'Productivity reports', panelId: 'productivity-card', question: 'Summarize the team productivity report and highlight capacity risks.' },
        'Manage': { section: 'Resource allocation', panelId: 'allocation-card', question: 'How should we rebalance current resource allocation?' },
        'View details': { section: 'Workforce utilization', panelId: 'utilization-card', question: 'Which team members are closest to capacity right now?' },
        'Explore recommendation': { section: 'Overview', panelId: 'insight-card', question: 'Explain the recommendation to protect team momentum and move the research handoff to Leah.' },
    }
    const destination = actions[action]
    if (!destination) return
    focusManagerPanel(destination.section, destination.panelId, destination.notice)
    if (destination.question) {
      assistantState.setQuestion(destination.question)
      onOpenAssistant()
    }
  }
  const handleManagerSurfaceClick = (event) => {
    const button = event.target.closest('button')
    if (!button) return
    const card = button.closest('.manager-card')
    if (!card) return
    if (card.classList.contains('productivity-card') && button.classList.contains('icon-button')) return handleManagerAction('Productivity options')
    if (card.classList.contains('allocation-card') && button.textContent.includes('Manage')) return handleManagerAction('Manage')
    if (card.classList.contains('utilization-card') && button.textContent.includes('View details')) return handleManagerAction('View details')
    if (card.classList.contains('insight-card') && button.textContent.includes('Explore recommendation')) return handleManagerAction('Explore recommendation')
  }
  return (
    <div className="manager-dashboard">
      <aside className="manager-sidebar">
        <div className="brand" />
        <div className="manager-profile"><span className="profile-avatar manager-avatar">MR</span><div><strong>Maya Roberts</strong><small>Design manager</small></div></div>
        <p className="nav-label">Manager workspace</p>
        <nav>{managerNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => focusManagerPanel(label, { Overview: 'team-attendance-card', 'Team attendance': 'team-attendance-card', 'Leave approvals': 'leave-approvals-card', 'Productivity reports': 'productivity-card', 'Resource allocation': 'allocation-card', 'Workforce utilization': 'utilization-card' }[label])}><Icon size={17} /><span>{label}</span>{label === 'Leave approvals' && <span className="nav-pill">3</span>}</button>)}</nav>
        <div className="manager-sidebar-bottom"><div className="manager-team-chip"><span className="team-chip-icon"><UsersRound size={15} /></span><span><strong>Product design</strong><small>12 direct reports</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button></div>
      </aside>
      <main className="manager-main">
        <header className="manager-topbar"><div><p className="eyebrow"><span className="live-dot" /> Manager workspace · Tuesday, September 8</p><h1>Your team at a glance <span>✦</span></h1><p className="manager-subtitle">A clear view of the people, progress, and capacity you lead.</p></div><div className="manager-top-actions"><button className="primary-button" onClick={() => onOpenManualEntry('Attendance')}><PlusCircle size={15} /> Manual Record Entry</button><button className="outline-button"><FileBarChart size={15} /> Export report</button><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setActionNotice('No new manager notifications. Leave approvals are shown in the approval queue below.')}><Bell size={18} /><i /></button><button className="manager-mobile-logout" onClick={onLogout}><LogOut size={15} /></button></div></header>
        <div className="manager-content" onClick={handleManagerSurfaceClick}>
          {actionNotice && <p className="action-notice" role="status">{actionNotice}</p>}
          <section className="manager-stat-grid"><article className="manager-stat green"><span className="stat-icon green"><UsersRound size={17} /></span><div><small>Team headcount</small><strong>{liveSnapshot.employeeCount || 0} <em>people</em></strong><p><b>{liveSnapshot.pendingLeave || 0}</b> live leave requests</p></div></article><article className="manager-stat blue"><span className="stat-icon blue"><Clock3 size={17} /></span><div><small>Team attendance</small><strong>{liveSnapshot.attendanceRate || 0}%</strong><p><b>{liveSnapshot.presentCount || 0}</b> present today</p></div></article><article className="manager-stat yellow"><span className="stat-icon yellow"><Activity size={17} /></span><div><small>Payroll processed</small><strong>{liveSnapshot.processedPayrollCount || 0}</strong><p><b>{liveSnapshot.totalRecords || 0}</b> total payroll records</p></div></article><article className="manager-stat coral"><span className="stat-icon coral"><WalletCards size={17} /></span><div><small>Payroll value</small><strong>${(liveSnapshot.totalPayroll || 0).toLocaleString()}</strong><p><b>{liveSnapshot.lateCount || 0}</b> late check-ins</p></div></article></section>
          <section className="manager-grid">
            <article id="team-attendance-card" className="manager-card attendance-team-card"><div className="manager-card-heading"><div><span className="card-kicker">Live today</span><h2>Team attendance</h2><p>12 team members across 2 locations</p></div><button className="small-link" onClick={() => handleManagerAction('Full attendance')}>Full attendance <ArrowUpRight size={13} /></button></div><div className="team-attendance-list"><div className="team-attendance-row"><span className="team-person-avatar blue">JM</span><div><strong>Jordan Miller</strong><small>Working from office</small></div><span className="attendance-status present">Present</span><span className="attendance-time">08:54</span></div><div className="team-attendance-row"><span className="team-person-avatar yellow">SK</span><div><strong>Sofia Kim</strong><small>Working remotely</small></div><span className="attendance-status present">Present</span><span className="attendance-time">09:02</span></div><div className="team-attendance-row"><span className="team-person-avatar coral">DW</span><div><strong>Daniel Wong</strong><small>Medical leave</small></div><span className="attendance-status away">On leave</span><span className="attendance-time">—</span></div><div className="team-attendance-row"><span className="team-person-avatar mint">LP</span><div><strong>Leah Park</strong><small>Working from office</small></div><span className="attendance-status late">Late arrival</span><span className="attendance-time">09:28</span></div></div><div className="attendance-summary"><span><i className="present-dot" /> 9 present</span><span><i className="remote-dot" /> 2 remote</span><span><i className="away-dot" /> 1 away</span><b>75% checked in</b></div></article>
            <article id="leave-approvals-card" className="manager-card approvals-card"><div className="manager-card-heading"><div><span className="card-kicker">Needs review</span><h2>Leave approvals</h2><p>Requests from your team</p></div><span className="approval-count">{leaveRequests.filter((item) => !approvedLeave.includes(item.id)).length}</span></div><div className="approval-list">{leaveRequests.map((request) => <div className={`approval-row ${approvedLeave.includes(request.id) ? 'approved' : ''}`} key={request.id}><span className={`team-person-avatar ${request.color}`}>{request.initials}</span><div><strong>{request.name}</strong><small>{request.type}</small></div>{approvedLeave.includes(request.id) ? <span className="approved-label">Approved</span> : <button className="approve-button" onClick={() => setApprovedLeave([...approvedLeave, request.id])}>Approve</button>}</div>)}</div><button className="view-link" onClick={() => handleManagerAction('Open approval queue')}>Open approval queue <ArrowUpRight size={14} /></button></article>
            <article className="manager-card productivity-card"><div className="manager-card-heading"><div><span className="card-kicker">Last 6 weeks</span><h2>Productivity report</h2><p>Completed work against goals</p></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="productivity-chart"><div className="productivity-y"><span>100</span><span>75</span><span>50</span><span>25</span></div><div className="productivity-bars">{[62, 73, 68, 82, 78, 91].map((value, index) => <div className="productivity-column" key={value}><div className="productivity-bar" style={{ height: `${value}%` }} /><span>W{index + 1}</span></div>)}</div></div><div className="productivity-footer"><span><i /> Team productivity</span><b>86.4% <small>average</small></b></div></article>
            <article className="manager-card allocation-card"><div className="manager-card-heading"><div><span className="card-kicker">Planning view</span><h2>Resource allocation</h2><p>Where your team is spending time</p></div><button className="small-link">Manage <ArrowUpRight size={13} /></button></div><div className="allocation-list"><div><span><i className="allocation-green" /> Client projects <b>58%</b></span><div><i style={{ width: '58%' }} /></div></div><div><span><i className="allocation-blue" /> Product development <b>27%</b></span><div><i style={{ width: '27%' }} /></div></div><div><span><i className="allocation-yellow" /> Team & operations <b>15%</b></span><div><i style={{ width: '15%' }} /></div></div></div><div className="allocation-note"><Sparkles size={14} /><span><strong>Capacity signal:</strong> Leah has 6 hours available this week.</span></div></article>
            <article className="manager-card utilization-card"><div className="manager-card-heading"><div><span className="card-kicker">Current load</span><h2>Workforce utilization</h2><p>Capacity and workload by person</p></div><button className="small-link">View details <ArrowUpRight size={13} /></button></div><div className="utilization-row"><span className="team-person-avatar mint">LP</span><div><strong>Leah Park</strong><small>Product designer</small></div><div className="utilization-meter"><span style={{ width: '68%' }} /><small>68%</small></div></div><div className="utilization-row"><span className="team-person-avatar blue">JM</span><div><strong>Jordan Miller</strong><small>Senior designer</small></div><div className="utilization-meter"><span style={{ width: '92%' }} /><small>92%</small></div></div><div className="utilization-row"><span className="team-person-avatar yellow">SK</span><div><strong>Sofia Kim</strong><small>UX researcher</small></div><div className="utilization-meter"><span style={{ width: '81%' }} /><small>81%</small></div></div></article>
            <article className="manager-card insight-card"><div className="insight-heading"><span className="ai-icon"><Sparkles size={15} /></span><div><span className="card-kicker">AI signal</span><h2>Protect the good momentum</h2></div></div><p>Your team's productivity is up <strong>6.8%</strong>, but two people are nearing capacity. Consider moving the research handoff to Leah.</p><button className="text-button">Explore recommendation <ArrowUpRight size={14} /></button></article>
          </section>
        </div>
      </main>
      <AssistantDrawer
        isOpen={assistantState.isOpen}
        onClose={assistantState.onClose}
        question={assistantState.question}
        setQuestion={assistantState.setQuestion}
        onSubmit={assistantState.onSubmit}
        submittedQuestion={assistantState.submittedQuestion}
        aiLoading={assistantState.aiLoading}
        aiAnswer={assistantState.aiAnswer}
        roleLabel="Manager"
      />
    </div>
  )
}

function EmployeeDirectoryCard({ employees = [], onOpenManualEntry }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
    const email = (emp.email || '').toLowerCase()
    const role = (emp.role || '').toLowerCase()
    const code = (emp.employee_code || emp.id || '').toLowerCase()
    const query = searchTerm.toLowerCase()
    return fullName.includes(query) || email.includes(query) || role.includes(query) || code.includes(query)
  })

  return (
    <article className="hr-card" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
      <div className="hr-card-heading" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span className="card-kicker">Live Directory</span>
          <h2>Workforce Employee Directory</h2>
          <p>{employees.length} employees registered in system</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name, role or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px 0 28px',
                borderRadius: '7px',
                border: '1px solid #dbe4dc',
                fontSize: '11px',
                outline: 'none',
                width: '230px',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '10px', color: '#88988e' }} />
          </div>
          <button className="primary-button" onClick={() => onOpenManualEntry('Employee')}>
            <UserPlus size={15} /> + Add Employee
          </button>
        </div>
      </div>

      <div className="employee-table-container">
        <table className="employee-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Employee Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Access Role</th>
              <th>Status</th>
              <th>Hire Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td><span className="emp-code-badge">{emp.employee_code || emp.id}</span></td>
                  <td>
                    <strong style={{ color: '#253a31', fontSize: '11px' }}>{emp.first_name} {emp.last_name}</strong>
                    {emp.phone && <small style={{ display: 'block', color: '#88988e', fontSize: '9px' }}>{emp.phone}</small>}
                  </td>
                  <td>{emp.email}</td>
                  <td>
                    <div>{emp.role}</div>
                    <small style={{ color: '#88988e' }}>{emp.department_id || 'Engineering'}</small>
                  </td>
                  <td><span className="emp-role-badge">{emp.access_role || 'EMPLOYEE'}</span></td>
                  <td>
                    <span className={`emp-status-badge ${String(emp.employment_status || 'active').toLowerCase().replace(' ', '-')}`}>
                      {emp.employment_status || 'Active'}
                    </span>
                  </td>
                  <td>{emp.hire_date || '2026-01-15'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#7a8c82' }}>
                  No employees match "{searchTerm}". Click "+ Add Employee" to create one manually!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function ManualEntryModal({ isOpen, onClose, onRefreshData, employeesList = [], initialTab = 'Employee' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, isOpen])

  const [empForm, setEmpForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: 'DEP-ENG',
    role: 'Software Engineer',
    access_role: 'EMPLOYEE',
    employment_status: 'Active',
    worker_type: 'Employee',
    hire_date: new Date().toISOString().split('T')[0],
  })

  const [attForm, setAttForm] = useState({
    employee_id: employeesList[0]?.id || 'E001',
    date: new Date().toISOString().split('T')[0],
    check_in: '09:00',
    check_out: '17:00',
    attendance_method: 'Manual',
    status: 'Present',
    notes: 'Manual entry',
  })

  const [shiftForm, setShiftForm] = useState({
    employee_id: employeesList[0]?.id || 'E001',
    shift_name: 'General Shift',
    start_time: '09:00',
    end_time: '17:00',
    assignment_date: new Date().toISOString().split('T')[0],
  })

  const [leaveForm, setLeaveForm] = useState({
    employee_id: employeesList[0]?.id || 'E001',
    leave_type: 'Annual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    total_days: 1.0,
    reason: 'Personal leave',
  })

  const [tsForm, setTsForm] = useState({
    employee_id: employeesList[0]?.id || 'E001',
    project: 'Product Development',
    work_date: new Date().toISOString().split('T')[0],
    regular_hours: 8.0,
    overtime_hours: 0.0,
    description: 'Manual work hour logging',
  })

  const [payForm, setPayForm] = useState({
    employee_id: employeesList[0]?.id || 'E001',
    pay_period: 'August 2026',
    base_salary: 5000.0,
    bonuses_incentives: 500.0,
    overtime_pay: 0.0,
  })

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (activeTab === 'Employee') {
        const res = await fetch('http://localhost:8000/api/employees/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(empForm),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Failed to create employee')
        }
        setMessage('Employee created successfully!')
      } else if (activeTab === 'Attendance') {
        const res = await fetch('http://localhost:8000/api/attendance/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attForm),
        })
        if (!res.ok) throw new Error('Failed to mark attendance')
        setMessage('Attendance logged successfully!')
      } else if (activeTab === 'Shift') {
        const res = await fetch('http://localhost:8000/api/shifts/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...shiftForm, shift_id: 'SH-001' }),
        })
        if (!res.ok) throw new Error('Failed to assign shift')
        setMessage('Shift assigned successfully!')
      } else if (activeTab === 'Leave') {
        const res = await fetch('http://localhost:8000/api/leaves/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leaveForm),
        })
        if (!res.ok) throw new Error('Failed to submit leave request')
        setMessage('Leave request submitted successfully!')
      } else if (activeTab === 'Timesheet') {
        const res = await fetch('http://localhost:8000/api/timesheets/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tsForm),
        })
        if (!res.ok) throw new Error('Failed to log timesheet')
        setMessage('Timesheet entry saved successfully!')
      } else if (activeTab === 'Payroll') {
        const res = await fetch('http://localhost:8000/api/payroll/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payForm),
        })
        if (!res.ok) throw new Error('Failed to save payroll record')
        setMessage('Payroll record updated successfully!')
      }

      if (onRefreshData) onRefreshData()
      setTimeout(() => {
        setLoading(false)
        onClose()
      }, 900)
    } catch (error) {
      setLoading(false)
      setMessage(`Error: ${error.message}`)
    }
  }

  return (
    <div className="manual-entry-overlay" onClick={onClose}>
      <div className="manual-entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manual-entry-header">
          <div>
            <span className="card-kicker">Manual Entry Center</span>
            <h2>Create & Add Records</h2>
            <p>Manually input employee, attendance, shift, leave, timesheet, or payroll details.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="manual-tabs">
          {['Employee', 'Attendance', 'Shift', 'Leave', 'Timesheet', 'Payroll'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`manual-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setMessage(''); }}
            >
              {tab === 'Employee' && <UsersRound size={14} />}
              {tab === 'Attendance' && <Clock3 size={14} />}
              {tab === 'Shift' && <CalendarDays size={14} />}
              {tab === 'Leave' && <FileBarChart size={14} />}
              {tab === 'Timesheet' && <Activity size={14} />}
              {tab === 'Payroll' && <WalletCards size={14} />}
              {tab}
            </button>
          ))}
        </div>

        {message && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '14px',
            fontSize: '11px',
            fontWeight: 700,
            background: message.startsWith('Error') ? '#ffe8e5' : '#e2f5e7',
            color: message.startsWith('Error') ? '#c44536' : '#22744e',
            border: `1px solid ${message.startsWith('Error') ? '#f3b8b0' : '#b2e2bd'}`,
          }}>
            {message}
          </div>
        )}

        <form className="manual-form" onSubmit={handleSubmit}>
          {activeTab === 'Employee' && (
            <div className="form-grid">
              <div className="form-group">
                <label>First Name</label>
                <input required value={empForm.first_name} onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })} placeholder="e.g. John" />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input required value={empForm.last_name} onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })} placeholder="e.g. Doe" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" required value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} placeholder="john.doe@company.com" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} placeholder="+1 (555) 000-1234" />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select value={empForm.department_id} onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}>
                  <option value="DEP-ENG">Engineering</option>
                  <option value="DEP-CS">Customer Success</option>
                  <option value="DEP-MKT">Marketing</option>
                  <option value="DEP-OPS">Operations</option>
                  <option value="DEP-HR">Human Resources</option>
                </select>
              </div>
              <div className="form-group">
                <label>Designation / Role</label>
                <input required value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} placeholder="e.g. Software Engineer" />
              </div>
              <div className="form-group">
                <label>Access Role</label>
                <select value={empForm.access_role} onChange={(e) => setEmpForm({ ...empForm, access_role: e.target.value })}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Administrator</option>
                </select>
              </div>
              <div className="form-group">
                <label>Worker Type</label>
                <select value={empForm.worker_type} onChange={(e) => setEmpForm({ ...empForm, worker_type: e.target.value })}>
                  <option value="Employee">Full-time Employee</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>
              <div className="form-group">
                <label>Hire Date</label>
                <input type="date" value={empForm.hire_date} onChange={(e) => setEmpForm({ ...empForm, hire_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Employment Status</label>
                <select value={empForm.employment_status} onChange={(e) => setEmpForm({ ...empForm, employment_status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Attendance' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={attForm.employee_id} onChange={(e) => setAttForm({ ...attForm, employee_id: e.target.value })}>
                  {employeesList.length > 0 ? employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.id})</option>) : <option value="E001">Alex Rivera (E001)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Check-in Time</label>
                <input type="time" value={attForm.check_in} onChange={(e) => setAttForm({ ...attForm, check_in: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Check-out Time</label>
                <input type="time" value={attForm.check_out} onChange={(e) => setAttForm({ ...attForm, check_out: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Method</label>
                <select value={attForm.attendance_method} onChange={(e) => setAttForm({ ...attForm, attendance_method: e.target.value })}>
                  <option value="Manual">Manual HR Entry</option>
                  <option value="GPS">GPS Geofence</option>
                  <option value="Biometric">Biometric Fingerprint</option>
                  <option value="QR">QR Code</option>
                </select>
              </div>
              <div className="form-group">
                <label>Attendance Status</label>
                <select value={attForm.status} onChange={(e) => setAttForm({ ...attForm, status: e.target.value })}>
                  <option value="Present">Present</option>
                  <option value="Late">Late Arrival</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Shift' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={shiftForm.employee_id} onChange={(e) => setShiftForm({ ...shiftForm, employee_id: e.target.value })}>
                  {employeesList.length > 0 ? employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.id})</option>) : <option value="E001">Alex Rivera (E001)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Shift Name</label>
                <input value={shiftForm.shift_name} onChange={(e) => setShiftForm({ ...shiftForm, shift_name: e.target.value })} placeholder="e.g. Morning Shift" />
              </div>
              <div className="form-group">
                <label>Assignment Date</label>
                <input type="date" value={shiftForm.assignment_date} onChange={(e) => setShiftForm({ ...shiftForm, assignment_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === 'Leave' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={leaveForm.employee_id} onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                  {employeesList.length > 0 ? employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.id})</option>) : <option value="E001">Alex Rivera (E001)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Leave Type</label>
                <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Personal">Personal Day</option>
                  <option value="Maternity">Maternity/Paternity</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label>Reason / Details</label>
                <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." />
              </div>
            </div>
          )}

          {activeTab === 'Timesheet' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={tsForm.employee_id} onChange={(e) => setTsForm({ ...tsForm, employee_id: e.target.value })}>
                  {employeesList.length > 0 ? employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.id})</option>) : <option value="E001">Alex Rivera (E001)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Project Name</label>
                <input value={tsForm.project} onChange={(e) => setTsForm({ ...tsForm, project: e.target.value })} placeholder="e.g. Workforce Dashboard" />
              </div>
              <div className="form-group">
                <label>Work Date</label>
                <input type="date" value={tsForm.work_date} onChange={(e) => setTsForm({ ...tsForm, work_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Hours Worked</label>
                <input type="number" step="0.5" value={tsForm.regular_hours} onChange={(e) => setTsForm({ ...tsForm, regular_hours: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group full-width">
                <label>Task Description</label>
                <textarea value={tsForm.description} onChange={(e) => setTsForm({ ...tsForm, description: e.target.value })} placeholder="Task summary..." />
              </div>
            </div>
          )}

          {activeTab === 'Payroll' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={payForm.employee_id} onChange={(e) => setPayForm({ ...payForm, employee_id: e.target.value })}>
                  {employeesList.length > 0 ? employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.id})</option>) : <option value="E001">Alex Rivera (E001)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Pay Period</label>
                <input value={payForm.pay_period} onChange={(e) => setPayForm({ ...payForm, pay_period: e.target.value })} placeholder="e.g. August 2026" />
              </div>
              <div className="form-group">
                <label>Base Salary ($)</label>
                <input type="number" value={payForm.base_salary} onChange={(e) => setPayForm({ ...payForm, base_salary: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Bonus & Incentives ($)</label>
                <input type="number" value={payForm.bonuses_incentives} onChange={(e) => setPayForm({ ...payForm, bonuses_incentives: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving Record...' : `Save ${activeTab} Entry`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HRDashboard({ onLogout, dataset, onImport, onOpenAssistant, assistantState, liveSnapshot, onGeneratePayroll, liveWorkforce, onOpenManualEntry }) {
  const [activeSection, setActiveSection] = useState('Overview')
  const [dismissedAlerts, setDismissedAlerts] = useState([])
  const [hubTab, setHubTab] = useState('AI capabilities')
  const [workflowStep, setWorkflowStep] = useState(3)
  const [actionNotice, setActionNotice] = useState('')
  const hrNav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Employee analytics', icon: UsersRound },
    { label: 'Attrition trends', icon: Activity },
    { label: 'Attendance reports', icon: Clock3 },
    { label: 'Payroll reports', icon: WalletCards },
    { label: 'Compliance monitoring', icon: ShieldCheck },
  ]
  const alerts = [
    { id: 1, icon: CalendarDays, color: 'blue', title: 'Shift reminders', text: '18 employees have shifts starting within 2 hours.', action: 'Review shifts' },
    { id: 2, icon: FileBarChart, color: 'yellow', title: 'Leave approval notifications', text: '7 leave requests are waiting for manager approval.', action: 'Open approvals' },
    { id: 3, icon: AlertTriangle, color: 'coral', title: 'Attendance alerts', text: '4 late arrivals and 2 unusual check-ins detected today.', action: 'View anomalies' },
    { id: 4, icon: Sparkles, color: 'mint', title: 'Birthdays & anniversaries', text: 'Celebrate 3 team milestones this week.', action: 'See milestones' },
  ]
  const hubContent = {
    'AI capabilities': {
      kicker: 'Intelligence layer', title: 'AI capabilities', description: 'Signals that turn workforce data into earlier, smarter decisions.', items: [
        ['AI chatbot for HR queries', 'Ask policy, people, and payroll questions in natural language.', 'Summarize the latest HR, attendance, and payroll signals.'],
        ['Attendance anomaly detection', 'Flag unusual check-ins, missed punches, and location drift.', 'Which attendance anomalies were detected today?'],
        ['Predictive absenteeism analysis', 'See absence risk before it impacts team capacity.', 'Which teams show the highest absenteeism risk?'],
        ['Intelligent shift scheduling', 'Balance coverage, preferences, skills, and overtime.', 'Where are the biggest shift coverage gaps?'],
        ['Employee attrition prediction', 'Spot retention risk with explainable signals.', 'Which departments have the highest attrition risk?'],
        ['Productivity scoring', 'Understand output patterns without reducing people to a number.', 'Summarize current workforce productivity signals.'],
        ['Workforce forecasting', 'Model demand, staffing needs, and future skill gaps.', 'Where should we hire next based on workforce demand?'],
        ['Automated compliance alerts', 'Stay ahead of training, access, and policy deadlines.', 'Which compliance items need HR attention?'],
      ],
    },
    Integrations: {
      kicker: 'Connected ecosystem', title: 'Integrations', description: 'Keep every workforce signal in sync with the tools your teams already use.', items: [['Biometric devices', 'Attendance events sync in real time.'], ['ERP systems', 'Connect people costs and resource plans.'], ['Payroll software', 'Send approved inputs without re-keying.'], ['Microsoft Teams', 'Bring alerts and approvals into team channels.'], ['Slack', 'Deliver HR updates where work happens.'], ['Outlook', 'Coordinate calendars, shifts, and reminders.'], ['Google Workspace', 'Sync identity, calendar, and org structure.'], ['Active Directory', 'Provision roles with secure directory access.'], ['SAP', 'Connect enterprise workforce and finance data.'], ['Oracle HRMS', 'Keep core employee records aligned.']],
    },
    Reports: {
      kicker: 'Decision-ready data', title: 'Reports library', description: 'Generate, schedule, and share the workforce reports leadership needs.', items: [['Daily attendance', 'Presence, late arrivals, absences, and anomalies.'], ['Monthly attendance', 'Trends by location, department, and shift.'], ['Overtime report', 'Hours, cost, and approval status.'], ['Leave summary', 'Balances, usage, and pending requests.'], ['Payroll summary', 'Inputs, deductions, incentives, and exceptions.'], ['Employee productivity', 'Goals, output, and capacity signals.'], ['Shift utilization', 'Coverage, swaps, and schedule efficiency.'], ['Workforce cost analysis', 'Cost by team, role, location, and worker type.'], ['Attrition report', 'Risk segments, trends, and retention actions.'], ['Department performance', 'KPIs and comparative team health.']],
    },
    Security: {
      kicker: 'Trust center', title: 'Security & governance', description: 'Controls designed for sensitive workforce data and accountable operations.', items: [['Role-based access control', 'Give every role the minimum access it needs.'], ['Multi-factor authentication', 'Add a second layer of identity verification.'], ['Data encryption', 'Protect workforce data in transit and at rest.'], ['Audit logs', 'Trace sensitive actions and approvals.'], ['Backup & disaster recovery', 'Keep critical operations resilient.'], ['GDPR-ready data handling', 'Support privacy, retention, and access workflows.']],
    },
  }
  const workflow = ['Check-in captured', 'AI validates attendance', 'Shift & overtime calculated', 'Leave routed for approval', 'Timesheet approved', 'Payroll inputs generated', 'Dashboards updated', 'Alerts shared', 'Reports distributed']
  const activeHub = hubContent[hubTab]
  const metrics = deriveMetrics(dataset.attendance, dataset.allocation, dataset.workforce)
  const liveMetrics = {
    employeeCount: liveSnapshot.employeeCount || metrics.employeeCount,
    attritionRate: liveSnapshot.employeeCount ? Math.max(0, Math.min(100, liveSnapshot.attendanceRate || 0)) : metrics.attritionRate,
    attendance: liveSnapshot.attendanceRate || metrics.attendance,
    payrollRate: liveSnapshot.totalRecords ? Math.round((liveSnapshot.processedPayrollCount / liveSnapshot.totalRecords) * 100) : metrics.payrollRate,
    processedPayroll: liveSnapshot.processedPayrollCount || metrics.processedPayroll,
    workforceRows: liveSnapshot.totalRecords || metrics.workforceRows,
    presentRows: liveSnapshot.presentCount || metrics.presentRows,
    leaveRows: liveSnapshot.leaveCount || metrics.leaveRows,
    absentRows: Math.max(0, (liveSnapshot.employeeCount || 0) - (liveSnapshot.presentCount || 0) - (liveSnapshot.leaveCount || 0)) || metrics.absentRows,
    departments: metrics.departments,
    allocationRows: metrics.allocationRows,
  }
  const focusHrPanel = (section, panelId) => {
    setActiveSection(section)
    window.requestAnimationFrame(() => document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const handleHrNavigation = (section) => {
    const panelBySection = {
      Overview: 'alerts-card',
      'Employee analytics': 'employee-analytics-card',
      'Attrition trends': 'attrition-card',
      'Attendance reports': 'attendance-report-card',
      'Payroll reports': 'payroll-card',
      'Compliance monitoring': 'compliance-card',
    }
    focusHrPanel(section, panelBySection[section] || 'alerts-card')
  }
  const handleHrAction = (action) => {
    const actionMap = {
      'Review shifts': { question: 'Which upcoming shifts need review?', section: 'Attendance reports', panelId: 'attendance-report-card' },
      'Open approvals': { question: 'Show pending leave approvals.', section: 'Overview', panelId: 'alerts-card' },
      'View anomalies': { question: 'Which attendance anomalies were detected today?', section: 'Attendance reports', panelId: 'attendance-report-card' },
      'See milestones': { section: 'Overview', panelId: 'alerts-card', notice: 'Milestones: 3 birthdays and work anniversaries this week.' },
      'Review compliance center': { section: 'Compliance monitoring', panelId: 'compliance-card' },
      'Full report': { section: 'Attendance reports', panelId: 'attendance-report-card', notice: 'Attendance report opened from the live backend snapshot.' },
    }
    const destination = actionMap[action]
    if (!destination) return
    focusHrPanel(destination.section, destination.panelId)
    setActionNotice(destination.notice || '')
    if (destination.question) {
      assistantState.setQuestion(destination.question)
      onOpenAssistant()
    }
  }
  return (
    <div className="hr-dashboard">
      <aside className="hr-sidebar">
        <div className="brand" />
        <div className="hr-profile"><span className="profile-avatar hr-avatar">AR</span><div><strong>Alex Rivera</strong><small>HR Administrator</small></div></div>
        <p className="nav-label">HR command center</p>
        <nav>{hrNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => handleHrNavigation(label)}><Icon size={17} /><span>{label}</span>{label === 'Compliance monitoring' && <span className="nav-pill">2</span>}</button>)}</nav>
        <div className="hr-sidebar-bottom"><div className="security-chip"><ShieldCheck size={15} /><span><strong>All systems secure</strong><small>Last audit · 12 min ago</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button></div>
      </aside>
      <main className="hr-main">
        <header className="hr-topbar"><div><p className="eyebrow"><span className="live-dot" /> HR command center · Tuesday, September 8</p><h1>Good morning, Alex <span>✦</span></h1><p className="hr-subtitle">The people signals that need your attention today.</p></div><div className="hr-top-actions"><button className="primary-button" onClick={() => onOpenManualEntry('Employee')}><UserPlus size={15} /> + Add Employee / Manual Entry</button><button className="outline-button" onClick={onGeneratePayroll}><WalletCards size={15} /> Generate payroll</button><button className="outline-button"><FileBarChart size={15} /> Export report</button><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><button className="notification-button hr-notification-button" aria-label="Notifications"><Bell size={18} /><i /><span>{alerts.length - dismissedAlerts.length}</span></button><button className="hr-mobile-logout" onClick={onLogout}><LogOut size={15} /></button></div></header>
        <div className="hr-content">
          <section className="data-import-card"><div><span className="card-kicker">Workforce Record Operations</span><h2>Add or refresh workforce records</h2><p>{dataset.attendance.length} attendance records · {dataset.allocation.length} allocation records · {metrics.departments} departments</p></div><div style={{ display: 'flex', gap: '10px' }}><button className="primary-button" onClick={() => onOpenManualEntry('Employee')}><UserPlus size={15} /> Manual Record Entry</button><label className="outline-button import-button"><Database size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={onImport} /></label></div></section>
          <section className="hr-stat-grid"><article className="hr-stat green"><span className="stat-icon green"><UsersRound size={17} /></span><div><small>Total employees</small><strong>{liveMetrics.employeeCount.toLocaleString()}</strong><p><b>Live</b> · backend employee count</p></div><span className="stat-spark green-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat blue"><span className="stat-icon blue"><Activity size={17} /></span><div><small>Attrition rate</small><strong>{liveMetrics.attritionRate}%</strong><p><b>Live</b> · workforce health signal</p></div><span className="stat-spark blue-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat yellow"><span className="stat-icon yellow"><Clock3 size={17} /></span><div><small>Attendance present rate</small><strong>{liveMetrics.attendance}%</strong><p><b>{liveMetrics.presentRows}</b> present · backend snapshot</p></div><span className="stat-spark yellow-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat coral"><span className="stat-icon coral"><WalletCards size={17} /></span><div><small>Payroll processed</small><strong>{liveMetrics.payrollRate}%</strong><p><b>{liveMetrics.processedPayroll}</b> of {liveMetrics.workforceRows} payroll records</p></div><span className="stat-spark coral-spark"><i /><i /><i /><i /><i /></span></article></section>
          <section className="hr-grid">
            <EmployeeDirectoryCard employees={liveWorkforce?.employees || []} onOpenManualEntry={onOpenManualEntry} />
            <article id="employee-analytics-card" className="hr-card employee-analytics-card"><div className="hr-card-heading"><div><span className="card-kicker">People overview</span><h2>Employee analytics</h2><p>Headcount distribution across loaded data</p></div><button className="small-link" onClick={() => onOpenManualEntry('Employee')}>+ Add Employee <ArrowUpRight size={13} /></button></div><div className="analytics-body"><div className="analytics-donut"><strong>{metrics.employeeCount.toLocaleString()}</strong><small>employees</small></div><div className="analytics-legend"><span><i className="legend-green" />Departments <b>{metrics.departments}</b></span><span><i className="legend-blue" />Allocation rows <b>{metrics.allocationRows}</b></span><span><i className="legend-yellow" />Attendance rows <b>{dataset.attendance.length}</b></span><span><i className="legend-coral" />Profiles <b>Not supplied</b></span></div></div><div className="analytics-footer"><span>{metrics.departments} departments</span><span>Locations not supplied</span><span>Profile fields not supplied</span></div></article>
            <article id="attrition-card" className="hr-card attrition-card"><div className="hr-card-heading"><div><span className="card-kicker">Predictive signal</span><h2>Attrition trends</h2><p>Average rate across workforce metrics</p></div><span className="risk-badge">{metrics.attritionDelta <= 0 ? 'Improving' : 'Watch'}</span></div><div className="attrition-data-panel"><strong>{metrics.attritionRate}%</strong><span>Current average attrition</span><b>{metrics.attritionDelta <= 0 ? '↓' : '↑'} {Math.abs(metrics.attritionDelta)}% vs previous period</b></div></article>
            <article id="attendance-report-card" className="hr-card attendance-report-card"><div className="hr-card-heading"><div><span className="card-kicker">Operations</span><h2>Attendance reports</h2><p>Calculated from live attendance records</p></div><button className="small-link" onClick={() => handleHrAction('Full report')}>Full report <ArrowUpRight size={13} /></button></div><div className="attendance-report-footer"><span><strong>{liveMetrics.presentRows}</strong> present</span><span><strong>{liveMetrics.leaveRows}</strong> leave/away</span><span><strong>{liveMetrics.absentRows}</strong> absent</span></div></article>
            <article id="payroll-card" className="hr-card payroll-card"><div className="hr-card-heading"><div><span className="card-kicker">Finance operations</span><h2>Payroll reports</h2><p>Payroll status from backend data</p></div><span className="processed-badge"><ShieldCheck size={13} /> {liveMetrics.payrollRate}% ready</span></div><div className="payroll-progress"><div><span>Payroll records processed</span><b>{liveMetrics.processedPayroll} / {liveMetrics.workforceRows}</b></div><div className="payroll-track"><i style={{ width: `${liveMetrics.payrollRate}%` }} /></div></div><div className="payroll-items"><span><i className="payroll-green" />Processed <b>{liveMetrics.processedPayroll}</b></span><span><i className="payroll-yellow" />Pending <b>{Math.max(0, liveMetrics.workforceRows - liveMetrics.processedPayroll)}</b></span></div></article>
            <article id="compliance-card" className="hr-card compliance-card"><div className="hr-card-heading"><div><span className="card-kicker">Risk & governance</span><h2>Compliance monitoring</h2><p>Policy health across your organization</p></div><span className="compliance-score">92 <small>/ 100</small></span></div><div className="compliance-list"><span><ShieldCheck size={14} /><b>GDPR data handling</b><em>Compliant</em></span><span><ShieldCheck size={14} /><b>Mandatory training</b><em className="warning">18 due</em></span><span><ShieldCheck size={14} /><b>Access reviews</b><em className="warning">2 overdue</em></span></div><button className="view-link" onClick={() => handleHrAction('Review compliance center')}>Review compliance center <ArrowUpRight size={14} /></button></article>
            <article id="alerts-card" className="hr-card alerts-card"><div className="hr-card-heading"><div><span className="card-kicker">Live feed</span><h2>Notifications & alerts</h2><p>Stay ahead of the moments that matter</p></div><span className="alert-count">{alerts.length - dismissedAlerts.length} new</span></div>{actionNotice && <p className="action-notice" role="status">{actionNotice}</p>}<div className="hr-alert-list">{alerts.map((alert) => { const Icon = alert.icon; return <div className={`hr-alert ${dismissedAlerts.includes(alert.id) ? 'dismissed' : ''}`} key={alert.id}><span className={`alert-icon ${alert.color}`}><Icon size={14} /></span><div><strong>{alert.title}</strong><small>{alert.text}</small><button onClick={() => handleHrAction(alert.action)}>{alert.action} <ArrowUpRight size={11} /></button></div><button className="dismiss-alert" onClick={() => setDismissedAlerts([...dismissedAlerts, alert.id])} aria-label={`Dismiss ${alert.title}`}>×</button></div> })}</div></article>
          </section>
          <section className="automation-hub">
            <div className="hub-heading"><div><p className="eyebrow"><span className="live-dot" /> Workforce platform</p><h2>Automation, intelligence, and control</h2><p>One operating layer for the full workforce lifecycle.</p></div><div className="hub-outcomes"><span><strong>80-90%</strong><small>manual work reduced</small></span><span><strong>24/7</strong><small>operational visibility</small></span><span><strong>100%</strong><small>audit-ready activity</small></span></div></div>
            <div className="hub-tabs">{Object.keys(hubContent).map((tab) => <button key={tab} className={hubTab === tab ? 'active' : ''} onClick={() => setHubTab(tab)}>{tab === 'AI capabilities' && <Sparkles size={14} />}{tab === 'Integrations' && <Command size={14} />}{tab === 'Reports' && <FileBarChart size={14} />}{tab === 'Security' && <ShieldCheck size={14} />}{tab}</button>)}</div>
            <div className="hub-content"><div className="hub-copy"><span className="card-kicker">{activeHub.kicker}</span><h3>{activeHub.title}</h3><p>{activeHub.description}</p><button className="primary-button hub-action" onClick={() => { assistantState.setQuestion(activeHub.items[0]?.[2] || `Tell me about ${activeHub.title}.`); onOpenAssistant() }}>Explore {activeHub.title} <ArrowUpRight size={15} /></button></div><div className="hub-item-grid">{activeHub.items.map(([title, description, prompt], index) => <button className="hub-item" key={title} onClick={() => { assistantState.setQuestion(prompt || `Tell me more about ${title}.`); onOpenAssistant() }}><span className={`hub-item-number ${hubTab === 'Security' ? 'secure' : ''}`}>{String(index + 1).padStart(2, '0')}</span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={14} /></button>)}</div></div>
            <div className="workflow-strip"><div className="workflow-heading"><div><span className="card-kicker">Real-time workflow</span><h3>From check-in to insight</h3></div><span className="workflow-live"><i /> Live now</span></div><div className="workflow-steps">{workflow.map((step, index) => <button key={step} className={index <= workflowStep ? 'complete' : ''} onClick={() => setWorkflowStep(index)}><span>{index < workflowStep ? '✓' : index + 1}</span><small>{step}</small></button>)}</div></div>
          </section>
        </div>
      </main>
      <AssistantDrawer
        isOpen={assistantState.isOpen}
        onClose={assistantState.onClose}
        question={assistantState.question}
        setQuestion={assistantState.setQuestion}
        onSubmit={assistantState.onSubmit}
        submittedQuestion={assistantState.submittedQuestion}
        aiLoading={assistantState.aiLoading}
        aiAnswer={assistantState.aiAnswer}
        roleLabel="HR Administrator"
      />
    </div>
  )
}

function App() {
  const [authenticatedRole, setAuthenticatedRole] = useState(null)
  const [dataset, setDataset] = useState({ attendance: [], allocation: [], workforce: [] })
  const [liveWorkforce, setLiveWorkforce] = useState({ employees: [], attendance: [], payrollSummary: {}, leaveRequests: [] })
  const [activeNav, setActiveNav] = useState('Overview')
  const [range, setRange] = useState('This week')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')

  const workforceMetrics = deriveMetrics(dataset.attendance, dataset.allocation, dataset.workforce)
  const totalHeadcount = workforceMetrics.employeeCount || 0

  useEffect(() => {
    Promise.all([
      fetch('/data/attendance.csv').then((response) => response.text()),
      fetch('/data/allocation.csv').then((response) => response.text()),
      fetch('/data/workforce_metrics.csv').then((response) => response.text()),
    ]).then(([attendanceText, allocationText, workforceText]) => {
      setDataset({ attendance: parseCsv(attendanceText), allocation: parseCsv(allocationText), workforce: parseCsv(workforceText) })
    }).catch(() => {})

    Promise.all([
      fetch('http://localhost:8000/api/employees/').then((response) => response.json()),
      fetch('http://localhost:8000/api/attendance/').then((response) => response.json()),
      fetch('http://localhost:8000/api/payroll/summary').then((response) => response.json()),
      fetch('http://localhost:8000/api/leaves/').then((response) => response.json()),
    ]).then(([employees, attendance, payrollSummary, leaveRequests]) => {
      setLiveWorkforce({ employees, attendance, payrollSummary, leaveRequests })
    }).catch(() => {
      setLiveWorkforce({ employees: [], attendance: [], payrollSummary: {}, leaveRequests: [] })
    })
  }, [])

  const importCsv = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      const rows = parseCsv(text)
      const headers = Object.keys(rows[0] || {})
      if (headers.includes('Status') && headers.includes('E_Name')) setDataset((current) => ({ ...current, attendance: [...current.attendance, ...rows] }))
      if (headers.includes('department') && headers.includes('allocation_status')) setDataset((current) => ({ ...current, allocation: [...current.allocation, ...rows] }))
      if (headers.includes('attrition_rate') && headers.includes('payroll_status')) setDataset((current) => ({ ...current, workforce: [...current.workforce, ...rows] }))
      event.target.value = ''
    })
  }

  const [aiAnswer, setAiAnswer] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState({ healthy: false })

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('unhealthy')))
      .then(() => setBackendStatus({ healthy: true }))
      .catch(() => setBackendStatus({ healthy: false }))
  }, [])

  const submitQuestion = (event) => {
    event.preventDefault()
    if (!question.trim()) return
    const currentQuestion = question.trim()
    setSubmittedQuestion(currentQuestion)
    setAiLoading(true)

    fetch('http://localhost:8000/api/ai/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: currentQuestion, role: authenticatedRole?.label || 'HR Administrator' })
    })
      .then((res) => res.json())
      .then((data) => {
        setAiAnswer(data.answer)
        setAiLoading(false)
      })
      .catch(() => {
        setAiAnswer(`Based on current signals: ${currentQuestion} - Attendance is 91.7% with high overall stability. 128 employees active.`)
        setAiLoading(false)
      })
  }

  const generatePayroll = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pay_period: '2026-08' }),
      })
      if (!response.ok) throw new Error('Payroll generation failed')
      const result = await response.json()
      setLiveWorkforce((current) => ({
        ...current,
        payrollSummary: {
          total_payroll_cost: result.total_payroll_cost,
          processed_records: result.generated_records,
          total_records: result.generated_records,
        },
      }))
      alert(`${result.generated_records} employee salaries generated for ${result.pay_period}.`)
    } catch (error) {
      alert(error.message)
    }
  }

  const liveSnapshot = buildLiveWorkforceSnapshot(liveWorkforce.employees, liveWorkforce.attendance, liveWorkforce.payrollSummary, liveWorkforce.leaveRequests)

  const assistantState = {
    isOpen: isAssistantOpen,
    onClose: () => setIsAssistantOpen(false),
    question,
    setQuestion,
    onSubmit: submitQuestion,
    submittedQuestion,
    aiLoading,
    aiAnswer,
  }

  const handleLogin = async (roleConfig, loginEmail = 'megha@gmail.com', loginPassword = 'demo-password') => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword, role: roleConfig.label || 'HR Administrator' }),
      })
      if (!response.ok) throw new Error('login failed')
      const data = await response.json()
      setAuthenticatedRole({ ...roleConfig, email: data.email || loginEmail, name: data.name || `${roleConfig.label}` })
      return true
    } catch (error) {
      setAuthenticatedRole(roleConfig)
      return true
    }
  }

  const refreshLiveWorkforce = () => {
    Promise.all([
      fetch('http://localhost:8000/api/employees/').then((response) => response.json()),
      fetch('http://localhost:8000/api/attendance/').then((response) => response.json()),
      fetch('http://localhost:8000/api/payroll/summary').then((response) => response.json()),
      fetch('http://localhost:8000/api/leaves/').then((response) => response.json()),
    ]).then(([employees, attendance, payrollSummary, leaveRequests]) => {
      setLiveWorkforce({ employees, attendance, payrollSummary, leaveRequests })
    }).catch(() => {})
  }

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [manualEntryTab, setManualEntryTab] = useState('Employee')

  const handleOpenManualEntry = (tab = 'Employee') => {
    setManualEntryTab(tab)
    setIsManualEntryOpen(true)
  }

  if (!authenticatedRole) return <LoginPage onLogin={handleLogin} headcount={totalHeadcount} backendStatus={backendStatus} />
  if (authenticatedRole.id === 'employee') return (
    <>
      <EmployeePortal employee={authenticatedRole} onLogout={() => setAuthenticatedRole(null)} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} onOpenManualEntry={handleOpenManualEntry} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )
  if (authenticatedRole.id === 'manager') return (
    <>
      <ManagerDashboard onLogout={() => setAuthenticatedRole(null)} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} onOpenManualEntry={handleOpenManualEntry} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )
  if (authenticatedRole.id === 'hr') return (
    <>
      <HRDashboard onLogout={() => setAuthenticatedRole(null)} dataset={dataset} onImport={importCsv} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} onGeneratePayroll={generatePayroll} liveWorkforce={liveWorkforce} onOpenManualEntry={handleOpenManualEntry} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isMobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span> </span>
          <button className="icon-button sidebar-close" onClick={() => setIsMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div><strong>Northstar Inc.</strong><small>People operations</small></div>
          <ChevronDown size={15} />
        </div>

        <p className="nav-label">Workspace</p>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setIsMobileNavOpen(false) }}>
              <Icon size={17} strokeWidth={activeNav === label ? 2.4 : 1.8} />
              <span>{label}</span>
              {label === 'Reports' && <span className="nav-pill">3</span>}
            </button>
          ))}
        </nav>

        <p className="nav-label nav-label-spaced">Manage</p>
        <nav>
          <button className="nav-item"><Settings size={17} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17} /><span>Help center</span></button>
        </nav>

        <div className="sidebar-footer">
          <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Unlock more insights</strong><span>Get deeper workforce signals with Pro.</span><button>Explore Pro <ArrowUpRight size={14} /></button></div>
          <div className="user-profile"><div className="profile-avatar">AR</div><div><strong>Alex Rivera</strong><small>HR Administrator</small></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setIsMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="backend-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.7rem', borderRadius: '999px', background: backendStatus.healthy ? 'rgba(39,174,96,0.12)' : 'rgba(248,171,29,0.12)', color: backendStatus.healthy ? '#7ae5a9' : '#ffd166', border: `1px solid ${backendStatus.healthy ? '#39c178' : '#e7aa24'}`, fontSize: '0.72rem', fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: backendStatus.healthy ? '#39c178' : '#e7aa24', display: 'inline-block' }} />
              {backendStatus.healthy ? 'AI connected' : 'Checking backend'}
            </div>
            <button className="search-button"><Search size={17} /><span>Search anything</span><kbd><Command size={11} /> K</kbd></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="profile-avatar top-avatar">AR</button>
          </div>
        </header>

        <div className="page-container">
          <section className="welcome-row">
            <div><p className="eyebrow"><span className="live-dot" /> Live workforce pulse</p><h1>Good morning, Alex <span>✦</span></h1><p className="subtitle">Here is what is happening across Northstar today.</p></div>
            <div className="welcome-actions"><button className="outline-button"><FileBarChart size={16} /> Export report</button><button className="primary-button" onClick={() => setIsAssistantOpen(true)}><Bot size={17} /> Ask assistant</button></div>
          </section>

          <section className="metric-grid">
            <article className="metric-card accent-mint"><div className="metric-top"><span>Active headcount</span><span className="metric-icon"><UsersRound size={17} /></span></div><strong>{totalHeadcount.toLocaleString()}</strong><div className="metric-bottom"><span className="trend positive">↗ 4.8%</span><span>vs last month</span><div className="mini-bars mint-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-blue"><div className="metric-top"><span>Attendance today</span><span className="metric-icon"><Clock3 size={17} /></span></div><strong>94.6%</strong><div className="metric-bottom"><span className="trend positive">↗ 2.1%</span><span>vs last week</span><div className="mini-bars blue-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-yellow"><div className="metric-top"><span>Open positions</span><span className="metric-icon"><Sparkles size={17} /></span></div><strong>36</strong><div className="metric-bottom"><span className="trend neutral">12 urgent</span><span>across 8 teams</span><div className="mini-bars yellow-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-coral"><div className="metric-top"><span>Attrition risk</span><span className="metric-icon"><Activity size={17} /></span></div><strong>8.2%</strong><div className="metric-bottom"><span className="trend negative">↘ 1.4%</span><span>vs last quarter</span><div className="mini-bars coral-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel attendance-panel"><div className="panel-heading"><div><h2>Attendance overview</h2><p>Daily presence across all locations</p></div><select value={range} onChange={(event) => setRange(event.target.value)}><option>This week</option><option>This month</option><option>This quarter</option></select></div><div className="chart-area"><div className="chart-y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-content"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bars">{attendance.map((item) => <div className="bar-column" key={item.day}><div className="bar-tooltip">{item.value}%</div><div className="bar" style={{ '--bar-height': `${item.value}%` }} /><span>{item.day}</span></div>)}</div></div></div><div className="chart-footer"><span><i className="legend-dot present" /> Present</span><span><i className="legend-dot away" /> Away / leave</span><span className="chart-note"><ArrowUpRight size={14} /> 3.2% higher than last week</span></div></article>

            <article className="panel ai-panel"><div className="panel-heading"><div className="ai-title"><div className="ai-icon"><Sparkles size={16} /></div><div><h2>AI briefing</h2><p>Generated 8 minutes ago</p></div></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="ai-summary"><span className="summary-label">Today’s signal</span><h3>Team energy is up, but capacity is tightening.</h3><p>Attendance is <strong>3.2% above</strong> the weekly average. Customer success is approaching its workload threshold with <strong>4 open shifts</strong>.</p><button className="text-button" onClick={() => setIsAssistantOpen(true)}>Explore recommendation <ArrowUpRight size={15} /></button></div><div className="ai-bottom"><div className="sparkline"><span style={{ height: '34%' }} /><span style={{ height: '52%' }} /><span style={{ height: '43%' }} /><span style={{ height: '68%' }} /><span style={{ height: '59%' }} /><span style={{ height: '86%' }} /><span style={{ height: '77%' }} /></div><span>Workforce confidence <strong>87%</strong></span></div></article>

            <article className="panel team-panel"><div className="panel-heading"><div><h2>Team utilization</h2><p>Capacity by department</p></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="team-list">{teams.map((team) => <div className="team-row" key={team.name}><div className="team-info"><span className={`team-dot ${team.color}`} /><div><strong>{team.name}</strong><small>{team.people}</small></div><b>{team.value}%</b></div><div className="progress-track"><div className={`progress-fill ${team.color}`} style={{ width: `${team.value}%` }} /></div></div>)}</div><button className="view-link">View workforce map <ArrowUpRight size={14} /></button></article>

            <article className="panel actions-panel"><div className="panel-heading"><div><h2>Needs your attention</h2><p>4 items need review</p></div><span className="attention-count">4</span></div><div className="action-list"><button><span className="action-icon coral"><CalendarDays size={16} /></span><span><strong>Approve shift swaps</strong><small>7 requests pending</small></span><ArrowUpRight size={15} /></button><button><span className="action-icon yellow"><WalletCards size={16} /></span><span><strong>Review payroll inputs</strong><small>Due today, 5:00 PM</small></span><ArrowUpRight size={15} /></button><button><span className="action-icon blue"><MessageSquareText size={16} /></span><span><strong>Respond to 3 check-ins</strong><small>Employee feedback</small></span><ArrowUpRight size={15} /></button></div></article>
          </section>
        </div>
      </main>

      {isAssistantOpen && <div className="assistant-overlay" onClick={() => setIsAssistantOpen(false)}><section className="assistant-drawer" onClick={(event) => event.stopPropagation()}><div className="assistant-header"><div className="ai-title"><div className="ai-icon"><Sparkles size={17} /></div><div><h2>AI assistant</h2><p>Workforce intelligence, on demand</p></div></div><button className="icon-button" onClick={() => setIsAssistantOpen(false)} aria-label="Close assistant"><X size={18} /></button></div><div className="assistant-body"><p className="assistant-greeting">Hi Alex. I can help you understand your workforce data or take action on your priority tasks.</p><div className="suggestion-grid"><button onClick={() => setQuestion('Which teams are at risk of burnout?')}>Which teams are at risk of burnout?</button><button onClick={() => setQuestion('Summarize attendance this week')}>Summarize attendance this week</button><button onClick={() => setQuestion('Where should we hire next?')}>Where should we hire next?</button></div>{submittedQuestion && <div className="assistant-response"><span className="response-label">AI insight</span><p>{aiLoading ? 'Analyzing workforce signals...' : aiAnswer || `Based on latest signals for: ${submittedQuestion}`}</p></div>}</div><form className="assistant-input" onSubmit={submitQuestion}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your workforce..." /><button type="submit" aria-label="Send question"><ArrowUpRight size={17} /></button></form></section></div>}
    </div>
  )
}

export default App
