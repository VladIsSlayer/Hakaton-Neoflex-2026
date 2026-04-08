import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/api/supabase'

/**
 * Проверка доступности Supabase: конфиг + простой запрос к таблице courses (если есть).
 */
export function DbStatusPanel() {
  const query = useQuery({
    queryKey: ['supabase', 'courses-head'],
    queryFn: async () => {
      const sb = getSupabase()
      if (!sb) {
        throw new Error('Клиент не создан: задайте API_SUPABASE_URL и API_SUPABASE_ANON_KEY в корневом .env')
      }
      const { error } = await sb.from('courses').select('id').limit(1)
      if (error) throw error
      return 'connected'
    },
    enabled: isSupabaseConfigured(),
    retry: 1,
  })

  if (!isSupabaseConfigured()) {
    return (
      <p className="sketch-muted">
        Supabase не сконфигурирован. В корне репозитория в <code>.env</code> задайте{' '}
        <code>API_SUPABASE_URL</code> и <code>API_SUPABASE_ANON_KEY</code>.
      </p>
    )
  }

  if (query.isPending) return <p className="sketch-muted">Запрос к БД…</p>
  if (query.isError) {
    return (
      <p className="sketch-error">
        Ошибка: {query.error instanceof Error ? query.error.message : String(query.error)}
      </p>
    )
  }
  return <p className="sketch-ok">Ответ Supabase (courses): ок</p>
}
