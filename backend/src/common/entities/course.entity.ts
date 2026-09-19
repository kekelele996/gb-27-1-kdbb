import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { CourseLesson } from './course-lesson.entity';
import { CourseEnrollment } from './course-enrollment.entity';

export enum CourseType {
  FREE = 'free',
  PAID = 'paid',
}

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  cover: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: CourseType, default: CourseType.FREE })
  type: CourseType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column()
  category: string;

  @Column('simple-array', { default: [] })
  tags: string[];

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  status: CourseStatus;

  @Column()
  teacherId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacherId' })
  teacher: User;

  @OneToMany(() => CourseLesson, lesson => lesson.course)
  lessons: CourseLesson[];

  @OneToMany(() => CourseEnrollment, enrollment => enrollment.course)
  enrollments: CourseEnrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
