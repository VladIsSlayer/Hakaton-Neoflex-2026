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
import { useState } from 'react'

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
            <Statistic title="Активных курсов" value={3} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="На проверке" value={1} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Средний прогресс" value={72} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Решений за неделю" value={12} />
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
              <div>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Typography.Text strong>NeoFlex Bootcamp</Typography.Text>
                  <Link className="neo-link" to="/courses/sample-course-id">
                    Открыть
                  </Link>
                </Space>
                <Progress percent={65} size="small" />
              </div>
              <div>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Typography.Text strong>DevOps трек</Typography.Text>
                  <Link className="neo-link" to="/courses/sample-course-id">
                    Открыть
                  </Link>
                </Space>
                <Progress percent={20} size="small" />
              </div>
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
