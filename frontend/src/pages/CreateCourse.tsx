import { Card, Form, Input, Select, InputNumber, Button, message, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { courseApi } from '@/api/course';
import { CourseType } from '@/types/course';

const { Title } = Typography;

const categories = ['数学', '语文', '英语', '物理', '化学', '编程', '职业技能', '其他'];
const tagsOptions = ['基础', '进阶', '入门', '高级', '实战', '理论'];

export default function CreateCourse() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    try {
      const course = await courseApi.create({
        name: values.name,
        description: values.description,
        cover: values.cover || `https://picsum.photos/seed/${Date.now()}/400/300`,
        category: values.category,
        tags: values.tags || [],
        type: values.type,
        price: values.type === CourseType.PAID ? values.price : 0,
      });
      message.success('课程创建成功');
      navigate(`/courses/${course.id}`);
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  return (
    <div>
      <Title level={2}>创建课程</Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ type: CourseType.FREE, price: 0 }}
        >
          <Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input placeholder="请输入课程名称" />
          </Form.Item>

          <Form.Item name="description" label="课程简介" rules={[{ required: true, message: '请输入课程简介' }]}>
            <Input.TextArea rows={4} placeholder="请输入课程简介" />
          </Form.Item>

          <Form.Item name="cover" label="课程封面 URL">
            <Input placeholder="请输入封面图片 URL (可选)" />
          </Form.Item>

          <Form.Item name="category" label="课程分类" rules={[{ required: true, message: '请选择课程分类' }]}>
            <Select placeholder="请选择课程分类">
              {categories.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  {cat}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="tags" label="课程标签">
            <Select mode="tags" placeholder="请输入或选择标签" allowClear>
              {tagsOptions.map((tag) => (
                <Select.Option key={tag} value={tag}>
                  {tag}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="type" label="课程类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value={CourseType.FREE}>免费</Select.Option>
              <Select.Option value={CourseType.PAID}>付费</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
          >
            {({ getFieldValue }) =>
              getFieldValue('type') === CourseType.PAID ? (
                <Form.Item name="price" label="课程价格" rules={[{ required: true, message: '请输入课程价格' }]}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    style={{ width: 200 }}
                    placeholder="请输入课程价格"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="large">
                创建课程
              </Button>
              <Button size="large" onClick={() => navigate('/my-courses')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
