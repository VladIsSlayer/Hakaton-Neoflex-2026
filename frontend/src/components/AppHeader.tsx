import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Space, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useAuthUiStore } from '@/stores/authUiStore'

export function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const isLoggedIn = useAuthUiStore((s) => s.isLoggedIn)
  const setLoggedIn = useAuthUiStore((s) => s.setLoggedIn)

  const handleDemoToggle = () => {
    const next = !isLoggedIn
    setLoggedIn(next)
    if (!next) navigate('/')
  }

  const handleLogout = () => {
    setLoggedIn(false)
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
        <Button
          size="small"
          className="site-header__demo-toggle"
          onClick={handleDemoToggle}
          type="text"
        >
          demo: {isLoggedIn ? 'logged in' : 'logged out'}
        </Button>
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
        {isLoggedIn ? (
          <Space size={12}>
            <NavLink to="/profile" className={navClass}>
              <Space size={8}>
                <Avatar size={24} icon={<UserOutlined />} />
                <Typography.Text className="site-header__profile-label">Профиль</Typography.Text>
              </Space>
            </NavLink>
            <Button size="small" className="site-header__logout-btn" onClick={handleLogout}>
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
