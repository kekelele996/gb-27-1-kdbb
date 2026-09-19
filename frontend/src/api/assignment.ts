import { api } from './index';
import { Assignment, AssignmentSubmission } from '@/types/assignment';

export const assignmentApi = {
  list: (courseId: string) => api.get<Assignment[]>(`/assignments?courseId=${courseId}`).then(res => res.data),
  get: (id: string) => api.get<Assignment>(`/assignments/${id}`).then(res => res.data),
  create: (data: Partial<Assignment>) => api.post<Assignment>('/assignments', data).then(res => res.data),
  submit: (assignmentId: string, data: Partial<AssignmentSubmission>) =>
    api.post<AssignmentSubmission>(`/assignments/${assignmentId}/submit`, data).then(res => res.data),
  getMySubmission: (assignmentId: string) =>
    api.get<AssignmentSubmission | null>(`/assignments/${assignmentId}/my-submission`).then(res => res.data),
  getSubmissions: (assignmentId: string) =>
    api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`).then(res => res.data),
  grade: (submissionId: string, score: number, feedback: string) =>
    api.post<AssignmentSubmission>(`/assignments/submissions/${submissionId}/grade`, { score, feedback }).then(res => res.data),
};

export const statisticsApi = {
  getMyStats: () => api.get('/statistics/my').then(res => res.data),
};
