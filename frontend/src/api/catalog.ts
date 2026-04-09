import { ApiError, apiFetch, getAccessToken } from '@/api/client'

export type CourseRow = {
  id: string
  title: string
  description?: string | null
  is_published?: boolean | null
  content_blocks_json?: unknown
}

export type LessonTaskMeta = {
  task_id: string
  language_id: number
  /** С бэкенда; при отсутствии показываем Judge0 id. */
  language_label?: string
}

/** Ответ POST /api/tasks/:id/check после прогона в Judge0. */
export type TaskCheckResponse = {
  status: 'success' | 'failed'
  phase: string
  execution_status: string
  /** Классификация с бэка (compile_error, wrong_answer, …). */
  failure_kind?: string
  error: string
  console: string
  stderr?: string
  compile_output?: string
  judge_status?: string
  score: number
  updated_progress_percent: number
  course_progress_percent: number
  competencies: unknown
  already_solved: boolean
}

export type LessonRow = {
  id: string
  course_id: string
  title: string
  order_index?: number | null
  content_body?: string | null
  video_embed_url?: string | null
  practice_kind?: string | null
  practice_title?: string | null
  quiz_question?: string | null
  quiz_options_json?: string | null
  quiz_correct_option?: string | null
  ide_task?: string | null
  ide_template?: string | null
  tests_json?: string | null
  content_blocks_json?: unknown
  task_id?: string | null
}

export type StudentCourseProgress = {
  enrollmentId: string
  userId: string
  courseId: string
  courseTitle: string
  progressPercent: number
  lessonsTotal: number
  lessonsCompleted: number
}

export type StudentSnapshot = {
  user: {
    id: string
    email?: string | null
    full_name?: string | null
    role?: string | null
    tg_chat_id?: string | null
  } | null
  enrolledCourses: StudentCourseProgress[]
}

export type LessonProgressItem = {
  lessonId: string
  courseId: string
  lessonTitle: string
  courseTitle: string
  progressPercent: number
  status: 'в процессе' | 'не начат'
}

export type ProfileTaskStatusRow = {
  course: string
  task: string
  status: string
  score: string
}

export type UserSolutionRow = {
  id: string
  title: string
  status: string
  courseTitle: string
}

export type CourseAudienceStat = {
  courseId: string
  enrollments: number
}

export type LessonContentConfig = {
  kind: 'quiz' | 'ide' | 'hybrid' | 'none'
  practiceTitle: string | null
  quizQuestion: string | null
  quizOptions: string[]
  quizCorrectOption: string | null
  ideTask: string | null
  ideTemplate: string | null
  tests: Array<{ input: string; expected: string }>
  videoEmbedUrl: string | null
  blocks: LessonContentBlock[]
}

export type LessonContentBlock =
  | { type: 'text'; text: string }
  | { type: 'video'; embedUrl: string }
  | { type: 'quiz'; title?: string; question: string; options: string[]; correctOption?: string | null }
  | { type: 'ide'; title?: string; language?: string; task?: string; template: string; tests: Array<{ input: string; expected: string }> }

type MeSnapshotDTO = {
  user: {
    id: string
    email: string
    full_name: string
    role: string
    tg_chat_id?: string
  }
  enrolled_courses: Array<{
    enrollment_id: string
    user_id: string
    course_id: string
    course_title: string
    progress_percent: number
    lessons_total: number
    lessons_completed: number
  }>
  submissions: Array<{
    id: string
    task_id: string
    status: string
    lesson_id: string
    course_id: string
    lesson_title: string
    course_title: string
  }>
  recent_submissions: Array<{
    id: string
    task_id: string
    status: string
    lesson_title: string
    course_title: string
  }>
  task_statuses: Array<{
    course: string
    task: string
    status: string
    score: string
  }>
  average_competency_level: number
  total_competencies_catalog: number
}

type EnrollmentCountRow = {
  course_id: string
  enrollments: number
}

export async function fetchCourses(): Promise<CourseRow[]> {
  return apiFetch<CourseRow[]>('/api/courses', { method: 'GET' })
}

export async function fetchLessons(): Promise<LessonRow[]> {
  const rows = await apiFetch<LessonRow[]>('/api/lessons', { method: 'GET' })
  return [...rows].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
}

export async function fetchCourseById(courseId: string): Promise<CourseRow | null> {
  const courses = await fetchCourses()
  return courses.find((c) => c.id === courseId) ?? null
}

export async function fetchCourseContentBlocks(courseId: string): Promise<LessonContentBlock[]> {
  const course = await fetchCourseById(courseId)
  if (!course) return []
  return parseContentBlocks(course.content_blocks_json)
}

