import { api } from './index';
import { LiveClass } from '@/types/live';
import type { AttendanceRecord, AttendanceSummary, CheckInResult } from '@/types/attendance';

export const liveClassApi = {
  list: () => api.get<LiveClass[]>('/live-classes').then(res => res.data),
  get: (id: string) => api.get<LiveClass>(`/live-classes/${id}`).then(res => res.data),
  create: (data: Partial<LiveClass>) => api.post<LiveClass>('/live-classes', data).then(res => res.data),
  start: (id: string) => api.post<LiveClass>(`/live-classes/${id}/start`).then(res => res.data),
  end: (id: string) => api.post<LiveClass>(`/live-classes/${id}/end`).then(res => res.data),
};

export const attendanceApi = {
  checkIn: (liveClassId: string) =>
    api.post<CheckInResult>('/attendance/check-in', { liveClassId }).then(res => res.data),
  getWindow: (liveClassId: string) =>
    api.get<CheckInResult>(`/attendance/live-class/${liveClassId}/window`).then(res => res.data),
  getSummary: (liveClassId: string) =>
    api.get<AttendanceSummary | null>(`/attendance/live-class/${liveClassId}/summary`).then(res => res.data),
  getByLiveClass: (liveClassId: string) =>
    api.get<AttendanceRecord[]>(`/attendance/live-class/${liveClassId}`).then(res => res.data),
  getMyRecords: (courseId?: string) =>
    api.get('/attendance/my', { params: { courseId } }).then(res => res.data),
};
