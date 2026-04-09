import { Button, Card, Col, Form, Input, Row, Space, Tabs, Typography } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const isRegisterMode = useMemo(() => searchParams.get('mode') === 'register', [searchParams])
  const defaultTab = isRegisterMode ? 'register' : 'login'

  return (
    <Row justify="center">
      <Col xs={24} sm={20} md={14} lg={10} xl={8}>
        <Card className="neo-card">
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Вход и регистрация
            </Typography.Title>
            <Typography.Text type="secondary">
              Временная форма для визуальной интеграции. API-логика будет подключена на следующем шаге.
            </Typography.Text>
            <Tabs
              defaultActiveKey={defaultTab}
              items={[
                {
                  key: 'login',
                  label: 'Вход',
                  children: (
                    <Form layout="vertical">
                      <Form.Item label="Email" name="email" rules={[{ required: true }]}>
                        <Input placeholder="student@example.com" />
                      </Form.Item>
                      <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
                        <Input.Password placeholder="••••••••" />
                      </Form.Item>
                      <Space>
                        <Button type="primary" className="neo-gradient-button">
                          Войти
                        </Button>
                        <Button className="neo-purple-btn">Войти через Telegram</Button>
                      </Space>
                    </Form>
                  ),
                },
                {
                  key: 'register',
                  label: 'Регистрация',
                  children: (
                    <Form layout="vertical">
                      <Form.Item label="Email" name="register_email" rules={[{ required: true }]}>
                        <Input placeholder="student@example.com" />
                      </Form.Item>
                      <Form.Item label="Пароль" name="register_password" rules={[{ required: true }]}>
                        <Input.Password placeholder="••••••••" />
                      </Form.Item>
                      <Form.Item
                        label="Повтор пароля"
                        name="register_password_repeat"
                        rules={[{ required: true }]}
                      >
                        <Input.Password placeholder="••••••••" />
                      </Form.Item>
                      <Button type="primary" className="neo-gradient-button">
                        Зарегистрироваться
                      </Button>
                    </Form>
                  ),
                },
              ]}
            />
          </Space>
        </Card>
      </Col>
    </Row>
  )
}
