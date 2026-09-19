import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Course } from './course.entity';

@Entity('course_lessons')
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column()
  order: number;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ nullable: true })
  coursewareUrl: string;

  @Column({ default: false })
  isLive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  liveStartTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  liveEndTime: Date;

  @Column({ default: false })
  isRecordingGenerated: boolean;

  @Column()
  courseId: string;

  @ManyToOne(() => Course, course => course.lessons)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
