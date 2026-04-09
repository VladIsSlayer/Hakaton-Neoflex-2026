/** UUID курса «Бесплатный курс» в каталоге (центральная карточка, заглушка контента урока). */
const DEFAULT_FREE_COURSE_ID = '7dabf3fa-15d8-4a5d-bcf6-9cc188a7c074'

export const FREE_COURSE_ID = (
  import.meta.env.VITE_FREE_COURSE_ID?.trim() || DEFAULT_FREE_COURSE_ID
).replace(/\/$/, '')

/** Баннер карточки бесплатного курса на главной (`public/Banners`). */
export const FREE_COURSE_BANNER_SRC = '/Banners/Тестирование pytest и практика.png'
