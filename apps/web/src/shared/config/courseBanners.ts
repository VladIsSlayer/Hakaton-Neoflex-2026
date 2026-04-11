import { FREE_COURSE_BANNER_SRC, FREE_COURSE_ID } from '@/shared/config/freeCourse'

/** Имена файлов в `public/Banners` без `.png` (как в репозитории). */
const BANNER_BASENAMES = [
  'Agile и Scrum в ИТ-командах',
  'Docker контейнеры для разработчика',
  'Git и командная разработка',
  'Kubernetes первые шаги',
  'Linux для разработчиков',
  'REST API проектирование и версионирование',
  'TypeScript в веб-проектах',
  'ИБ для разработчиков основы',
  'Машинное обучение на Python введение',
  'Микросервисы паттерны и границы',
  'PostgreSQL администрирование и производительность',
  'Python для автоматизации и скриптинга',
  'React компоненты, состояние, хуки',
  'Тестирование pytest и практика',
] as const

function normTitle(s: string): string {
  return s
    .replace(/:\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Фон карточки курса на главной: по UUID демо-курса, затем по названию (с «:» или без). */
export function bannerSrcForCourse(course: { id: string; title: string }): string {
  if (course.id === FREE_COURSE_ID) return FREE_COURSE_BANNER_SRC
  const n = normTitle(course.title)
  for (const base of BANNER_BASENAMES) {
    if (normTitle(base) === n) return `/Banners/${base}.png`
  }
  let h = 0
  for (let i = 0; i < course.id.length; i++) h = (h + course.id.charCodeAt(i)) % 997
  const idx = h % BANNER_BASENAMES.length
  return `/Banners/${BANNER_BASENAMES[idx]}.png`
}
