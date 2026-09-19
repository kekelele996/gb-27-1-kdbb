import { Row, Col, Card, Typography, Statistic, Progress, List, Tag } from 'antd';
import { BookOutlined, TeamOutlined, CheckCircleOutlined, TrophyOutlined, ClockCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { statisticsApi } from '@/api/assignment';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types/user';

const { Title } = Typography;

export default function Statistics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const isTeacher = user?.role === UserRole.TEACHER;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await statisticsApi.getMyStats();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  const teacherStats = [
    { title: '教授课程', value: stats?.totalCourses || 0, icon: <BookOutlined style={{ fontSize: 48 }} />, color: '#1890ff' },
    { title: '累计销量', value: stats?.totalSales || 0, icon: <TeamOutlined style={{ fontSize: 48 }} />, color: '#52c41a' },
    { title: '出勤率', value: `${stats?.attendanceRate || 0}%`, icon: <CheckCircleOutlined style={{ fontSize: 48 }} />, color: '#fa8c16' },
    { title: '作业平均分', value: stats?.averageScore || 0, icon: <TrophyOutlined style={{ fontSize: 48 }} />, color: '#722ed1' },
  ];

  const studentStats = [
    { title: '学习课程', value: stats?.totalCourses || 0, icon: <BookOutlined style={{ fontSize: 48 }} />, color: '#1890ff' },
    { title: '完成课程', value: stats?.completedCourses || 0, icon: <CheckCircleOutlined style={{ fontSize: 48 }} />, color: '#52c41a' },
    { title: '学习时长', value: `${stats?.totalStudyHours || 0} 小时`, icon: <ClockCircleOutlined style={{ fontSize: 48 }} />, color: '#fa8c16' },
    { title: '作业平均分', value: stats?.averageScore || 0, icon: <BarChartOutlined style={{ fontSize: 48 }} />, color: '#722ed1' },
  ];

  const currentStats = isTeacher ? teacherStats : studentStats;

  return (
    <div>
      <Title level={2}>数据统计</Title>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {currentStats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card className="stats-card">
              <Row gutter={16} align="middle">
                <Col span={8} style={{ color: stat.color }}>
                  {stat.icon}
                </Col>
                <Col span={16}>
                  <div className="stats-value">{stat.value}</div>
                  <div className="stats-label">{stat.title}</div>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="学习进度">
            <Progress percent={stats?.completedCourses && stats?.totalCourses 
              ? Math.round((stats.completedCourses / stats.totalCourses) * 100) 
              : 0} />
            <div style={{ marginTop: 16 }}>
              <List
                dataSource={[
                  { title: '已完成作业', value: `${stats?.completedAssignments || 0} / ${stats?.totalAssignments || 0}`, percent: stats?.totalAssignments 
                    ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100) 
                    : 0 },
                  { title: '签到记录', value: `${stats?.attendanceRecords || 0} 次`, percent: Math.min((stats?.attendanceRecords || 0) * 10, 100) },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.title}
                      description={<Progress percent={item.percent} size="small" showInfo={false} />}
                    />
                    <Tag color="blue">{item.value}</Tag>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="快速统计">
            <List
              dataSource={[
                { title: '平均成绩', value: stats?.averageScore || 0, unit: '分' },
                { title: isTeacher ? '总作业数' : '完成作业', value: stats?.totalAssignments || 0, unit: '份' },
                { title: isTeacher ? '学生数量' : '学习时长', value: isTeacher ? (stats?.totalSales || 0) : (stats?.totalStudyHours || 0), unit: isTeacher ? '人' : '小时' },
                { title: isTeacher ? '课程数量' : '已完成课程', value: stats?.totalCourses || 0, unit: '门' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.title}</span>
                  <span>
                    <Tag color="blue">{item.value}</Tag>
                    <span>{item.unit}</span>
                  </span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
