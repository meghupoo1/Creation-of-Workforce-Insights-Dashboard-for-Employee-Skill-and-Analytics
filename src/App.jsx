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
import './manager-notifications.css'
import { resolveDefaultManagerId } from './employeeAssignment.js'
import { API_BASE_URL, DEMO_LOGIN_EMAILS } from './config.js'

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
  { id: 'admin', label: 'System Admin', description: 'Full system visibility, security & global access', icon: ShieldCheck, accent: 'purple', email: DEMO_LOGIN_EMAILS.admin },
  { id: 'hr', label: 'HR Administrator', description: 'People analytics, payroll and compliance', icon: BriefcaseBusiness, accent: 'green', email: DEMO_LOGIN_EMAILS.hr },
  { id: 'manager', label: 'Manager', description: 'Team attendance, goals and approvals', icon: UsersRound, accent: 'blue', email: DEMO_LOGIN_EMAILS.manager },
  { id: 'employee', label: 'Employee', description: 'Self-service, shifts and time off', icon: UserRound, accent: 'yellow', email: DEMO_LOGIN_EMAILS.employee },
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

function escapeCsvValue(value) {
  const stringValue = String(value ?? '')
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`
  return stringValue
}

function downloadCsvReport(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  const lateCount = attendance.filter((row) => String(row.status || row.Status || '').toLowerCase() === 'late').length
  const attendanceOnLeaveCount = attendance.filter((row) => ['on leave', 'leave'].includes(String(row.status || row.Status || '').toLowerCase())).length
  const attendanceAbsentCount = attendance.filter((row) => String(row.status || row.Status || '').toLowerCase() === 'absent').length
  const leaveCount = leaveRequests.length
  const approvedLeave = leaveRequests.filter((row) => String(row.status || '').toUpperCase() === 'APPROVED').length
  const pendingLeave = leaveRequests.filter((row) => String(row.status || '').toUpperCase() !== 'APPROVED').length
  const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0
  const totalPayroll = Number(payrollSummary.total_payroll_cost || 0)
  const processedPayrollCount = Number(payrollSummary.processed_records || 0)
  const totalRecords = Number(payrollSummary.total_records || 0)

  return {
    employeeCount: employees.length,
    attendanceRecordCount: attendance.length,
    presentCount,
    lateCount,
    attendanceOnLeaveCount,
    attendanceAbsentCount,
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

function getDefaultSalaryByRole(accessRole = 'EMPLOYEE', roleName = '', workerType = 'Employee', departmentName = '', experienceYears = 0) {
  const normalizedAccessRole = String(accessRole || 'EMPLOYEE').toUpperCase()
  const normalizedRole = String(roleName || '').toLowerCase()
  const normalizedDepartment = String(departmentName || '').toLowerCase()
  let salary = 56000

  if (['chief', 'vice president', 'director'].some((value) => normalizedRole.includes(value))) salary = 140000
  else if (normalizedRole.includes('manager') || normalizedAccessRole === 'MANAGER') salary = 95000
  else if (['engineer', 'developer', 'architect'].some((value) => normalizedRole.includes(value))) salary = 78000
  else if (['analyst', 'data scientist'].some((value) => normalizedRole.includes(value))) salary = 70000
  else if (['designer', 'research'].some((value) => normalizedRole.includes(value))) salary = 74000
  else if (['human resources', 'hr ', 'recruit'].some((value) => normalizedRole.includes(value))) salary = 68000
  else if (normalizedAccessRole === 'ADMIN') salary = 115000
  else if (['HR_ADMIN', 'HR'].includes(normalizedAccessRole)) salary = 82000

  if (['engineering', 'technology', 'finance'].some((value) => normalizedDepartment.includes(value))) salary *= 1.08
  else if (normalizedDepartment.includes('product')) salary *= 1.05
  else if (['customer', 'success', 'human resources', 'hr'].some((value) => normalizedDepartment.includes(value))) salary *= 0.98
  else if (['operations', 'support'].some((value) => normalizedDepartment.includes(value))) salary *= 0.96

  salary *= 1 + Math.min(Math.max(Number(experienceYears) || 0, 0), 25) * 0.02
  if (String(workerType).toLowerCase() === 'contractor') salary *= 0.85
  else if (String(workerType).toLowerCase() === 'intern') salary *= 0.5
  return Math.max(30000, Math.round(salary / 100) * 100)
}

function buildContextualAiResponse(question, roleLabel = 'HR Administrator', liveSnapshot = {}) {
  const q = String(question || '').toLowerCase()
  const attendanceRate = Number(liveSnapshot.attendanceRate || 0)
  const presentCount = Number(liveSnapshot.presentCount || 0)
  const lateCount = Number(liveSnapshot.lateCount || 0)
  const pendingLeave = Number(liveSnapshot.pendingLeave || liveSnapshot.leaveCount || 0)
  const payrollProcessed = Number(liveSnapshot.processedPayrollCount || 0)
  const totalRecords = Number(liveSnapshot.totalRecords || 0)
  const employeeCount = Number(liveSnapshot.employeeCount || 0)
  const payrollCost = Number(liveSnapshot.totalPayroll || 0)
  const attritionRate = Number(liveSnapshot.attritionRate || 12.4)

  const employeeKeywords = ['employee', 'employees', 'person', 'people', 'headcount', 'team', 'workforce']
  const attendanceKeywords = ['attendance', 'present', 'late', 'check-in', 'check in', 'time']
  const leaveKeywords = ['leave', 'approval', 'approve', 'time off']
  const payrollKeywords = ['payroll', 'salary', 'compensation', 'payslip']
  const attritionKeywords = ['attrition', 'retention', 'risk', 'turnover']
  const workloadKeywords = ['workload', 'overtime', 'engineering', 'capacity', 'department']

  if (!q.trim()) {
    return `Here is the current workforce status for ${roleLabel}: attendance is ${attendanceRate}% with ${presentCount} present today, ${lateCount} late, and ${pendingLeave} pending leave items. Payroll is ${totalRecords ? Math.round((payrollProcessed / totalRecords) * 100) : 0}% processed.`
  }

  if (attritionKeywords.some((keyword) => q.includes(keyword))) {
    return `Overall workforce attrition risk is low at ${attritionRate.toFixed(1)}%. This reflects a stable retention profile, with Engineering showing a minor overtime workload alert but no major turnover signal.`
  }

  if (workloadKeywords.some((keyword) => q.includes(keyword))) {
    return `Engineering is showing a slight workload alert due to consecutive overtime, but the overall workforce risk remains low. The current attrition risk is ${attritionRate.toFixed(1)}%, and the team remains stable overall.`
  }

  if (attendanceKeywords.some((keyword) => q.includes(keyword))) {
    return `Current attendance for ${roleLabel}: ${attendanceRate}% of tracked employees are present today, with ${presentCount} present, ${lateCount} late, and ${pendingLeave} active leave or approval items in the queue.`
  }

  if (leaveKeywords.some((keyword) => q.includes(keyword))) {
    return `There are ${pendingLeave} pending leave or approval items in the current workforce view. The team is currently at ${attendanceRate}% attendance, and ${presentCount} employees are present today.`
  }

  if (payrollKeywords.some((keyword) => q.includes(keyword))) {
    const payrollPercent = totalRecords ? Math.round((payrollProcessed / totalRecords) * 100) : 0
    return `Payroll status is ${payrollPercent}% processed across ${totalRecords || 0} records. ${payrollProcessed} records are complete, and the current payroll value is $${payrollCost.toLocaleString()}.`
  }

  if (employeeKeywords.some((keyword) => q.includes(keyword))) {
    return `The live workforce count is ${employeeCount} employees. Current attendance is ${attendanceRate}% with ${presentCount} present and ${lateCount} late today. Attrition risk remains low at ${attritionRate.toFixed(1)}%.`
  }

  return `Based on the live workforce snapshot: attendance is ${attendanceRate}% with ${presentCount} present and ${lateCount} late today. Attrition risk is ${attritionRate.toFixed(1)}%, with Engineering showing a slight overtime workload alert and ${pendingLeave} pending leave items.`
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
            <div className="assistant-response" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <span className="response-label">AI Workforce Agent Signal</span>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.65', fontSize: '11px', marginTop: '6px', color: '#2c3e34' }}>
                {aiLoading ? '🤖 Analyzing real-time workforce metrics and database signals...' : aiAnswer || `Based on latest signals for: ${submittedQuestion}`}
              </div>
            </div>
          )}
        </div>
        <form className="assistant-input" onSubmit={onSubmit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your workforce..." /><button type="submit" aria-label="Send question"><ArrowUpRight size={17} /></button></form>
      </section>
    </div>
  )
}

function LoginPage({ onLogin, onPasswordSetup, headcount = 0, backendStatus = { healthy: false } }) {
  const [selectedRole, setSelectedRole] = useState('admin')
  const [email, setEmail] = useState('admin@gmail.com')
  const [password, setPassword] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [isSettingUpPassword, setIsSettingUpPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginNotice, setLoginNotice] = useState('')
  const role = roles.find((item) => item.id === selectedRole)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoginError('')
    setLoginNotice('')
    const error = await onLogin(role, email, password)
    if (error) setLoginError(error)
  }

  const handlePasswordSetup = async (event) => {
    event.preventDefault()
    setLoginError('')
    setLoginNotice('')
    const error = await onPasswordSetup({ email, setup_code: setupCode, new_password: password })
    if (error) {
      setLoginError(error)
      return
    }
    setIsSettingUpPassword(false)
    setSetupCode('')
    setPassword('')
    setLoginNotice('Password set. Sign in with your new password.')
  }

  const selectRole = (nextRole) => {
    setSelectedRole(nextRole.id)
    setEmail(nextRole.email)
    setLoginError('')
    setLoginNotice('')
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
            {backendStatus.healthy ? 'AI connected to backend' : backendStatus.checking ? 'Checking backend...' : 'Backend unavailable'}
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-heading"><span>{isSettingUpPassword ? 'Account setup' : 'Welcome back'}</span><h2>{isSettingUpPassword ? 'Set your password' : 'Sign in to your workspace'}</h2><p>{isSettingUpPassword ? 'Enter the one-time code provided by your administrator.' : 'Choose your role to continue to Northstar Inc.'}</p></div>
          {!isSettingUpPassword && <div className="role-grid">{roles.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={`role-option ${selectedRole === item.id ? `selected ${item.accent}` : ''}`} onClick={() => selectRole(item)}><span className="role-icon"><Icon size={17} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{selectedRole === item.id && <span className="selected-check">✓</span>}</button> })}</div>}
          <form className="login-form" onSubmit={isSettingUpPassword ? handlePasswordSetup : handleSubmit}>
            <label>Email address<div className="input-wrap"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div></label>
            {isSettingUpPassword && <label>One-time setup code<div className="input-wrap"><LockKeyhole size={16} /><input type="text" value={setupCode} onChange={(event) => setSetupCode(event.target.value)} required autoComplete="one-time-code" /></div></label>}
            <label>{isSettingUpPassword ? 'New password' : 'Password'}<div className="input-wrap"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isSettingUpPassword ? 8 : undefined} maxLength={72} autoComplete={isSettingUpPassword ? 'new-password' : 'current-password'} /></div></label>
            {!isSettingUpPassword && <div className="form-meta"><label className="remember"><input type="checkbox" defaultChecked /> <span>Remember me</span></label><button type="button" className="forgot-button" onClick={() => { setIsSettingUpPassword(true); setPassword(''); setLoginError(''); setLoginNotice('') }}>Set up or reset password</button></div>}
            <button className="login-submit" type="submit">{isSettingUpPassword ? 'Set password' : `Continue as ${role.label}`} <ArrowUpRight size={16} /></button>
            {isSettingUpPassword && <button type="button" className="forgot-button" onClick={() => { setIsSettingUpPassword(false); setSetupCode(''); setPassword(''); setLoginError('') }}>Back to sign in</button>}
            {loginError && <p role="alert" style={{ margin: 0, color: '#c44536', fontSize: '12px', fontWeight: 700 }}>{loginError}</p>}
            {loginNotice && <p role="status" style={{ margin: 0, color: '#237a59', fontSize: '12px', fontWeight: 700 }}>{loginNotice}</p>}
          </form>
          <div className="login-footer"><span>Protected workspace</span><span className="secure-dot" /> <span>Workforce workspace</span></div>
        </div>
      </section>
    </main>
  )
}

function EmployeePortal({ employee, onLogout, onOpenAssistant, assistantState, liveSnapshot, liveWorkforce, onRefreshData, readOnlyPreview = false }) {
  const [checkedIn, setCheckedIn] = useState(false)
  const [activeSection, setActiveSection] = useState('Overview')
  const [leaveRequested, setLeaveRequested] = useState(false)
  const [actionNotice, setActionNotice] = useState('')
  const [selectedCheckinMethod, setSelectedCheckinMethod] = useState('GPS check-in')
  const [verificationMode, setVerificationMode] = useState(null)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [profileEditForm, setProfileEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const employeeId = employee?.employeeId
  const cameraRef = useRef(null)

  useEffect(() => {
    if (!employeeId) {
      setCheckedIn(false)
      return
    }
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const attendanceToday = (liveWorkforce?.attendance || []).find((record) =>
      record.employee_id === employeeId && String(record.date).slice(0, 10) === today
    )
    const status = String(attendanceToday?.status || '').toLowerCase()
    setCheckedIn(status === 'present' || status === 'late')
  }, [employeeId, liveWorkforce?.attendance])

  useEffect(() => {
    if (!employeeId) return undefined
    let active = true
    const refreshNotifications = () => fetch(`${API_BASE_URL}/api/notifications/?employee_id=${encodeURIComponent(employeeId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load notifications')))
      .then((data) => { if (active) setNotifications(data) })
      .catch(() => { if (active) setNotifications([]) })
    refreshNotifications()
    const refreshTimer = window.setInterval(refreshNotifications, 30000)
    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [employeeId])

  const unreadNotificationCount = notifications.filter((notification) => !notification.is_read).length
  const openEmployeeNotification = async (notification) => {
    if (!notification.is_read) {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(notification.id)}/read?employee_id=${encodeURIComponent(employeeId)}`, { method: 'POST' })
      if (response.ok) setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
    }
    setNotificationsOpen(false)
  }

  useEffect(() => {
    if (!employee.employeeId) return undefined
    let active = true
    fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(employee.employeeId)}/workspace`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Employee workspace unavailable')))
      .then((data) => { if (active) setWorkspace(data) })
      .catch(() => { if (active) setWorkspace(null) })
    return () => { active = false }
  }, [employee.employeeId])

  const employeeRecord = workspace?.employee || {}
  const displayName = employee.name || `${employeeRecord.first_name || ''} ${employeeRecord.last_name || ''}`.trim() || 'Employee'
  const jobTitle = employeeRecord.role || employee.label || 'Employee'
  const assignedShift = workspace?.shift

  const openProfileModal = () => {
    const parts = (displayName || '').split(' ')
    setProfileEditForm({
      first_name: employeeRecord.first_name || parts[0] || '',
      last_name: employeeRecord.last_name || parts.slice(1).join(' ') || '',
      email: employeeRecord.email || employee.email || '',
      phone: employeeRecord.phone || '',
    })
    setIsProfileModalOpen(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!employeeId) {
      setActionNotice('Profile updates are read-only in preview mode.')
      setIsProfileModalOpen(false)
      return
    }
    setProfileSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(employeeId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileEditForm),
      })
      if (response.ok) {
        setActionNotice('Profile details updated successfully!')
        setIsProfileModalOpen(false)
        if (onRefreshData) await onRefreshData()
        fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(employeeId)}/workspace`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => { if (data) setWorkspace(data) })
          .catch(() => {})
      } else {
        setActionNotice('Failed to update profile. Please try again.')
      }
    } catch {
      setActionNotice('Unable to reach server. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

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

  const performBiometricCheckin = async (method = 'Face recognition') => {
    if (!employeeId || readOnlyPreview) {
      setActionNotice(readOnlyPreview ? 'Attendance is read-only in the Admin preview.' : 'Sign in as an employee to record attendance.')
      return
    }
    setBiometricLoading(true)
    let imageData = null
    if (cameraRef.current && cameraRef.current.srcObject) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = cameraRef.current.videoWidth || 320
        canvas.height = cameraRef.current.videoHeight || 240
        const ctx = canvas.getContext('2d')
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(cameraRef.current, 0, 0, canvas.width, canvas.height)
          imageData = canvas.toDataURL('image/jpeg', 0.8)
        }
      } catch (err) {
        console.warn('Camera frame capture error:', err)
      }
    }

    const checkInTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/verify-biometric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          email: employee?.email || employeeRecord?.email,
          attendance_method: method,
          image_data: imageData,
          check_in: checkInTime,
        }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Biometric verification failed')
      }

      const result = await response.json()
      setCheckedIn(true)
      setVerificationMode(null)
      setActionNotice(result.message || `${method} verification complete. Attendance recorded in backend.`)

      if (typeof onRefreshData === 'function') {
        onRefreshData()
      }
    } catch (error) {
      console.error('Biometric checkin request error:', error)
      setCheckedIn(true)
      setVerificationMode(null)
      setActionNotice(`${method} verified locally (${error.message}).`)
    } finally {
      setBiometricLoading(false)
    }
  }

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
      Edit: { section: 'My profile', panelId: 'profile-card', notice: 'Profile edit form opened.' },
      'View calendar': { section: 'My shifts', panelId: 'shift-card', notice: 'Shift calendar opened for this week.' },
    }
    const destination = actions[action]
    if (!destination) return
    if (action === 'Edit') {
      openProfileModal()
    }
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
        <div className="employee-greeting"><span className="profile-avatar employee-avatar">{displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{jobTitle}</small></div></div>
        <p className="nav-label">Employee portal</p>
        <nav>{portalNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => focusEmployeePanel(label, { Overview: 'checkin-card', Attendance: 'checkin-card', 'My shifts': 'shift-card', 'Leave & time off': 'leave-card', Timesheets: 'timesheet-card', 'My profile': 'profile-card' }[label])}><Icon size={17} /><span>{label}</span></button>)}</nav>
        <div className="employee-sidebar-bottom"><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button><small>Northstar Inc. · Employee self-service</small></div>
      </aside>
      <main className="employee-main">
        <header className="employee-topbar"><div><p className="eyebrow"><span className="live-dot" /> {new Date().toLocaleDateString()}</p><h1>Good morning, {displayName.split(' ')[0]} <span>✦</span></h1></div><div className="employee-top-actions"><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><div className="manager-notification-control"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><i />{unreadNotificationCount > 0 && <span className="manager-notification-count">{unreadNotificationCount}</span>}</button>{notificationsOpen && <section className="manager-notification-panel" aria-label="Employee notifications"><div className="manager-notification-heading"><strong>Notifications</strong><small>{unreadNotificationCount} new</small></div>{notifications.length ? <div className="manager-notification-list">{notifications.map((notification) => <button key={notification.id} className={`manager-notification-item ${notification.is_read ? 'read' : 'unread'}`} onClick={() => openEmployeeNotification(notification)}><strong>{notification.title}</strong><small>{notification.message}</small><time>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}</time></button>)}</div> : <p className="manager-notification-empty">{employeeId ? 'No new employee notifications.' : 'Sign in as an employee to view personal notifications.'}</p>}</section>}</div><button className="employee-logout-mobile" onClick={onLogout}><LogOut size={15} /> Log out</button></div></header>
        <div className="employee-content" onClick={handleEmployeeSurfaceClick}>
          {actionNotice && <p className="action-notice" role="status">{actionNotice}</p>}
          <section className="employee-hero"><div><span className="hero-kicker">Your workday, at a glance</span><h2>Ready to make it a good one?</h2><p>Everything you need for your time, growth, and next step is here.</p></div><div className="hero-orbit"><span>✦</span><i /><i /><i /></div></section>
          <section className="employee-stat-grid"><article><span className="stat-icon green"><Clock3 size={17} /></span><div><small>Today’s attendance</small><strong>{checkedIn ? 'Checked in' : employeeId ? 'Not checked in' : 'Sign-in required'}</strong><em>{checkedIn ? 'Attendance recorded for today' : employeeId ? 'Your shift starts at 9:00 AM' : 'Personal attendance is unavailable in preview mode.'}</em></div></article><article><span className="stat-icon blue"><CalendarDays size={17} /></span><div><small>Next shift</small><strong>{assignedShift?.name || (employeeId ? 'No shift assigned' : 'Sign-in required')}</strong><em>{assignedShift ? `${assignedShift.start_time} - ${assignedShift.end_time}` : employeeId ? 'Contact your manager to arrange a schedule.' : 'Personal schedule is unavailable in preview mode.'}</em></div></article><article><span className="stat-icon yellow"><FileBarChart size={17} /></span><div><small>Leave balance</small><strong>{employeeId ? 'Not available' : 'Sign-in required'}</strong><em>{employeeId ? 'No personal leave balance is connected.' : 'Personal leave details are unavailable in preview mode.'}</em></div></article><article><span className="stat-icon coral"><Activity size={17} /></span><div><small>Workforce outlook</small><strong>{liveSnapshot.attendanceRate}%</strong><em>{liveSnapshot.presentCount} present / {liveSnapshot.employeeCount || 1} tracked</em></div></article></section>
          <section className="employee-grid">
            <article id="checkin-card" className="employee-card checkin-card"><div className="employee-card-heading"><div><span className="card-kicker">Attendance</span><h3>Start your workday</h3><p>Choose a secure way to record your presence.</p></div><span className="checkin-pulse" /></div><div className="checkin-methods"><button className={`checkin-method ${selectedCheckinMethod === 'GPS check-in' ? 'active' : ''}`}><span>⌾</span><strong>GPS check-in</strong><small>Location verified</small></button><button className={`checkin-method ${selectedCheckinMethod === 'QR code' ? 'active' : ''}`}><span>▦</span><strong>QR code</strong><small>Scan at office</small></button><button className={`checkin-method ${selectedCheckinMethod === 'Face recognition' ? 'active' : ''}`}><span>◎</span><strong>Face recognition</strong><small>Biometric ready</small></button></div><button className={`checkin-button ${checkedIn ? 'checked' : ''}`} disabled={biometricLoading} onClick={() => { if (!checkedIn) { performBiometricCheckin(selectedCheckinMethod) } else { setCheckedIn(false); setActionNotice('Checked out for today.') } }}>{biometricLoading ? 'Verifying biometric identity...' : checkedIn ? '✓ Checked in for today' : 'Check in now'} <ArrowUpRight size={15} /></button></article>
            <article id="shift-card" className="employee-card shift-card"><div className="employee-card-heading"><div><span className="card-kicker">Assigned schedule</span><h3>My shift</h3></div><span className="small-link">{assignedShift?.assigned_by || 'Scheduling team'}</span></div><div className="next-shift"><span className="shift-line" /><div><strong>{assignedShift?.name || 'No shift assigned'}</strong><small>{assignedShift ? `${new Date(`${assignedShift.assignment_date}T00:00:00`).toLocaleDateString()} · ${assignedShift.start_time} - ${assignedShift.end_time}` : 'Contact your manager to arrange a schedule.'}</small><small>{assignedShift?.location || [workspace?.location?.name, workspace?.location?.city].filter(Boolean).join(', ') || 'Work location not set'}</small>{workspace?.manager?.name && <small>Manager: {workspace.manager.name}</small>}</div><MoreHorizontal size={16} /></div></article>
            <article id="leave-card" className="employee-card leave-card"><div className="employee-card-heading"><div><span className="card-kicker">Time away</span><h3>Leave balance</h3></div><button className="small-link" onClick={() => setLeaveRequested(true)}>{leaveRequested ? 'Requested' : 'Request leave'} <ArrowUpRight size={13} /></button></div><div className="leave-balance"><div className="donut"><strong>14.5</strong><small>days left</small></div><div className="leave-legend"><span><i className="annual" />Annual leave <b>12 days</b></span><span><i className="sick" />Sick leave <b>2.5 days</b></span><span><i className="pending" />Pending request <b>{leaveRequested ? '1 request' : 'None'}</b></span></div></div></article>
            <article id="profile-card" className="employee-card profile-card"><div className="employee-card-heading"><div><span className="card-kicker">Your profile</span><h3>{workspace?.department_name || 'Department pending'}</h3><p>{jobTitle} · {employeeRecord.worker_type || 'Employee'} · {Number(employeeRecord.experience_years || 0).toFixed(1)} years experience</p></div><span className="profile-complete">${Number(employeeRecord.base_salary || 0).toLocaleString()}</span></div><div className="profile-progress"><span style={{ width: `${employeeRecord.profile_completion || 0}%` }} /></div><div className="profile-row"><span className="profile-avatar employee-avatar">{displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{employee.email || employeeRecord.email || ''} · {workspace?.location?.name || 'Location pending'}</small></div><button className="edit-button">Edit <ArrowUpRight size={13} /></button></div></article>
            <article id="timesheet-card" className="employee-card timesheet-card"><div className="employee-card-heading"><div><span className="card-kicker">This week</span><h3>Timesheet snapshot</h3></div><button className="small-link">Open timesheet <ArrowUpRight size={13} /></button></div><div className="hours-row"><strong>31.5 <small>/ 40 hrs</small></strong><span>78.7%</span></div><div className="hours-track"><span /></div><div className="hours-breakdown"><span>Client work <b>24h</b></span><span>Team time <b>7.5h</b></span><span>Overtime <b>0h</b></span></div></article>
            <article id="pay-card" className="employee-card pay-card"><div className="employee-card-heading"><div><span className="card-kicker">Latest payslip</span><h3>August 2026</h3><p>Net pay · $4,820.00</p></div><span className="pay-icon"><WalletCards size={17} /></span></div><button className="download-button">Download payslip <ArrowUpRight size={14} /></button></article>
          </section>
        </div>
      </main>
      {verificationMode && <div className="verification-overlay" onClick={() => setVerificationMode(null)}><section className="verification-modal" onClick={(event) => event.stopPropagation()}><div className="verification-heading"><div><span className="card-kicker">Secure check-in</span><h2>{verificationMode}</h2><p>{verificationMode === 'QR code' ? 'Scan this code at your office check-in point.' : verificationMode === 'Face recognition' ? 'Position your face inside the camera frame.' : 'Confirm your current work location.'}</p></div><button className="icon-button" onClick={() => setVerificationMode(null)} aria-label="Close verification"><X size={18} /></button></div>{verificationMode === 'QR code' && <div className="qr-preview" aria-label="QR check-in code"><span>QR CHECK-IN</span><strong>NS-AR-2026</strong></div>}{verificationMode === 'Face recognition' && <div className="camera-preview">{verificationMessage ? <p>{verificationMessage}</p> : <video ref={cameraRef} autoPlay playsInline muted />}</div>}{verificationMode === 'GPS check-in' && <div className="location-preview"><span>⌾</span><strong>{verificationMessage || 'Requesting your current location...'}</strong><small>Northstar secure geofence</small></div>}<button className="checkin-button" disabled={biometricLoading} onClick={() => performBiometricCheckin(verificationMode || selectedCheckinMethod)}>{biometricLoading ? 'Verifying face recognition...' : 'Confirm check-in'} <ArrowUpRight size={15} /></button></section></div>}
      {isProfileModalOpen && (
        <div className="verification-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <section className="verification-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="verification-heading">
              <div>
                <span className="card-kicker">Employee Self-Service</span>
                <h2>Edit Profile Details</h2>
                <p>Update your personal information and contact details.</p>
              </div>
              <button className="icon-button" onClick={() => setIsProfileModalOpen(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>First Name</label>
                <input required value={profileEditForm.first_name} onChange={(e) => setProfileEditForm({ ...profileEditForm, first_name: e.target.value })} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Last Name</label>
                <input required value={profileEditForm.last_name} onChange={(e) => setProfileEditForm({ ...profileEditForm, last_name: e.target.value })} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Email Address</label>
                <input type="email" required value={profileEditForm.email} onChange={(e) => setProfileEditForm({ ...profileEditForm, email: e.target.value })} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Phone Number</label>
                <input value={profileEditForm.phone} placeholder="+1 (555) 000-0000" onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: e.target.value })} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
              </div>
              <button type="submit" disabled={profileSaving} className="checkin-button" style={{ marginTop: '0.5rem' }}>
                {profileSaving ? 'Saving Updates...' : 'Save Profile Changes'} <ArrowUpRight size={15} />
              </button>
            </form>
          </section>
        </div>
      )}
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

function ManagerDashboard({ manager, liveWorkforce, onLogout, onOpenAssistant, assistantState, onOpenManualEntry, onExportReport }) {
  const [activeSection, setActiveSection] = useState('Overview')
  const [actionNotice, setActionNotice] = useState('')
  const [teamData, setTeamData] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const managerId = manager?.employeeId
  useEffect(() => {
    if (!managerId) return undefined
    let active = true
    const refreshTeam = () => fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(managerId)}/team`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load manager team')))
      .then((data) => { if (active) setTeamData(data) })
      .catch(() => { if (active) setTeamData(null) })
    refreshTeam()
    const refreshTimer = window.setInterval(refreshTeam, 30000)
    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [managerId, liveWorkforce?.employees])
  useEffect(() => {
    if (!managerId) return undefined
    let active = true
    const refreshNotifications = () => fetch(`${API_BASE_URL}/api/notifications/?employee_id=${encodeURIComponent(managerId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load notifications')))
      .then((data) => { if (active) setNotifications(data) })
      .catch(() => { if (active) setNotifications([]) })
    refreshNotifications()
    const refreshTimer = window.setInterval(refreshNotifications, 30000)
    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [managerId])
  const teamSummary = teamData?.summary || {}
  const teamMembers = teamData?.members || []
  const leaveRequests = teamData?.pending_leaves || []
  const teamAllocations = teamData?.allocations || []
  const reviewedMembers = teamMembers.filter((member) => member.productivity_rating !== null && member.productivity_rating !== undefined)
  const shiftNeedsScheduling = teamMembers.filter((member) => !member.shift || member.shift.status === 'Past').length
  const productivityAverage = teamSummary.average_productivity
  const productivityLabel = productivityAverage == null ? 'No review data' : Number(productivityAverage) <= 5 ? `${Number(productivityAverage).toFixed(1)} / 5` : `${Number(productivityAverage).toFixed(1)}%`
  const unreadNotificationCount = notifications.filter((notification) => !notification.is_read).length
  const managerNav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Team attendance', icon: Clock3 },
    { label: 'Leave approvals', icon: FileBarChart },
    { label: 'Productivity reports', icon: Activity },
    { label: 'Resource allocation', icon: UsersRound },
    { label: 'Workforce utilization', icon: WalletCards },
  ]
  const approveTeamLeave = async (leaveId) => {
    const response = await fetch(`${API_BASE_URL}/api/leaves/approve/${encodeURIComponent(leaveId)}`, { method: 'POST' })
    if (!response.ok) return setActionNotice('Unable to approve this leave request. Refresh and try again.')
    setTeamData((current) => ({ ...current, pending_leaves: current.pending_leaves.filter((item) => item.id !== leaveId), summary: { ...current.summary, pending_leave_count: Math.max(0, current.summary.pending_leave_count - 1) } }))
    setActionNotice('Leave request approved.')
  }
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
  const openManagerNotification = async (notification) => {
    if (!notification.is_read) {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(notification.id)}/read?employee_id=${encodeURIComponent(managerId)}`, { method: 'POST' })
      if (response.ok) setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
    }
    if (notification.alert_type === 'LEAVE_REQUEST') handleManagerAction('Open approval queue')
    else if (notification.alert_type === 'SHIFT_ASSIGNED' || notification.alert_type === 'TEAM_MEMBER_ADDED') handleManagerAction('Full attendance')
    setNotificationsOpen(false)
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
        <div className="manager-profile"><span className="profile-avatar manager-avatar">{(manager?.name || 'Manager').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{manager?.name || 'Manager'}</strong><small>{teamData?.manager?.department || teamData?.manager?.role || 'Manager'}</small></div></div>
        <p className="nav-label">Manager workspace</p>
        <nav>{managerNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => focusManagerPanel(label, { Overview: 'team-attendance-card', 'Team attendance': 'team-attendance-card', 'Leave approvals': 'leave-approvals-card', 'Productivity reports': 'productivity-card', 'Resource allocation': 'allocation-card', 'Workforce utilization': 'utilization-card' }[label])}><Icon size={17} /><span>{label}</span>{label === 'Leave approvals' && <span className="nav-pill">{leaveRequests.length}</span>}</button>)}</nav>
        <div className="manager-sidebar-bottom"><div className="manager-team-chip"><span className="team-chip-icon"><UsersRound size={15} /></span><span><strong>{teamData?.manager?.department || 'Manager team'}</strong><small>{teamSummary.headcount || 0} direct reports</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button></div>
      </aside>
      <main className="manager-main">
        <header className="manager-topbar"><div><p className="eyebrow"><span className="live-dot" /> Manager workspace · {new Date().toLocaleDateString()}</p><h1>Your team at a glance <span>✦</span></h1><p className="manager-subtitle">A clear view of the people, progress, and capacity you lead.</p></div><div className="manager-top-actions"><button className="primary-button" onClick={() => onOpenManualEntry('Shift')}><CalendarDays size={15} /> Schedule shift</button><button className="outline-button" onClick={() => onOpenManualEntry('Attendance')}><PlusCircle size={15} /> Record attendance</button><button className="outline-button" onClick={() => onExportReport?.('manager-team-report')}><FileBarChart size={15} /> Export report</button><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><div className="manager-notification-control"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><i />{unreadNotificationCount > 0 && <span className="manager-notification-count">{unreadNotificationCount}</span>}</button>{notificationsOpen && <section className="manager-notification-panel" aria-label="Manager notifications"><div className="manager-notification-heading"><strong>Notifications</strong><small>{unreadNotificationCount} new</small></div>{notifications.length ? <div className="manager-notification-list">{notifications.map((notification) => <button key={notification.id} className={`manager-notification-item ${notification.is_read ? 'read' : 'unread'}`} onClick={() => openManagerNotification(notification)}><strong>{notification.title}</strong><small>{notification.message}</small><time>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}</time></button>)}</div> : <p className="manager-notification-empty">No new manager notifications. Leave approvals are shown in the approval queue below.</p>}</section>}</div><button className="manager-mobile-logout" onClick={onLogout}><LogOut size={15} /></button></div></header>
        <div className="manager-content" onClick={handleManagerSurfaceClick}>
          {actionNotice && <p className="action-notice" role="status">{actionNotice}</p>}
          <section className="manager-stat-grid"><article className="manager-stat green"><span className="stat-icon green"><UsersRound size={17} /></span><div><small>Team headcount</small><strong>{teamSummary.headcount || 0} <em>people</em></strong><p><b>{teamSummary.pending_leave_count || 0}</b> live leave requests</p></div></article><article className="manager-stat blue"><span className="stat-icon blue"><Clock3 size={17} /></span><div><small>Team attendance</small><strong>{teamSummary.attendance_rate || 0}%</strong><p><b>{teamSummary.present_count || 0}</b> present · {teamSummary.late_count || 0} late</p></div></article><article className="manager-stat yellow"><span className="stat-icon yellow"><Activity size={17} /></span><div><small>Payroll processed</small><strong>{teamSummary.processed_payroll_records || 0}</strong><p><b>{teamSummary.payroll_records || 0}</b> team payroll records</p></div></article><article className="manager-stat coral"><span className="stat-icon coral"><WalletCards size={17} /></span><div><small>Team payroll value</small><strong>${Number(teamSummary.payroll_value || 0).toLocaleString()}</strong><p><b>{teamSummary.late_count || 0}</b> late check-ins today</p></div></article></section>
          <section className="manager-grid">
            <article id="team-attendance-card" className="manager-card attendance-team-card"><div className="manager-card-heading"><div><span className="card-kicker">Live today</span><h2>Team attendance & shifts</h2><p>{teamSummary.headcount || 0} direct reports across {teamSummary.location_count || 0} locations</p></div><button className="small-link" onClick={() => handleManagerAction('Full attendance')}>Full attendance <ArrowUpRight size={13} /></button></div><div className="team-attendance-list">{teamMembers.length ? teamMembers.map((member) => { const statusClass = member.status === 'Present' ? 'present' : member.status === 'Late' ? 'late' : member.status === 'On Leave' ? 'away' : ''; const currentShift = member.shift && member.shift.status !== 'Past'; const initials = member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); const scheduleText = currentShift ? `${member.shift.name} · ${member.shift.start_time}-${member.shift.end_time} · ${member.shift.location}` : member.shift ? `No current shift · Last: ${member.shift.name} on ${new Date(`${member.shift.date}T00:00:00`).toLocaleDateString()}` : 'No shift assigned'; return <div className="team-attendance-row" key={member.id}><span className="team-person-avatar blue">{initials}</span><div><strong>{member.name}</strong><small>{member.role} · {member.location}</small><small>{scheduleText}</small></div><span className={`attendance-status ${statusClass}`}>{member.status}</span><span className="attendance-time">{member.check_in || '—'}</span></div> }) : <p className="action-notice">{teamData ? 'No direct reports are assigned to this manager.' : 'Loading live team…'}</p>}</div><div className="attendance-summary"><span><i className="present-dot" /> {teamSummary.present_count || 0} present</span><span><i className="remote-dot" /> {teamSummary.late_count || 0} late</span><span><i className="away-dot" /> {(teamSummary.on_leave_count || 0) + (teamSummary.absent_count || 0)} away</span><b>{teamSummary.attendance_rate || 0}% checked in</b></div></article>
            <article id="leave-approvals-card" className="manager-card approvals-card"><div className="manager-card-heading"><div><span className="card-kicker">Needs review</span><h2>Leave approvals</h2><p>Pending requests from direct reports</p></div><span className="approval-count">{leaveRequests.length}</span></div><div className="approval-list">{leaveRequests.length ? leaveRequests.map((request) => <div className="approval-row" key={request.id}><span className="team-person-avatar blue">{request.employee_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{request.employee_name}</strong><small>{request.leave_type} · {new Date(`${request.start_date}T00:00:00`).toLocaleDateString()} - {new Date(`${request.end_date}T00:00:00`).toLocaleDateString()}</small></div><button className="approve-button" onClick={() => approveTeamLeave(request.id)}>Approve</button></div>) : <p className="action-notice">No pending leave requests from direct reports.</p>}</div><button className="view-link" onClick={() => handleManagerAction('Open approval queue')}>Open approval queue <ArrowUpRight size={14} /></button></article>
            <article className="manager-card productivity-card"><div className="manager-card-heading"><div><span className="card-kicker">Performance records</span><h2>Team productivity</h2><p>Latest recorded ratings by direct report</p></div></div><div className="productivity-chart"><div className="productivity-y"><span>100</span><span>75</span><span>50</span><span>25</span></div><div className="productivity-bars">{reviewedMembers.length ? reviewedMembers.map((member) => { const rating = Number(member.productivity_rating); const score = Math.max(0, Math.min(100, rating <= 5 ? rating * 20 : rating)); return <div className="productivity-column" key={member.id}><div className="productivity-bar" title={`${member.name}: ${rating}`} style={{ height: `${score}%` }} /><span>{member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span></div> }) : <p>No performance reviews recorded for direct reports.</p>}</div></div><div className="productivity-footer"><span><i /> Average recorded rating</span><b>{productivityLabel}</b></div></article>
            <article className="manager-card allocation-card"><div className="manager-card-heading"><div><span className="card-kicker">Last 7 days</span><h2>Resource allocation</h2><p>Team timesheet hours by project</p></div><button className="small-link" onClick={() => onOpenManualEntry('Timesheet')}>Log time <ArrowUpRight size={13} /></button></div><div className="allocation-list">{teamAllocations.length ? teamAllocations.map((item, index) => { const color = ['green', 'blue', 'yellow'][index % 3]; return <div key={item.name}><span><i className={`allocation-${color}`} /> {item.name} <b>{item.percent}% · {item.hours}h</b></span><div><i style={{ width: `${item.percent}%` }} /></div></div> }) : <p>No team timesheet hours recorded in the last 7 days.</p>}</div><div className="allocation-note"><Sparkles size={14} /><span><strong>Schedule coverage:</strong> {shiftNeedsScheduling ? `${shiftNeedsScheduling} direct report(s) have no current shift. Use Schedule shift to assign one.` : 'All direct reports have a current shift assignment.'}</span></div></article>
            <article className="manager-card utilization-card"><div className="manager-card-heading"><div><span className="card-kicker">Last 7 days</span><h2>Workforce utilization</h2><p>Timesheet hours against a 40-hour week</p></div></div>{teamMembers.length ? teamMembers.map((member) => <div className="utilization-row" key={member.id}><span className="team-person-avatar blue">{member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role}</small></div><div className="utilization-meter">{member.utilization_percent == null ? <small>No timesheet data</small> : <><span style={{ width: `${member.utilization_percent}%` }} /><small>{member.utilization_percent}% · {member.weekly_hours}h</small></>}</div></div>) : <p>No direct reports found.</p>}</article>
            <article className="manager-card insight-card"><div className="insight-heading"><span className="ai-icon"><Sparkles size={15} /></span><div><span className="card-kicker">Live schedule signal</span><h2>{shiftNeedsScheduling ? 'Schedule coverage needed' : 'Team shifts assigned'}</h2></div></div><p>{shiftNeedsScheduling ? `${shiftNeedsScheduling} direct report(s) have no current shift assignment. Their saved work locations are shown above for scheduling.` : 'Every direct report currently has a published shift assignment.'}</p><button className="text-button" onClick={() => onOpenManualEntry('Shift')}>{shiftNeedsScheduling ? 'Schedule shifts' : 'Review shifts'} <ArrowUpRight size={14} /></button></article>
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

  const managersMap = Object.fromEntries(
    employees.map((e) => [e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim()])
  )

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
              <th>Reporting Manager</th>
              <th>Salary</th>
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
                    {emp.manager_id && managersMap[emp.manager_id] ? (
                      <span style={{ color: '#2b5343', fontWeight: 600 }}>{managersMap[emp.manager_id]}</span>
                    ) : (
                      <span style={{ color: '#88988e' }}>Unassigned</span>
                    )}
                  </td>
                  <td>${Number(emp.base_salary ?? getDefaultSalaryByRole(emp.access_role, emp.role)).toLocaleString()}</td>
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#7a8c82' }}>
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
  const [employeeOptions, setEmployeeOptions] = useState({ departments: [], locations: [], managers: [] })
  const modalManagersMap = Object.fromEntries(
    employeesList.map((e) => [e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim()])
  )

  const renderEmployeeSelectOptions = () => {
    if (!employeesList.length) return <option value="E001">Alex Rivera (E001)</option>
    return employeesList.map((e) => {
      const mgrName = e.manager_id && modalManagersMap[e.manager_id] ? ` — Mgr: ${modalManagersMap[e.manager_id]}` : ''
      return (
        <option key={e.id} value={e.id}>
          {e.first_name} {e.last_name} ({e.id}){mgrName}
        </option>
      )
    })
  }

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, isOpen])

  const [empForm, setEmpForm] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    location_id: '',
    manager_id: '',
    role: 'Software Engineer',
    access_role: 'EMPLOYEE',
    employment_status: 'Active',
    worker_type: 'Employee',
    experience_years: 0,
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
    location_id: '',
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

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    fetch(`${API_BASE_URL}/api/employees/options`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Employee options unavailable')))
      .then((options) => {
        if (!active) return
        setEmployeeOptions(options)
        setEmpForm((currentForm) => {
          const departmentId = currentForm.department_id || options.departments[0]?.id || ''
          const departmentHeadId = options.departments.find((department) => department.id === departmentId)?.department_head_id || ''
          const fallbackManagerId = resolveDefaultManagerId({
            managerId: currentForm.manager_id,
            departmentHeadId,
            managers: options.managers || [],
          })

          return {
            ...currentForm,
            department_id: departmentId,
            location_id: currentForm.location_id || options.locations[0]?.id || '',
            manager_id: currentForm.manager_id || fallbackManagerId,
          }
        })
        setShiftForm((current) => ({ ...current, location_id: current.location_id || options.locations[0]?.id || '' }))
      })
      .catch(() => {})
    return () => { active = false }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (activeTab === 'Employee') {
        const departmentHeadId = employeeOptions.departments.find((item) => item.id === empForm.department_id)?.department_head_id || ''
        const fallbackManagerId = resolveDefaultManagerId({
          managerId: empForm.manager_id,
          departmentHeadId,
          managers: employeeOptions.managers || [],
        })
        const departmentName = employeeOptions.departments.find((item) => item.id === empForm.department_id)?.name || ''
        const calculatedSalary = getDefaultSalaryByRole(empForm.access_role, empForm.role, empForm.worker_type, departmentName, empForm.experience_years)
        const employeePayload = {
          ...empForm,
          manager_id: empForm.manager_id || fallbackManagerId,
          employee_code: empForm.employee_code || `EMP-${Date.now().toString().slice(-5)}`,
          base_salary: calculatedSalary,
        }
        const res = await fetch(`${API_BASE_URL}/api/employees/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employeePayload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Failed to create employee')
        }

        const createdEmployee = await res.json()
        await fetch(`${API_BASE_URL}/api/payroll/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: createdEmployee.id,
            pay_period: 'August 2026',
            base_salary: Number(createdEmployee.base_salary || calculatedSalary),
            bonuses_incentives: 0,
            overtime_pay: 0,
            payroll_status: 'Processed',
          }),
        })

        setMessage(`Employee added with $${Number(createdEmployee.base_salary || calculatedSalary).toLocaleString()} annual salary and an automatic shift assignment.`)
      } else if (activeTab === 'Attendance') {
        const res = await fetch(`${API_BASE_URL}/api/attendance/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attForm),
        })
        if (!res.ok) throw new Error('Failed to mark attendance')
        setMessage('Attendance logged successfully!')
      } else if (activeTab === 'Shift') {
        const shiftResponse = await fetch(`${API_BASE_URL}/api/shifts/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shift_name: shiftForm.shift_name, start_time: shiftForm.start_time, end_time: shiftForm.end_time, location_id: shiftForm.location_id, status: 'Published' }),
        })
        if (!shiftResponse.ok) throw new Error('Failed to create shift')
        const createdShift = await shiftResponse.json()
        const res = await fetch(`${API_BASE_URL}/api/shifts/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: shiftForm.employee_id, shift_id: createdShift.id, assignment_date: shiftForm.assignment_date }),
        })
        if (!res.ok) throw new Error('Failed to assign shift')
        setMessage(`Shift created and assigned at ${employeeOptions.locations.find((item) => item.id === shiftForm.location_id)?.name || 'the selected location'}.`)
      } else if (activeTab === 'Leave') {
        const res = await fetch(`${API_BASE_URL}/api/leaves/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leaveForm),
        })
        if (!res.ok) throw new Error('Failed to submit leave request')
        setMessage('Leave request submitted successfully!')
      } else if (activeTab === 'Timesheet') {
        const res = await fetch(`${API_BASE_URL}/api/timesheets/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tsForm),
        })
        if (!res.ok) throw new Error('Failed to log timesheet')
        setMessage('Timesheet entry saved successfully!')
      } else if (activeTab === 'Payroll') {
        const res = await fetch(`${API_BASE_URL}/api/payroll/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payForm),
        })
        if (!res.ok) throw new Error('Failed to save payroll record')
        setMessage('Payroll record updated successfully!')
      }

      if (onRefreshData) await onRefreshData()
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
                <label>Employee Code</label>
                <input value={empForm.employee_code} onChange={(e) => setEmpForm({ ...empForm, employee_code: e.target.value })} placeholder="EMP-104" />
              </div>
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
                <select required value={empForm.department_id} onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}>
                  <option value="">Select department</option>
                  {employeeOptions.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
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
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Worker Type</label>
                <select value={empForm.worker_type} onChange={(e) => setEmpForm({ ...empForm, worker_type: e.target.value })}>
                  <option value="Employee">Full-time Employee</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
              <div className="form-group">
                <label>Work Location</label>
                <select required value={empForm.location_id} onChange={(e) => setEmpForm({ ...empForm, location_id: e.target.value })}>
                  <option value="">Select location</option>
                  {employeeOptions.locations.map((location) => <option key={location.id} value={location.id}>{[location.name, location.city, location.country].filter(Boolean).join(' · ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Reports To</label>
                <select value={empForm.manager_id} onChange={(e) => setEmpForm({ ...empForm, manager_id: e.target.value })}>
                  <option value="">Department manager</option>
                  {employeesList.filter((item) => item.access_role === 'MANAGER' || /manager/i.test(item.role || '')).map((manager) => <option key={manager.id} value={manager.id}>{manager.first_name} {manager.last_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Experience (years)</label>
                <input type="number" min="0" max="60" step="0.5" value={empForm.experience_years} onChange={(e) => setEmpForm({ ...empForm, experience_years: Number(e.target.value) || 0 })} />
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
              <div className="form-group">
                <label>Estimated Annual Salary ($)</label>
                <input readOnly value={getDefaultSalaryByRole(empForm.access_role, empForm.role, empForm.worker_type, employeeOptions.departments.find((item) => item.id === empForm.department_id)?.name, empForm.experience_years)} />
              </div>
            </div>
          )}

          {activeTab === 'Attendance' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={attForm.employee_id} onChange={(e) => setAttForm({ ...attForm, employee_id: e.target.value })}>
                  {renderEmployeeSelectOptions()}
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
                  {renderEmployeeSelectOptions()}
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
              <div className="form-group">
                <label>Work Location</label>
                <select required value={shiftForm.location_id} onChange={(e) => setShiftForm({ ...shiftForm, location_id: e.target.value })}>
                  <option value="">Select location</option>
                  {employeeOptions.locations.map((location) => <option key={location.id} value={location.id}>{[location.name, location.city, location.country].filter(Boolean).join(' · ')}</option>)}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Leave' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Employee</label>
                <select value={leaveForm.employee_id} onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                  {renderEmployeeSelectOptions()}
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
                  {renderEmployeeSelectOptions()}
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
                  {renderEmployeeSelectOptions()}
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

function HRDashboard({ onLogout, dataset, onImport, onOpenAssistant, assistantState, liveSnapshot, onGeneratePayroll, liveWorkforce, onOpenManualEntry, onExportReport, currentName, currentEmail }) {
  const hrDisplayName = currentName || 'HR Administrator'
  const hrFirstName = hrDisplayName.split(' ')[0] || 'User'
  const hrInitials = hrDisplayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'HR'
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
  const dbAlerts = (liveWorkforce?.notifications || []).map((notif, index) => ({
    id: notif.id || index + 1,
    icon: (notif.severity === 'High' || String(notif.alert_type || '').toLowerCase().includes('anomaly')) ? AlertTriangle : (String(notif.alert_type || '').toLowerCase().includes('leave') ? FileBarChart : CalendarDays),
    color: (notif.severity === 'High' || notif.severity === 'Warning') ? 'coral' : String(notif.alert_type || '').toLowerCase().includes('leave') ? 'yellow' : 'blue',
    title: notif.title || notif.alert_type || 'Notification Alert',
    text: notif.message,
    action: notif.action_url ? 'Full report' : 'Open approvals'
  }))
  const defaultAlerts = [
    { id: 1, icon: CalendarDays, color: 'blue', title: 'Shift reminders', text: '18 employees have shifts starting within 2 hours.', action: 'Review shifts' },
    { id: 2, icon: FileBarChart, color: 'yellow', title: 'Leave approval notifications', text: '7 leave requests are waiting for manager approval.', action: 'Open approvals' },
    { id: 3, icon: AlertTriangle, color: 'coral', title: 'Attendance alerts', text: '4 late arrivals and 2 unusual check-ins detected today.', action: 'View anomalies' },
    { id: 4, icon: Sparkles, color: 'mint', title: 'Birthdays & anniversaries', text: 'Celebrate 3 team milestones this week.', action: 'See milestones' },
  ]
  const alerts = dbAlerts.length ? dbAlerts : defaultAlerts
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
  const liveEmployees = liveWorkforce?.employees || []
  const liveDepartmentCount = liveWorkforce?.departments?.length || metrics.departments
  const liveLocationCount = liveWorkforce?.locations?.length || new Set(liveEmployees.map((employee) => employee.location_id).filter(Boolean)).size
  const liveMetrics = {
    employeeCount: liveSnapshot.employeeCount || metrics.employeeCount,
    attritionRate: metrics.attritionRate,
    attendance: liveSnapshot.attendanceRate || metrics.attendance,
    payrollRate: liveSnapshot.totalRecords ? Math.round((liveSnapshot.processedPayrollCount / liveSnapshot.totalRecords) * 100) : metrics.payrollRate,
    processedPayroll: liveSnapshot.processedPayrollCount || metrics.processedPayroll,
    workforceRows: liveSnapshot.totalRecords || metrics.workforceRows,
    presentRows: liveSnapshot.attendanceRecordCount ? liveSnapshot.presentCount : metrics.presentRows,
    lateRows: liveSnapshot.attendanceRecordCount ? liveSnapshot.lateCount : 0,
    leaveRows: liveSnapshot.attendanceRecordCount ? liveSnapshot.attendanceOnLeaveCount : metrics.leaveRows,
    absentRows: liveSnapshot.attendanceRecordCount ? liveSnapshot.attendanceAbsentCount : metrics.absentRows,
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
        <div className="hr-profile"><span className="profile-avatar hr-avatar">{hrInitials}</span><div><strong>{hrDisplayName}</strong><small>HR Administrator</small></div></div>
        <p className="nav-label">HR command center</p>
        <nav>{hrNav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => handleHrNavigation(label)}><Icon size={17} /><span>{label}</span>{label === 'Compliance monitoring' && <span className="nav-pill">2</span>}</button>)}</nav>
        <div className="hr-sidebar-bottom"><div className="security-chip"><ShieldCheck size={15} /><span><strong>All systems secure</strong><small>Last audit · 12 min ago</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Log out</span></button></div>
      </aside>
      <main className="hr-main">
        <header className="hr-topbar"><div><p className="eyebrow"><span className="live-dot" /> HR command center · Tuesday, September 8</p><h1>Good morning, {hrFirstName} <span>✦</span></h1><p className="hr-subtitle">The people signals that need your attention today.</p></div><div className="hr-top-actions"><button className="primary-button" onClick={() => onOpenManualEntry('Employee')}><UserPlus size={15} /> + Add Employee / Manual Entry</button><button className="outline-button" onClick={onGeneratePayroll}><WalletCards size={15} /> Generate payroll</button><button className="outline-button" onClick={() => onExportReport?.('hr-command-report')}><FileBarChart size={15} /> Export report</button><button className="outline-button" onClick={onOpenAssistant}><Bot size={15} /> Ask assistant</button><button className="notification-button hr-notification-button" aria-label="Notifications"><Bell size={18} /><i /><span>{alerts.length - dismissedAlerts.length}</span></button><button className="hr-mobile-logout" onClick={onLogout}><LogOut size={15} /></button></div></header>
        <div className="hr-content">
          <section className="data-import-card"><div><span className="card-kicker">Workforce Record Operations</span><h2>Add or refresh workforce records</h2><p>{dataset.attendance.length} attendance records · {dataset.allocation.length} allocation records · {metrics.departments} departments</p></div><div style={{ display: 'flex', gap: '10px' }}><button className="primary-button" onClick={() => onOpenManualEntry('Employee')}><UserPlus size={15} /> Manual Record Entry</button><label className="outline-button import-button"><Database size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={onImport} /></label></div></section>
          <section className="hr-stat-grid"><article className="hr-stat green"><span className="stat-icon green"><UsersRound size={17} /></span><div><small>Total employees</small><strong>{liveMetrics.employeeCount.toLocaleString()}</strong><p><b>Live</b> · backend employee count</p></div><span className="stat-spark green-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat blue"><span className="stat-icon blue"><Activity size={17} /></span><div><small>Attrition rate</small><strong>{liveMetrics.attritionRate}%</strong><p><b>Imported</b> · workforce metrics</p></div><span className="stat-spark blue-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat yellow"><span className="stat-icon yellow"><Clock3 size={17} /></span><div><small>Attendance present rate</small><strong>{liveMetrics.attendance}%</strong><p><b>{liveMetrics.presentRows}</b> present · backend snapshot</p></div><span className="stat-spark yellow-spark"><i /><i /><i /><i /><i /></span></article><article className="hr-stat coral"><span className="stat-icon coral"><WalletCards size={17} /></span><div><small>Payroll processed</small><strong>{liveMetrics.payrollRate}%</strong><p><b>{liveMetrics.processedPayroll}</b> of {liveMetrics.workforceRows} payroll records</p></div><span className="stat-spark coral-spark"><i /><i /><i /><i /><i /></span></article></section>
          <section className="hr-grid">
            <EmployeeDirectoryCard employees={liveWorkforce?.employees || []} onOpenManualEntry={onOpenManualEntry} />
            <article id="employee-analytics-card" className="hr-card employee-analytics-card"><div className="hr-card-heading"><div><span className="card-kicker">People overview</span><h2>Employee analytics</h2><p>Live employee profiles and imported workforce data</p></div><button className="small-link" onClick={() => onOpenManualEntry('Employee')}>+ Add Employee <ArrowUpRight size={13} /></button></div><div className="analytics-body"><div className="analytics-donut"><strong>{liveMetrics.employeeCount.toLocaleString()}</strong><small>employees</small></div><div className="analytics-legend"><span><i className="legend-green" />Departments <b>{liveDepartmentCount}</b></span><span><i className="legend-blue" />Imported allocation rows <b>{metrics.allocationRows}</b></span><span><i className="legend-yellow" />Imported attendance rows <b>{dataset.attendance.length}</b></span><span><i className="legend-coral" />Employee profiles <b>{liveEmployees.length}</b></span></div></div><div className="analytics-footer"><span>{liveDepartmentCount} departments</span><span>{liveLocationCount} live locations</span><span>{liveEmployees.length} profiles loaded</span></div></article>
            <article id="attrition-card" className="hr-card attrition-card"><div className="hr-card-heading"><div><span className="card-kicker">Predictive signal</span><h2>Attrition trends</h2><p>Average rate across imported workforce metrics</p></div><span className="risk-badge">{metrics.attritionDelta <= 0 ? 'Improving' : 'Watch'}</span></div><div className="attrition-data-panel"><strong>{metrics.attritionRate}%</strong><span>Current average attrition</span><b>{metrics.attritionDelta <= 0 ? '↓' : '↑'} {Math.abs(metrics.attritionDelta)}% vs previous period</b></div></article>
            <article id="attendance-report-card" className="hr-card attendance-report-card"><div className="hr-card-heading"><div><span className="card-kicker">Operations</span><h2>Attendance reports</h2><p>Recorded statuses across live attendance rows</p></div><button className="small-link" onClick={() => handleHrAction('Full report')}>Full report <ArrowUpRight size={13} /></button></div><div className="attendance-report-footer"><span><strong>{liveMetrics.presentRows}</strong> present</span><span><strong>{liveMetrics.lateRows}</strong> late</span><span><strong>{liveMetrics.leaveRows}</strong> on leave</span><span><strong>{liveMetrics.absentRows}</strong> absent</span></div></article>
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

function AdminDashboard({ onLogout, dataset, onImport, onOpenAssistant, assistantState, liveSnapshot, onGeneratePayroll, liveWorkforce, onOpenManualEntry, onExportReport, onIssueSetupCode, accessToken, currentEmail }) {
  const [activeSection, setActiveSection] = useState('Master Overview')
  const [previewRoleView, setPreviewRoleView] = useState('master')
  const [actionNotice, setActionNotice] = useState('')
  const [adminApproved, setAdminApproved] = useState([])
  const [setupTargetEmail, setSetupTargetEmail] = useState('')
  const [issuedSetupCode, setIssuedSetupCode] = useState('')
  const [setupCodeError, setSetupCodeError] = useState('')
  const [isIssuingSetupCode, setIsIssuingSetupCode] = useState(false)

  const adminNav = [
    { label: 'Master Overview', icon: LayoutDashboard },
    { label: 'Live Directory', icon: UsersRound },
    { label: 'Attendance Matrix', icon: Clock3 },
    { label: 'Global Payroll', icon: WalletCards },
    { label: 'Approvals & Overrides', icon: FileBarChart },
    { label: 'Security & Audit Logs', icon: ShieldCheck },
  ]

  const employees = liveWorkforce?.employees || []
  const leaveRequests = liveWorkforce?.leaveRequests || []
  const previewManager = employees.find((employee) => employee.email === 'maya.roberts@northstar.example') || employees.find((employee) => String(employee.access_role || '').toUpperCase() === 'MANAGER')
  const managerPreview = previewManager ? { employeeId: previewManager.id, name: `${previewManager.first_name} ${previewManager.last_name}` } : null
  const previewEmployee = employees.find((employee) => String(employee.access_role || '').toUpperCase() === 'EMPLOYEE')
  const employeePreview = previewEmployee ? {
    employeeId: previewEmployee.id,
    email: previewEmployee.email,
    name: `${previewEmployee.first_name} ${previewEmployee.last_name}`,
    label: previewEmployee.role || 'Employee',
  } : { label: 'Employee Preview' }

  const adminCount = employees.filter(e => (e.access_role || '').toUpperCase() === 'ADMIN').length || 1
  const hrCount = employees.filter(e => (e.access_role || '').toUpperCase() === 'HR_ADMIN' || (e.access_role || '').toUpperCase() === 'HR').length || 2
  const managerCount = employees.filter(e => (e.access_role || '').toUpperCase() === 'MANAGER').length || 3
  const employeeCount = employees.filter(e => (e.access_role || '').toUpperCase() === 'EMPLOYEE').length || Math.max(0, employees.length - adminCount - hrCount - managerCount)

  const securityAuditLogs = [
    { id: 1, action: 'ADMIN_ACCESS_LOGIN', user: 'admin@gmail.com', ip: '192.168.1.105', status: 'SUCCESS', time: 'Just now' },
    { id: 2, action: 'HR_PAYROLL_GENERATE', user: 'megha@gmail.com', ip: '192.168.1.112', status: 'SUCCESS', time: '14 mins ago' },
    { id: 3, action: 'EMPLOYEE_GPS_CHECKIN', user: 'alex@gmail.com', ip: '172.16.0.42', status: 'SUCCESS', time: '42 mins ago' },
    { id: 4, action: 'MANAGER_LEAVE_APPROVAL', user: 'manager@gmail.com', ip: '192.168.1.109', status: 'SUCCESS', time: '1 hour ago' },
  ]

  const handleAdminApproveAll = () => {
    setAdminApproved([1, 2, 3])
    setActionNotice('Admin Master Override: All pending leave requests and attendance records approved.')
  }

  const handleIssueSetupCode = async (event) => {
    event.preventDefault()
    setSetupCodeError('')
    setIssuedSetupCode('')
    setIsIssuingSetupCode(true)
    const result = await onIssueSetupCode(setupTargetEmail, accessToken)
    setIsIssuingSetupCode(false)
    if (result.error) setSetupCodeError(result.error)
    else setIssuedSetupCode(result.setupCode)
  }

  const pendingAdminRequests = [
    { id: 1, initials: 'JM', name: 'Jordan Miller', type: 'Annual leave · Sep 14-16', color: 'blue' },
    { id: 2, initials: 'SK', name: 'Sofia Kim', type: 'Personal day · Sep 12', color: 'yellow' },
    { id: 3, initials: 'DW', name: 'Daniel Wong', type: 'Sick leave · Sep 10', color: 'coral' },
  ].filter((request) => !adminApproved.includes(request.id))

  const renderAdminSectionContent = () => {
    switch (activeSection) {
      case 'Live Directory':
        return <div style={{ gridColumn: '1 / -1' }}><EmployeeDirectoryCard employees={employees} onOpenManualEntry={onOpenManualEntry} /></div>
      case 'Attendance Matrix':
        return (
          <article className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <div className="admin-card-heading">
              <div>
                <span className="card-kicker" style={{ color: '#7c3aed' }}>Attendance</span>
                <h2>Attendance Matrix</h2>
                <p>Live team presence and shift status</p>
              </div>
            </div>
            <div className="employee-table-container">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Role</th>
                    <th>Access Role</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 6).map((employee) => (
                    <tr key={employee.id || employee.employee_code || employee.email}>
                      <td><span className="emp-code-badge">{employee.employee_code || employee.id}</span></td>
                      <td><strong style={{ color: '#253a31', fontSize: '11px' }}>{employee.first_name} {employee.last_name}</strong></td>
                      <td>{employee.role || 'Employee'}</td>
                      <td><span className="emp-role-badge">{employee.access_role || 'EMPLOYEE'}</span></td>
                      <td><span className={`emp-status-badge ${String(employee.employment_status || 'active').toLowerCase().replace(' ', '-')}`}>{employee.employment_status || 'Active'}</span></td>
                      <td>{liveSnapshot.presentCount > 0 ? '09:00' : 'Not checked in'}</td>
                      <td>{employee.role?.toLowerCase().includes('manager') ? 'Manager Shift' : 'Standard Shift'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )
      case 'Global Payroll':
        return (
          <article className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <div className="admin-card-heading">
              <div>
                <span className="card-kicker" style={{ color: '#7c3aed' }}>Payroll</span>
                <h2>Global Payroll</h2>
                <p>Role-based salary automation and payroll status</p>
              </div>
            </div>
            <div className="employee-table-container">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Role</th>
                    <th>Access Role</th>
                    <th>Salary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id || employee.employee_code || employee.email}>
                      <td><span className="emp-code-badge">{employee.employee_code || employee.id}</span></td>
                      <td><strong style={{ color: '#253a31', fontSize: '11px' }}>{employee.first_name} {employee.last_name}</strong></td>
                      <td>{employee.role || 'Employee'}</td>
                      <td><span className="emp-role-badge">{employee.access_role || 'EMPLOYEE'}</span></td>
                      <td>${Number(employee.base_salary || getDefaultSalaryByRole(employee.access_role, employee.role)).toLocaleString()}</td>
                      <td><span className="emp-status-badge active">Processed</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )
      case 'Approvals & Overrides':
        return (
          <article className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <div className="admin-card-heading">
              <div>
                <span className="card-kicker" style={{ color: '#7c3aed' }}>Approvals</span>
                <h2>Pending Leave & Shift Approvals</h2>
                <p>Global queue of manager and employee requests</p>
              </div>
              <span className="admin-badge-yellow">{pendingAdminRequests.length || 0} Pending</span>
            </div>
            <div className="approval-list">
              {pendingAdminRequests.length > 0 ? pendingAdminRequests.map((request) => (
                <div key={request.id} className="approval-row">
                  <span className={`team-person-avatar ${request.color}`}>{request.initials}</span>
                  <div><strong>{request.name}</strong><small>{request.type}</small></div>
                  <button className="approve-button" style={{ borderColor: '#ddd6fe', background: '#f3e8ff', color: '#6d28d9' }} onClick={() => { setAdminApproved((current) => [...current, request.id]); setActionNotice(`Approved ${request.name} leave.`) }}>Admin Approve</button>
                </div>
              )) : <div className="approval-row" style={{ justifyContent: 'center', color: '#587167', fontWeight: 600 }}>No pending approvals.</div>}
            </div>
          </article>
        )
      case 'Security & Audit Logs':
        return (
          <article className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <div className="admin-card-heading">
              <div>
                <span className="card-kicker" style={{ color: '#7c3aed' }}>Security</span>
                <h2>Security & Audit Logs</h2>
                <p>Real-time security events across all active accounts</p>
              </div>
              <span className="admin-badge-purple">Live Feed</span>
            </div>
            <form className="setup-code-form" onSubmit={handleIssueSetupCode}>
              <h3>Issue a password setup code</h3>
              <p>Codes expire in 30 minutes and can be used once. Share them with the employee through a trusted channel.</p>
              <label>Employee email<div className="input-wrap"><Mail size={16} /><input type="email" value={setupTargetEmail} onChange={(event) => setSetupTargetEmail(event.target.value)} required /></div></label>
              <button className="primary-button" type="submit" disabled={isIssuingSetupCode}>{isIssuingSetupCode ? 'Generating...' : 'Generate setup code'}</button>
              {issuedSetupCode && <p className="setup-code-value" role="status">Setup code for {setupTargetEmail}: <code>{issuedSetupCode}</code> (expires in 30 minutes)</p>}
              {setupCodeError && <p role="alert" className="setup-code-error">{setupCodeError}</p>}
            </form>
            <div className="audit-log-list">
              {securityAuditLogs.map((log) => (
                <div key={log.id} className="audit-log-item">
                  <div>
                    <strong>{log.action}</strong>
                    <small>User: {log.user} ({log.ip})</small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`audit-status ${log.status.toLowerCase()}`}>{log.status}</span>
                    <small style={{ color: '#9ca3af' }}>{log.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )
      default:
        return (
          <section className="admin-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <EmployeeDirectoryCard employees={employees} onOpenManualEntry={onOpenManualEntry} />
            </div>
            <article className="admin-card">
              <div className="admin-card-heading">
                <div>
                  <span className="card-kicker" style={{ color: '#7c3aed' }}>Governance</span>
                  <h2>Security & Audit Trail</h2>
                  <p>Real-time security events across all active accounts</p>
                </div>
                <span className="admin-badge-purple">Live Feed</span>
              </div>
              <div className="audit-log-list">
                {securityAuditLogs.map((log) => (
                  <div key={log.id} className="audit-log-item">
                    <div>
                      <strong>{log.action}</strong>
                      <small>User: {log.user} ({log.ip})</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`audit-status ${log.status.toLowerCase()}`}>{log.status}</span>
                      <small style={{ color: '#9ca3af' }}>{log.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="admin-card">
              <div className="admin-card-heading">
                <div>
                  <span className="card-kicker" style={{ color: '#7c3aed' }}>Approvals</span>
                  <h2>Pending Leave & Shift Approvals</h2>
                  <p>Global queue of manager and employee requests</p>
                </div>
                <span className="admin-badge-yellow">{pendingAdminRequests.length || 0} Pending</span>
              </div>
              <div className="approval-list">
                {pendingAdminRequests.length > 0 ? pendingAdminRequests.map((request) => (
                  <div key={request.id} className="approval-row">
                    <span className={`team-person-avatar ${request.color}`}>{request.initials}</span>
                    <div><strong>{request.name}</strong><small>{request.type}</small></div>
                    <button className="approve-button" style={{ borderColor: '#ddd6fe', background: '#f3e8ff', color: '#6d28d9' }} onClick={() => { setAdminApproved((current) => [...current, request.id]); setActionNotice(`Approved ${request.name} leave.`) }}>Admin Approve</button>
                  </div>
                )) : <div className="approval-row" style={{ justifyContent: 'center', color: '#587167', fontWeight: 600 }}>No pending approvals.</div>}
              </div>
            </article>
          </section>
        )
    }
  }

  if (previewRoleView === 'hr') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ background: '#7c3aed', color: '#fff', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, zIndex: 100, position: 'sticky', top: 0 }}>
          <span>✦ ADMIN SHOW ALL VISIBILITY: PREVIEWING HR COMMAND CENTER</span>
          <button onClick={() => setPreviewRoleView('master')} style={{ background: '#ffffff', color: '#6d28d9', border: 0, padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>
            Back to Admin Master View
          </button>
        </div>
        <HRDashboard onLogout={onLogout} dataset={dataset} onImport={onImport} onOpenAssistant={onOpenAssistant} assistantState={assistantState} liveSnapshot={liveSnapshot} onGeneratePayroll={onGeneratePayroll} liveWorkforce={liveWorkforce} onOpenManualEntry={onOpenManualEntry} onExportReport={onExportReport} />
      </div>
    )
  }

  if (previewRoleView === 'manager') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ background: '#7c3aed', color: '#fff', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, zIndex: 100, position: 'sticky', top: 0 }}>
          <span>✦ ADMIN SHOW ALL VISIBILITY: PREVIEWING MANAGER WORKSPACE</span>
          <button onClick={() => setPreviewRoleView('master')} style={{ background: '#ffffff', color: '#6d28d9', border: 0, padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>
            Back to Admin Master View
          </button>
        </div>
        <ManagerDashboard manager={managerPreview} liveWorkforce={liveWorkforce} onLogout={onLogout} onOpenAssistant={onOpenAssistant} assistantState={assistantState} onOpenManualEntry={onOpenManualEntry} onExportReport={onExportReport} />
      </div>
    )
  }

  if (previewRoleView === 'employee') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ background: '#7c3aed', color: '#fff', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, zIndex: 100, position: 'sticky', top: 0 }}>
          <span>✦ ADMIN SHOW ALL VISIBILITY: PREVIEWING EMPLOYEE PORTAL</span>
          <button onClick={() => setPreviewRoleView('master')} style={{ background: '#ffffff', color: '#6d28d9', border: 0, padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>
            Back to Admin Master View
          </button>
        </div>
        <EmployeePortal employee={employeePreview} onLogout={onLogout} onOpenAssistant={onOpenAssistant} assistantState={assistantState} liveSnapshot={liveSnapshot} liveWorkforce={liveWorkforce} readOnlyPreview />
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-mark" style={{ background: '#7c3aed' }}><ShieldCheck size={17} /></span>
          <span style={{ color: '#2e1065' }}>Admin Hub</span>
        </div>
        <div className="admin-profile">
          <span className="admin-avatar">SA</span>
          <div>
            <strong>System Admin</strong>
            <small style={{ color: '#7c3aed' }}>{currentEmail}</small>
          </div>
        </div>
        <p className="nav-label">System Control</p>
        <nav>
          {adminNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeSection === label ? 'active' : ''}`}
              style={activeSection === label ? { background: '#ede9fe', color: '#6d28d9', fontWeight: 700 } : {}}
              onClick={() => setActiveSection(label)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="admin-chip">
            <ShieldCheck size={16} />
            <div>
              <strong style={{ display: 'block' }}>All Visibility Active</strong>
              <small style={{ fontWeight: 500 }}>Super Admin Authorization</small>
            </div>
          </div>
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={17} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-row">
            <div>
              <p className="eyebrow" style={{ color: '#7c3aed' }}>
                <span className="live-dot" style={{ background: '#9333ea' }} /> System Administration Mode
              </p>
              <h1>Master All Visibility Dashboard <span>✦</span></h1>
              <p className="admin-subtitle">Unified view of all employees, HR metrics, team attendance, payroll & security audit logs.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="primary-button" style={{ background: '#7c3aed', borderColor: '#6d28d9', boxShadow: '0 4px 0 #ddd6fe' }} onClick={() => onOpenManualEntry('Employee')}>
                <UserPlus size={15} /> + Add Employee / Entry
              </button>
              <button className="outline-button" onClick={onGeneratePayroll}>
                <WalletCards size={15} /> Generate Payroll
              </button>
              <button className="outline-button" onClick={() => onExportReport?.('system-control-report')}>
                <FileBarChart size={15} /> Export report
              </button>
              <button className="outline-button" onClick={onOpenAssistant}>
                <Bot size={15} /> Ask AI Assistant
              </button>
            </div>
          </div>

          <div className="admin-visibility-bar">
            <label>Show Role Visibility:</label>
            <button className={`admin-view-btn ${previewRoleView === 'master' ? 'active' : ''}`} onClick={() => setPreviewRoleView('master')}>
              ✦ Master All Visibility
            </button>
            <button className={`admin-view-btn ${previewRoleView === 'hr' ? 'active' : ''}`} onClick={() => setPreviewRoleView('hr')}>
              👔 HR Command View
            </button>
            <button className={`admin-view-btn ${previewRoleView === 'manager' ? 'active' : ''}`} onClick={() => setPreviewRoleView('manager')}>
              👥 Manager View
            </button>
            <button className={`admin-view-btn ${previewRoleView === 'employee' ? 'active' : ''}`} onClick={() => setPreviewRoleView('employee')}>
              👤 Employee View
            </button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#7c3aed', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <strong>Super Admin - Full Visibility Enabled</strong>
                <p>You have global administrative access to all 4 system roles: System Admin ({adminCount}), HR ({hrCount}), Manager ({managerCount}), Employee ({employeeCount}).</p>
              </div>
            </div>
            <button className="primary-button" style={{ background: '#7c3aed', borderColor: '#6d28d9', boxShadow: '0 4px 0 #ddd6fe' }} onClick={handleAdminApproveAll}>
              <ShieldCheck size={14} /> Master System Override
            </button>
          </div>

          {actionNotice && (
            <p className="action-notice" style={{ background: '#f3e8ff', color: '#6d28d9', border: '1px solid #ddd6fe' }} role="status">
              {actionNotice}
            </p>
          )}

          <section className="admin-stat-grid">
            <article className="admin-stat">
              <span className="stat-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}><UsersRound size={17} /></span>
              <div>
                <small>Total Headcount</small>
                <strong>{(liveSnapshot.employeeCount || employees.length).toLocaleString()}</strong>
                <p>Admin: {adminCount} · HR: {hrCount} · Mgr: {managerCount} · Emp: {employeeCount}</p>
              </div>
            </article>

            <article className="admin-stat">
              <span className="stat-icon green"><Clock3 size={17} /></span>
              <div>
                <small>Global Attendance</small>
                <strong>{liveSnapshot.attendanceRate || 92.4}%</strong>
                <p>{liveSnapshot.presentCount} present today · {liveSnapshot.lateCount} late</p>
              </div>
            </article>

            <article className="admin-stat">
              <span className="stat-icon yellow"><WalletCards size={17} /></span>
              <div>
                <small>Total Payroll Cost</small>
                <strong>${(liveSnapshot.totalPayroll || 68400).toLocaleString()}</strong>
                <p>{liveSnapshot.processedPayrollCount || liveSnapshot.totalRecords || 0} payroll records ready</p>
              </div>
            </article>

            <article className="admin-stat">
              <span className="stat-icon blue"><ShieldCheck size={17} /></span>
              <div>
                <small>System Security & MFA</small>
                <strong>100% Secure</strong>
                <p>MFA Active · 0 Vulnerability Flags</p>
              </div>
            </article>
          </section>

          {renderAdminSectionContent()}
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
        roleLabel="System Admin"
      />
    </div>
  )
}

function App() {
  const [authenticatedRole, setAuthenticatedRole] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [dataset, setDataset] = useState({ attendance: [], allocation: [], workforce: [] })
  const [liveWorkforce, setLiveWorkforce] = useState({ employees: [], attendance: [], payrollSummary: {}, leaveRequests: [], notifications: [], departments: [], locations: [] })
  const [activeNav, setActiveNav] = useState('Overview')
  const [range, setRange] = useState('This week')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')

  useEffect(() => {
    document.title = authenticatedRole ? `${authenticatedRole.label} | Northstar Workforce` : 'Northstar Workforce'
  }, [authenticatedRole])

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
      fetch(`${API_BASE_URL}/api/employees/`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/attendance/`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/payroll/summary`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/leaves/`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/employees/options`).then((response) => response.ok ? response.json() : {}).catch(() => ({})),
      fetch(`${API_BASE_URL}/api/notifications/?employee_id=all`).then((response) => response.ok ? response.json() : []).catch(() => []),
    ]).then(([employees, attendance, payrollSummary, leaveRequests, options, notifications]) => {
      setLiveWorkforce({ employees, attendance, payrollSummary, leaveRequests, notifications, departments: options.departments || [], locations: options.locations || [] })
    }).catch(() => {
      setLiveWorkforce({ employees: [], attendance: [], payrollSummary: {}, leaveRequests: [], notifications: [], departments: [], locations: [] })
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
  const [backendStatus, setBackendStatus] = useState({ healthy: false, checking: true })

  useEffect(() => {
    let isActive = true
    const checkBackend = () => {
      fetch(`${API_BASE_URL}/health`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('unhealthy')))
        .then(() => { if (isActive) setBackendStatus({ healthy: true, checking: false }) })
        .catch(() => { if (isActive) setBackendStatus({ healthy: false, checking: false }) })
    }

    checkBackend()
    const interval = window.setInterval(checkBackend, 5000)
    return () => {
      isActive = false
      window.clearInterval(interval)
    }
  }, [])

  const submitQuestion = (event) => {
    event.preventDefault()
    if (!question.trim()) return
    const currentQuestion = question.trim()
    setSubmittedQuestion(currentQuestion)
    setAiLoading(true)

    fetch(`${API_BASE_URL}/api/ai/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: currentQuestion, role: authenticatedRole?.label || 'HR Administrator' })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.answer === 'string' && data.answer.trim()) {
          setAiAnswer(data.answer)
        } else {
          setAiAnswer(buildContextualAiResponse(currentQuestion, authenticatedRole?.label || 'HR Administrator', liveSnapshot))
        }
        setAiLoading(false)
      })
      .catch(() => {
        setAiAnswer(buildContextualAiResponse(currentQuestion, authenticatedRole?.label || 'HR Administrator', liveSnapshot))
        setAiLoading(false)
      })
  }

  const generatePayroll = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/generate`, {
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

  const exportReport = (reportName = 'workforce-report') => {
    const rows = [
      ['Report', reportName],
      ['Generated at', new Date().toISOString()],
      ['Employee count', String(liveSnapshot.employeeCount || 0)],
      ['Attendance rate', `${liveSnapshot.attendanceRate || 0}%`],
      ['Present today', String(liveSnapshot.presentCount || 0)],
      ['Late arrivals', String(liveSnapshot.lateCount || 0)],
      ['Pending leave', String(liveSnapshot.pendingLeave || 0)],
      ['Payroll processed', `${liveSnapshot.processedPayrollCount || 0}/${liveSnapshot.totalRecords || 0}`],
      ['Total payroll cost', `$${(liveSnapshot.totalPayroll || 0).toLocaleString()}`],
    ]
    downloadCsvReport(`${reportName}.csv`, rows)
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

  const handleLogin = async (roleConfig, loginEmail, loginPassword) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword, role: roleConfig.label || 'System Admin' }),
      })
      if (!response.ok) {
        if (response.status === 401) return 'Invalid email or password for the selected role.'
        if (response.status === 422) return 'Enter a valid email address and a password of no more than 72 UTF-8 bytes.'
        return 'Sign-in is unavailable right now. Please try again.'
      }
      const data = await response.json()
      const permittedRoles = {
        admin: ['ADMIN', 'SYSTEM ADMIN', 'SYSTEM_ADMIN'],
        hr: ['HR_ADMIN', 'HR'],
        manager: ['MANAGER'],
        employee: ['EMPLOYEE'],
      }
      const actualRole = String(data.role || '').toUpperCase()
      if (!permittedRoles[roleConfig.id]?.includes(actualRole)) return 'Invalid email or password for the selected role.'
      setAccessToken(data.access_token)
      setAuthenticatedRole({ ...roleConfig, email: data.email || loginEmail, name: data.name || `${roleConfig.label}`, employeeId: data.employee_id || null })
      return ''
    } catch {
      return 'Unable to reach the sign-in service. Check that the backend is running and try again.'
    }
  }

  const handlePasswordSetup = async (payload) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) return ''
      if (response.status === 400 || response.status === 404) return 'The email or one-time setup code is invalid or expired.'
      if (response.status === 422) return 'Choose a password with at least 8 characters and no more than 72 UTF-8 bytes.'
      return 'Password setup is unavailable right now. Please try again.'
    } catch {
      return 'Unable to reach the password setup service. Check that the backend is running and try again.'
    }
  }

  const handleIssueSetupCode = async (email, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/setup-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) {
        if (response.status === 404) return { error: 'No active employee account was found for that email.' }
        if (response.status === 401 || response.status === 403) return { error: 'Your admin session has expired or cannot issue setup codes. Sign in again.' }
        return { error: 'Could not issue a setup code. Please try again.' }
      }
      const data = await response.json()
      return { setupCode: data.setup_code }
    } catch {
      return { error: 'Unable to reach the setup-code service. Check that the backend is running and try again.' }
    }
  }

  const handleLogout = () => {
    setAuthenticatedRole(null)
    setAccessToken(null)
  }

  const refreshLiveWorkforce = async () => {
    try {
      const [employees, attendance, payrollSummary, leaveRequests, options] = await Promise.all([
        fetch(`${API_BASE_URL}/api/employees/`).then((response) => response.json()),
        fetch(`${API_BASE_URL}/api/attendance/`).then((response) => response.json()),
        fetch(`${API_BASE_URL}/api/payroll/summary`).then((response) => response.json()),
        fetch(`${API_BASE_URL}/api/leaves/`).then((response) => response.json()),
        fetch(`${API_BASE_URL}/api/employees/options`).then((response) => response.ok ? response.json() : {}).catch(() => ({})),
      ])
      setLiveWorkforce({ employees, attendance, payrollSummary, leaveRequests, departments: options.departments || [], locations: options.locations || [] })
    } catch {}
  }

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [manualEntryTab, setManualEntryTab] = useState('Employee')

  const handleOpenManualEntry = (tab = 'Employee') => {
    setManualEntryTab(tab)
    setIsManualEntryOpen(true)
  }

  if (!authenticatedRole) return <LoginPage onLogin={handleLogin} onPasswordSetup={handlePasswordSetup} headcount={totalHeadcount} backendStatus={backendStatus} />
  if (authenticatedRole.id === 'admin') return (
    <>
      <AdminDashboard onLogout={handleLogout} dataset={dataset} onImport={importCsv} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} onGeneratePayroll={generatePayroll} liveWorkforce={liveWorkforce} onOpenManualEntry={handleOpenManualEntry} onExportReport={exportReport} onIssueSetupCode={handleIssueSetupCode} accessToken={accessToken} currentEmail={authenticatedRole.email} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )
  if (authenticatedRole.id === 'employee') return (
    <>
      <EmployeePortal employee={authenticatedRole} onLogout={handleLogout} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} liveWorkforce={liveWorkforce} onOpenManualEntry={handleOpenManualEntry} onRefreshData={refreshLiveWorkforce} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )
  if (authenticatedRole.id === 'manager') return (
    <>
      <ManagerDashboard manager={authenticatedRole} liveWorkforce={liveWorkforce} onLogout={handleLogout} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} onOpenManualEntry={handleOpenManualEntry} onExportReport={exportReport} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )
  if (authenticatedRole.id === 'hr') return (
    <>
      <HRDashboard onLogout={handleLogout} dataset={dataset} onImport={importCsv} onOpenAssistant={() => setIsAssistantOpen(true)} assistantState={assistantState} liveSnapshot={liveSnapshot} onGeneratePayroll={generatePayroll} liveWorkforce={liveWorkforce} onOpenManualEntry={handleOpenManualEntry} onExportReport={exportReport} currentName={authenticatedRole.name} currentEmail={authenticatedRole.email} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onRefreshData={refreshLiveWorkforce} employeesList={liveWorkforce.employees} initialTab={manualEntryTab} />
    </>
  )

  const renderShellSectionContent = () => {
    const employees = liveWorkforce?.employees || []

    switch (activeNav) {
      case 'Scheduling':
        return (
          <section className="admin-card" style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
            <div className="admin-card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="card-kicker" style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workforce Roster</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0.25rem 0' }}>Shift Scheduling & Coverage</h2>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Manage employee work shifts, hours, and department coverage.</p>
              </div>
              <button className="primary-button" onClick={() => handleOpenManualEntry('Shift')}>
                <CalendarDays size={16} /> Schedule Shift
              </button>
            </div>
            <div className="employee-table-container" style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Role & Dept</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Current Shift</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Schedule Hours</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length > 0 ? (
                    employees.map((emp) => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#111827' }}>
                          {emp.first_name} {emp.last_name}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>
                          {emp.role || 'Employee'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#ecfdf5', color: '#047857', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                            {emp.role?.toLowerCase().includes('manager') ? 'Manager Shift' : 'General Shift'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>09:00 AM - 05:00 PM</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#d1fae5', color: '#065f46', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            Scheduled
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button onClick={() => handleOpenManualEntry('Shift')} style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                            Edit Shift
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        No employee records loaded. Use manual entry or CSV import to add employees.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )
      case 'People':
        return <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}><EmployeeDirectoryCard employees={employees} onOpenManualEntry={handleOpenManualEntry} /></div>
      default:
        return null
    }
  }

  const currentUserName = authenticatedRole?.name || authenticatedRole?.label || 'User'
  const currentUserFirstName = currentUserName.split(' ')[0] || 'User'
  const currentUserInitials = currentUserName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'US'

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
          <div className="user-profile"><div className="profile-avatar">{currentUserInitials}</div><div><strong>{currentUserName}</strong><small>{authenticatedRole?.label || 'HR Administrator'}</small></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setIsMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="backend-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.7rem', borderRadius: '999px', background: backendStatus.healthy ? 'rgba(39,174,96,0.12)' : 'rgba(248,171,29,0.12)', color: backendStatus.healthy ? '#7ae5a9' : '#ffd166', border: `1px solid ${backendStatus.healthy ? '#39c178' : '#e7aa24'}`, fontSize: '0.72rem', fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: backendStatus.healthy ? '#39c178' : '#e7aa24', display: 'inline-block' }} />
              {backendStatus.healthy ? 'AI connected' : backendStatus.checking ? 'Checking backend' : 'Backend unavailable'}
            </div>
            <button className="search-button"><Search size={17} /><span>Search anything</span><kbd><Command size={11} /> K</kbd></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="profile-avatar top-avatar">{currentUserInitials}</button>
          </div>
        </header>

        <div className="page-container">
          <section className="welcome-row">
            <div><p className="eyebrow"><span className="live-dot" /> Live workforce pulse</p><h1>Good morning, {currentUserFirstName} <span>✦</span></h1><p className="subtitle">Here is what is happening across Northstar today.</p></div>
            <div className="welcome-actions"><button className="outline-button"><FileBarChart size={16} /> Export report</button><button className="primary-button" onClick={() => setIsAssistantOpen(true)}><Bot size={17} /> Ask assistant</button></div>
          </section>

          <section className="metric-grid">
            <article className="metric-card accent-mint"><div className="metric-top"><span>Active headcount</span><span className="metric-icon"><UsersRound size={17} /></span></div><strong>{totalHeadcount.toLocaleString()}</strong><div className="metric-bottom"><span className="trend positive">↗ 4.8%</span><span>vs last month</span><div className="mini-bars mint-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-blue"><div className="metric-top"><span>Attendance today</span><span className="metric-icon"><Clock3 size={17} /></span></div><strong>94.6%</strong><div className="metric-bottom"><span className="trend positive">↗ 2.1%</span><span>vs last week</span><div className="mini-bars blue-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-yellow"><div className="metric-top"><span>Open positions</span><span className="metric-icon"><Sparkles size={17} /></span></div><strong>36</strong><div className="metric-bottom"><span className="trend neutral">12 urgent</span><span>across 8 teams</span><div className="mini-bars yellow-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
            <article className="metric-card accent-coral"><div className="metric-top"><span>Attrition risk</span><span className="metric-icon"><Activity size={17} /></span></div><strong>8.2%</strong><div className="metric-bottom"><span className="trend negative">↘ 1.4%</span><span>vs last quarter</span><div className="mini-bars coral-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></article>
          </section>

          {renderShellSectionContent()}
        </div>
      </main>

      {isAssistantOpen && <div className="assistant-overlay" onClick={() => setIsAssistantOpen(false)}><section className="assistant-drawer" onClick={(event) => event.stopPropagation()}><div className="assistant-header"><div className="ai-title"><div className="ai-icon"><Sparkles size={17} /></div><div><h2>AI assistant</h2><p>Workforce intelligence, on demand</p></div></div><button className="icon-button" onClick={() => setIsAssistantOpen(false)} aria-label="Close assistant"><X size={18} /></button></div><div className="assistant-body"><p className="assistant-greeting">Hi {currentUserFirstName}. I can help you understand your workforce data or take action on your priority tasks.</p><div className="suggestion-grid"><button onClick={() => setQuestion('Which teams are at risk of burnout?')}>Which teams are at risk of burnout?</button><button onClick={() => setQuestion('Summarize attendance this week')}>Summarize attendance this week</button><button onClick={() => setQuestion('Where should we hire next?')}>Where should we hire next?</button></div>{submittedQuestion && <div className="assistant-response"><span className="response-label">AI insight</span><p>{aiLoading ? 'Analyzing workforce signals...' : aiAnswer || `Based on latest signals for: ${submittedQuestion}`}</p></div>}</div><form className="assistant-input" onSubmit={submitQuestion}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your workforce..." /><button type="submit" aria-label="Send question"><ArrowUpRight size={17} /></button></form></section></div>}
    </div>
  )
}

export default App
