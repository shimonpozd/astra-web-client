const cleanJoin = (base: string, path: string) => {
  if (!base) return path
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
const adminBase = import.meta.env.VITE_ADMIN_BASE_URL ?? '/admin'
const wsBase = import.meta.env.VITE_WS_BASE_URL ?? null

export const config = {
  apiBaseUrl: apiBase,
  adminBaseUrl: adminBase,
  websocketBaseUrl: wsBase,
  apiUrl: (path: string) => cleanJoin(apiBase, path),
  adminUrl: (path: string) => cleanJoin(adminBase, path),
  websocketUrl(path: string) {
    if (!wsBase) {
      throw new Error('VITE_WS_BASE_URL is not configured')
    }
    return cleanJoin(wsBase, path)
  },
}

export type AppConfig = typeof config
