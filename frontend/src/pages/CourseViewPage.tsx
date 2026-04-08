import { useParams } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'

export function CourseViewPage() {
  const { courseId } = useParams()

  return (
    <>
      <SketchBlock label="PAGE · Course · заголовок / описание">
        <p>
          Курс <code>{courseId ?? '—'}</code>
        </p>
      </SketchBlock>
      <SketchBlock label="PAGE · Course · список уроков (Steps/Timeline)">
        <p>Уроки курса (заглушка)</p>
      </SketchBlock>
    </>
  )
}