/** Уроки конкретного курса с `task_id` и прочими полями (не фильтр по глобальному каталогу). */
export async function fetchLessonsByCourse(courseId: string): Promise<LessonRow[]> {
  try {
    const rows = await apiFetch<LessonRow[]>(
      `/api/courses/${encodeURIComponent(courseId)}/lessons`,
      { method: 'GET' }
    )
    return [...rows].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return []
    }
    throw e
  }
}

async function fetchMeSnapshot(): Promise<MeSnapshotDTO | null> {
  if (!getAccessToken()) return null
  try {
    return await apiFetch<MeSnapshotDTO>('/api/users/me/snapshot', { method: 'GET', auth: true })
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      return null
    }
    throw e
  }
}

export async function enrollInCourse(courseId: string): Promise<{ course_id: string }> {
  return apiFetch<{ course_id: string }>('/api/enrollments', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ course_id: courseId }),
  })
}

export async function fetchStudentSnapshot(): Promise<StudentSnapshot> {
  const snap = await fetchMeSnapshot()
  if (!snap) {
    return { user: null, enrolledCourses: [] }
  }
  return {
    user: {
      id: snap.user.id,
      email: snap.user.email,
      full_name: snap.user.full_name,
      role: snap.user.role,
      tg_chat_id: snap.user.tg_chat_id ?? null,
    },
    enrolledCourses: snap.enrolled_courses.map((e) => ({
      enrollmentId: e.enrollment_id,
      userId: e.user_id,
      courseId: e.course_id,
      courseTitle: e.course_title,
      progressPercent: Math.max(0, Math.min(100, Math.round(e.progress_percent ?? 0))),
      lessonsTotal: e.lessons_total ?? 0,
      lessonsCompleted: e.lessons_completed ?? 0,
    })),
  }
}

export async function fetchLessonTaskMeta(lessonId: string): Promise<LessonTaskMeta | null> {
  try {
    return await apiFetch<LessonTaskMeta>(`/api/lessons/${encodeURIComponent(lessonId)}/task`, {
      method: 'GET',
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return null
    }
    throw e
  }
}

export async function submitTaskCheck(
  taskId: string,
  userCode: string,
  languageId: number
): Promise<TaskCheckResponse> {
  return apiFetch<TaskCheckResponse>(`/api/tasks/${encodeURIComponent(taskId)}/check`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ user_code: userCode, language_id: languageId }),
  })
}

export async function fetchLessonProgressForStudent(): Promise<LessonProgressItem[]> {
  const [courses, lessons, snap] = await Promise.all([fetchCourses(), fetchLessons(), fetchMeSnapshot()])
  const courseMap = new Map(courses.map((course) => [course.id, course.title]))
  const progressByCourseId = new Map<string, number>()
  if (snap) {
    for (const e of snap.enrolled_courses) {
      progressByCourseId.set(
        e.course_id,
        Math.max(0, Math.min(100, Math.round(e.progress_percent ?? 0)))
      )
    }
  }
  const taskByLesson = new Map<string, string>()
  for (const lesson of lessons) {
    if (lesson.task_id) {
      taskByLesson.set(lesson.id, lesson.task_id)
    }
  }
  const submissionByTask = new Map<string, { status: string }>()
  if (snap) {
    for (const s of snap.submissions) {
      submissionByTask.set(s.task_id, { status: s.status })
    }
  }

  return lessons.map((lesson) => {
    const taskId = taskByLesson.get(lesson.id)
    const submission = taskId ? submissionByTask.get(taskId) : undefined
    const courseTitle = courseMap.get(lesson.course_id) ?? 'Курс'
    const progress = progressByCourseId.get(lesson.course_id) ?? (submission ? 100 : 0)
    return {
      lessonId: lesson.id,
      courseId: lesson.course_id,
      lessonTitle: lesson.title,
      courseTitle,
      progressPercent: progress,
      status: progress > 0 ? 'в процессе' : 'не начат',
    }
  })
}

export async function fetchProfileTaskStatuses(): Promise<ProfileTaskStatusRow[]> {
  const snap = await fetchMeSnapshot()
  if (!snap) return []
  return snap.task_statuses.map((row) => ({
    course: row.course,
    task: row.task,
    status: row.status,
    score: row.score,
  }))
}

export async function fetchRecentSolutions(): Promise<UserSolutionRow[]> {
  const snap = await fetchMeSnapshot()
  if (!snap) return []
  return snap.recent_submissions.map((s) => ({
    id: s.id,
    title: s.lesson_title,
    status: s.status,
    courseTitle: s.course_title,
  }))
}

