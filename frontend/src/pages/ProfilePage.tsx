import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCourses, fetchLessons } from '@/api/catalog'

const COURSE_REVIEW_ROWS = [
  {
    course: 'NeoFlex Bootcamp',
    task: 'Практика: SQL-выборка',
    status: 'Ожидает ответа куратора',
    score: '—',
  },
  {
    course: 'NeoFlex Bootcamp',
    task: 'Алгоритмы: сортировка',
    status: 'Принято',
    score: '10',
  },
  {
    course: 'DevOps трек',
    task: 'PR в репозитории',
    status: 'Проверено',
    score: '8',
  },
  {
    course: 'DevOps трек',
    task: 'Конфиг CI',
    status: 'Отклонено',
    score: '0',
  },
] as const

export function ProfilePage() {
  const [telegramConnected, setTelegramConnected] = useState(false)
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
  })

  const activeCourses = useMemo(
    () => (coursesQuery.data ?? []).slice(0, 3),
    [coursesQuery.data]
  )
  const stats = useMemo(() => {
    const activeCount = activeCourses.length
    const inReview = Math.max(0, Math.floor((lessonsQuery.data?.length ?? 0) / 4))
    const avgProgress = activeCount > 0 ? 67 : 0
    const weekly = lessonsQuery.data?.length ?? 0
    return { activeCount, inReview, avgProgress, weekly }
  }, [activeCourses.length, lessonsQuery.data])
  const columns = [
    { title: 'Курс', dataIndex: 'course', key: 'course' },
    { title: 'Задание', dataIndex: 'task', key: 'task' },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => {
        if (value.includes('Отклон')) return <Tag color="#a40f4d">{value}</Tag>
        if (value.includes('Принято')) return <Tag color="#1e084d">{value}</Tag>
        if (value.includes('Проверено')) return <Tag color="#6b1cc8">{value}</Tag>
        return <Tag color="#ff7a00">{value}</Tag>
      },
    },
    { title: 'Итоговый балл', dataIndex: 'score', key: 'score' },
  ]

  return (
    <Space className="profile-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Row align="middle" gutter={[16, 16]}>
          <Col>
            <Avatar size={72} icon={<UserOutlined />} />
          </Col>
          <Col flex="auto">
            <Typography.Title level={4} style={{ margin: 0 }}>
              Иван Петров
            </Typography.Title>
            <Typography.Text type="secondary">ivan.petrov · student@neoflex.demo</Typography.Text>
            <br />
            <Tag color="#1e084d" style={{ marginTop: 8 }}>
              Студент
            </Tag>
          </Col>
          <Col>
            {!telegramConnected ? (
              <Button className="neo-purple-btn" onClick={() => setTelegramConnected(true)}>
                Подключить Telegram
              </Button>
            ) : (
              <Tag color="#1e084d">Telegram подключен</Tag>
            )}
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Активных курсов" value={stats.activeCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="На проверке" value={stats.inReview} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Средний прогресс" value={stats.avgProgress} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Решений за неделю" value={stats.weekly} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            Статусы заданий (куратор / итог)
          </Typography.Title>
          <Table
            rowKey={(row) => `${row.course}-${row.task}`}
            columns={columns}
            dataSource={COURSE_REVIEW_ROWS.map((row) => ({ ...row }))}
            pagination={false}
            size="small"
          />
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Активные курсы">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              {activeCourses.map((course, index) => (
                <div key={course.id}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text strong>{course.title}</Typography.Text>
                    <Link className="neo-link" to={`/courses/${course.id}`}>
                      Открыть
                    </Link>
                  </Space>
                  <Progress percent={Math.max(12, 72 - index * 22)} size="small" />
                </div>
              ))}
              {activeCourses.length === 0 && <Typography.Text type="secondary">Нет активных курсов.</Typography.Text>}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Матрица компетенций">
            <div className="profile-radar-placeholder">
              <Typography.Text type="secondary">Radar chart (скоро)</Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Последние решения">
            <ul className="sketch-list">
              <li>Задача #12 · Python · success · 2 ч назад</li>
              <li>Задача #08 · SQL · failed · вчера</li>
              <li>Задача #03 · Python · success · 3 дня назад</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
