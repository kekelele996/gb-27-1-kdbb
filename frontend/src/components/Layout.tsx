import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
  PlusOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types/user';

const { Header, Content } = Layout;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/courses', icon: <BookOutlined />, label: '课程列表' },
    ...(isAuthenticated
      ? [
          { key: '/my-courses', icon: <PlayCircleOutlined />, label: '我的课程' },
          { key: '/statistics', icon: <BarChartOutlined />, label: '数据统计' },
        ]
      : []),
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/my-courses'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          在线课堂
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        />
        <Space>
          {isAuthenticated ? (
            <>
              {user?.role === UserRole.TEACHER && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-course')}>
                  创建课程
                </Button>
              )}
              <Dropdown menu={{ items: userMenuItems }}>
                <Space style={{ cursor: 'pointer', color: 'white' }}>
                  <Avatar icon={<UserOutlined />} />
                  <span>{user?.name}</span>
                </Space>
              </Dropdown>
            </>
          ) : (
            <>
              <Button onClick={() => navigate('/login')}>登录</Button>
              <Button type="primary" onClick={() => navigate('/register')}>
                注册
              </Button>
            </>
          )}
        </Space>
      </Header>
      <Content style={{ padding: '24px' }}>{children}</Content>
    </Layout>
  );
}