export async function fetchUserCompetencyStats(): Promise<{ averageLevel: number; totalCompetencies: number }> {
  const snap = await fetchMeSnapshot()
  if (!snap) {
    return { averageLevel: 0, totalCompetencies: 0 }
  }
  return {
    averageLevel: snap.average_competency_level ?? 0,
    totalCompetencies: snap.total_competencies_catalog ?? 0,
  }
}

export async function fetchCourseAudienceStats(): Promise<CourseAudienceStat[]> {
  const rows = await apiFetch<EnrollmentCountRow[]>('/api/stats/course-enrollments', { method: 'GET' })
  return rows.map((r) => ({
    courseId: r.course_id,
    enrollments: r.enrollments,
  }))
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

function parseTests(value: string | null | undefined): Array<{ input: string; expected: string }> {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => ({
        input: String(item?.input ?? ''),
        expected: String(item?.expected ?? ''),
      }))
      .filter((item) => item.input.length > 0 || item.expected.length > 0)
  } catch {
    return []
  }
}

function parseContentBlocks(value: unknown): LessonContentBlock[] {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []
    const blocks: LessonContentBlock[] = []
    for (const raw of parsed) {
      const type = String(raw?.type ?? '').toLowerCase()
      if (type === 'text') {
        const text = String(raw?.text ?? '')
        if (text) blocks.push({ type: 'text', text })
      } else if (type === 'video') {
        const embedUrl = String(raw?.embedUrl ?? raw?.embed_url ?? '')
        if (embedUrl) blocks.push({ type: 'video', embedUrl })
      } else if (type === 'quiz') {
        const question = String(raw?.question ?? '')
        const options = Array.isArray(raw?.options) ? raw.options.map((item: unknown) => String(item)) : []
        if (question && options.length > 0) {
          blocks.push({
            type: 'quiz',
            title: raw?.title ? String(raw.title) : undefined,
            question,
            options,
            correctOption: raw?.correctOption ? String(raw.correctOption) : null,
          })
        }
      } else if (type === 'ide') {
        const template = String(raw?.template ?? '')
        const tests = Array.isArray(raw?.tests)
          ? raw.tests.map((test: { input?: unknown; expected?: unknown }) => ({
              input: String(test?.input ?? ''),
              expected: String(test?.expected ?? ''),
            }))
          : []
        blocks.push({
          type: 'ide',
          title: raw?.title ? String(raw.title) : undefined,
          language: raw?.language ? String(raw.language) : undefined,
          task: raw?.task ? String(raw.task) : undefined,
          template,
          tests: tests.filter((test: { input: string; expected: string }) => test.input || test.expected),
        })
      }
    }
    return blocks
  } catch {
    return []
  }
}

export async function fetchLessonContentConfig(courseId: string, lessonId: string): Promise<LessonContentConfig | null> {
  const lessons = await fetchLessonsByCourse(courseId)
  const lesson = lessons.find((item) => item.id === lessonId)
  if (!lesson) return null

  const rawKind = (lesson.practice_kind ?? 'none').toLowerCase()
  const kind: LessonContentConfig['kind'] =
    rawKind === 'quiz' || rawKind === 'ide' || rawKind === 'hybrid' ? rawKind : 'none'

  const parsedBlocks = parseContentBlocks(lesson.content_blocks_json)
  const fallbackBlocks: LessonContentBlock[] = []
  if (lesson.content_body) fallbackBlocks.push({ type: 'text', text: lesson.content_body })
  if (lesson.video_embed_url) fallbackBlocks.push({ type: 'video', embedUrl: lesson.video_embed_url })
  if ((kind === 'quiz' || kind === 'hybrid') && lesson.quiz_question) {
    fallbackBlocks.push({
      type: 'quiz',
      title: lesson.practice_title ?? undefined,
      question: lesson.quiz_question,
      options: parseJsonArray(lesson.quiz_options_json),
      correctOption: lesson.quiz_correct_option ?? null,
    })
  }
  if (kind === 'ide' || kind === 'hybrid') {
    fallbackBlocks.push({
      type: 'ide',
      title: lesson.practice_title ?? undefined,
      language: 'sql',
      task: lesson.ide_task ?? undefined,
      template: lesson.ide_template ?? '',
      tests: parseTests(lesson.tests_json),
    })
  }

  return {
    kind,
    practiceTitle: lesson.practice_title ?? null,
    quizQuestion: lesson.quiz_question ?? null,
    quizOptions: parseJsonArray(lesson.quiz_options_json),
    quizCorrectOption: lesson.quiz_correct_option ?? null,
    ideTask: lesson.ide_task ?? null,
    ideTemplate: lesson.ide_template ?? null,
    tests: parseTests(lesson.tests_json),
    videoEmbedUrl: lesson.video_embed_url ?? null,
    blocks: parsedBlocks.length > 0 ? parsedBlocks : fallbackBlocks,
  }
}
