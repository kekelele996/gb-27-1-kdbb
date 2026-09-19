export enum CourseType {
  FREE = 'free',
  PAID = 'paid',
}

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export interface Course {
  id: string;
  name: string;
  cover: string;
  description: string;
  type: CourseType;
  price: number;
  category: string;
  tags: string[];
  status: CourseStatus;
  teacherId: string;
  teacher?: any;
  lessons?: CourseLesson[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  duration: number;
  order: number;
  videoUrl?: string;
  coursewareUrl?: string;
  isLive: boolean;
  liveStartTime?: Date;
  liveEndTime?: Date;
  isRecordingGenerated: boolean;
  courseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnrollment {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  status: string;
  enrolledAt?: Date;
  course?: Course;
}
