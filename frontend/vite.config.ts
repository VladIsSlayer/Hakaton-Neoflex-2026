import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Читаем корневой .env репозитория (API_SUPABASE_*), пробрасываем в import.meta.env для клиента
export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, rootDir, '')

  const supabaseUrl = env.VITE_SUPABASE_URL || env.API_SUPABASE_URL || ''
  const supabaseAnonKey =
    env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.API_SUPABASE_ANON_KEY ||
    ''

  // В development: пустой URL → запросы на тот же origin, Vite проксирует /api и /webhooks на бэкенд (без CORS).
  const devProxyTarget =
    (env.VITE_DEV_API_PROXY || env.API_URL || env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')
  const explicitApi = (env.VITE_API_URL || env.API_URL || '').replace(/\/$/, '')
  const apiUrlForDefine =
    mode === 'development' ? '' : explicitApi || 'http://localhost:8080'

  return {
    plugins: [react()],
    envDir: rootDir,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrlForDefine),
    },
    server: {
      proxy: {
        '/api': { target: devProxyTarget, changeOrigin: true },
        '/webhooks': { target: devProxyTarget, changeOrigin: true },
      },
    },
  }
})
