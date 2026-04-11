import { useQuery } from '@tanstack/react-query'
import { apiURL } from '@/shared/api/client'

/** Проверка Go API и PostgreSQL через GET /api/health. */
export function DbStatusPanel() {
  const query = useQuery({
    queryKey: ['backend-health'],
    queryFn: async () => {
      const res = await fetch(apiURL('/api/health'))
      const text = await res.text()
      let body: unknown = null
      if (text) {
        try {
          body = JSON.parse(text) as unknown
        } catch {
          body = text
        }
      }
      if (!res.ok) {
        throw new Error(typeof body === 'object' && body && 'message' in body ? String((body as { message?: string }).message) : res.statusText)
      }
      return body
    },
    retry: 1,
  })

  if (query.isPending) return <p className="sketch-muted">Запрос к API…</p>
  if (query.isError) {
    return (
      <p className="sketch-error">
        Ошибка: {query.error instanceof Error ? query.error.message : String(query.error)}
      </p>
    )
  }
  const data = query.data as { status?: string; db?: string } | null
  const db = data?.db === 'up' ? 'PostgreSQL: ок' : data?.db === 'down' ? 'БД: недоступна' : ''
  return (
    <p className="sketch-ok">
      Backend: {data?.status ?? 'ok'}
      {db ? ` · ${db}` : ''}
    </p>
  )
}
