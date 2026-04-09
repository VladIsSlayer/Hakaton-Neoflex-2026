import { Link, useParams } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Col, Collapse, Input, Progress, Radio, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchCourseById,
  fetchCourseContentBlocks,
  fetchLessonProgressForStudent,
  fetchLessonTaskMeta,
  fetchLessonsByCourse,
  submitTaskCheck,
  type LessonContentBlock,
  type TaskCheckResponse,
} from '@/api/catalog'
import { TaskCheckResultPanel } from '@/components/TaskCheckResultPanel'
import { ApiError, getAccessToken } from '@/api/client'
import { JUDGE0_IDE_LANGUAGES } from '@/constants/judge0Languages'

export function CourseViewPage() {
  const { courseId } = useParams()
  const queryClient = useQueryClient()
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [ideCode, setIdeCode] = useState<string>('')
  const [taskCheckResult, setTaskCheckResult] = useState<TaskCheckResponse | null>(null)
  const [taskCheckHttpError, setTaskCheckHttpError] = useState<string | null>(null)
  const [checkSubmitting, setCheckSubmitting] = useState(false)
  /** Должен совпадать с language_id задачи в БД, иначе бэкенд вернёт 400. */
  const [ideLanguageId, setIdeLanguageId] = useState(71)
  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseById(courseId ?? ''),
    enabled: Boolean(courseId),
  })
  const lessonsQuery = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => fetchLessonsByCourse(courseId ?? ''),
    enabled: Boolean(courseId),
  })
  const lessonProgressQuery = useQuery({
    queryKey: ['lesson-progress', courseId],
    queryFn: fetchLessonProgressForStudent,
    enabled: Boolean(courseId),
  })
  const courseBlocksQuery = useQuery({
    queryKey: ['course-content-blocks', courseId],
    queryFn: () => fetchCourseContentBlocks(courseId ?? ''),
    enabled: Boolean(courseId),
  })

  /** Контрольное задание на странице курса — последний урок с задачей (часто итоговая практика). */
  const lessonIdForCourseIde = useMemo(() => {
    const list = lessonsQuery.data ?? []
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].task_id) return list[i].id
    }
    return null
  }, [lessonsQuery.data])

  const courseIdeTaskMetaQuery = useQuery({
    queryKey: ['course-ide-task-meta', courseId, lessonIdForCourseIde],
    queryFn: () => fetchLessonTaskMeta(lessonIdForCourseIde!),
    enabled: Boolean(courseId && lessonIdForCourseIde),
  })

  useEffect(() => {
    const id = courseIdeTaskMetaQuery.data?.language_id
    if (id != null) setIdeLanguageId(id)
  }, [courseIdeTaskMetaQuery.data?.language_id])

  const lessonRows = useMemo(() => {
    const progressMap = new Map(
      (lessonProgressQuery.data ?? [])
        .filter((row) => row.courseId === courseId)
        .map((row) => [row.lessonId, row.progressPercent])
    )
    return (lessonsQuery.data ?? []).map((lesson, index) => {
      const progress = progressMap.get(lesson.id) ?? 0
      const practiceClosed = progress >= 70
      const status = progress === 0 ? 'Не начато' : progress < 100 ? 'В процессе' : 'Завершено'
      const score = practiceClosed ? Math.min(100, 50 + index * 10) : 0
      return {
        key: lesson.id,
        id: lesson.id,
        number: index + 1,
        title: lesson.title,
        progress,
        practice: practiceClosed ? 'Закрыта' : 'Открыта',
        status,
        score,
      }
    })
  }, [courseId, lessonProgressQuery.data, lessonsQuery.data])

  const lessonColumns = [
    { title: '№', dataIndex: 'number', key: 'number', width: 64 },
    {
      title: 'Лекция',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, row: { id: string }) => (
        <Link className="neo-link" to={`/courses/${courseId}/lessons/${row.id}`}>
          {value}
        </Link>
      ),
    },
    {
      title: 'Прогресс',
      dataIndex: 'progress',
      key: 'progress',
      render: (value: number) => (
        <div style={{ minWidth: 150 }}>
          <Progress percent={value} size="small" />
        </div>
      ),
    },
    {
      title: 'Практика',
      dataIndex: 'practice',
      key: 'practice',
      render: (value: string) => <Tag color={value === 'Закрыта' ? '#1e084d' : '#6b1cc8'}>{value}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={value === 'Завершено' ? '#1e084d' : value === 'В процессе' ? '#ff7a00' : '#6b1cc8'}>{value}</Tag>
      ),
    },
    {
      title: 'Оценка',
      dataIndex: 'score',
      key: 'score',
      render: (value: number) => (value > 0 ? `${value}/100` : '—'),
      width: 110,
    },
  ]

  const handleCheckQuiz = (blockIndex: number) => {
    const answer = quizAnswers[blockIndex]
    message.success(`Ответ викторины "${(answer ?? '—').toUpperCase()}" отправлен на проверку`)
  }

  const handleSendMaterialAsJson = async (block: Extract<LessonContentBlock, { type: 'ide' }>) => {
    if (!getAccessToken()) {
      message.warning('Войдите в систему, чтобы отправить код на проверку.')
      return
    }
    if (!lessonIdForCourseIde) {
      message.error('У курса нет урока с задачей в БД — проверка недоступна.')
      return
    }
    setCheckSubmitting(true)
    try {
      let meta = courseIdeTaskMetaQuery.data ?? null
      if (!meta) {
        meta = await fetchLessonTaskMeta(lessonIdForCourseIde)
        if (meta) {
          void queryClient.setQueryData(['course-ide-task-meta', courseId, lessonIdForCourseIde], meta)
        }
      }
      if (!meta) {
        message.error('Не удалось получить метаданные задачи для урока.')
        return
      }
      const code = ideCode || block.template || ''
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
        void queryClient.invalidateQueries({ queryKey: ['lesson-progress', courseId] })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка сети'
      message.error(msg)
      const details =
        e instanceof ApiError ? { code: e.code, details: e.details } : {}
      setTaskCheckResult(null)
      setTaskCheckHttpError(JSON.stringify({ error: msg, ...details }, null, 2))
    } finally {
      setCheckSubmitting(false)
    }
  }

  const renderCourseBlock = (block: LessonContentBlock, idx: number) => {
    if (block.type === 'text') {
      return (
        <Typography.Paragraph key={`course-text-${idx}`}>
          {block.text}
        </Typography.Paragraph>
      )
    }
    if (block.type === 'video') {
      return (
        <div className="lesson-inline-video" key={`course-video-${idx}`}>
          <iframe
            src={block.embedUrl}
            title={`${courseQuery.data?.title ?? 'Course'} video ${idx + 1}`}
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
        <Card key={`course-quiz-${idx}`} className="neo-card" size="small">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{block.title ?? 'Квиз'}</Typography.Text>
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
              Проверить викторину
            </Button>
          </Space>
        </Card>
      )
    }
    if (block.type === 'ide') {
      const currentCode = ideCode || block.template || ''
      const visibleIdeLines = Math.max(8, currentCode.split('\n').length)
      return (
        <Card key={`course-ide-${idx}`} className="neo-card" size="small">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{block.title ?? 'Практика в IDE'}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {block.task ?? 'Задача пока не добавлена в БД.'}
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
              {courseIdeTaskMetaQuery.isLoading ? (
                <Typography.Text type="secondary">Загрузка метаданных задачи…</Typography.Text>
              ) : courseIdeTaskMetaQuery.isError ? (
                <Typography.Text type="danger">
                  Ошибка загрузки меты:{' '}
                  {courseIdeTaskMetaQuery.error instanceof Error
                    ? courseIdeTaskMetaQuery.error.message
                    : 'запрос не удался'}
                </Typography.Text>
              ) : courseIdeTaskMetaQuery.data ? (
                <Typography.Text type="secondary">
                  Задача урока: task_id <Typography.Text code>{courseIdeTaskMetaQuery.data.task_id}</Typography.Text>
                  {courseIdeTaskMetaQuery.data.language_id !== ideLanguageId ? (
                    <>
                      {' '}
                      <Typography.Text type="warning">
                        Выбранный язык не совпадает с задачей в БД — проверка вернёт ошибку. Нужен language_id{' '}
                        {courseIdeTaskMetaQuery.data.language_id}.
                      </Typography.Text>
                    </>
                  ) : null}
                </Typography.Text>
              ) : lessonIdForCourseIde ? (
                <Typography.Text type="secondary">
                  Мета не получена (урок без задачи или курс не опубликован). Проверьте таблицу{' '}
                  <Typography.Text code>tasks</Typography.Text> для этого урока.
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">
                  Нет урока с <Typography.Text code>task_id</Typography.Text> в каталоге курса.
                </Typography.Text>
              )}
            </Space>
            <div className="course-ide-shell">
              <div className="course-ide-gutter" aria-hidden>
                {Array.from({ length: visibleIdeLines }, (_, i) => (
                  <div key={`line-${idx}-${i + 1}`}>{i + 1}</div>
                ))}
              </div>
              <Input.TextArea
                className="course-ide-textarea"
                autoSize={{ minRows: 10 }}
                value={currentCode}
                onChange={(e) => setIdeCode(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="course-test-cases">
              <Typography.Text strong>Тесты (input → output):</Typography.Text>
              <ul className="sketch-list" style={{ marginTop: 6 }}>
                {block.tests.map((test) => (
                  <li key={`${idx}-${test.input}-${test.expected}`}>
                    <code>{test.input}</code> → <code>{test.expected}</code>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              type="primary"
              className="neo-gradient-button"
              loading={checkSubmitting}
              disabled={
                !lessonIdForCourseIde ||
                (courseIdeTaskMetaQuery.isSuccess && courseIdeTaskMetaQuery.data == null) ||
                courseIdeTaskMetaQuery.isLoading
              }
              onClick={() => void handleSendMaterialAsJson(block)}
            >
              Отправить на проверку (Judge0)
            </Button>
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
      <Card className="neo-card course-content-header">
        <Space size={16} align="start">
          <Avatar size={64} className="neo-course-avatar course-content-header__avatar">
            {(courseQuery.data?.title?.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'C').toUpperCase()}
          </Avatar>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
              {courseQuery.data?.title ?? `Курс ${courseId ?? ''}`}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {courseQuery.data?.description ?? 'Описание курса пока не заполнено.'}
            </Typography.Paragraph>
          </div>
        </Space>
      </Card>

      <Card className="neo-card" title="Лекции курса">
        <Table
          rowKey="id"
          columns={lessonColumns}
          dataSource={lessonRows}
          pagination={false}
          size="small"
          locale={{ emptyText: 'Лекции курса пока не добавлены.' }}
        />
      </Card>

      {(courseBlocksQuery.data?.length ?? 0) > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card className="neo-card" title="Контрольное задание курса">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {courseBlocksQuery.data?.map((block, idx) => renderCourseBlock(block, idx))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  )
}
