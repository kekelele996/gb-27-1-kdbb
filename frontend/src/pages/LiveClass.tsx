import { Button, Input, Card, Typography, Tag, Space, message, Avatar, Statistic, Row, Col, Empty } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, LikeOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { liveClassApi, attendanceApi } from '@/api/live';
import { LiveClass as LiveClassType, LiveClassStatus } from '@/types/live';
import {
  AttendanceStatus,
  AttendanceRejectReason,
  CheckInPhase,
  CheckInResult,
  AttendanceSummary,
} from '@/types/attendance';
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

const REJECT_REASON_TEXT: Record<string, string> = {
  [AttendanceRejectReason.LIVE_CLASS_NOT_FOUND]: '直播课堂不存在',
  [AttendanceRejectReason.WINDOW_NOT_OPENED]: '签到窗口未开启：请在直播开始后再签到',
  [AttendanceRejectReason.WINDOW_CLOSED]: '签到窗口已关闭：开播 10 分钟后不再接受签到',
  [AttendanceRejectReason.NOT_ENROLLED]: '未报名该课程，无法签到',
  [AttendanceRejectReason.ROLE_FORBIDDEN]: '教师/管理员不需要签到',
};

const PHASE_META: Record<CheckInPhase, { text: string; color: string }> = {
  not_opened: { text: '签到未开窗', color: 'blue' },
  present: { text: '签到中（出勤窗口）', color: 'green' },
  late: { text: '签到中（迟到窗口）', color: 'orange' },
  closed: { text: '签到窗口已关闭', color: 'red' },
  ended: { text: '直播已结束', color: 'default' },
};

