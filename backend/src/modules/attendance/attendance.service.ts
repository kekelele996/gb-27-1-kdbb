import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../../common/entities/attendance-record.entity';
import { AttendanceSummary } from '../../common/entities/attendance-summary.entity';
import { LiveClass, LiveClassStatus } from '../../common/entities/live-class.entity';
import { CourseEnrollment, EnrollmentStatus } from '../../common/entities/course-enrollment.entity';
import { User, UserRole } from '../../common/entities/user.entity';

/** 直播开始后 5 分钟内签到 => 出勤 */
export const PRESENT_WINDOW_MS = 5 * 60 * 1000;
/** 5～10 分钟内签到 => 迟到，超过 10 分钟窗口关闭 */
export const LATE_WINDOW_MS = 10 * 60 * 1000;

/** 签到被整次拒绝的原因码（前端据此展示拒绝原因） */
export const AttendanceRejectReason = {
  LIVE_CLASS_NOT_FOUND: 'LIVE_CLASS_NOT_FOUND',
  WINDOW_NOT_OPENED: 'WINDOW_NOT_OPENED',
  WINDOW_CLOSED: 'WINDOW_CLOSED',
  NOT_ENROLLED: 'NOT_ENROLLED',
  ROLE_FORBIDDEN: 'ROLE_FORBIDDEN',
} as const;

export type CheckInPhase = 'not_opened' | 'present' | 'late' | 'closed' | 'ended';

export interface CheckInWindow {
  liveClassId: string;
  liveStatus: LiveClassStatus;
  actualStartTime: Date | null;
  endTime: Date | null;
  presentDeadline: Date | null;
  lateDeadline: Date | null;
  serverTime: Date;
  phase: CheckInPhase;
  isOpen: boolean;
  presentRemainingMs: number;
  lateRemainingMs: number;
}

