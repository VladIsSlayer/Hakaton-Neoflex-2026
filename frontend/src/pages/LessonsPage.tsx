import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Input, List, Pagination, Progress, Space, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCourseAudienceStats, fetchCourses, fetchLessonProgressForStudent, fetchLessons } from '@/api/catalog'
import { FREE_COURSE_ID } from '@/constants/freeCourse'
import { useAuthStore } from '@/stores/authStore'

/** Агрегатор «продолжить обучение»: последний урок, список в процессе */
export function LessonsPage() {
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const lessonProgressQuery = useQuery({
    queryKey: ['lesson-progress', 'lessons-v2'],
    queryFn: fetchLessonProgressForStudent,
    enabled: isLoggedIn,
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
  })
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })
  const audienceQuery = useQuery({
    queryKey: ['course-audience-stats'],
    queryFn: fetchCourseAudienceStats,
  })

  const lessonsSource = useMemo(() => {
    if (lessonProgressQuery.data && lessonProgressQuery.data.length > 0) {
      return lessonProgressQuery.data.map((item) => ({
        id: item.lessonId,
        courseId: item.courseId,
        title: item.lessonTitle,
        course: item.courseTitle,
        status: item.status,
        badge: (item.lessonTitle.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'L').toUpperCase(),
        progress: item.progressPercent,
        enrollments: 0,
      }))
    }
    const audienceMap = new Map((audienceQuery.data ?? []).map((stat) => [stat.courseId, stat.enrollments]))
    const courseMap = new Map((coursesQuery.data ?? []).map((course) => [course.id, course.title]))
    return (lessonsQuery.data ?? []).map((lesson) => ({
      id: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      course: courseMap.get(lesson.course_id) ?? lesson.course_id,
      status: 'не начат' as const,
      badge: (lesson.title.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'L').toUpperCase(),
      progress: 0,
      enrollments: audienceMap.get(lesson.course_id) ?? 0,
    }))
  }, [lessonProgressQuery.data, audienceQuery.data, lessonsQuery.data, coursesQuery.data])

  const recentLesson = lessonsSource.find((lesson) => lesson.progress > 0) ?? lessonsSource[0]
  const recentCourseTitle = recentLesson?.course ?? 'Курс'
  const recentBadge = (recentCourseTitle.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'L').toUpperCase()

  /** Большой промо-баннер: всегда курс «Бесплатный курс» (FREE_COURSE_ID). */
  const spotlightCourse = useMemo(
    () => coursesQuery.data?.find((c) => c.id === FREE_COURSE_ID) ?? null,
    [coursesQuery.data]
  )
  const spotlightLessons = useMemo(() => {
    return [...(lessonsQuery.data ?? [])]
      .filter((l) => l.course_id === FREE_COURSE_ID)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }, [lessonsQuery.data])
  const spotlightFirstLesson = spotlightLessons[0] ?? null
  const spotlightPromoUrl = `/courses/${FREE_COURSE_ID}`
  const spotlightTitle = spotlightCourse?.title ?? 'Бесплатный курс'
  const spotlightSubtitle = (() => {
    const desc = spotlightCourse?.description?.trim()
    if (desc) return desc
    const body = spotlightFirstLesson?.content_body?.trim()
    if (body) return body.length > 220 ? `${body.slice(0, 217)}…` : body
    return 'Материалы курса и практические задания — начните с первого урока.'
  })()

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
      {isLoggedIn && (
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
      )}

      <Card
        className="neo-banner neo-banner--promo"
        hoverable
        styles={{ body: { cursor: 'pointer' } }}
        onClick={() => navigate(spotlightPromoUrl)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(spotlightPromoUrl)
          }
        }}
        aria-label={`Открыть страницу курса: ${spotlightTitle}`}
      >
        <Typography.Title className="neo-promo-title" level={2} style={{ marginTop: 0, color: '#ececed' }}>
          {spotlightTitle}
        </Typography.Title>
        <Typography.Paragraph className="neo-promo-subtitle" style={{ color: '#ececed', marginBottom: 0 }}>
          {spotlightSubtitle}
        </Typography.Paragraph>
        <div className="neo-banner-promo__cta">
          <Button
            type="primary"
            className="neo-gradient-button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(spotlightPromoUrl)
            }}
          >
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
                <Link to={isLoggedIn && item.courseId ? `/courses/${item.courseId}/lessons/${item.id}` : '/auth?mode=register'}>
                  Открыть
                </Link>
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
                    {isLoggedIn && (
                      <Tag color={item.status === 'в процессе' ? '#1e084d' : '#6b1cc8'}>{item.status}</Tag>
                    )}
                  </Space>
                </div>
              }
              description={
                <div style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text type="secondary">{item.course}</Typography.Text>
                    {isLoggedIn && <Typography.Text type="secondary">{`${item.progress}%`}</Typography.Text>}
                  </Space>
                  {isLoggedIn && (
                    <Progress
                      percent={item.progress}
                      showInfo={false}
                      size="small"
                      style={{ marginTop: 6 }}
                    />
                  )}
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

      {(lessonsQuery.isError || lessonProgressQuery.isError) && (
        <Typography.Text type="secondary">
          Не удалось загрузить лекции из БД, показаны локальные данные.
        </Typography.Text>
      )}
    </Space>
  )
}
