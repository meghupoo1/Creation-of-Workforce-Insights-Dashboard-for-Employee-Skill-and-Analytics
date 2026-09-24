const pptxgen = require('pptxgenjs')
const path = require('path')

const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'Workforce Analytics Team'
pptx.subject = 'AI-Powered Workforce Management Automation System'
pptx.title = 'Workforce Analytics & Talent Intelligence Dashboard'
pptx.company = 'Northstar Inc.'
pptx.lang = 'en-US'
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
}
pptx.defineSlideMaster({
  title: 'MASTER',
  background: { color: 'F5F8F4' },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: '3E8B60' }, line: { color: '3E8B60' } } },
    { text: { text: 'WORKFORCE INTELLIGENCE', options: { x: 0.55, y: 7.12, w: 3, h: 0.18, fontFace: 'Aptos', fontSize: 7, bold: true, color: '799180', charSpacing: 1.2 } } },
    { text: { text: 'September 2026', options: { x: 10.8, y: 7.12, w: 1.9, h: 0.18, fontFace: 'Aptos', fontSize: 7, color: '9BA69F', align: 'right' } } },
  ],
  slideNumber: { x: 12.85, y: 7.1, color: '9BA69F', fontFace: 'Aptos', fontSize: 8 },
})

const root = path.resolve(__dirname, '..')
const img = (name) => path.join(root, 'public', 'screenshots', name)
const colors = { ink: '30483B', muted: '7D9184', green: '3E8B60', soft: 'E3F4E5', blue: 'E4F0FC', yellow: 'FFF2CF', coral: 'FFEBE3', white: 'FFFFFF', line: 'DDE8DD' }

function title(slide, kicker, heading, sub) {
  slide.addText(kicker.toUpperCase(), { x: 0.65, y: 0.5, w: 4, h: 0.2, fontSize: 9, bold: true, color: colors.green, charSpacing: 1.4 })
  slide.addText(heading, { x: 0.65, y: 0.82, w: 8.8, h: 0.55, fontFace: 'Aptos Display', fontSize: 27, bold: true, color: colors.ink, margin: 0, breakLine: false })
  if (sub) slide.addText(sub, { x: 0.65, y: 1.47, w: 8.8, h: 0.35, fontSize: 11, color: colors.muted, margin: 0 })
}
function roundedCard(slide, x, y, w, h, fill = colors.white) { slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: colors.line, pt: 0.7 } }) }
function bulletList(slide, items, x, y, w, opts = {}) { slide.addText(items.map((item) => ({ text: item, options: { bullet: { indent: 13 }, hanging: 3 } })), { x, y, w, h: opts.h || 2.8, fontSize: opts.size || 13, color: opts.color || colors.ink, breakLine: true, paraSpaceAfterPt: 12, margin: 0.04, valign: 'top' }) }
function screenshot(slide, file, x, y, w, h) { slide.addImage({ path: img(file), x, y, w, h }) }

let slide = pptx.addSlide('MASTER')
slide.background = { color: 'E3F4E5' }
slide.addShape(pptx.ShapeType.arc, { x: 8.9, y: -1.4, w: 5.6, h: 5.6, line: { color: 'B9DDBD', pt: 1.5, transparency: 20 }, adjustPoint: 0.25 })
slide.addShape(pptx.ShapeType.arc, { x: 9.5, y: -0.7, w: 4.5, h: 4.5, line: { color: 'B9DDBD', pt: 1, transparency: 30 }, adjustPoint: 0.25 })
slide.addText('AI-Powered Workforce\nManagement Automation', { x: 0.75, y: 1.2, w: 7.1, h: 1.3, fontFace: 'Aptos Display', fontSize: 31, bold: true, color: colors.ink, breakLine: false, margin: 0 })
slide.addText('Workforce analytics & talent intelligence dashboard', { x: 0.78, y: 2.72, w: 6.2, h: 0.35, fontSize: 15, color: '5F7B68', margin: 0 })
slide.addText('Project report and product walkthrough', { x: 0.78, y: 3.28, w: 4.5, h: 0.25, fontSize: 11, bold: true, color: colors.green, margin: 0 })
slide.addShape(pptx.ShapeType.roundRect, { x: 0.78, y: 4.45, w: 2.18, h: 0.5, rectRadius: 0.06, fill: { color: colors.green }, line: { color: colors.green } })
slide.addText('FRONTEND PROTOTYPE', { x: 0.95, y: 4.61, w: 1.85, h: 0.13, fontSize: 8, bold: true, color: colors.white, charSpacing: 1.1, align: 'center', margin: 0 })
screenshot(slide, 'login.png', 7.25, 1.15, 5.35, 4.6)

