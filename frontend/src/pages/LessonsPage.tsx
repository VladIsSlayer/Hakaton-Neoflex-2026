import { Link } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'

/** Агрегатор «продолжить обучение»: последний урок, список в процессе */
export function LessonsPage() {
  return (
    <>
      <SketchBlock label="PAGE · Лекции · продолжить">
        <p className="sketch-muted" style={{ marginTop: 0 }}>
          Быстрый переход к месту остановки (данные с бэка позже).
        </p>
        <p>
          <Link to="/courses/sample-course-id/lessons/sample-lesson-id">
            Открыть пример урока (sample)
          </Link>
        </p>
      </SketchBlock>
      <SketchBlock label="PAGE · Лекции · уроки в работе">
        <ul className="sketch-list">
          <li>Курс A — урок 3 · в процессе</li>
          <li>Курс B — урок 1 · не начат</li>
        </ul>
      </SketchBlock>
    </>
  )
}
