import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider, theme } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={ruRU}
        theme={{
          algorithm: [theme.defaultAlgorithm],
          token: {
            colorPrimary: '#1e084d',
            colorInfo: '#1e084d',
            borderRadius: 14,
            colorBgLayout: '#f5f4ff',
            colorBgContainer: '#ffffff',
            colorText: '#260743',
            colorTextSecondary: '#4a3f61',
          },
          components: {
            Button: {
              borderRadius: 999,
              controlHeight: 38,
            },
            Card: {
              borderRadiusLG: 18,
            },
          },
        }}
      >
        <AntdApp>
          <RouterProvider router={router} />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