slide = pptx.addSlide('MASTER')
title(slide, '01 / Product', 'One workspace, three role experiences', 'A single workforce operating layer tailored to the decisions each role needs to make.')
const roleCards = [
  ['HR Administrator', 'See employee analytics, attrition, payroll, compliance, alerts, and platform controls.', colors.soft],
  ['Manager', 'Coordinate team attendance, leave approvals, productivity, resource allocation, and utilization.', colors.blue],
  ['Employee', 'Handle attendance, shifts, leave, timesheets, payslips, profile, and growth in self-service.', colors.yellow],
]
roleCards.forEach((card, i) => { const x = 0.7 + i * 4.15; roundedCard(slide, x, 2.15, 3.72, 2.25, card[2]); slide.addText(`0${i + 1}`, { x: x + 0.25, y: 2.4, w: 0.4, h: 0.25, fontSize: 11, bold: true, color: colors.green }); slide.addText(card[0], { x: x + 0.25, y: 2.86, w: 3.1, h: 0.32, fontSize: 17, bold: true, color: colors.ink, margin: 0 }); slide.addText(card[1], { x: x + 0.25, y: 3.35, w: 3.05, h: 0.72, fontSize: 11, color: colors.muted, breakLine: false, margin: 0, valign: 'top' }) })
slide.addText('Role-based access is represented in the frontend now; production authentication and authorization should be backed by an identity provider and server-side policy enforcement.', { x: 0.75, y: 5.35, w: 11.3, h: 0.6, fontSize: 12, italic: true, color: colors.muted, margin: 0 })

slide = pptx.addSlide('MASTER')
title(slide, '02 / Screens', 'HR command center', 'Executive visibility across people, attendance, payroll, attrition, compliance, and alerts.')
screenshot(slide, 'hr-dashboard.png', 0.65, 1.95, 12.03, 4.78)
slide.addShape(pptx.ShapeType.roundRect, { x: 9.55, y: 5.9, w: 2.5, h: 0.46, rectRadius: 0.05, fill: { color: colors.green, transparency: 8 }, line: { color: colors.green, transparency: 100 } })
slide.addText('Analytics + automation hub', { x: 9.72, y: 6.05, w: 2.15, h: 0.12, color: colors.white, fontSize: 8, bold: true, align: 'center', margin: 0 })

slide = pptx.addSlide('MASTER')
title(slide, '03 / Screens', 'Manager dashboard', 'A focused view for attendance, approvals, productivity, resource allocation, and team utilization.')
screenshot(slide, 'manager-dashboard.png', 0.65, 1.95, 12.03, 4.78)

slide = pptx.addSlide('MASTER')
title(slide, '04 / Screens', 'Employee self-service', 'A calmer employee experience for the workday, time away, shifts, payroll, and personal growth.')
screenshot(slide, 'employee-portal.png', 0.65, 1.95, 12.03, 4.78)

slide = pptx.addSlide('MASTER')
title(slide, '05 / Platform', 'AI, integrations, reports, and security', 'The automation hub organizes capability breadth into four practical operating surfaces.')
const platformCols = [
  ['AI capabilities', ['HR chatbot', 'Anomaly detection', 'Absenteeism analysis', 'Attrition prediction', 'Workforce forecasting', 'Compliance alerts'], colors.soft],
  ['Integrations', ['Biometric devices', 'ERP + payroll', 'Teams + Slack', 'Outlook + Google', 'Active Directory', 'SAP + Oracle HRMS'], colors.blue],
  ['Reports', ['Attendance', 'Overtime + leave', 'Payroll summary', 'Productivity', 'Cost + attrition', 'Department performance'], colors.yellow],
  ['Security', ['RBAC', 'MFA', 'Encryption', 'Audit logs', 'Disaster recovery', 'GDPR-ready handling'], colors.coral],
]
platformCols.forEach((col, i) => { const x = 0.7 + (i % 2) * 6.15; const y = 2.05 + Math.floor(i / 2) * 2.35; roundedCard(slide, x, y, 5.55, 1.95, col[2]); slide.addText(col[0], { x: x + 0.25, y: y + 0.22, w: 4.5, h: 0.28, fontSize: 16, bold: true, color: colors.ink, margin: 0 }); bulletList(slide, col[1], x + 0.28, y + 0.66, 4.7, { h: 1.05, size: 9, color: colors.muted }) })
slide.addText('Designed for future API connectors and model services; the current implementation uses local frontend state for demonstration.', { x: 0.72, y: 6.72, w: 11.8, h: 0.2, fontSize: 9, italic: true, color: colors.muted, margin: 0 })

