import { useAuthStore } from '@/stores/authStore'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function apiBase(): string {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (!base) {
    throw new Error('VITE_API_URL не задан (например http://localhost:8080)')
  }
  return base
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
  const res = await fetch(`${apiBase()}${path}`, { ...rest, headers })
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
