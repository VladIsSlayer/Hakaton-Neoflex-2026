import { useParams } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams()

  return (
    <>
      <SketchBlock label="PAGE · Lesson · теория (markdown)">
        <p>
          Курс <code>{courseId ?? '—'}</code>, урок <code>{lessonId ?? '—'}</code>
        </p>
      </SketchBlock>
      <SketchBlock label="PAGE · Lesson · Monaco + консоль">
        <p>IDE + Run → API (заглушка)</p>
      </SketchBlock>
    </>
  )
}
