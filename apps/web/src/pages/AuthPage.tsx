import { Button, Card, Col, Form, Input, Row, Space, Tabs, Typography, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/shared/api/client'
import { useAuthStore, type AuthUser } from '@/features/auth/model/authStore'

type AuthTokenResponse = {
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
      const data = await apiFetch<AuthTokenResponse>('/api/auth/login', {
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

  const onRegister = async (values: {
    register_email: string
    full_name: string
    register_password: string
    register_password_repeat: string
  }) => {
    try {
      const data = await apiFetch<AuthTokenResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: values.register_email.trim(),
          full_name: values.full_name.trim(),
          password: values.register_password,
        }),
      })
      setSession(data.access_token, data.user)
      await queryClient.invalidateQueries()
      message.success('Регистрация прошла успешно')
      navigate('/profile')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409 || e.code === 'conflict') {
          message.error('Этот email уже зарегистрирован')
          return
        }
        if (e.status === 400) {
          message.error(e.message || 'Проверьте введённые данные')
          return
        }
        message.error(e.message || 'Ошибка регистрации')
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
              Вход и регистрация через backend (JWT). Новые пользователи получают роль студента.
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
                    <Form layout="vertical" onFinish={onRegister}>
                      <Form.Item
                        label="Email"
                        name="register_email"
                        rules={[{ required: true, type: 'email', message: 'Укажите корректный email' }]}
                      >
                        <Input placeholder="student@example.com" autoComplete="email" />
                      </Form.Item>
                      <Form.Item
                        label="ФИО"
                        name="full_name"
                        rules={[{ required: true, message: 'Укажите имя' }]}
                      >
                        <Input placeholder="Иван Иванов" autoComplete="name" />
                      </Form.Item>
                      <Form.Item
                        label="Пароль"
                        name="register_password"
                        rules={[
                          { required: true, message: 'Введите пароль' },
                          { min: 8, message: 'Не менее 8 символов' },
                        ]}
                      >
                        <Input.Password placeholder="••••••••" autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item
                        label="Повтор пароля"
                        name="register_password_repeat"
                        dependencies={['register_password']}
                        rules={[
                          { required: true, message: 'Повторите пароль' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('register_password') === value) {
                                return Promise.resolve()
                              }
                              return Promise.reject(new Error('Пароли не совпадают'))
                            },
                          }),
                        ]}
                      >
                        <Input.Password placeholder="••••••••" autoComplete="new-password" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" className="neo-gradient-button">
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
