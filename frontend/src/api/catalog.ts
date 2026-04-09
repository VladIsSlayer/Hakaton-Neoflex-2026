import { getSupabase } from '@/api/supabase'

type CourseRow = {
  id: string
  title: string
  description?: string | null
  is_published?: boolean | null
}

type LessonRow = {
  id: string
  course_id: string
  title: string
  order_index?: number | null
  content_body?: string | null
}

async function selectFirstAvailable<T>(tables: string[], selectClause: string): Promise<T[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase не сконфигурирован')

  let lastError: unknown = null
  for (const table of tables) {
    const { data, error } = await sb.from(table).select(selectClause)
    if (!error && data) return data as T[]
    lastError = error
  }
  throw lastError instanceof Error ? lastError : new Error('Не удалось прочитать таблицу')
}

export async function fetchCourses(): Promise<CourseRow[]> {
  const rows = await selectFirstAvailable<CourseRow>(
    ['courses', 'COURSES'],
    'id,title,description,is_published'
  )
  return rows
}

export async function fetchLessons(): Promise<LessonRow[]> {
  const rows = await selectFirstAvailable<LessonRow>(
    ['lessons', 'LESSONS'],
    'id,course_id,title,order_index,content_body'
  )
  return rows.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
}

export async function fetchCourseById(courseId: string): Promise<CourseRow | null> {
  const courses = await fetchCourses()
  return courses.find((c) => c.id === courseId) ?? null
}

export async function fetchLessonsByCourse(courseId: string): Promise<LessonRow[]> {
  const all = await fetchLessons()
  return all.filter((lesson) => lesson.course_id === courseId)
}

