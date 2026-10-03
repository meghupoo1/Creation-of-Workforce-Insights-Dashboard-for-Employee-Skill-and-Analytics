export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL !== undefined)
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.MODE === 'production' ? '' : 'http://localhost:8000');

export const DEMO_LOGIN_EMAILS = {
  admin: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@gmail.com',
  hr: import.meta.env.VITE_DEMO_HR_EMAIL || 'shwethaa@gmail.com',
  manager: import.meta.env.VITE_DEMO_MANAGER_EMAIL || 'maya.roberts@northstar.example',
  employee: import.meta.env.VITE_DEMO_EMPLOYEE_EMAIL || 'aarav.sharma@northstar.example',
}
