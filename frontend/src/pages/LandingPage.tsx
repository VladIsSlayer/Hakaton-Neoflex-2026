import { Button, Card, Col, Progress, Row, Space, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCourses, fetchLessons } from '@/api/catalog'

const SERVICE_GROUPS = [
  {
    title: 'Курсы: разработка',
    items: ['Backend на микросервисах', 'Web-разработка', 'Мобильные приложения', 'Интеграция ИТ-систем'],
  },
  {
    title: 'Искусственный интеллект и LLM',
    items: ['AI Ready-консалтинг', 'Generative AI', 'Data Science'],
  },
  {
    title: 'Платформы данных',
    items: ['DWH и Enterprise Data Lake', 'Data Engineering', 'Data Governance'],
  },
] as const

function getTrailingNumber(value: string): number | null {
  const match = value.match(/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

export function LandingPage() {
  const navigate = useNavigate()
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
  })

  const recentCourse = coursesQuery.data && coursesQuery.data.length > 0
    ? coursesQuery.data[coursesQuery.data.length - 1]
    : null
  const recentCourseLessons = lessonsQuery.data?.filter((lesson) => lesson.course_id === recentCourse?.id) ?? []
  const completedModules = recentCourseLessons.length > 0 ? Math.ceil(recentCourseLessons.length * 0.67) : 0
  const progressPercent = recentCourseLessons.length > 0
    ? Math.min(100, Math.round((completedModules / recentCourseLessons.length) * 100))
    : 0

  const sortedCourses = [...(coursesQuery.data ?? [])].sort((a, b) => {
    const aNum = getTrailingNumber(a.title)
    const bNum = getTrailingNumber(b.title)
    if (aNum !== null && bNum !== null) return aNum - bNum
    return a.title.localeCompare(b.title, 'ru')
  })

  const courseGroups = sortedCourses.length > 0
    ? [{ title: 'Направления', items: sortedCourses.slice(0, 6).map((course) => course.title) }]
    : SERVICE_GROUPS

  return (
    <Space className="landing-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="hero-card neo-banner neo-hero-fullscreen">
        <Typography.Title className="neo-hero-title" level={1} style={{ marginTop: 0 }}>
          NEO EDU
        </Typography.Title>
        <Typography.Paragraph className="neo-hero-subtitle">
          Платформа развития ИТ-компетенций в корпоративном формате.
        </Typography.Paragraph>
        <Button type="primary" size="large" className="neo-gradient-button neo-gradient-button--hero">
          <Link to="/dashboard">Перейти к курсам</Link>
        </Button>
      </Card>

      <Card
        className="neo-card neo-last-course-banner"
        hoverable
        onClick={() => recentCourse?.id && navigate(`/courses/${recentCourse.id}`)}
      >
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          {recentCourse?.title ?? 'Последний курс'}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 8 }}>
          M&G: {completedModules}/{recentCourseLessons.length} модулей
        </Typography.Paragraph>
        <Progress percent={progressPercent} showInfo={false} strokeColor={{ from: '#ff7a00', to: '#ff2f92' }} />
      </Card>

      <Typography.Title level={3} style={{ margin: '8px 0 0', textAlign: 'center' }}>
        Курсы
      </Typography.Title>
      {courseGroups.map((group) => (
        <div key={group.title}>
          <Typography.Title level={5} style={{ textAlign: 'center', marginBottom: 12 }}>
            {group.title}
          </Typography.Title>
          <Row gutter={[12, 12]}>
            {group.items.map((item) => (
              <Col key={item} xs={24} sm={12}>
                <Card
                  className="neo-service-tile"
                  hoverable
                  onClick={() => {
                    const selected = sortedCourses.find((c) => c.title === item)
                    if (selected?.id) navigate(`/courses/${selected.id}`)
                  }}
                >
                  <Typography.Text className="neo-service-tile__text neo-service-tile__text--base">
                    {item}
                  </Typography.Text>
                  <Typography.Text className="neo-service-tile__desc">
                    Курс с практикой и кейсами. Научитесь применять навыки в реальных задачах команды.
                  </Typography.Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}

      {coursesQuery.isError && <Typography.Text type="secondary">Не удалось загрузить данные курсов.</Typography.Text>}
    </Space>
  )
}
