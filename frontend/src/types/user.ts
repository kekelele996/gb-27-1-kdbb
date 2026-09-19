export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

export enum TeacherStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface User {
  id: string;
  username?: string;
  email: string;
  phone?: string;
  role: UserRole;
  name: string;
  avatar?: string;
  teacherStatus?: TeacherStatus;
  teacherCertification?: string;
  wechatOpenId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResult {
  accessToken: string;
  user: User;
}

export interface LoginParams {
  account: string;
  password: string;
}

export interface RegisterParams {
  email: string;
  phone?: string;
  username?: string;
  password: string;
  name: string;
  role: UserRole;
}
