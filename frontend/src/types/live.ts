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
  scheduledStartTime?: Date;
  actualStartTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}
