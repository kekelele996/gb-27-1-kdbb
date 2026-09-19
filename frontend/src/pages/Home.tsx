import { Row, Col, Card, Typography, Tag, Button, Carousel, Space } from 'antd';
import { PlayCircleOutlined, TeamOutlined, BookOutlined, TrophyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { courseApi } from '@/api/course';
import { Course, CourseType } from '@/types/course';

const { Title, Paragraph } = Typography;

export default function Home() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await courseApi.list();
      setCourses(data.slice(0, 6));
    } finally {
      setLoading(false);
    }
  };

  const banners = [
    {
      title: '随时随地，学习无忧',
      description: '支持直播授课与录播回放，让学习更灵活',
      color: '#1890ff',
    },
    {
      title: '互动课堂，高效学习',
      description: '电子白板、弹幕互动、举手发言，课堂体验更丰富',
      color: '#52c41a',
    },
    {
      title: '数据驱动，精准教学',
      description: '学习数据统计，掌握学习进度和成绩趋势',
      color: '#fa8c16',
    },
  ];

  const features = [
    { icon: <PlayCircleOutlined style={{ fontSize: 48 }} />, title: '直播授课', description: '实时互动教学，支持200人同时在线' },
    { icon: <BookOutlined style={{ fontSize: 48 }} />, title: '录播回放', description: '直播结束自动生成录播，支持倍速播放' },
    { icon: <TeamOutlined style={{ fontSize: 48 }} />, title: '互动课堂', description: '弹幕发言、举手提问，课堂更活跃' },
    { icon: <TrophyOutlined style={{ fontSize: 48 }} />, title: '作业系统', description: '在线布置、提交、批改，作业管理更高效' },
  ];

  return (
    <div>
      <Carousel autoplay style={{ marginBottom: 48, borderRadius: 8, overflow: 'hidden' }}>
        {banners.map((banner, index) => (
          <div
            key={index}
            style={{
              padding: '80px 48px',
              background: banner.color,
              color: 'white',
            }}
          >
            <Title level={2} style={{ color: 'white', marginBottom: 16 }}>
              {banner.title}
            </Title>
            <Paragraph style={{ color: 'white', fontSize: 18, opacity: 0.9 }}>
              {banner.description}
            </Paragraph>
            <Button type="primary" size="large" onClick={() => navigate('/courses')}>
              开始学习
            </Button>
          </div>
        ))}
      </Carousel>

      <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
        {features.map((feature, index) => (
          <Col span={6} key={index}>
            <Card hoverable style={{ textAlign: 'center', height: '100%' }}>
              <div style={{ color: '#1890ff', marginBottom: 16 }}>{feature.icon}</div>
              <Title level={4}>{feature.title}</Title>
              <Paragraph type="secondary">{feature.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <Title level={3} style={{ margin: 0 }}>热门课程</Title>
          <Button type="link" onClick={() => navigate('/courses')}>
            查看全部
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {courses.slice(0, 4).map((course) => (
          <Col span={6} key={course.id}>
            <Card
              hoverable
              className="course-card"
              cover={
                <img
                  src={course.cover}
                  alt={course.name}
                  className="course-cover"
                  onError={(e: any) => {
                    e.target.src = 'https://picsum.photos/seed/course' + course.id + '/400/240';
                  }}
                />
              }
              actions={[
                <Button type="primary" block onClick={() => navigate(`/courses/${course.id}`)}>
                  查看详情
                </Button>,
              ]}
            >
              <Card.Meta
                title={course.name}
                description={
                  <Space direction="vertical" size={8}>
                    <Tag color={course.type === CourseType.PAID ? 'gold' : 'green'}>
                      {course.type === CourseType.PAID ? `¥${course.price}` : '免费'}
                    </Tag>
                    <span style={{ color: '#999' }}>{course.category}</span>
                  </Space>
                }
              />
            </Card>
          </Col>
        ))}
        {courses.length === 0 && !loading && (
          <Col span={24}>
            <Card style={{ textAlign: 'center' }}>
              <Paragraph type="secondary">暂无课程，快来创建第一个课程吧！</Paragraph>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
