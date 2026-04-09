import { useAuthStore } from '@/stores/authStore'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** База API без завершающего /. Пустая строка в dev — относительные пути (прокси Vite → бэкенд). */
export function getApiBaseURL(): string {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

/** Полный URL пути API (path должен начинаться с /). */
export function apiURL(path: string): string {
  const base = getApiBaseURL()
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  if (base === '') {
    return path
  }
  return `${base}${path}`
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken
}

export async function apiFetch<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const { auth, ...rest } = init ?? {}
  const headers = new Headers(rest.headers)
  if (!headers.has('Content-Type') && rest.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const t = getAccessToken()
    if (t) {
      headers.set('Authorization', `Bearer ${t}`)
    }
  }
  const res = await fetch(apiURL(path), { ...rest, headers })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = { message: text }
    }
  }
  if (!res.ok) {
    const o = body as { code?: string; message?: string; details?: unknown }
    throw new ApiError(
      res.status,
      o?.code ?? 'http_error',
      o?.message ?? res.statusText,
      o?.details
    )
  }
  return body as T
}
