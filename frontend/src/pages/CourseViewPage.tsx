import { useParams } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'
import { useQuery } from '@tanstack/react-query'
import { fetchCourseById, fetchLessonsByCourse } from '@/api/catalog'

export function CourseViewPage() {
  const { courseId } = useParams()
  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseById(courseId ?? ''),
    enabled: Boolean(courseId),
  })
  const lessonsQuery = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => fetchLessonsByCourse(courseId ?? ''),
    enabled: Boolean(courseId),
  })

  return (
    <>
      <SketchBlock label="PAGE · Course · заголовок / описание">
        <p>
          Курс <code>{courseQuery.data?.title ?? courseId ?? '—'}</code>
        </p>
      </SketchBlock>
      <SketchBlock label="PAGE · Course · список уроков (Steps/Timeline)">
        {lessonsQuery.data && lessonsQuery.data.length > 0 ? (
          <ul className="sketch-list">
            {lessonsQuery.data.map((lesson) => (
              <li key={lesson.id}>{lesson.title}</li>
            ))}
          </ul>
        ) : (
          <p>Уроки курса (заглушка)</p>
        )}
      </SketchBlock>
    </>
  )
}