export interface CheckInResult {
  record: AttendanceRecord | null;
  window: CheckInWindow;
  /** 是否为重复提交（true 时原样返回首次记录，签到状态与时间不变） */
  duplicated: boolean;
  summary: AttendanceSummary | null;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(AttendanceSummary)
    private readonly summaryRepository: Repository<AttendanceSummary>,
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    private readonly dataSource: DataSource,
  ) {}

  private rejected(
    code: keyof typeof AttendanceRejectReason,
    message: string,
    ctor: typeof BadRequestException | typeof ForbiddenException | typeof NotFoundException,
  ): never {
    throw new ctor({ code, message, rejected: true } as any);
  }

  private buildWindow(liveClass: LiveClass, now: Date = new Date()): CheckInWindow {
    const start = liveClass.actualStartTime ? new Date(liveClass.actualStartTime) : null;
    const presentDeadline = start ? new Date(start.getTime() + PRESENT_WINDOW_MS) : null;
    const lateDeadline = start ? new Date(start.getTime() + LATE_WINDOW_MS) : null;

    let phase: CheckInPhase;
    if (liveClass.status === LiveClassStatus.SCHEDULED || !start || now.getTime() < start.getTime()) {
      phase = 'not_opened';
    } else if (liveClass.status === LiveClassStatus.ENDED) {
      phase = 'ended';
    } else {
      const elapsed = now.getTime() - start.getTime();
      if (elapsed <= PRESENT_WINDOW_MS) {
        phase = 'present';
      } else if (elapsed <= LATE_WINDOW_MS) {
        phase = 'late';
      } else {
        phase = 'closed';
      }
    }

    return {
      liveClassId: liveClass.id,
      liveStatus: liveClass.status,
      actualStartTime: start,
      endTime: liveClass.endTime ? new Date(liveClass.endTime) : null,
      presentDeadline,
      lateDeadline,
      serverTime: now,
      phase,
      isOpen: phase === 'present' || phase === 'late',
      presentRemainingMs: presentDeadline
        ? Math.max(0, presentDeadline.getTime() - now.getTime())
        : 0,
      lateRemainingMs: lateDeadline ? Math.max(0, lateDeadline.getTime() - now.getTime()) : 0,
    };
  }

  /**
   * 学生签到。任何拒绝场景都不产生写入：
   * 未开窗 / 窗口关闭 / 未报名 / 教师（含管理员）签到整次拒绝；
   * 重复提交原样返回首次记录。
   */
  async checkIn(user: User, liveClassId: string): Promise<CheckInResult> {
    const liveClass = await this.liveClassRepository.findOne({ where: { id: liveClassId } });
    if (!liveClass) {
      this.rejected('LIVE_CLASS_NOT_FOUND', '直播课堂不存在', NotFoundException);
    }

    // 教师、管理员不能签到，整次拒绝
    if (user.role !== UserRole.STUDENT) {
      this.rejected('ROLE_FORBIDDEN', '教师和管理员无需签到', ForbiddenException);
    }

    const now = new Date();
    const window_ = this.buildWindow(liveClass, now);

    if (window_.phase === 'not_opened') {
      this.rejected('WINDOW_NOT_OPENED', '签到尚未开始，请在直播开始后 10 分钟内签到', BadRequestException);
    }
    if (window_.phase === 'ended' || window_.phase === 'closed') {
      this.rejected('WINDOW_CLOSED', '签到窗口已关闭', BadRequestException);
    }

    // 未报名学生整次拒绝
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentId: user.id, courseId: liveClass.courseId, status: EnrollmentStatus.ACTIVE },
    });
    if (!enrollment) {
      this.rejected('NOT_ENROLLED', '未报名该课程，无法签到', ForbiddenException);
    }

    // 重复提交：直接返回原记录，不改状态、不改时间
    const existing = await this.attendanceRepository.findOne({
      where: { studentId: user.id, liveClassId },
    });
    if (existing) {
      const summary = await this.summaryRepository.findOne({ where: { liveClassId } });
      return { record: existing, window: window_, duplicated: true, summary };
    }

    const status =
      window_.phase === 'present' ? AttendanceStatus.PRESENT : AttendanceStatus.LATE;
    const elapsed = liveClass.actualStartTime
      ? Math.max(0, now.getTime() - new Date(liveClass.actualStartTime).getTime())
      : 0;

    const record = this.attendanceRepository.create({
      studentId: user.id,
      liveClassId,
      status,
      checkInTime: now,
      signInDuration: Math.floor(elapsed / 1000),
    });

    try {
      await this.attendanceRepository.save(record);
    } catch (err: any) {
      // 并发下唯一约束 (studentId, liveClassId) 冲突 => 视为重复提交，回读原记录
      if (err?.code === '23505') {
        const original = await this.attendanceRepository.findOneOrFail({
          where: { studentId: user.id, liveClassId },
        });
        const summary = await this.summaryRepository.findOne({ where: { liveClassId } });
        return { record: original, window: window_, duplicated: true, summary };
      }
      throw err;
    }

    return { record, window: window_, duplicated: false, summary: null };
  }

  /** 当前登录用户视角的签到窗口与结果（刷新后回读一致） */
  async getWindow(user: User, liveClassId: string): Promise<CheckInResult> {
    const liveClass = await this.liveClassRepository.findOne({ where: { id: liveClassId } });
    if (!liveClass) {
      this.rejected('LIVE_CLASS_NOT_FOUND', '直播课堂不存在', NotFoundException);
    }
    const window_ = this.buildWindow(liveClass!);
    const record =
      user.role === UserRole.STUDENT
        ? await this.attendanceRepository.findOne({ where: { studentId: user.id, liveClassId } })
        : null;
    const summary = await this.summaryRepository.findOne({ where: { liveClassId } });
    return { record, window: window_, duplicated: false, summary };
  }

  /**
   * 直播结束时在同一个事务内调用：
   * 已报名但尚未签到的学生统一记缺勤，并落盘签到汇总。
   * 必须由 endLive 的事务（queryRunner.manager）调用，保证汇总与结束状态一次落盘。
   */
  async finalizeAttendance(manager: EntityManager, liveClass: LiveClass): Promise<AttendanceSummary> {
    const liveClassId = liveClass.id;

    const enrollments = await manager.find(CourseEnrollment, {
      where: { courseId: liveClass.courseId, status: EnrollmentStatus.ACTIVE },
    });

    if (enrollments.length > 0) {
      const checkedIn = await manager.find(AttendanceRecord, { where: { liveClassId } });
      const checkedInIds = new Set(checkedIn.map((r) => r.studentId));
      const absentRecords = enrollments
        .filter((e) => !checkedInIds.has(e.studentId))
        .map((e) =>
          manager.create(AttendanceRecord, {
            studentId: e.studentId,
            liveClassId,
            status: AttendanceStatus.ABSENT,
            checkInTime: null,
          }),
        );
      if (absentRecords.length > 0) {
        await manager.save(absentRecords);
      }
    }

    const records = await manager.find(AttendanceRecord, { where: { liveClassId } });
    const presentCount = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const lateCount = records.filter((r) => r.status === AttendanceStatus.LATE).length;
    const absentCount = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;

    let summary = await manager.findOne(AttendanceSummary, { where: { liveClassId } });
    if (!summary) {
      summary = manager.create(AttendanceSummary, { liveClassId });
    }
    summary.totalEnrolled = enrollments.length;
    summary.presentCount = presentCount;
    summary.lateCount = lateCount;
    summary.absentCount = absentCount;
    return manager.save(summary);
  }

  async getSummary(liveClassId: string): Promise<AttendanceSummary | null> {
    return this.summaryRepository.findOne({ where: { liveClassId } });
  }

  async getRecordsByLiveClass(liveClassId: string) {
    return this.attendanceRepository.find({
      where: { liveClassId },
      relations: ['student'],
      order: { checkInTime: 'ASC' },
    });
  }

  async getMyRecords(studentId: string, courseId?: string) {
    const queryBuilder = this.attendanceRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.liveClass', 'liveClass')
      .leftJoinAndSelect('record.student', 'student')
      .where('record.studentId = :studentId', { studentId });

    if (courseId) {
      queryBuilder.andWhere('liveClass.courseId = :courseId', { courseId });
    }

    return queryBuilder.orderBy('record.createdAt', 'DESC').getMany();
  }
}
