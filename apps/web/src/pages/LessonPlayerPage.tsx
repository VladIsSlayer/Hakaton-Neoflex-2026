import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, Collapse, Input, Radio, Select, Space, Typography, message } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCourseById,
  fetchLessonContentConfig,
  fetchLessonTaskMeta,
  fetchLessonsByCourse,
  submitTaskCheck,
  type LessonContentBlock,
  type TaskCheckResponse,
} from '@/shared/api/catalog'
import { TaskCheckResultPanel } from '@/features/task-check/ui/TaskCheckResultPanel'
import { ApiError, getAccessToken } from '@/shared/api/client'
import { FREE_COURSE_ID } from '@/shared/config/freeCourse'
import { JUDGE0_IDE_LANGUAGES } from '@/shared/config/judge0Languages'

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams()
  const queryClient = useQueryClient()
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [ideCode, setIdeCode] = useState('')
  const [taskCheckResult, setTaskCheckResult] = useState<TaskCheckResponse | null>(null)
  const [taskCheckHttpError, setTaskCheckHttpError] = useState<string | null>(null)
  const [checkSubmitting, setCheckSubmitting] = useState(false)
  const [ideLanguageId, setIdeLanguageId] = useState(71)

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseById(courseId ?? ''),
    enabled: Boolean(courseId),
  })
  const courseLessonsQuery = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => fetchLessonsByCourse(courseId ?? ''),
    enabled: Boolean(courseId),
  })
  const freeLessonsQuery = useQuery({
    queryKey: ['course-lessons', 'free-stub', FREE_COURSE_ID],
    queryFn: () => fetchLessonsByCourse(FREE_COURSE_ID),
    enabled: Boolean(FREE_COURSE_ID),
  })

  const lesson = useMemo(
    () => (courseLessonsQuery.data ?? []).find((item) => item.id === lessonId) ?? null,
    [courseLessonsQuery.data, lessonId]
  )
  const orderIndex = lesson?.order_index ?? 0

  /** Теория и практика подгружаются с бесплатного курса (по order_index), заглушка для любого маршрута. */
  const contentTarget = useMemo(() => {
    if (!courseId || !lessonId) return null
    if (!courseLessonsQuery.isFetched || !freeLessonsQuery.isFetched) return null
    const freeList = freeLessonsQuery.data ?? []
    if (freeList.length > 0) {
      const hit = freeList.find((l) => (l.order_index ?? 0) === orderIndex)
      return { cid: FREE_COURSE_ID, lid: (hit ?? freeList[0]).id }
    }
    return { cid: courseId, lid: lessonId }
  }, [
    courseId,
    lessonId,
    orderIndex,
    courseLessonsQuery.isFetched,
    freeLessonsQuery.isFetched,
    freeLessonsQuery.data,
  ])

  const lessonContentQuery = useQuery({
    queryKey: ['lesson-content', contentTarget?.cid, contentTarget?.lid, 'stub-free'],
    queryFn: () => fetchLessonContentConfig(contentTarget!.cid, contentTarget!.lid),
    enabled: Boolean(contentTarget),
  })

  const lessonContent = lessonContentQuery.data
  const lessonIdForTaskCheck = contentTarget?.lid ?? lessonId

  const taskMetaQuery = useQuery({
    queryKey: ['lesson-task-meta', lessonIdForTaskCheck],
    queryFn: () => fetchLessonTaskMeta(lessonIdForTaskCheck!),
    enabled: Boolean(lessonIdForTaskCheck),
  })

  useEffect(() => {
    const id = taskMetaQuery.data?.language_id
    if (id != null) setIdeLanguageId(id)
  }, [taskMetaQuery.data?.language_id])

  const handleCheckQuiz = (blockIndex: number) => {
    const answer = quizAnswers[blockIndex]
    message.success(`Ответ "${(answer ?? '—').toUpperCase()}" отправлен на проверку`)
  }

  const handleSendMaterialAsJson = async (block: Extract<LessonContentBlock, { type: 'ide' }>) => {
    if (!getAccessToken()) {
      message.warning('Войдите в систему, чтобы отправить код на проверку.')
      return
    }
    if (!lessonId) {
      message.error('Не выбран урок')
      return
    }
    setCheckSubmitting(true)
    try {
      let meta = taskMetaQuery.data ?? null
      if (!meta) {
        meta = await fetchLessonTaskMeta(lessonIdForTaskCheck ?? lessonId)
        if (meta) {
          void queryClient.setQueryData(['lesson-task-meta', lessonIdForTaskCheck], meta)
        }
      }
      if (!meta) {
        message.error('Для этого урока нет задачи в БД (tasks). Добавьте задачу или проверьте курс.')
        return
      }
      const code = ideCode || block.template || lessonContent?.ideTemplate || ''
      if (!code.trim()) {
        message.warning('Введите код в редакторе')
        return
      }
      const res = await submitTaskCheck(meta.task_id, code, ideLanguageId)
      setTaskCheckResult(res)
      setTaskCheckHttpError(null)
      if (res.status === 'success') {
        if (res.already_solved) {
          message.success('Решение уже было засчитано ранее')
        } else {
          message.success('Задача принята')
        }
        void queryClient.invalidateQueries({ queryKey: ['student-snapshot'] })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка сети'
      message.error(msg)
      const details = e instanceof ApiError ? { code: e.code, details: e.details } : {}
      setTaskCheckResult(null)
      setTaskCheckHttpError(JSON.stringify({ error: msg, ...details }, null, 2))
    } finally {
      setCheckSubmitting(false)
    }
  }

  const renderBlock = (block: LessonContentBlock, idx: number) => {
    if (block.type === 'text') {
      return (
        <Typography.Paragraph key={`text-${idx}`}>
          {block.text}
        </Typography.Paragraph>
      )
    }
    if (block.type === 'video') {
      return (
        <div className="lesson-inline-video" key={`video-${idx}`}>
          <iframe
            src={block.embedUrl}
            title={`${lesson?.title ?? 'Lesson'} video ${idx + 1}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )
    }
    if (block.type === 'quiz') {
      return (
        <Card className="neo-card" key={`quiz-${idx}`} size="small">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{block.title ?? 'Викторина'}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{block.question}</Typography.Paragraph>
            <Radio.Group
              value={quizAnswers[idx] ?? 'a'}
              onChange={(e) => setQuizAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
            >
              <Space direction="vertical">
                {block.options.map((option, optionIndex) => (
                  <Radio value={String.fromCharCode(97 + optionIndex)} key={`${idx}-${option}`}>
                    {String.fromCharCode(65 + optionIndex)}. {option}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            <Button type="primary" className="neo-gradient-button" onClick={() => handleCheckQuiz(idx)}>
              Проверить тест
            </Button>
          </Space>
        </Card>
      )
    }
    if (block.type === 'ide') {
      const initialCode = ideCode || block.template || lessonContent?.ideTemplate || ''
      const rows = Math.max(8, initialCode.split('\n').length)
      return (
        <Card className="neo-card" key={`ide-${idx}`} size="small">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{block.title ?? 'IDE-задание'}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {block.task ?? lessonContent?.ideTask ?? 'Задача для IDE пока не добавлена в БД.'}
            </Typography.Paragraph>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Space align="center" wrap>
                <Typography.Text type="secondary">Язык (Judge0):</Typography.Text>
                <Select
                  value={ideLanguageId}
                  style={{ minWidth: 220 }}
                  options={JUDGE0_IDE_LANGUAGES.map((o) => ({ value: o.value, label: `${o.label} (#${o.value})` }))}
                  onChange={(v) => setIdeLanguageId(v)}
                />
              </Space>
              {taskMetaQuery.isLoading ? (
                <Typography.Text type="secondary">Загрузка метаданных задачи…</Typography.Text>
              ) : taskMetaQuery.isError ? (
                <Typography.Text type="danger">
                  Ошибка загрузки меты:{' '}
                  {taskMetaQuery.error instanceof Error ? taskMetaQuery.error.message : 'запрос не удался'}
                </Typography.Text>
              ) : taskMetaQuery.data ? (
                <Typography.Text type="secondary">
                  Задача: <Typography.Text code>{taskMetaQuery.data.task_id}</Typography.Text>
                  {taskMetaQuery.data.language_id !== ideLanguageId ? (
                    <Typography.Text type="warning">
                      {' '}
                      Язык не совпадает с задачей в БД — нужен language_id {taskMetaQuery.data.language_id}.
                    </Typography.Text>
                  ) : null}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">
                  Для этого урока нет задачи в БД — проверка недоступна.
                </Typography.Text>
              )}
            </Space>
            <div className="course-ide-shell">
              <div className="course-ide-gutter" aria-hidden>
                {Array.from({ length: rows }, (_, i) => (
                  <div key={`lesson-line-${i + 1}`}>{i + 1}</div>
                ))}
              </div>
              <Input.TextArea
                className="course-ide-textarea"
                autoSize={{ minRows: 10 }}
                value={initialCode}
                onChange={(e) => setIdeCode(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="course-test-cases">
              <Typography.Text strong>Тесты (из БД):</Typography.Text>
              <ul className="sketch-list" style={{ marginTop: 6 }}>
                {block.tests.map((test) => (
                  <li key={`${idx}-${test.input}-${test.expected}`}>
                    <code>{test.input}</code> → <code>{test.expected}</code>
                  </li>
                ))}
              </ul>
            </div>
            <Space>
              <Button
                type="primary"
                className="neo-gradient-button"
                loading={checkSubmitting}
                disabled={
                  (taskMetaQuery.isSuccess && taskMetaQuery.data == null) || taskMetaQuery.isLoading
                }
                onClick={() => void handleSendMaterialAsJson(block)}
              >
                Отправить на проверку (Judge0)
              </Button>
            </Space>
            {taskCheckResult ? (
              <Card size="small" className="neo-card">
                <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>
                  Результат проверки
                </Typography.Text>
                <TaskCheckResultPanel
                  response={taskCheckResult}
                  rawJson={JSON.stringify(taskCheckResult, null, 2)}
                />
              </Card>
            ) : null}
            {taskCheckHttpError ? (
              <Card size="small" className="neo-card">
                <Alert type="error" showIcon message="Запрос к серверу не удался" />
                <Collapse
                  style={{ marginTop: 10 }}
                  size="small"
                  items={[
                    {
                      key: 'err',
                      label: 'Подробности (JSON)',
                      children: <pre className="course-json-preview">{taskCheckHttpError}</pre>,
                    },
                  ]}
                />
              </Card>
            ) : null}
          </Space>
        </Card>
      )
    }
    return null
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="neo-card">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
          {lesson?.title ?? `Урок ${lessonId ?? ''}`}
        </Typography.Title>
        <Typography.Text type="secondary">
          Курс: <Link className="neo-link" to={`/courses/${courseId}`}>{courseQuery.data?.title ?? courseId}</Link>
        </Typography.Text>
        {contentTarget && contentTarget.cid === FREE_COURSE_ID && courseId !== FREE_COURSE_ID ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            Теория и задания ниже — с курса «Бесплатный курс» (заглушка по номеру урока).
          </Typography.Paragraph>
        ) : null}
      </Card>

      <Card className="neo-card" title="Теоретический материал">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {lessonContent?.blocks && lessonContent.blocks.length > 0 ? (
            lessonContent.blocks
              .filter((block) => block.type === 'text' || block.type === 'video')
              .map((block, idx) => renderBlock(block, idx))
          ) : (
            <Typography.Paragraph type="secondary">Контент лекции не заполнен в БД.</Typography.Paragraph>
          )}
        </Space>
      </Card>

      <Card className="neo-card" title="Тестовое задание">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {lessonContent?.blocks && lessonContent.blocks.length > 0 ? (
            lessonContent.blocks
              .filter((block) => block.type === 'quiz' || block.type === 'ide')
              .map((block, idx) => renderBlock(block, idx + 100))
          ) : (
            <Typography.Paragraph type="secondary">Практические блоки не заполнены в БД.</Typography.Paragraph>
          )}
        </Space>
      </Card>
    </Space>
  )
}
