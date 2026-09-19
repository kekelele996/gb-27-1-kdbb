import { Button, Input, Card, Typography, Tag, Space, message, Avatar } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, LikeOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { liveClassApi, attendanceApi } from '@/api/live';
import { LiveClass as LiveClassType, LiveClassStatus } from '@/types/live';
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

export default function LiveClass() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liveClass, setLiveClass] = useState<LiveClassType | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
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
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadLiveClass = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await liveClassApi.get(id);
      setLiveClass(data);
    } finally {
      setLoading(false);
    }
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    try {
      await attendanceApi.checkIn(id);
      setCheckedIn(true);
      message.success('签到成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '签到失败');
    }
  };

  const startLive = async () => {
    if (!id) return;
    try {
      const updated = await liveClassApi.start(id);
      setLiveClass(updated);
      message.success('直播已开始');
    } catch (error: any) {
      message.error(error.response?.data?.message || '开始直播失败');
    }
  };

  const endLive = async () => {
    if (!id) return;
    try {
      const updated = await liveClassApi.end(id);
      setLiveClass(updated);
      message.success('直播已结束');
    } catch (error: any) {
      message.error(error.response?.data?.message || '结束直播失败');
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
                  <Button type="primary" danger size="large" onClick={endLive}>
                    结束直播
                  </Button>
                )}
                {!isTeacher && liveClass?.status === LiveClassStatus.LIVE && !checkedIn && (
                  <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleCheckIn}>
                    签到
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </div>

        <div className="live-sidebar">
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
