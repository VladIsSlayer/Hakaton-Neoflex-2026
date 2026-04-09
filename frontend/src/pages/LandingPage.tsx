import { Button, Card, Col, Progress, Row, Space, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

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

export function LandingPage() {
  const navigate = useNavigate()
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

      <Card className="neo-card neo-last-course-banner" hoverable onClick={() => navigate('/courses/sample-course-id')}>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          SQL для аналитики и продуктовых команд
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 8 }}>
          M&G: 4/6 модулей
        </Typography.Paragraph>
        <Progress percent={67} showInfo={false} strokeColor={{ from: '#ff7a00', to: '#ff2f92' }} />
      </Card>

      <Typography.Title level={3} style={{ margin: '8px 0 0', textAlign: 'center' }}>
        Курсы
      </Typography.Title>
      {SERVICE_GROUPS.map((group) => (
        <div key={group.title}>
          <Typography.Title level={5} style={{ textAlign: 'center', marginBottom: 12 }}>
            {group.title}
          </Typography.Title>
          <Row gutter={[12, 12]}>
            {group.items.map((item) => (
              <Col key={item} xs={24} sm={12}>
                <Card className="neo-service-tile" hoverable onClick={() => navigate('/courses/sample-course-id')}>
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
    </Space>
  )
}
