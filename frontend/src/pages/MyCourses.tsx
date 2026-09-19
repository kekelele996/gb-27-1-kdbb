import { Row, Col, Card, Typography, Tabs, List, Tag, Button, Avatar, Empty } from 'antd';
import { PlayCircleOutlined, BookOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { courseApi } from '@/api/course';
import { Course, CourseType } from '@/types/course';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types/user';

const { Title } = Typography;

export default function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseApi.getMyCourses();
      setCourses(data);
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = user?.role === UserRole.TEACHER;
  const teachingCourses = courses.filter(c => c.teacherId === user?.id);
  const learningCourses = courses.filter(c => c.teacherId !== user?.id);

  const tabs = isTeacher
    ? [
        { key: 'teaching', label: '我教授的课程', courses: teachingCourses },
        { key: 'learning', label: '我学习的课程', courses: learningCourses },
      ]
    : [{ key: 'learning', label: '我学习的课程', courses: learningCourses }];

  const renderCourseCard = (course: Course) => (
    <Card
      key={course.id}
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
          进入课程
        </Button>,
      ]}
    >
      <Card.Meta
        avatar={<Avatar icon={<BookOutlined />} />}
        title={course.name}
        description={
          <Tag color={course.type === CourseType.PAID ? 'gold' : 'green'}>
          {course.type === CourseType.PAID ? `¥${course.price}` : '免费'}
        </Tag>
        }
      />
    </Card>
  );

  return (
    <div>
      <Title level={2}>我的课程</Title>
      
      <Tabs
        defaultActiveKey={tabs[0].key}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          children: (
            <div>
              {tab.courses.length > 0 ? (
                <Row gutter={[24, 24]}>
                  {tab.courses.map(renderCourseCard)}
                </Row>
              ) : (
                <Card>
                  <Empty description="暂无课程" />
                </Card>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
}
