import { api } from './index';
import { LoginParams, RegisterParams, LoginResult, User } from '@/types/user';

export const authApi = {
  login: (data: LoginParams) => api.post<LoginResult>('/auth/login', data).then(res => res.data),
  register: (data: RegisterParams) => api.post<LoginResult>('/auth/register', data).then(res => res.data),
  getProfile: () => api.get<User>('/auth/profile').then(res => res.data),
};

export const userApi = {
  getProfile: () => api.get<User>('/users/profile').then(res => res.data),
  updateProfile: (data: Partial<User>) => api.put<User>('/users/profile', data).then(res => res.data),
  submitTeacherCertification: (certification: string) => 
    api.post<User>('/users/teacher-certification', { certification }).then(res => res.data),
};
