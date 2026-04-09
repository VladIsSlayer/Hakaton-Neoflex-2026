import { getSupabase } from '@/api/supabase'

export type CourseRow = {
  id: string
  title: string
  description?: string | null
  is_published?: boolean | null
  content_blocks_json?: unknown
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
}

type EnrollmentRow = {
  id: string
  user_id: string
  course_id: string
  progress_percent?: number | null
}

type UserRow = {
  id: string
  email?: string | null
  full_name?: string | null
  role?: string | null
  tg_chat_id?: string | null
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
  user: UserRow | null
  enrolledCourses: StudentCourseProgress[]
}

type TaskRow = {
  id: string
  lesson_id: string
  language_id?: number | null
  competency_id?: string | null
}

type SubmissionRow = {
  id: string
  user_id: string
  task_id: string
  status: string
}

type CompetencyRow = {
  id: string
  name: string
}

type UserCompetencyRow = {
  user_id: string
  competency_id: string
  level: number
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
    'id,title,description,is_published,content_blocks_json'
  )
  return rows.filter((course) => course.is_published === true)
}

export async function fetchLessons(): Promise<LessonRow[]> {
  const publishedCourses = await fetchCourses()
  const publishedCourseIds = new Set(publishedCourses.map((course) => course.id))
  const rows = await selectFirstAvailable<LessonRow>(
    ['lessons', 'LESSONS'],
    [
      'id',
      'course_id',
      'title',
      'order_index',
      'content_body',
      'video_embed_url',
      'practice_kind',
      'practice_title',
      'quiz_question',
      'quiz_options_json',
      'quiz_correct_option',
      'ide_task',
      'ide_template',
      'tests_json',
      'content_blocks_json',
    ].join(',')
  )
  return rows
    .filter((lesson) => publishedCourseIds.has(lesson.course_id))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
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

export async function fetchLessonsByCourse(courseId: string): Promise<LessonRow[]> {
  const all = await fetchLessons()
  return all.filter((lesson) => lesson.course_id === courseId)
}

export async function fetchStudentSnapshot(): Promise<StudentSnapshot> {
  const [courses, lessons, enrollments, users] = await Promise.all([
    fetchCourses(),
    fetchLessons(),
    selectFirstAvailable<EnrollmentRow>(
      ['enrollments', 'ENROLLMENTS'],
      'id,user_id,course_id,progress_percent'
    ).catch(() => []),
    selectFirstAvailable<UserRow>(
      ['users', 'USERS'],
      'id,email,full_name,role,tg_chat_id'
    ).catch(() => []),
  ])

  const activeUser =
    users.find((user) => user.email?.toLowerCase() === 'user 1@neoedu.local') ??
    users.find((user) => user.role === 'student') ??
    users[0] ??
    null
  const filteredEnrollments = activeUser
    ? enrollments.filter((enrollment) => enrollment.user_id === activeUser.id)
    : enrollments

  const courseMap = new Map(courses.map((course) => [course.id, course]))
  const lessonsByCourse = new Map<string, number>()
  for (const lesson of lessons) {
    lessonsByCourse.set(lesson.course_id, (lessonsByCourse.get(lesson.course_id) ?? 0) + 1)
  }

  const enrolledCourses: StudentCourseProgress[] = filteredEnrollments
    .map((enrollment) => {
      const course = courseMap.get(enrollment.course_id)
      if (!course) return null
      const lessonsTotal = lessonsByCourse.get(course.id) ?? 0
      const progress = Math.max(0, Math.min(100, Math.round(enrollment.progress_percent ?? 0)))
      const lessonsCompleted = lessonsTotal > 0 ? Math.round((progress / 100) * lessonsTotal) : 0

      return {
        enrollmentId: enrollment.id,
        userId: enrollment.user_id,
        courseId: course.id,
        courseTitle: course.title,
        progressPercent: progress,
        lessonsTotal,
        lessonsCompleted,
      }
    })
    .filter((item): item is StudentCourseProgress => item !== null)

  return {
    user: activeUser,
    enrolledCourses,
  }
}

async function getCurrentStudentUser(): Promise<UserRow | null> {
  const users = await selectFirstAvailable<UserRow>(
    ['users', 'USERS'],
    'id,email,full_name,role,tg_chat_id'
  ).catch(() => [])
  if (users.length === 0) return null
  return (
    users.find((user) => user.email?.toLowerCase() === 'user 1@neoedu.local') ??
    users.find((user) => user.role === 'student') ??
    users[0]
  )
}

export async function fetchLessonProgressForStudent(): Promise<LessonProgressItem[]> {
  const [user, courses, lessons, tasks, submissions, enrollments] = await Promise.all([
    getCurrentStudentUser(),
    fetchCourses(),
    fetchLessons(),
    selectFirstAvailable<TaskRow>(
      ['tasks', 'TASKS'],
      'id,lesson_id,language_id,competency_id'
    ).catch(() => []),
    selectFirstAvailable<SubmissionRow>(
      ['submissions', 'SUBMISSIONS'],
      'id,user_id,task_id,status'
    ).catch(() => []),
    selectFirstAvailable<EnrollmentRow>(
      ['enrollments', 'ENROLLMENTS'],
      'id,user_id,course_id,progress_percent'
    ).catch(() => []),
  ])

  const courseMap = new Map(courses.map((course) => [course.id, course.title]))
  const progressByCourseId = new Map(
    enrollments
      .filter((enrollment) => !user || enrollment.user_id === user.id)
      .map((enrollment) => [
        enrollment.course_id,
        Math.max(0, Math.min(100, Math.round(enrollment.progress_percent ?? 0))),
      ])
  )

  const taskByLesson = new Map(tasks.map((task) => [task.lesson_id, task.id]))
  const submissionByTask = new Map(
    submissions
      .filter((submission) => !user || submission.user_id === user.id)
      .map((submission) => [submission.task_id, submission])
  )

  return lessons
    .map((lesson) => {
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
  const [user, courses, lessons, tasks, submissions] = await Promise.all([
    getCurrentStudentUser(),
    fetchCourses(),
    fetchLessons(),
    selectFirstAvailable<TaskRow>(
      ['tasks', 'TASKS'],
      'id,lesson_id,language_id,competency_id'
    ).catch(() => []),
    selectFirstAvailable<SubmissionRow>(
      ['submissions', 'SUBMISSIONS'],
      'id,user_id,task_id,status'
    ).catch(() => []),
  ])

  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const userSubmissions = submissions.filter((submission) => !user || submission.user_id === user.id)

  return userSubmissions.map((submission) => {
    const task = tasksById.get(submission.task_id)
    const lesson = task ? lessonsById.get(task.lesson_id) : undefined
    const course = lesson ? courseById.get(lesson.course_id) : undefined
    const success = submission.status.toLowerCase() === 'success'
    return {
      course: course?.title ?? 'Курс',
      task: lesson?.title ?? 'Задание',
      status: success ? 'Принято' : 'Отклонено',
      score: success ? '10' : '0',
    }
  })
}

export async function fetchRecentSolutions(): Promise<UserSolutionRow[]> {
  const [user, courses, lessons, tasks, submissions] = await Promise.all([
    getCurrentStudentUser(),
    fetchCourses(),
    fetchLessons(),
    selectFirstAvailable<TaskRow>(
      ['tasks', 'TASKS'],
      'id,lesson_id,language_id,competency_id'
    ).catch(() => []),
    selectFirstAvailable<SubmissionRow>(
      ['submissions', 'SUBMISSIONS'],
      'id,user_id,task_id,status'
    ).catch(() => []),
  ])

  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

  return submissions
    .filter((submission) => !user || submission.user_id === user.id)
    .slice(0, 5)
    .map((submission) => {
      const task = tasksById.get(submission.task_id)
      const lesson = task ? lessonsById.get(task.lesson_id) : undefined
      const course = lesson ? courseById.get(lesson.course_id) : undefined
      return {
        id: submission.id,
        title: lesson?.title ?? 'Задание',
        status: submission.status,
        courseTitle: course?.title ?? 'Курс',
      }
    })
}

export async function fetchUserCompetencyStats(): Promise<{ averageLevel: number; totalCompetencies: number }> {
  const [user, rows, competencies] = await Promise.all([
    getCurrentStudentUser(),
    selectFirstAvailable<UserCompetencyRow>(
      ['user_competencies', 'USER_COMPETENCIES'],
      'user_id,competency_id,level'
    ).catch(() => []),
    selectFirstAvailable<CompetencyRow>(
      ['competencies', 'COMPETENCIES'],
      'id,name'
    ).catch(() => []),
  ])

  const userRows = rows.filter((row) => !user || row.user_id === user.id)
  const totalCompetencies = competencies.length
  const averageLevel = userRows.length > 0
    ? Math.round(userRows.reduce((sum, row) => sum + row.level, 0) / userRows.length)
    : 0

  return { averageLevel, totalCompetencies }
}

export async function fetchCourseAudienceStats(): Promise<CourseAudienceStat[]> {
  const enrollments = await selectFirstAvailable<EnrollmentRow>(
    ['enrollments', 'ENROLLMENTS'],
    'id,user_id,course_id,progress_percent'
  ).catch(() => [])

  const counts = new Map<string, number>()
  for (const enrollment of enrollments) {
    counts.set(enrollment.course_id, (counts.get(enrollment.course_id) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([courseId, enrollmentsCount]) => ({
    courseId,
    enrollments: enrollmentsCount,
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
          ? raw.tests.map((test: any) => ({ input: String(test?.input ?? ''), expected: String(test?.expected ?? '') }))
          : []
        blocks.push({
          type: 'ide',
          title: raw?.title ? String(raw.title) : undefined,
          language: raw?.language ? String(raw.language) : undefined,
          task: raw?.task ? String(raw.task) : undefined,
          template,
          tests: tests.filter((test) => test.input || test.expected),
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

