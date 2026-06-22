const KEY = 'aeonx_admin_session'

export function setAdminSession() {
  try { localStorage.setItem(KEY, 'true') } catch {}
}

export function clearAdminSession() {
  try { localStorage.removeItem(KEY) } catch {}
}

// Safe to call only after mount (in useEffect or event handlers)
export function isAdminSession(): boolean {
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}
