import { LiveClassStatus } from './live';

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
}

export type CheckInPhase = 'not_opened' | 'present' | 'late' | 'closed' | 'ended';

/** 签到被拒绝的原因码，与后端 AttendanceRejectReason 对应 */
export enum AttendanceRejectReason {
  LIVE_CLASS_NOT_FOUND = 'LIVE_CLASS_NOT_FOUND',
  WINDOW_NOT_OPENED = 'WINDOW_NOT_OPENED',
  WINDOW_CLOSED = 'WINDOW_CLOSED',
  NOT_ENROLLED = 'NOT_ENROLLED',
  ROLE_FORBIDDEN = 'ROLE_FORBIDDEN',
}

export interface CheckInWindow {
  liveClassId: string;
  liveStatus: LiveClassStatus;
  actualStartTime: string | null;
  endTime: string | null;
  presentDeadline: string | null;
  lateDeadline: string | null;
  serverTime: string;
  phase: CheckInPhase;
  isOpen: boolean;
  presentRemainingMs: number;
  lateRemainingMs: number;
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
  student?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface AttendanceSummary {
  id: string;
  liveClassId: string;
  totalEnrolled: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

export interface CheckInResult {
  record: AttendanceRecord | null;
  window: CheckInWindow;
  duplicated: boolean;
  summary: AttendanceSummary | null;
}