slide = pptx.addSlide('MASTER')
title(slide, '06 / Workflow', 'From check-in to insight', 'The real-time operating loop connects attendance events to decisions, approvals, payroll, and reporting.')
const steps = ['Check-in', 'AI validation', 'Shift + overtime', 'Leave approval', 'Timesheet', 'Payroll input', 'Dashboards', 'Alerts', 'Reports']
steps.forEach((step, i) => { const x = 0.75 + (i % 5) * 2.45; const y = 2.15 + Math.floor(i / 5) * 1.45; roundedCard(slide, x, y, 2.05, 0.85, i < 6 ? colors.white : colors.soft); slide.addText(String(i + 1).padStart(2, '0'), { x: x + 0.15, y: y + 0.18, w: 0.32, h: 0.2, fontSize: 10, bold: true, color: colors.green, margin: 0 }); slide.addText(step, { x: x + 0.58, y: y + 0.2, w: 1.25, h: 0.2, fontSize: 10, bold: true, color: colors.ink, margin: 0 }) })
slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 5.45, w: 11.9, h: 0.75, rectRadius: 0.06, fill: { color: 'E3F4E5' }, line: { color: 'CBE2CC' } })
slide.addText('Expected outcomes', { x: 1, y: 5.68, w: 1.5, h: 0.18, fontSize: 10, bold: true, color: colors.green, margin: 0 })
slide.addText('80-90% less manual HR work  •  Faster attendance and payroll processing  •  Better utilization  •  Audit-ready operations  •  Stronger employee experience', { x: 2.55, y: 5.63, w: 9.55, h: 0.3, fontSize: 11, color: colors.ink, margin: 0 })

slide = pptx.addSlide('MASTER')
title(slide, '07 / Next steps', 'Connect the product to real workforce data', 'The frontend prototype is ready for authenticated, data-backed implementation.')
bulletList(slide, ['Connect identity, RBAC, MFA, and session management.', 'Integrate employee, attendance, shift, leave, timesheet, payroll, and organization APIs.', 'Replace local demo state with validated data services and audit events.', 'Add model services for anomaly detection, attrition, absenteeism, forecasting, and recommendations.', 'Add automated tests for permissions, approvals, logout, reports, and data quality.', 'Deploy with monitoring, backups, disaster recovery, and GDPR retention workflows.'], 0.9, 2.0, 6.3, { h: 3.8, size: 14 })
roundedCard(slide, 8.1, 1.9, 4.25, 3.8, colors.soft)
slide.addText('Prototype status', { x: 8.45, y: 2.35, w: 3.4, h: 0.3, fontSize: 17, bold: true, color: colors.ink, margin: 0 })
slide.addText('Ready for stakeholder walkthrough', { x: 8.45, y: 2.9, w: 3.2, h: 0.3, fontSize: 13, color: colors.green, bold: true, margin: 0 })
slide.addText('Built and verified:', { x: 8.45, y: 3.55, w: 2, h: 0.2, fontSize: 10, bold: true, color: colors.muted, margin: 0 })
bulletList(slide, ['Role login', 'HR command center', 'Manager workspace', 'Employee portal', 'AI assistant + workflow', 'Responsive layouts'], 8.5, 3.9, 3.2, { h: 1.5, size: 10, color: colors.ink })

pptx.writeFile({ fileName: path.join(root, 'docs', 'workforce-analytics-presentation.pptx') })
