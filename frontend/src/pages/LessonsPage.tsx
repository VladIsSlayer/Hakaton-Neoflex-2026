import { Link } from 'react-router-dom'
import { Avatar, Button, Card, Input, List, Pagination, Progress, Space, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'

const MOCK_LESSONS = [
  { id: 'l1', title: 'SQL: JOIN и агрегации', course: 'SQL Practice', status: 'в процессе', badge: 'SQL' },
  { id: 'l2', title: 'Python: списки и словари', course: 'Python Core', status: 'не начат', badge: 'PY' },
  { id: 'l3', title: 'Git: rebase и merge', course: 'Git & Code Review', status: 'в процессе', badge: 'GIT' },
  { id: 'l4', title: 'Go: goroutine', course: 'Go Basics', status: 'не начат', badge: 'GO' },
  { id: 'l5', title: 'Docker: multi-stage build', course: 'Docker Practice', status: 'в процессе', badge: 'DOC' },
  { id: 'l6', title: 'SQL: оконные функции', course: 'Product SQL Cases', status: 'не начат', badge: 'SQL' },
  { id: 'l7', title: 'CI: workflow jobs', course: 'CI/CD Pipelines', status: 'не начат', badge: 'CI' },
] as const

/** Агрегатор «продолжить обучение»: последний урок, список в процессе */
export function LessonsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredLessons = useMemo(
    () =>
      MOCK_LESSONS.filter((item) =>
        `${item.title} ${item.course}`.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [search]
  )

  const pageLessons = useMemo(
    () => filteredLessons.slice((page - 1) * pageSize, page * pageSize),
    [filteredLessons, page]
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="neo-banner neo-banner--continue">
        <Space style={{ justifyContent: 'space-between', width: '100%' }} align="center">
          <Space>
            <Avatar size={24} className="neo-course-avatar">
              SQL
            </Avatar>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Продолжить с места остановки
              </Typography.Title>
              <Typography.Text type="secondary">SQL Practice · Урок 4: JOIN и подзапросы</Typography.Text>
            </div>
          </Space>
          <Button type="primary" className="neo-gradient-button neo-gradient-button--compact">
            <Link to="/courses/sample-course-id/lessons/sample-lesson-id">Открыть урок</Link>
          </Button>
        </Space>
      </Card>

      <Card className="neo-banner neo-banner--promo">
        <Typography.Title className="neo-promo-title" level={2} style={{ marginTop: 0, color: '#ececed' }}>
          Инфраструктура и пайплайны
        </Typography.Title>
        <Typography.Paragraph className="neo-promo-subtitle" style={{ color: '#ececed', marginBottom: 0 }}>
          Практика CI/CD, Docker и инфраструктурных пайплайнов для продакшн-среды.
        </Typography.Paragraph>
        <div className="neo-banner-promo__cta">
          <Button type="primary" className="neo-gradient-button">
            Попробовать
          </Button>
        </div>
      </Card>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Поиск лекций и курсов"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
      />

      <List
        className="neo-list"
        dataSource={pageLessons}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button key={`open-${item.id}`} type="primary" size="small" className="neo-gradient-button">
                <Link to="/courses/sample-course-id/lessons/sample-lesson-id">Открыть</Link>
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <div style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                      <Avatar size={22} className="neo-course-avatar">
                        {item.badge}
                      </Avatar>
                      <Typography.Text>{item.title}</Typography.Text>
                    </Space>
                    <Tag color={item.status === 'в процессе' ? '#1e084d' : '#6b1cc8'}>{item.status}</Tag>
                  </Space>
                </div>
              }
              description={
                <div style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text type="secondary">{item.course}</Typography.Text>
                    <Typography.Text type="secondary">{
                      item.status === 'в процессе' ? '63%' : '0%'
                    }</Typography.Text>
                  </Space>
                  <Progress
                    percent={item.status === 'в процессе' ? 63 : 0}
                    showInfo={false}
                    size="small"
                    style={{ marginTop: 6 }}
                  />
                </div>
              }
            />
          </List.Item>
        )}
      />

      <Pagination
        align="center"
        current={page}
        pageSize={pageSize}
        total={filteredLessons.length}
        onChange={setPage}
        showSizeChanger={false}
      />
    </Space>
  )
}
