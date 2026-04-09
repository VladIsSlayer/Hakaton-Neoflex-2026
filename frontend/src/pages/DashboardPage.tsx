import { Avatar, Button, Card, Col, Input, Pagination, Progress, Row, Space, Tag, Typography, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { fetchCourseAudienceStats, fetchCourses, fetchStudentSnapshot, enrollInCourse } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'

const MOCK_COURSES = [
  { id: '1', title: 'Python Core', level: 'Junior', progress: 72, skill: 'PY', enrollments: 421, sticker: 'TOP' },
  { id: '2', title: 'SQL Practice', level: 'Middle', progress: 41, skill: 'SQL', enrollments: 388, sticker: 'HIT' },
  { id: '3', title: 'Git & Code Review', level: 'Junior', progress: 88, skill: 'GIT', enrollments: 241, sticker: '' },
  { id: '4', title: 'Data Modeling', level: 'Middle', progress: 36, skill: 'DWH', enrollments: 219, sticker: '' },
  { id: '5', title: 'Go Basics', level: 'Junior', progress: 19, skill: 'GO', enrollments: 203, sticker: '' },
  { id: '6', title: 'API Testing', level: 'Middle', progress: 55, skill: 'QA', enrollments: 176, sticker: '' },
  { id: '7', title: 'CI/CD Pipelines', level: 'Senior', progress: 24, skill: 'CI', enrollments: 164, sticker: '' },
  { id: '8', title: 'System Design', level: 'Senior', progress: 11, skill: 'SYS', enrollments: 151, sticker: '' },
  { id: '9', title: 'Docker Practice', level: 'Middle', progress: 63, skill: 'DOC', enrollments: 147, sticker: '' },
  { id: '10', title: 'Product SQL Cases', level: 'Middle', progress: 27, skill: 'SQL', enrollments: 122, sticker: '' },
  { id: '11', title: 'Async Programming', level: 'Senior', progress: 14, skill: 'ASY', enrollments: 95, sticker: '' },
] as const

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken))
  const user = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState('Все отрасли')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const pageSize = 9
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })
  const studentQuery = useQuery({
    queryKey: ['student-snapshot', 'dashboard-v1'],
    queryFn: fetchStudentSnapshot,
    enabled: isLoggedIn,
  })
  const audienceQuery = useQuery({
    queryKey: ['course-audience-stats'],
    queryFn: fetchCourseAudienceStats,
  })

  const enrollMutation = useMutation({
    mutationFn: enrollInCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student-snapshot'] })
      message.success('Вы записаны на курс')
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 404) {
          message.error('Курс не найден или не опубликован')
          return
        }
        if (e.status === 403) {
          message.error('Запись доступна только студентам')
          return
        }
        message.error(e.message || 'Не удалось записаться')
        return
      }
      message.error('Не удалось записаться')
    },
  })

  const coursesSource = useMemo(() => {
    if (!coursesQuery.data || coursesQuery.data.length === 0) {
      return MOCK_COURSES.map((c) => ({ ...c, isEnrolled: false }))
    }
    const audienceMap = new Map(
      (audienceQuery.data ?? []).map((stat) => [stat.courseId, stat.enrollments])
    )
    const enrollmentMap = new Map(
      (studentQuery.data?.enrolledCourses ?? []).map((course) => [course.courseId, course])
    )
    return coursesQuery.data.map((course, index) => ({
      id: course.id,
      title: course.title,
      level: ['Junior', 'Middle', 'Senior'][index % 3],
      progress: isLoggedIn ? (enrollmentMap.get(course.id)?.progressPercent ?? 0) : 0,
      skill: (course.title.match(/[A-Za-zА-Яа-я]/)?.[0] ?? 'C').toUpperCase(),
      enrollments: audienceMap.get(course.id) ?? 0,
      sticker: index === 0 ? 'TOP' : index === 1 ? 'HIT' : '',
      isEnrolled: enrollmentMap.has(course.id),
    }))
  }, [coursesQuery.data, audienceQuery.data, studentQuery.data?.enrolledCourses, isLoggedIn])

  const filteredCourses = useMemo(
    () =>
      coursesSource.filter((item) =>
        item.title.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [coursesSource, search]
  )
  const pageCourses = useMemo(
    () => filteredCourses.slice((page - 1) * pageSize, page * pageSize),
    [filteredCourses, page]
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Каталог курсов
      </Typography.Title>

      <Space wrap>
        {['Все отрасли', 'Финансы', 'Промышленность', 'Ритейл'].map((filter) => (
          <Button
            key={filter}
            shape="round"
            className={filter === activeFilter ? 'neo-filter-btn neo-filter-btn--active' : 'neo-filter-btn'}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </Button>
        ))}
        <div className={`neo-search-wrap ${searchOpen ? 'neo-search-wrap--open' : ''}`}>
          <Button
            shape="round"
            className={searchOpen ? 'neo-filter-btn neo-filter-btn--active' : 'neo-filter-btn'}
            icon={<SearchOutlined />}
            onClick={() => setSearchOpen((prev) => !prev)}
          >
            {!searchOpen && 'Поиск'}
          </Button>
          <Input
            className="neo-search-input"
            allowClear
            placeholder="Поиск курса"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            onPressEnter={() => setSearchOpen(false)}
          />
        </div>
      </Space>

      <Row gutter={[16, 16]}>
        {pageCourses.map((course) => (
          <Col key={course.id} xs={24} md={12} lg={8}>
            <Card hoverable className="neo-card" onClick={() => navigate(`/courses/${course.id}`)}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <Avatar size={24} className="neo-course-avatar">
                      {course.skill}
                    </Avatar>
                    <Typography.Text strong>{course.title}</Typography.Text>
                  </Space>
                  <Space>
                    {course.sticker && <Tag className="neo-sticker">{course.sticker}</Tag>}
                    <Tag color="#260743">{course.level}</Tag>
                  </Space>
                </Space>
                <Typography.Text type="secondary">Вступили: {course.enrollments}</Typography.Text>
                {isLoggedIn && user?.role === 'student' && !course.isEnrolled ? (
                  <Button
                    size="small"
                    type="primary"
                    className="neo-gradient-button"
                    loading={enrollMutation.isPending && enrollMutation.variables === course.id}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      enrollMutation.mutate(course.id)
                    }}
                  >
                    Записаться на курс
                  </Button>
                ) : isLoggedIn ? (
                  <Progress percent={course.progress} size="small" />
                ) : null}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Pagination
        align="center"
        current={page}
        pageSize={pageSize}
        total={filteredCourses.length}
        onChange={setPage}
        showSizeChanger={false}
      />

      {coursesQuery.isError && (
        <Typography.Text type="secondary">
          Не удалось загрузить курсы из БД, показаны локальные данные.
        </Typography.Text>
      )}
    </Space>
  )
}
