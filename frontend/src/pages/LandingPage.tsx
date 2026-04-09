import { Button, Card, Col, Progress, Row, Space, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCourses, fetchLessons, fetchStudentSnapshot } from '@/api/catalog'
import { bannerSrcForCourse } from '@/constants/courseBanners'
import { FREE_COURSE_BANNER_SRC, FREE_COURSE_ID } from '@/constants/freeCourse'
import type { CSSProperties } from 'react'
import { useAuthStore } from '@/stores/authStore'

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
    items: ['DWH и Enterprise Data Lake', 'Data Engineering', 'Качество данных'],
  },
] as const

function getTrailingNumber(value: string): number | null {
  const match = value.match(/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

export function LandingPage() {
  const navigate = useNavigate()
  const coursesQuery = useQuery({
    queryKey: ['courses', 'landing-v2'],
    queryFn: fetchCourses,
    refetchOnMount: 'always',
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons', 'landing-v2'],
    queryFn: fetchLessons,
    refetchOnMount: 'always',
  })
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken))
  const studentQuery = useQuery({
    queryKey: ['student-snapshot', 'landing-v1', isAuthenticated],
    queryFn: fetchStudentSnapshot,
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  })

  /** Центральная карточка всегда про бесплатный демо-курс, независимо от аккаунта. */
  const freeCourse =
    coursesQuery.data?.find((c) => c.id === FREE_COURSE_ID) ?? coursesQuery.data?.[0] ?? null
  const enrollmentInFree = studentQuery.data?.enrolledCourses?.find(
    (e) => e.courseId === freeCourse?.id
  )
  const freeCourseLessons =
    lessonsQuery.data?.filter((lesson) => lesson.course_id === freeCourse?.id) ?? []
  const completedModules = enrollmentInFree?.lessonsCompleted ?? 0
  const progressPercent = enrollmentInFree?.progressPercent ?? 0

  const sortedCourses = [...(coursesQuery.data ?? [])].sort((a, b) => {
    const aNum = getTrailingNumber(a.title)
    const bNum = getTrailingNumber(b.title)
    if (aNum !== null && bNum !== null) return aNum - bNum
    return a.title.localeCompare(b.title, 'ru')
  })

  const directionCourses = sortedCourses.length > 0 ? sortedCourses.slice(0, 6) : []
  const courseGroups =
    sortedCourses.length > 0
      ? [{ title: 'Направления', items: directionCourses.map((c) => c.title) }]
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
        className="neo-last-course-banner neo-last-course-banner--free-course"
        hoverable
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(38, 7, 67, 0.9) 0%, rgba(30, 8, 77, 0.78) 50%, rgba(38, 7, 67, 0.62) 100%), url(${encodeURI(FREE_COURSE_BANNER_SRC)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        onClick={() => freeCourse?.id && navigate(`/courses/${freeCourse.id}`)}
      >
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          {freeCourse?.title ?? 'Бесплатный курс'}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 8 }}>
          {freeCourse?.description ?? 'Описание курса пока не заполнено в БД.'}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 8 }}>
          Модули: {completedModules}/{enrollmentInFree?.lessonsTotal ?? freeCourseLessons.length}
          {isAuthenticated && !enrollmentInFree ? ' · Запишитесь на курс в каталоге, чтобы сохранять прогресс' : null}
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
            {group.title === 'Направления' && directionCourses.length > 0
              ? directionCourses.map((course) => (
                  <Col key={course.id} xs={24} sm={12}>
                    <Card
                      className="neo-service-tile neo-service-tile--banner"
                      hoverable
                      style={
                        {
                          '--neo-tile-banner': `url(${encodeURI(bannerSrcForCourse(course))})`,
                        } as CSSProperties
                      }
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <Typography.Text className="neo-service-tile__text neo-service-tile__text--base">
                        {course.title}
                      </Typography.Text>
                      <Typography.Text className="neo-service-tile__desc">
                        {course.description ?? 'Описание курса пока не заполнено в БД.'}
                      </Typography.Text>
                    </Card>
                  </Col>
                ))
              : group.items.map((item) => (
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
                        {sortedCourses.find((c) => c.title === item)?.description ??
                          'Описание курса пока не заполнено в БД.'}
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
