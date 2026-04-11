import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Space, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/model/authStore'

export function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken))
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = async () => {
    logout()
    await queryClient.invalidateQueries()
    if (location.pathname.startsWith('/profile')) {
      navigate('/')
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    'site-header__nav-link' + (isActive ? ' site-header__nav-link--active' : '')

  return (
    <header className="site-header">
      <div className="site-header__left">
        <NavLink to="/" className="site-header__logo" end>
          NEO EDU
        </NavLink>
        {isAuthenticated && user && (
          <Typography.Text type="secondary" className="site-header__demo-toggle" style={{ marginLeft: 12 }}>
            {user.email}
          </Typography.Text>
        )}
      </div>

      <nav className="site-header__center" aria-label="Основное меню">
        <NavLink to="/" className={navClass} end>
          Главная
        </NavLink>
        <NavLink to="/dashboard" className={navClass}>
          Курсы
        </NavLink>
        <NavLink to="/lessons" className={navClass}>
          Лекции
        </NavLink>
      </nav>

      <div className="site-header__right">
        {isAuthenticated ? (
          <Space size={12}>
            <NavLink to="/profile" className={navClass}>
              <Space size={8}>
                <Avatar size={24} icon={<UserOutlined />} />
                <Typography.Text className="site-header__profile-label">Профиль</Typography.Text>
              </Space>
            </NavLink>
            <Button size="small" className="site-header__logout-btn" onClick={() => void handleLogout()}>
              Выйти
            </Button>
          </Space>
        ) : (
          <Space size={8}>
            <NavLink to="/auth" className={navClass}>
              Войти
            </NavLink>
            <Button
              type="primary"
              size="small"
              className="site-header__gradient-btn"
              onClick={() => navigate('/auth?mode=register')}
            >
              Регистрация
            </Button>
          </Space>
        )}
      </div>
    </header>
  )
}