const STATUS_META: Record<AttendanceStatus, { text: string; color: string }> = {
  [AttendanceStatus.PRESENT]: { text: '出勤', color: 'green' },
  [AttendanceStatus.LATE]: { text: '迟到', color: 'orange' },
  [AttendanceStatus.ABSENT]: { text: '缺勤', color: 'red' },
};

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LiveClass() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liveClass, setLiveClass] = useState<LiveClassType | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const isTeacher = user?.role === UserRole.TEACHER;

  // 本地秒级心跳，驱动窗口倒计时显示
  useEffect(() => {
    timerRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const loadAttendanceState = useCallback(async () => {
    if (!id) return;
    try {
      if (isTeacher) {
        const s = await attendanceApi.getSummary(id);
        setSummary(s);
      } else {
        const result = await attendanceApi.getWindow(id);
        setCheckInResult(result);
        setSummary(result.summary);
      }
    } catch {
      // 拉取窗口失败时保留上一次状态，不影响课堂其他功能
    }
  }, [id, isTeacher]);

  useEffect(() => {
    if (id) {
      loadLiveClass();
      initSocket();
      loadAttendanceState();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // 直播进行中轮询，保证刷新/重进后回读一致；结束后读取最终汇总
  useEffect(() => {
    if (liveClass?.status !== LiveClassStatus.LIVE) return;
    const poll = window.setInterval(async () => {
      try {
        const fresh = await liveClassApi.get(id!);
        setLiveClass(fresh);
        await loadAttendanceState();
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearInterval(poll);
  }, [liveClass?.status, id, loadAttendanceState]);

  useEffect(() => {
    // 直播刚结束时补拉一次汇总
    if (liveClass?.status === LiveClassStatus.ENDED) {
      loadAttendanceState();
    }
  }, [liveClass?.status, loadAttendanceState]);

  useEffect(() => {
    // 已存在签到记录后，拒绝原因应清除
    if (checkInResult?.record) setRejectReason(null);
  }, [checkInResult]);

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
    if (!id || checkingIn) return;
    setCheckingIn(true);
    setRejectReason(null);
    try {
      const result = await attendanceApi.checkIn(id);
      setCheckInResult(result);
      setSummary(result.summary);
      if (result.duplicated) {
        message.info('你已签到，重复提交不重复记录');
      } else if (result.record?.status === AttendanceStatus.LATE) {
        message.warning('签到成功（迟到）');
      } else {
        message.success('签到成功（出勤）');
      }
    } catch (error: any) {
      const data = error.response?.data;
      const code: string | undefined = data?.code;
      const text = (code && REJECT_REASON_TEXT[code]) || data?.message || '签到失败';
      setRejectReason(text);
      message.error(`签到被拒绝：${text}`);
      // 拒绝后回读最新窗口，保证页面与服务端一致
      loadAttendanceState();
    } finally {
      setCheckingIn(false);
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
      await loadAttendanceState();
      message.success('直播已结束，考勤已汇总');
    } catch (error: any) {
      // 并发重复结束：服务端只允许一次成功，这里回读真实状态
      if (error.response?.status === 409) {
        message.warning('直播已经结束');
      } else {
        message.error(error.response?.data?.message || '结束直播失败');
      }
      await loadLiveClass();
      await loadAttendanceState();
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

  // 学生签到卡片
  const renderStudentAttendance = () => {
    const windowPhase = checkInResult?.window.phase ?? (liveClass?.status === LiveClassStatus.ENDED ? 'ended' : 'not_opened');
    const phaseMeta = PHASE_META[windowPhase as CheckInPhase];
    const record = checkInResult?.record;

    // 以服务端窗口时间为基准做本地倒计时，每秒心跳刷新 now
    const serverTime = checkInResult?.window.serverTime ? new Date(checkInResult.window.serverTime).getTime() : null;
    const skew = serverTime ? serverTime - Date.now() : 0;
    const syncedNow = now + skew;
    const presentRemaining = checkInResult?.window.presentDeadline
      ? new Date(checkInResult.window.presentDeadline).getTime() - syncedNow
      : 0;
    const lateRemaining = checkInResult?.window.lateDeadline
      ? new Date(checkInResult.window.lateDeadline).getTime() - syncedNow
      : 0;

    const canCheckIn =
      liveClass?.status === LiveClassStatus.LIVE &&
      (windowPhase === 'present' || windowPhase === 'late') &&
      !record;

    return (
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>课堂签到</span>
          </Space>
        }
        size="small"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            窗口状态：<Tag color={phaseMeta.color}>{phaseMeta.text}</Tag>
          </div>

          {liveClass?.status === LiveClassStatus.LIVE && windowPhase === 'present' && (
            <Text type="secondary">
              开播 5 分钟内签到为「出勤」，剩余 {formatCountdown(presentRemaining)}；之后至 10 分钟为「迟到」
            </Text>
          )}
          {liveClass?.status === LiveClassStatus.LIVE && windowPhase === 'late' && (
            <Text type="warning">
              已进入迟到窗口，剩余 {formatCountdown(lateRemaining)}，关闭后记缺勤
            </Text>
          )}
          {windowPhase === 'not_opened' && <Text type="secondary">直播开始后开窗，5 分钟内出勤、10 分钟内迟到</Text>}
          {windowPhase === 'closed' && <Text type="danger">签到窗口已关闭，结束后将统一记缺勤</Text>}

          {record ? (
            <div>
              <Space>
                <CheckCircleOutlined style={{ color: record.status === AttendanceStatus.PRESENT ? '#52c41a' : '#faad14' }} />
                <Text strong>签到结果：</Text>
                <Tag color={STATUS_META[record.status as AttendanceStatus].color}>
                  {STATUS_META[record.status as AttendanceStatus].text}
                </Tag>
                {checkInResult?.duplicated && <Tag>重复提交，返回原记录</Tag>}
              </Space>
              {record.checkInTime && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">签到时间：{new Date(record.checkInTime).toLocaleString()}</Text>
                </div>
              )}
            </div>
          ) : (
            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              onClick={handleCheckIn}
              loading={checkingIn}
              disabled={!canCheckIn}
            >
              {windowPhase === 'late' ? '签到（迟到）' : '签到'}
            </Button>
          )}

          {rejectReason && !record && (
            <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7' }}>
              <Text type="danger" strong>签到被拒绝：{rejectReason}</Text>
              <div>
                <Text type="secondary">原签到记录与直播状态不受影响</Text>
              </div>
            </Card>
          )}

          {liveClass?.status === LiveClassStatus.ENDED && !record && (
            <Tag color="red">未在窗口内签到，已记缺勤</Tag>
          )}
        </Space>
      </Card>
    );
  };

  const renderTeacherSummary = () => {
    if (liveClass?.status !== LiveClassStatus.ENDED || !summary) {
      return liveClass?.status === LiveClassStatus.LIVE ? (
        <Card title={<span><ClockCircleOutlined /> 签到</span>} size="small">
          <Text type="secondary">签到窗口为开播后 10 分钟，结束直播时统一汇总缺勤并生成考勤报表</Text>
        </Card>
      ) : null;
    }
    return (
      <Card title="签到汇总（结束时已落盘）" size="small">
        <Row gutter={[8, 12]}>
          <Col span={12}><Statistic title="已报名" value={summary.totalEnrolled} /></Col>
          <Col span={12}><Statistic title="出勤" value={summary.presentCount} valueStyle={{ color: '#3f8600' }} /></Col>
          <Col span={12}><Statistic title="迟到" value={summary.lateCount} valueStyle={{ color: '#d48806' }} /></Col>
          <Col span={12}><Statistic title="缺勤" value={summary.absentCount} valueStyle={{ color: '#cf1322' }} /></Col>
        </Row>
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
                  <Button type="primary" danger size="large" onClick={endLive}>
                    结束直播
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </div>

        <div className="live-sidebar">
          {!isTeacher ? renderStudentAttendance() : renderTeacherSummary()}
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
              {messages.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />}
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
