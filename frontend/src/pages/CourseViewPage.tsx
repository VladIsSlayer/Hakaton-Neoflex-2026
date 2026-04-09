import { Link, useParams } from 'react-router-dom'
import { Avatar, Button, Card, Col, Input, Progress, Radio, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchCourseById, fetchLessonsByCourse, fetchLessonProgressForStudent } from '@/api/catalog'

export function CourseViewPage() {
  const { courseId } = useParams()
  const [quizValue, setQuizValue] = useState<string>('a')
  const [language, setLanguage] = useState<'sql' | 'python' | 'go' | 'javascript'>('sql')
  const [ideCode, setIdeCode] = useState<string>(
    '-- Решите задачу:\n' +
      '-- Верните сумму всех чисел из входного массива.\n' +
      '-- Пример: [1, 2, 3] -> 6\n\n' +
      'function solve(input) {\n' +
      '  // your code here\n' +
      '  return 0\n' +
      '}\n'
  )
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
  const isServiceDemoCourse = (courseQuery.data?.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === 'course 4'
  const visibleIdeLines = Math.max(8, ideCode.split('\n').length)

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

  const handleCheckQuiz = () => {
    message.success(`Ответ викторины "${quizValue.toUpperCase()}" отправлен на проверку`)
  }

  const handleSendMaterialAsJson = () => {
    const payload = {
      courseId,
      lessonId: lessonRows[0]?.id ?? null,
      quizAnswer: quizValue,
      language,
      code: ideCode,
      tests: [
        { input: '[1,2,3]', expected: '6' },
        { input: '[10,-5,7]', expected: '12' },
        { input: '[]', expected: '0' },
      ],
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

      {isServiceDemoCourse && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card className="neo-card" title="Контрольное задание курса">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Typography.Text strong>Часть 1: Викторина</Typography.Text>
                <Radio.Group value={quizValue} onChange={(e) => setQuizValue(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="a">A. Настроить CI с линтером и тестами</Radio>
                    <Radio value="b">B. Удалить пайплайн и деплоить вручную</Radio>
                    <Radio value="c">C. Запускать проверки только по пятницам</Radio>
                  </Space>
                </Radio.Group>
                <Button type="primary" className="neo-gradient-button" onClick={handleCheckQuiz}>
                  Проверить викторину
                </Button>

                <Typography.Text strong>Часть 2: Практика в IDE</Typography.Text>
                <Card size="small" className="neo-card">
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Typography.Text>
                      <strong>Задача:</strong> реализуйте функцию <code>solve(input)</code>, которая возвращает сумму
                      элементов массива.
                    </Typography.Text>
                    <div className="course-test-cases">
                      <Typography.Text strong>Тесты (input → output):</Typography.Text>
                      <ul className="sketch-list" style={{ marginTop: 6 }}>
                        <li><code>[1, 2, 3]</code> → <code>6</code></li>
                        <li><code>[10, -5, 7]</code> → <code>12</code></li>
                        <li><code>[]</code> → <code>0</code></li>
                      </ul>
                    </div>
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
                          <div key={`line-${i + 1}`}>{i + 1}</div>
                        ))}
                      </div>
                      <Input.TextArea
                        className="course-ide-textarea"
                        autoSize={{ minRows: 10 }}
                        value={ideCode}
                        onChange={(e) => setIdeCode(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </Space>
                </Card>
                <Space>
                  <Button type="primary" className="neo-gradient-button" onClick={handleSendMaterialAsJson}>
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
          </Col>
          <Col xs={24} lg={10}>
            <Card className="neo-card" title="Видео (по необходимости)">
              <div className="course-demo-video-placeholder">
                <Typography.Text type="secondary">Поле для видео-лекции / разбора задания</Typography.Text>
              </div>
              <Space direction="vertical" style={{ marginTop: 12, width: '100%' }}>
                <Typography.Link href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
                  Видео 1: Вводная лекция
                </Typography.Link>
                <Typography.Link href="https://www.youtube.com/watch?v=9bZkp7q19f0" target="_blank">
                  Видео 2: Разбор практики
                </Typography.Link>
                <Typography.Link href="https://www.youtube.com/watch?v=J---aiyznGQ" target="_blank">
                  Видео 3: Контрольное задание
                </Typography.Link>
                <Typography.Link href="https://www.youtube.com/watch?v=3GwjfUFyY6M" target="_blank">
                  Видео 4: Частые ошибки
                </Typography.Link>
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  )
}
