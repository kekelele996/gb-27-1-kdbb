import { Button, Input, Card, Typography, Tag, Space, message, Avatar, Statistic, Alert } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LikeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { liveClassApi, attendanceApi } from '@/api/live';
import {
  LiveClass as LiveClassType,
  LiveClassStatus,
  CheckInWindow,
  AttendanceStatus,
} from '@/types/live';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types/user';

const { Title, Text } = Typography;

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

const WINDOW_PRESENT_SECONDS = 5 * 60;
const WINDOW_LATE_SECONDS = 10 * 60;

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const attendanceTag = (status: AttendanceStatus) => {
  switch (status) {
    case AttendanceStatus.PRESENT:
      return <Tag color="green">出勤</Tag>;
    case AttendanceStatus.LATE:
      return <Tag color="orange">迟到</Tag>;
    case AttendanceStatus.ABSENT:
      return <Tag color="red">缺勤</Tag>;
  }
};

export default function LiveClass() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liveClass, setLiveClass] = useState<LiveClassType | null>(null);
  const [windowState, setWindowState] = useState<CheckInWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  // 本地每秒跳动，用于倒计时显示
  const [nowTick, setNowTick] = useState(Date.now());
  const { user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTeacher = user?.role === UserRole.TEACHER;

  useEffect(() => {
    if (id) {
      loadLiveClass();
      initSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 直播中轮询签到窗口（5s），刷新页面后可直接回读一致状态
  useEffect(() => {
    if (!id || !liveClass) return;

    const fetchWindow = () => attendanceApi.getWindow(id).then(setWindowState).catch(() => {});
    fetchWindow();

    const isLive = liveClass.status === LiveClassStatus.LIVE;
    const timer = isLive ? setInterval(fetchWindow, 5000) : null;
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [id, liveClass?.status]);

  // 本地倒计时
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = messagesEndRef.current;
    el?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadLiveClass = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await liveClassApi.get(id);
      setLiveClass(data);
      const windowData = await attendanceApi.getWindow(id).catch(() => null);
      setWindowState(windowData);
    } finally {
      setLoading(false);
    }
  };

  const refreshWindow = async () => {
    if (!id) return;
    const windowData = await attendanceApi.getWindow(id).catch(() => null);
    setWindowState(windowData);
  };

  const initSocket = () => {
    const socket = io('/socket.io/chat', {
      query: {
        roomId: id,
        userId: user?.id,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('userJoined', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.userId,
          userName: '系统',
          message: `${data.userName || '某用户'} 进入了直播间`,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on('userLeft', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.userId,
          userName: '系统',
          message: `${data.userName || '某用户'} 离开了直播间`,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on('handRaised', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.userId,
          userName: '系统',
          message: `${data.userName} 举手了`,
          timestamp: new Date(),
        },
      ]);
    });

    socket.on('handLowered', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: data.userId,
          userName: '系统',
          message: `${data.userName || '某用户'} 放下了手`,
          timestamp: new Date(),
        },
      ]);
    });
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      roomId: id,
      message: inputMessage,
      userId: user?.id,
      userName: user?.name,
    });
    setInputMessage('');
  };

  const toggleHand = () => {
    if (!socketRef.current) return;
    if (handRaised) {
      socketRef.current.emit('lowerHand', { roomId: id, userId: user?.id });
    } else {
      socketRef.current.emit('raiseHand', { roomId: id, userId: user?.id, userName: user?.name });
    }
    setHandRaised(!handRaised);
  };

  const handleCheckIn = async () => {
    if (!id) return;
    setSubmitting(true);
    setRejectReason(null);
    try {
      const result = await attendanceApi.checkIn(id);
      if (result.repeated) {
        message.info('你已签到，无需重复提交');
      } else if (result.record.status === AttendanceStatus.LATE) {
        message.success('签到成功（迟到）');
      } else {
        message.success('签到成功（出勤）');
      }
      await refreshWindow();
    } catch (error: any) {
      const reason = error.response?.data?.message || '签到失败';
      setRejectReason(reason);
      message.error(reason);
    } finally {
      setSubmitting(false);
    }
  };

  const startLive = async () => {
    if (!id) return;
    try {
      const updated = await liveClassApi.start(id);
      setLiveClass(updated);
      await refreshWindow();
      message.success('直播已开始，签到窗口已开启');
    } catch (error: any) {
      message.error(error.response?.data?.message || '开始直播失败');
    }
  };

  const endLive = async () => {
    if (!id) return;
    setEnding(true);
    try {
      const result = await liveClassApi.end(id);
      setLiveClass(result.liveClass);
      await refreshWindow();
      message.success('直播已结束，考勤汇总已生成');
    } catch (error: any) {
      message.error(error.response?.data?.message || '结束直播失败');
    } finally {
      setEnding(false);
    }
  };

  const getStatusTag = (status: LiveClassStatus) => {
    switch (status) {
      case LiveClassStatus.LIVE:
        return <Tag color="red">直播中</Tag>;
      case LiveClassStatus.SCHEDULED:
        return <Tag color="blue">未开始</Tag>;
      case LiveClassStatus.ENDED:
        return <Tag color="gray">已结束</Tag>;
    }
  };

  const renderCheckInPanel = () => {
    if (!windowState) return null;

    // 教师面板：签到窗口时间 + 汇总
    if (isTeacher) {
      const startMs = windowState.actualStartTime ? new Date(windowState.actualStartTime).getTime() : null;
      const presentLeft = startMs ? startMs + WINDOW_PRESENT_SECONDS * 1000 - nowTick : null;
      const lateLeft = startMs ? startMs + WINDOW_LATE_SECONDS * 1000 - nowTick : null;

      return (
        <Card title="签到窗口" size="small" style={{ marginBottom: 12 }}>
          {liveClass?.status === LiveClassStatus.SCHEDULED && (
            <Text type="secondary">直播开始后自动开启签到：前 5 分钟签到为出勤，5~10 分钟为迟到</Text>
          )}
          {liveClass?.status === LiveClassStatus.LIVE && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <ClockCircleOutlined />
                <Text>
                  出勤窗口剩余：
                  <Text strong type={presentLeft !== null && presentLeft > 0 ? 'success' : 'secondary'}>
                    {presentLeft !== null && presentLeft > 0 ? formatCountdown(presentLeft) : '已截止'}
                  </Text>
                </Text>
              </Space>
              <Text>
                迟到窗口剩余：
                <Text strong type={lateLeft !== null && lateLeft > 0 ? 'warning' : 'secondary'}>
                  {lateLeft !== null && lateLeft > 0 ? formatCountdown(lateLeft) : '已关闭'}
                </Text>
              </Text>
            </Space>
          )}
          {liveClass?.status === LiveClassStatus.ENDED && windowState.summary && (
            <Space size="large" wrap>
              <Statistic title="应到" value={windowState.summary.total} />
              <Statistic title="出勤" value={windowState.summary.present} valueStyle={{ color: '#52c41a' }} />
              <Statistic title="迟到" value={windowState.summary.late} valueStyle={{ color: '#fa8c16' }} />
              <Statistic title="缺勤" value={windowState.summary.absent} valueStyle={{ color: '#f5222d' }} />
            </Space>
          )}
        </Card>
      );
    }

    // 学生面板
    const myRecord = windowState.myRecord;

    if (myRecord) {
      return (
        <Card title="我的签到" size="small" style={{ marginBottom: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              {attendanceTag(myRecord.status)}
              <Text type="secondary">
                签到时间：{myRecord.checkInTime ? new Date(myRecord.checkInTime).toLocaleString() : '-'}
              </Text>
            </Space>
            <Text type="secondary">重复签到只会返回本条记录，不会改变签到结果</Text>
          </Space>
        </Card>
      );
    }

    const startMs = windowState.actualStartTime ? new Date(windowState.actualStartTime).getTime() : null;
    const presentLeft = startMs ? startMs + WINDOW_PRESENT_SECONDS * 1000 - nowTick : null;
    const lateLeft = startMs ? startMs + WINDOW_LATE_SECONDS * 1000 - nowTick : null;

    return (
      <Card title="课堂签到" size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {windowState.phase === 'not_open' && (
            <Text type="secondary">签到尚未开始，直播开始后前 5 分钟签到为出勤，5~10 分钟为迟到</Text>
          )}
          {windowState.phase === 'present' && (
            <>
              <Text strong type="success">
                签到窗口已开启，当前签到记为「出勤」
              </Text>
              <Text>
                出勤窗口剩余：<Text strong>{formatCountdown(presentLeft ?? 0)}</Text>
              </Text>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                onClick={handleCheckIn}
                block
              >
                立即签到
              </Button>
            </>
          )}
          {windowState.phase === 'late' && (
            <>
              <Text strong type="warning">
                出勤窗口已截止，当前签到记为「迟到」
              </Text>
              <Text>
                签到窗口剩余：<Text strong type="warning">{formatCountdown(lateLeft ?? 0)}</Text>
              </Text>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                onClick={handleCheckIn}
                block
              >
                立即签到（迟到）
              </Button>
            </>
          )}
          {windowState.phase === 'closed' && (
            <Text type="secondary">
              {liveClass?.status === LiveClassStatus.ENDED
                ? '签到窗口已关闭，未签到已统一记为缺勤'
                : '签到窗口已关闭（直播开始 10 分钟后无法签到）'}
            </Text>
          )}
          {(rejectReason || windowState.rejectReason) && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 4 }}
              message={rejectReason || windowState.rejectReason || ''}
            />
          )}
        </Space>
      </Card>
    );
  };

  if (loading) {
    return <Card><div style={{ textAlign: 'center', padding: 50 }}>加载中...</div></Card>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {liveClass?.title}
        </Title>
        {liveClass && getStatusTag(liveClass.status)}
      </Space>

      <div className="live-container">
        <div className="live-video-area">
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ color: 'white' }}>直播区域</Title>
            <Text style={{ color: 'white', opacity: 0.7 }}>
              {liveClass?.status === LiveClassStatus.LIVE ? '直播进行中...' : '等待直播开始...'}
            </Text>
            <div style={{ marginTop: 24 }}>
              <Space>
                {isTeacher && liveClass?.status === LiveClassStatus.SCHEDULED && (
                  <Button type="primary" size="large" onClick={startLive}>
                    开始直播
                  </Button>
                )}
                {isTeacher && liveClass?.status === LiveClassStatus.LIVE && (
                  <Button type="primary" danger size="large" loading={ending} onClick={endLive}>
                    结束直播
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </div>

        <div className="live-sidebar">
          <div className="attendance-panel" style={{ padding: 12, paddingBottom: 0 }}>
            {renderCheckInPanel()}
          </div>
          <Card title="互动聊天" size="small" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className="chat-message">
                  <Space>
                    <Avatar size="small" style={{ background: '#1890ff' }}>
                      {msg.userName?.[0]}
                    </Avatar>
                    <div>
                      <Text strong>{msg.userName}</Text>
                      <div style={{ fontSize: 14 }}>{msg.message}</div>
                    </div>
                  </Space>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="输入弹幕消息..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onPressEnter={sendMessage}
                />
                <Button type="primary" onClick={sendMessage}>
                  发送
                </Button>
              </Space.Compact>
              <div style={{ marginTop: 12 }}>
                <Space>
                  <Button
                    type={handRaised ? 'primary' : 'default'}
                    icon={<LikeOutlined />}
                    onClick={toggleHand}
                    disabled={liveClass?.status !== LiveClassStatus.LIVE}
                  >
                    {handRaised ? '放下手' : '举手'}
                  </Button>
                </Space>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
