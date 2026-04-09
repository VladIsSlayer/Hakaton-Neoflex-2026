/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
  readonly VITE_API_URL: string
  /** Опционально: UUID бесплатного курса для лендинга и заглушки контента урока */
  readonly VITE_FREE_COURSE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
