import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { LandingPage } from '@/pages/LandingPage'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CourseViewPage } from '@/pages/CourseViewPage'
import { LessonPlayerPage } from '@/pages/LessonPlayerPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { LessonsPage } from '@/pages/LessonsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'lessons', element: <LessonsPage /> },
      { path: 'courses/:courseId', element: <CourseViewPage /> },
      { path: 'courses/:courseId/lessons/:lessonId', element: <LessonPlayerPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
])
