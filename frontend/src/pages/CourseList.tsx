import { Row, Col, Card, Typography, Tag, Button, Input, Select, Space, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { courseApi } from '@/api/course';
import { Course, CourseType } from '@/types/course';

const { Title } = Typography;

const categories = ['数学', '语文', '英语', '物理', '化学', '编程', '职业技能', '其他'];

export default function CourseList() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    type: '' as CourseType | '',
  });

  useEffect(() => {
    loadCourses();
  }, [filters]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.category) params.category = filters.category;
      if (filters.type) params.type = filters.type;
      const data = await courseApi.list(params);
      setCourses(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={2}>课程列表</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Space wrap size="large">
          <Input
            placeholder="搜索课程..."
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            allowClear
          />
          <Select
            placeholder="选择分类"
            style={{ width: 150 }}
            value={filters.category || undefined}
            onChange={(value) => setFilters({ ...filters, category: value || '' })}
            allowClear
          >
            {categories.map((cat) => (
              <Select.Option key={cat} value={cat}>
                {cat}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="课程类型"
            style={{ width: 150 }}
            value={filters.type || undefined}
            onChange={(value) => setFilters({ ...filters, type: value || '' })}
            allowClear
          >
            <Select.Option value={CourseType.FREE}>免费</Select.Option>
            <Select.Option value={CourseType.PAID}>付费</Select.Option>
          </Select>
        </Space>
      </Card>

      {courses.length > 0 ? (
        <Row gutter={[24, 24]}>
          {courses.map((course) => (
            <Col span={6} key={course.id}>
              <Card
                hoverable
                loading={loading}
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
                      <Space>
                        <Tag color={course.type === CourseType.PAID ? 'gold' : 'green'}>
                          {course.type === CourseType.PAID ? `¥${course.price}` : '免费'}
                        </Tag>
                        <Tag>{course.category}</Tag>
                      </Space>
                      {course.tags?.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Empty description="暂无课程" />
        </Card>
      )}
    </div>
  );
}
