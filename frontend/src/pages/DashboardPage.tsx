import { SketchBlock } from '@/components/SketchBlock'
import { DbStatusPanel } from '@/components/DbStatusPanel'

export function DashboardPage() {
  return (
    <>
      <SketchBlock label="PAGE · Dashboard · каталог курсов">
        <p>Сетка карточек курсов (заглушка)</p>
      </SketchBlock>
      <SketchBlock label="PAGE · Dashboard · интеграция Supabase">
        <DbStatusPanel />
      </SketchBlock>
    </>
  )
}
