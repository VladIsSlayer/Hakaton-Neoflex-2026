import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  Col,
  Pagination,
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
import {
  fetchCourses,
  fetchProfileTaskStatuses,
  fetchRecentSolutions,
  fetchStudentSnapshot,
} from '@/api/catalog'
import { CompetencyMatrixCharts } from '@/components/CompetencyMatrixCharts'

export function ProfilePage() {
  const [taskPage, setTaskPage] = useState(1)
  const [coursesPage, setCoursesPage] = useState(1)
  const taskPageSize = 5
  const coursesPageSize = 4
  const studentQuery = useQuery({
    queryKey: ['student-snapshot', 'profile-v1'],
    queryFn: fetchStudentSnapshot,
  })
  const taskStatusesQuery = useQuery({
    queryKey: ['profile-task-statuses', 'profile-v1'],
    queryFn: fetchProfileTaskStatuses,
  })
  const recentSolutionsQuery = useQuery({
    queryKey: ['profile-recent-solutions', 'profile-v1'],
    queryFn: fetchRecentSolutions,
  })
  const catalogQuery = useQuery({
    queryKey: ['courses', 'profile-matrix-fallback'],
    queryFn: fetchCourses,
  })
  const activeCourses = useMemo(() => studentQuery.data?.enrolledCourses ?? [], [studentQuery.data?.enrolledCourses])

  const competencyMatrixRows = useMemo(() => {
    const fromSnap = studentQuery.data?.matrixCourses ?? []
    if (fromSnap.length > 0) return fromSnap
    const published = (catalogQuery.data ?? []).filter((c) => c.is_published !== false)
    const pubSix = published.slice(0, 6)
    const progById = new Map(
      (studentQuery.data?.enrolledCourses ?? []).map((e) => [e.courseId, e.progressPercent])
    )
    return pubSix.map((c) => ({
      courseId: c.id,
      courseTitle: c.title,
      progressPercent: progById.get(c.id) ?? 0,
    }))
  }, [studentQuery.data?.matrixCourses, studentQuery.data?.enrolledCourses, catalogQuery.data])

  const matrixUsesCatalogFallback = useMemo(() => {
    const fromSnap = studentQuery.data?.matrixCourses ?? []
    return fromSnap.length === 0 && competencyMatrixRows.length > 0
  }, [studentQuery.data?.matrixCourses, competencyMatrixRows.length])
  const pagedActiveCourses = useMemo(
    () => activeCourses.slice((coursesPage - 1) * coursesPageSize, coursesPage * coursesPageSize),
    [activeCourses, coursesPage]
  )
  const pagedTaskStatuses = useMemo(
    () => (taskStatusesQuery.data ?? []).slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize),
    [taskStatusesQuery.data, taskPage]
  )
  const stats = useMemo(() => {
    const activeCount = activeCourses.length
    const inReview = taskStatusesQuery.data?.filter((row) => row.status !== 'Принято' && row.status !== 'Отклонено').length ?? 0
    const avgProgress = activeCount > 0
      ? Math.round(activeCourses.reduce((sum, course) => sum + course.progressPercent, 0) / activeCount)
      : 0
    const weekly = recentSolutionsQuery.data?.length ?? 0
    return { activeCount, inReview, avgProgress, weekly }
  }, [activeCourses, taskStatusesQuery.data, recentSolutionsQuery.data])
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
  const userRole = studentQuery.data?.user?.role ?? 'student'
  const roleLabel = userRole === 'moderator' ? 'Модератор' : 'Студент'
  const tgConnected = Boolean(studentQuery.data?.user?.tg_chat_id)

  return (
    <Space className="profile-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Row align="middle" gutter={[16, 16]}>
          <Col>
            <Avatar size={72} icon={<UserOutlined />} />
          </Col>
          <Col flex="auto">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {studentQuery.data?.user?.full_name ?? 'Иван Петров'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {studentQuery.data?.user?.email ?? 'student@neoflex.demo'}
            </Typography.Text>
            <br />
            <Tag color="#1e084d" style={{ marginTop: 8 }}>
              {roleLabel}
            </Tag>
          </Col>
          <Col>
            {!tgConnected ? (
              <Button className="neo-purple-btn">
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
        <Col xs={24} xl={14} style={{ display: 'flex' }}>
          <Card className="profile-equal-card" title="Статусы заданий (куратор / итог)" style={{ width: '100%' }}>
            <Table
              rowKey={(row) => `${row.course}-${row.task}`}
              columns={columns}
              dataSource={pagedTaskStatuses.map((row) => ({ ...row }))}
              pagination={false}
              size="small"
            />
            <Pagination
              style={{ marginTop: 12 }}
              align="center"
              current={taskPage}
              pageSize={taskPageSize}
              total={(taskStatusesQuery.data ?? []).length}
              onChange={setTaskPage}
              showSizeChanger={false}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10} style={{ display: 'flex' }}>
          <Card className="profile-equal-card" title="Активные курсы" style={{ width: '100%' }}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              {pagedActiveCourses.map((course) => (
                <div key={course.courseId}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text strong>{course.courseTitle}</Typography.Text>
                    <Link className="neo-link" to={`/courses/${course.courseId}`}>
                      Открыть
                    </Link>
                  </Space>
                  <Progress percent={Math.max(0, Math.min(100, course.progressPercent))} size="small" />
                </div>
              ))}
              {activeCourses.length === 0 && <Typography.Text type="secondary">Нет активных курсов.</Typography.Text>}
              {activeCourses.length > 0 && (
                <Pagination
                  align="center"
                  current={coursesPage}
                  pageSize={coursesPageSize}
                  total={activeCourses.length}
                  onChange={setCoursesPage}
                  showSizeChanger={false}
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Матрица компетенций">
            <CompetencyMatrixCharts
              matrixCourses={competencyMatrixRows}
              catalogFallbackHint={matrixUsesCatalogFallback}
              competencyCount={(studentQuery.data?.competencies ?? []).length}
              averageLevel={studentQuery.data?.averageCompetencyLevel ?? 0}
              totalInCatalog={studentQuery.data?.totalCompetenciesInCatalog ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Последние решения">
            {recentSolutionsQuery.data && recentSolutionsQuery.data.length > 0 ? (
              <ul className="sketch-list">
                {recentSolutionsQuery.data.map((item) => (
                  <li key={item.id}>
                    {item.title} · {item.courseTitle} · {item.status}
                  </li>
                ))}
              </ul>
            ) : (
              <Typography.Text type="secondary">Нет решений в БД.</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
