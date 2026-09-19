import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { useEffect, useState } from 'react';
import MainLayout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import CourseList from './pages/CourseList';
import CourseDetail from './pages/CourseDetail';
import MyCourses from './pages/MyCourses';
import CreateCourse from './pages/CreateCourse';
import LiveClass from './pages/LiveClass';
import Assignment from './pages/Assignment';
import Statistics from './pages/Statistics';
import { useAuthStore } from './store/auth';
import { authApi } from './api/auth';

const { Content } = Layout;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, setUser, login } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          const profile = await authApi.getProfile();
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, [setUser]);

  if (loading) {
    return <div style={{ padding: 50, textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/courses" element={<CourseList />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route
                path="/my-courses"
                element={
                  <PrivateRoute>
                    <MyCourses />
                  </PrivateRoute>
                }
              />
              <Route
                path="/create-course"
                element={
                  <PrivateRoute>
                    <CreateCourse />
                  </PrivateRoute>
                }
              />
              <Route
                path="/live/:id"
                element={
                  <PrivateRoute>
                    <LiveClass />
                  </PrivateRoute>
                }
              />
              <Route
                path="/assignments/:id"
                element={
                  <PrivateRoute>
                    <Assignment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/statistics"
                element={
                  <PrivateRoute>
                    <Statistics />
                  </PrivateRoute>
                }
              />
            </Routes>
          </MainLayout>
        }
      />
    </Routes>
  );
}

export default App;
