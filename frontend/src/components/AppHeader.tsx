import { NavLink } from 'react-router-dom'
import { useAuthUiStore } from '@/stores/authUiStore'

export function AppHeader() {
  const isLoggedIn = useAuthUiStore((s) => s.isLoggedIn)
  const setLoggedIn = useAuthUiStore((s) => s.setLoggedIn)
  const toggleLoggedIn = useAuthUiStore((s) => s.toggleLoggedIn)

  const navClass = ({ isActive }: { isActive: boolean }) =>
    'site-header__nav-link' + (isActive ? ' site-header__nav-link--active' : '')

  return (
    <header className="site-header">
      <div className="site-header__left">
        <NavLink to="/" className="site-header__logo" end>
          NEO EDU
        </NavLink>
        <button
          type="button"
          className="site-header__demo-toggle"
          onClick={toggleLoggedIn}
          title="Переключить демо-состояние «вошёл в систему»"
        >
          демо: {isLoggedIn ? 'вышел' : 'вошёл'}
        </button>
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
          <>
            <NavLink to="/profile" className={navClass}>
              Профиль
            </NavLink>
            <button type="button" className="site-header__btn" onClick={() => setLoggedIn(false)}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <NavLink to="/auth" className={navClass}>
              Войти
            </NavLink>
            <NavLink to="/auth" className="site-header__btn site-header__btn--primary">
              Регистрация
            </NavLink>
          </>
        )}
      </div>
    </header>
  )
}
