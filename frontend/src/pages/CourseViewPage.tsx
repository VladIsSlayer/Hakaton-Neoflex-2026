import { Link, useParams } from 'react-router-dom'
import { Avatar, Button, Card, Col, Input, Progress, Radio, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchCourseById, fetchCourseContentBlocks, fetchLessonsByCourse, fetchLessonProgressForStudent, type LessonContentBlock } from '@/api/catalog'

export function CourseViewPage() {
  const { courseId } = useParams()
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [language, setLanguage] = useState<'sql' | 'python' | 'go' | 'javascript'>('sql')
  const [ideCode, setIdeCode] = useState<string>('')
  const [backendResponsePreview, setBackendResponsePreview] = useState<string>('')
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

  const handleSendMaterialAsJson = (block: Extract<LessonContentBlock, { type: 'ide' }>, blockIndex: number) => {
    const payload = {
      courseId,
      blockIndex,
      quizAnswers,
      language,
      task: block.task ?? null,
      code: ideCode || block.template || '',
      tests: block.tests,
      sentAt: new Date().toISOString(),
    }
    alert(`DEMO CHECK REQUEST:\n\n${JSON.stringify(payload, null, 2)}`)
    const mockBackendResponse = {
      status: 'queued',
      message: 'Запрос принят. В будущем здесь будет реальный ответ бэка.',
      receivedAt: new Date().toISOString(),
      checks: [
        { name: 'syntax', result: 'pending' },
        { name: 'tests', result: 'pending' },
      ],
    }
    setBackendResponsePreview(JSON.stringify(mockBackendResponse, null, 2))
    message.success('Проверка вызвала alert. Окно ниже зарезервировано под ответ бэка.')
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
            <Space align="center">
              <Typography.Text type="secondary">Язык:</Typography.Text>
              <Select
                value={language}
                style={{ width: 180 }}
                onChange={(value) => setLanguage(value)}
                options={[
                  { value: 'sql', label: 'SQL' },
                  { value: 'python', label: 'Python' },
                  { value: 'go', label: 'Go' },
                  { value: 'javascript', label: 'JavaScript' },
                ]}
              />
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
            <Space>
              <Button type="primary" className="neo-gradient-button" onClick={() => handleSendMaterialAsJson(block, idx)}>
                Проверить ответ (JSON)
              </Button>
              <Button className="neo-purple-btn">Отправить редактору курса</Button>
            </Space>
            {backendResponsePreview && (
              <Card size="small" className="neo-card">
                <Typography.Text strong>Ответ бэка (JSON)</Typography.Text>
                <pre className="course-json-preview">{backendResponsePreview}</pre>
              </Card>
            )}
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
