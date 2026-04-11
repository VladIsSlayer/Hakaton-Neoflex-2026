# NEO EDU — web

React + TypeScript + Vite, Ant Design, React Query, Zustand.

Структура слоёв (FSD): `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/shared`.

## Запуск

Из корня репозитория задан `.env` (см. `../../.env.example`).

```bash
npm install
npm run dev
```

`vite.config.ts` читает env из **корня монорепо** (`envDir: ../..`).

## Полезные пути

| Назначение | Путь |
|------------|------|
| Роутер | `src/app/router.tsx` |
| Провайдеры / тема | `src/app/App.tsx` |
| Шапка | `src/widgets/app-header/ui/AppHeader.tsx` |
| API-клиент | `src/shared/api/client.ts` |

Планы и детали — в `../../docs/plan/`.
