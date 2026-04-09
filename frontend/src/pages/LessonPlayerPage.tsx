import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, Input, Radio, Select, Space, Typography, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { fetchCourseById, fetchLessonContentConfig, fetchLessonsByCourse, type LessonContentBlock } from '@/api/catalog'

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams()
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [language, setLanguage] = useState<'sql' | 'python' | 'go' | 'javascript'>('sql')
  const [ideCode, setIdeCode] = useState('')
  const [backendResponsePreview, setBackendResponsePreview] = useState<string>('')

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
  const lessonContentQuery = useQuery({
    queryKey: ['lesson-content', courseId, lessonId],
    queryFn: () => fetchLessonContentConfig(courseId ?? '', lessonId ?? ''),
    enabled: Boolean(courseId && lessonId),
  })

  const lesson = useMemo(
    () => (courseLessonsQuery.data ?? []).find((item) => item.id === lessonId) ?? null,
    [courseLessonsQuery.data, lessonId]
  )
  const lessonContent = lessonContentQuery.data

  const handleCheckQuiz = (blockIndex: number) => {
    const answer = quizAnswers[blockIndex]
    message.success(`Ответ "${(answer ?? '—').toUpperCase()}" отправлен на проверку`)
  }

  const handleSendMaterialAsJson = (block: Extract<LessonContentBlock, { type: 'ide' }>, blockIndex: number) => {
    const payload = {
      courseId: courseId ?? null,
      lessonId: lessonId ?? null,
      blockIndex,
      language,
      task: block.task ?? lessonContent?.ideTask ?? null,
      code: ideCode || block.template || lessonContent?.ideTemplate || '',
      tests: block.tests,
      quizAnswers,
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
                onClick={() => handleSendMaterialAsJson(block, idx)}
              >
                Проверить ответ (JSON)
              </Button>
              <Button className="neo-purple-btn">Отправить на проверку</Button>
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
      <Card className="neo-card">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
          {lesson?.title ?? `Урок ${lessonId ?? ''}`}
        </Typography.Title>
        <Typography.Text type="secondary">
          Курс: <Link className="neo-link" to={`/courses/${courseId}`}>{courseQuery.data?.title ?? courseId}</Link>
        </Typography.Text>
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
