import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { LiveClass } from './live-class.entity';

/**
 * 签到汇总：直播结束时与直播状态在同一事务中一次落盘
 */
@Entity('attendance_summaries')
export class AttendanceSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => LiveClass)
  @JoinColumn({ name: 'liveClassId' })
  liveClass: LiveClass;

  @Column({ unique: true })
  liveClassId: string;

  @Column({ type: 'int', default: 0 })
  totalEnrolled: number;

  @Column({ type: 'int', default: 0 })
  presentCount: number;

  @Column({ type: 'int', default: 0 })
  lateCount: number;

  @Column({ type: 'int', default: 0 })
  absentCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
