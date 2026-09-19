import { Card, Typography, Form, Input, Button, Space, Descriptions, Tag, InputNumber, message, List, Avatar, Modal, Row, Col } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { assignmentApi } from '@/api/assignment';
import { Assignment, AssignmentType, SubmissionStatus, AssignmentSubmission } from '@/types/assignment';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types/user';

const { Title, Paragraph } = Typography;

export default function AssignmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const { user } = useAuthStore();

  const isTeacher = user?.role === UserRole.TEACHER;

  useEffect(() => {
    if (id) {
      loadAssignment();
    }
  }, [id]);

  const loadAssignment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await assignmentApi.get(id);
      setAssignment(data);

      if (isTeacher) {
        const subs = await assignmentApi.getSubmissions(id);
        setSubmissions(subs);
      } else {
        const mySub = await assignmentApi.getMySubmission(id);
        setSubmission(mySub);
        if (mySub) {
          form.setFieldsValue({
            textAnswer: mySub.textAnswer,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!id) return;
    try {
      const result = await assignmentApi.submit(id, {
        textAnswer: values.textAnswer,
      });
      setSubmission(result);
      message.success('提交成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交失败');
    }
  };

  const handleGrade = (submission: AssignmentSubmission) => {
    Modal.confirm({
      title: '批改作业',
      content: (
        <div style={{ marginTop: 16 }}>
          <Paragraph strong>学生答案：</Paragraph>
          <Paragraph>{submission.textAnswer || '无文本答案'}</Paragraph>
        </div>
      ),
      okText: '批改',
      onOk: async () => {
        const score = 85;
        const feedback = '做得很好！';
        try {
          await assignmentApi.grade(submission.id, score, feedback);
          message.success('批改完成');
          loadAssignment();
        } catch (error: any) {
          message.error('批改失败');
        }
      },
    });
  };

  const getTypeText = (type: AssignmentType) => {
    switch (type) {
      case AssignmentType.TEXT:
        return '文本题';
      case AssignmentType.CHOICE:
        return '选择题';
      case AssignmentType.ATTACHMENT:
        return '附件提交';
    }
  };

  const getStatusTag = (status: SubmissionStatus) => {
    switch (status) {
      case SubmissionStatus.SUBMITTED:
        return <Tag color="blue">待批改</Tag>;
      case SubmissionStatus.GRADED:
        return <Tag color="green">已批改</Tag>;
    }
  };

  if (loading) {
    return <Card><div style={{ textAlign: 'center', padding: 50 }}>加载中...</div></Card>;
  }

  if (!assignment) {
    return <Card><div style={{ textAlign: 'center', padding: 50 }}>作业不存在</div></Card>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {assignment.title}
        </Title>
        <Tag>{getTypeText(assignment.type)}</Tag>
      </Space>

      <Row gutter={24}>
        <Col span={16}>
          <Card title="作业详情">
            <Descriptions column={1}>
              <Descriptions.Item label="作业说明">
                <Paragraph>{assignment.description}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="满分">
                {assignment.maxScore} 分
              </Descriptions.Item>
              {assignment.deadline && (
                <Descriptions.Item label="截止时间">
                  {new Date(assignment.deadline).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {!isTeacher && (
            <Card title="我的答案" style={{ marginTop: 24 }}>
              {submission && getStatusTag(submission.status)}
              {submission?.status === SubmissionStatus.GRADED && (
                <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                  <Paragraph strong>得分：{submission.score} / {assignment.maxScore}</Paragraph>
                  <Paragraph strong>教师反馈：</Paragraph>
                  <Paragraph>{submission.feedback}</Paragraph>
                </div>
              )}
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                style={{ marginTop: 16 }}
              >
                {assignment.type === AssignmentType.TEXT && (
                  <Form.Item name="textAnswer" label="答案" rules={[{ required: true, message: '请输入答案' }]}>
                    <Input.TextArea rows={8} placeholder="请输入你的答案" />
                  </Form.Item>
                )}
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" size="large">
                      {submission ? '重新提交' : '提交作业'}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          )}

          {isTeacher && (
            <Card title="学生提交" style={{ marginTop: 24 }}>
              <List
                dataSource={submissions}
                locale={{ emptyText: '暂无提交' }}
                renderItem={(sub) => (
                  <List.Item
                    actions={[
                      sub.status === SubmissionStatus.SUBMITTED && (
                        <Button type="primary" icon={<EditOutlined />} onClick={() => handleGrade(sub)}>
                          批改
                        </Button>
                      ),
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar>{sub.studentId?.[0] || 'U'}</Avatar>}
                      title={
                        <Space>
                          {sub.studentId || '未知用户'}
                          {getStatusTag(sub.status)}
                        </Space>
                      }
                      description={
                        <Space>
                          <span>提交时间：{new Date(sub.createdAt).toLocaleString()}</span>
                          {sub.score !== null && <span>得分：{sub.score}</span>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
