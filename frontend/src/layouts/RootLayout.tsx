import { Outlet } from 'react-router-dom'
import { Layout, Typography } from 'antd'
import { AppHeader } from '@/components/AppHeader'

const { Header, Content, Footer } = Layout

export function RootLayout() {
  return (
    <Layout className="site-layout">
      <Header className="site-layout__header">
        <AppHeader />
      </Header>
      <Content className="site-layout__content">
        <div className="site-layout__content-inner">
          <Outlet />
        </div>
      </Content>
      <Footer className="site-layout__footer">
        <div className="site-footer-grid">
          <div className="site-footer-col site-footer-col--left">
            <Typography.Text strong>Служба поддержки</Typography.Text>
            <br />
            <Typography.Text type="secondary">+7 (495) 984 25 13</Typography.Text>
            <br />
            <Typography.Text type="secondary">info@neoflex.ru</Typography.Text>
          </div>
          <div className="site-footer-col site-footer-col--right">
            <Typography.Text strong>NEO EDU</Typography.Text>
            <br />
            <Typography.Text type="secondary">Корпоративная LMS для ИТ-обучения</Typography.Text>
          </div>
        </div>
      </Footer>
    </Layout>
  )
}
