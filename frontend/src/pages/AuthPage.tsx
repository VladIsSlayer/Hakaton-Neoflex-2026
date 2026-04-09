import { Button, Card, Col, Form, Input, Row, Space, Tabs, Typography, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/api/client'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  const isRegisterMode = useMemo(() => searchParams.get('mode') === 'register', [searchParams])
  const activeTab = isRegisterMode ? 'register' : 'login'

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      })
      setSession(data.access_token, data.user)
      await queryClient.invalidateQueries()
      message.success('Вход выполнен')
      navigate('/profile')
    } catch (e) {
      if (e instanceof ApiError) {
        message.error(e.message || 'Ошибка входа')
        return
      }
      message.error(e instanceof Error ? e.message : 'Сеть недоступна')
    }
  }

  return (
    <Row justify="center">
      <Col xs={24} sm={20} md={14} lg={10} xl={8}>
        <Card className="neo-card">
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Вход и регистрация
            </Typography.Title>
            <Typography.Text type="secondary">
              Авторизация через backend API (JWT). Регистрация появится позже — используйте учётную запись из БД.
            </Typography.Text>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => navigate(`/auth?mode=${key === 'register' ? 'register' : 'login'}`)}
              items={[
                {
                  key: 'login',
                  label: 'Вход',
                  children: (
                    <Form layout="vertical" onFinish={onLogin}>
                      <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
                        <Input placeholder="student@demo.local" autoComplete="email" />
                      </Form.Item>
                      <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
                        <Input.Password placeholder="••••••••" autoComplete="current-password" />
                      </Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" className="neo-gradient-button">
                          Войти
                        </Button>
                        <Button className="neo-purple-btn" disabled>
                          Войти через Telegram
                        </Button>
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
                      <Button type="primary" className="neo-gradient-button" disabled>
                        Зарегистрироваться
                      </Button>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                        Регистрация через API пока не подключена — создайте пользователя в PostgreSQL или попросите
                        администратора.
                      </Typography.Paragraph>
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
