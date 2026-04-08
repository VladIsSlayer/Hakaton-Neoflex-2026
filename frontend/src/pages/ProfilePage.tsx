import { Link } from 'react-router-dom'
import { SketchBlock } from '@/components/SketchBlock'

const COURSE_REVIEW_ROWS = [
  {
    course: 'NeoFlex Bootcamp',
    task: 'Практика: SQL-выборка',
    status: 'Ожидает ответа куратора',
    score: '—',
  },
  {
    course: 'NeoFlex Bootcamp',
    task: 'Алгоритмы: сортировка',
    status: 'Принято',
    score: '10',
  },
  {
    course: 'DevOps трек',
    task: 'PR в репозитории',
    status: 'Проверено',
    score: '8',
  },
  {
    course: 'DevOps трек',
    task: 'Конфиг CI',
    status: 'Отклонено',
    score: '0',
  },
] as const

export function ProfilePage() {
  return (
    <div className="profile-layout">
      <SketchBlock label="PROFILE · пользователь">
        <div className="profile-user-row">
          <div className="profile-avatar" aria-hidden>
            фото
          </div>
          <div className="profile-user-meta">
            <p className="profile-user-name">Иван Петров</p>
            <p className="sketch-muted profile-user-login">Логин: ivan.petrov · student@neoflex.demo</p>
            <p className="sketch-muted">Роль: студент · Telegram: не привязан</p>
          </div>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · дашборд · метрики">
        <div className="profile-metrics">
          <div className="profile-metric">
            <span className="profile-metric__value">3</span>
            <span className="profile-metric__label">Активных курсов</span>
          </div>
          <div className="profile-metric">
            <span className="profile-metric__value">1</span>
            <span className="profile-metric__label">На проверке</span>
          </div>
          <div className="profile-metric">
            <span className="profile-metric__value">72%</span>
            <span className="profile-metric__label">Средний прогресс</span>
          </div>
          <div className="profile-metric">
            <span className="profile-metric__value">12</span>
            <span className="profile-metric__label">Решений за неделю</span>
          </div>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · график активности">
        <div className="profile-chart-placeholder" role="img" aria-label="Заглушка графика активности">
          <span className="sketch-muted">Столбцы активности по дням (подключение API позже)</span>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · активные курсы">
        <div className="profile-course-cards">
          <div className="profile-course-card">
            <strong>NeoFlex Bootcamp</strong>
            <p className="sketch-muted">Прогресс 65% · последний: SQL-выборка</p>
            <p>
              <Link to="/courses/sample-course-id">К курсу</Link>
            </p>
          </div>
          <div className="profile-course-card">
            <strong>DevOps трек</strong>
            <p className="sketch-muted">Прогресс 20% · последний: Git basics</p>
            <p>
              <Link to="/courses/sample-course-id">К курсу</Link>
            </p>
          </div>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · статусы заданий (куратор / итог)">
        <div className="profile-table-wrap">
          <table className="profile-table">
            <thead>
              <tr>
                <th>Курс</th>
                <th>Задание</th>
                <th>Статус</th>
                <th>Итоговый балл</th>
              </tr>
            </thead>
            <tbody>
              {COURSE_REVIEW_ROWS.map((row) => (
                <tr key={`${row.course}-${row.task}`}>
                  <td>{row.course}</td>
                  <td>{row.task}</td>
                  <td>{row.status}</td>
                  <td>{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · матрица компетенций (radar)">
        <div className="profile-radar-placeholder">
          <span className="sketch-muted">Radar: Python, SQL, DevOps…</span>
        </div>
      </SketchBlock>

      <SketchBlock label="PROFILE · последние решения (Judge0 / сабмиты)">
        <ul className="sketch-list">
          <li>Задача #12 · Python · success · 2 ч назад</li>
          <li>Задача #08 · SQL · failed · вчера</li>
          <li>Задача #03 · Python · success · 3 дня назад</li>
        </ul>
      </SketchBlock>
    </div>
  )
}
