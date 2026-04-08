import { NavLink, Outlet } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Landing' },
  { to: '/auth', label: 'Auth' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/courses/sample-course-id', label: 'Course (sample)' },
  {
    to: '/courses/sample-course-id/lessons/sample-lesson-id',
    label: 'Lesson player',
  },
  { to: '/profile', label: 'Profile' },
]

export function RootLayout() {
  return (
    <div className="app-shell">
      <SketchBlock label="LAYOUT · header">
        <header className="app-shell__header">
          <span>NEO EDU</span>
          <span className="sketch-muted"> · wireframe</span>
        </header>
      </SketchBlock>

      <div className="app-shell__main">
        <SketchBlock label="LAYOUT · sidebar / nav">
          <nav className="app-shell__nav" aria-label="Основная навигация">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  'app-shell__link' + (isActive ? ' app-shell__link--active' : '')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </SketchBlock>

        <SketchBlock label="LAYOUT · main · Outlet">
          <main className="app-shell__outlet">
            <Outlet />
          </main>
        </SketchBlock>
      </div>
    </div>
  )
}
