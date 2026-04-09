import { Link } from 'react-router-dom'
import { Avatar, Button, Card, Input, List, Pagination, Progress, Space, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCourses, fetchLessons } from '@/api/catalog'

const MOCK_LESSONS = [
  { id: 'l1', courseId: 'sample-course-id', title: 'SQL: JOIN и агрегации', course: 'SQL Practice', status: 'в процессе', badge: 'SQL' },
  { id: 'l2', courseId: 'sample-course-id', title: 'Python: списки и словари', course: 'Python Core', status: 'не начат', badge: 'PY' },
  { id: 'l3', courseId: 'sample-course-id', title: 'Git: rebase и merge', course: 'Git & Code Review', status: 'в процессе', badge: 'GIT' },
  { id: 'l4', courseId: 'sample-course-id', title: 'Go: goroutine', course: 'Go Basics', status: 'не начат', badge: 'GO' },
  { id: 'l5', courseId: 'sample-course-id', title: 'Docker: multi-stage build', course: 'Docker Practice', status: 'в процессе', badge: 'DOC' },
  { id: 'l6', courseId: 'sample-course-id', title: 'SQL: оконные функции', course: 'Product SQL Cases', status: 'не начат', badge: 'SQL' },
  { id: 'l7', courseId: 'sample-course-id', title: 'CI: workflow jobs', course: 'CI/CD Pipelines', status: 'не начат', badge: 'CI' },
] as const

/** Агрегатор «продолжить обучение»: последний урок, список в процессе */
export function LessonsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
  })

  const lessonsSource = useMemo(() => {
    if (!lessonsQuery.data || lessonsQuery.data.length === 0) return MOCK_LESSONS
    const courseMap = new Map((coursesQuery.data ?? []).map((course) => [course.id, course.title]))
    return lessonsQuery.data.map((lesson, index) => ({
      id: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      course: courseMap.get(lesson.course_id) ?? 'Курс',
      status: index % 2 === 0 ? ('в процессе' as const) : ('не начат' as const),
      badge: (lesson.title.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'L').toUpperCase(),
    }))
  }, [coursesQuery.data, lessonsQuery.data])

  const recentLesson = lessonsSource.length > 0 ? lessonsSource[lessonsSource.length - 1] : undefined
  const recentCourseTitle = recentLesson?.course ?? 'Курс'
  const recentBadge = (recentCourseTitle.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'L').toUpperCase()

  const filteredLessons = useMemo(
    () =>
      lessonsSource.filter((item) =>
        `${item.title} ${item.course}`.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [lessonsSource, search]
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
              {recentBadge}
            </Avatar>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Продолжить с места остановки
              </Typography.Title>
              <Typography.Text type="secondary">
                {recentCourseTitle} · {recentLesson?.title ?? 'Урок'}
              </Typography.Text>
            </div>
          </Space>
          <Button type="primary" className="neo-gradient-button neo-gradient-button--compact">
            <Link to={recentLesson ? `/courses/${recentLesson.courseId}/lessons/${recentLesson.id}` : '/lessons'}>
              Открыть урок
            </Link>
          </Button>
        </Space>
      </Card>

      <Card className="neo-banner neo-banner--promo">
        <Typography.Title className="neo-promo-title" level={2} style={{ marginTop: 0, color: '#ececed' }}>
          {recentCourseTitle}
        </Typography.Title>
        <Typography.Paragraph className="neo-promo-subtitle" style={{ color: '#ececed', marginBottom: 0 }}>
          {recentLesson?.title ?? 'Материалы курса и практические задания из вашей программы обучения.'}
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
                <Link to={item.courseId ? `/courses/${item.courseId}/lessons/${item.id}` : '/lessons'}>Открыть</Link>
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

      {lessonsQuery.isError && (
        <Typography.Text type="secondary">
          Не удалось загрузить лекции из БД, показаны локальные данные.
        </Typography.Text>
      )}
    </Space>
  )
}
