import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { SketchBlock } from '@/components/SketchBlock'

export function RootLayout() {
  return (
    <div className="app-shell">
      <SketchBlock label="LAYOUT · site header">
        <AppHeader />
      </SketchBlock>

      <SketchBlock label="LAYOUT · main · Outlet">
        <main className="app-shell__outlet">
          <Outlet />
        </main>
      </SketchBlock>
    </div>
  )
}
