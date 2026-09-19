import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Course } from './course.entity';
import { CourseLesson } from './course-lesson.entity';
import { User } from './user.entity';

export enum AssignmentType {
  TEXT = 'text',
  CHOICE = 'choice',
  ATTACHMENT = 'attachment',
}

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  courseId: string;

  @Column()
  lessonId: string;

  @Column()
  teacherId: string;

  @Column({ type: 'enum', enum: AssignmentType, default: AssignmentType.TEXT })
  type: AssignmentType;

  @Column({ type: 'simple-json', nullable: true })
  questions: any;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ type: 'int', default: 100 })
  maxScore: number;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @ManyToOne(() => CourseLesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: CourseLesson;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacherId' })
  teacher: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
