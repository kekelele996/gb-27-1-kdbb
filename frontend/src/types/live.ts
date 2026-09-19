export enum LiveClassStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
}

export interface LiveClass {
  id: string;
  title: string;
  courseId: string;
  lessonId: string;
  teacherId: string;
  status: LiveClassStatus;
  maxParticipants: number;
  currentParticipants: number;
  scheduledStartTime?: string;
  actualStartTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
}

export interface AttendanceRecord {
  id: string;
  liveClassId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  signInDuration: number;
  createdAt: string;
  updatedAt: string;
}

export type CheckInWindowPhase = 'not_open' | 'present' | 'late' | 'closed';

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
}

export interface CheckInWindow {
  status: LiveClassStatus;
  actualStartTime: string | null;
  windowOpenAt: string | null;
  presentDeadline: string | null;
  lateDeadline: string | null;
  phase: CheckInWindowPhase;
  myRecord: AttendanceRecord | null;
  canCheckIn: boolean;
  rejectReason: string | null;
  summary: AttendanceSummary | null;
}

export interface CheckInResult {
  record: AttendanceRecord;
  repeated: boolean;
}

export interface EndLiveResult {
  liveClass: LiveClass;
  summary: AttendanceSummary;
}
