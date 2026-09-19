import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../../common/entities/attendance-record.entity';
import { LiveClass, LiveClassStatus } from '../../common/entities/live-class.entity';
import { User, UserRole } from '../../common/entities/user.entity';
import { CourseEnrollment } from '../../common/entities/course-enrollment.entity';

/** 直播开始后多少秒内签到算出勤 */
export const PRESENT_WINDOW_SECONDS = 5 * 60;
/** 直播开始后多少秒内签到算迟到，超过即签到窗口关闭 */
export const LATE_WINDOW_SECONDS = 10 * 60;

export type CheckInWindowPhase = 'not_open' | 'present' | 'late' | 'closed';

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
}

export interface CheckInResult {
  record: AttendanceRecord;
  /** 是否为重复提交（true 时 record 为原签到记录，状态、时间均不变） */
  repeated: boolean;
}

export interface CheckInWindow {
  status: LiveClassStatus;
  actualStartTime: Date | null;
  windowOpenAt: Date | null;
  presentDeadline: Date | null;
  lateDeadline: Date | null;
  phase: CheckInWindowPhase;
  myRecord: AttendanceRecord | null;
  canCheckIn: boolean;
  rejectReason: string | null;
  summary: AttendanceSummary | null;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 学生签到。
   * - 直播开始 5 分钟内：出勤(present)
   * - 5~10 分钟：迟到(late)
   * - 重复提交：原样返回已有记录，不做任何修改
   * - 未开窗 / 窗口关闭 / 未报名 / 教师签到：整次拒绝（4xx，不写数据）
   */
  async checkIn(studentId: string, liveClassId: string): Promise<CheckInResult> {
    // 用户本人已签到（出勤/迟到记录必有 checkInTime）时重复提交始终短路：
    // 原样返回已有记录，与窗口状态无关，绝不修改。
    // 注意：结束时系统补记的缺勤记录 checkInTime 为空，不属于“重复提交”，
    // 仍需走窗口校验并被拒绝，且缺勤记录保持不变。
    const existingRecord = await this.attendanceRepository.findOne({
      where: { studentId, liveClassId },
    });
    if (existingRecord?.checkInTime) {
      return { record: existingRecord, repeated: true };
    }

    return this.dataSource.transaction(async (manager) => {
      // 锁定直播行，保证与“结束直播”互斥：要么先签到成功，要么先结束记缺勤
      const liveClass = await manager
        .getRepository(LiveClass)
        .createQueryBuilder('lc')
        .setLock('pessimistic_write')
        .where('lc.id = :id', { id: liveClassId })
        .getOne();

      if (!liveClass) {
        throw new NotFoundException('直播课堂不存在');
      }

      // 并发情况下可能已在等待锁期间被其他请求写入记录
      const racedRecord = await manager.getRepository(AttendanceRecord).findOne({
        where: { studentId, liveClassId },
      });
      if (racedRecord?.checkInTime) {
        return { record: racedRecord, repeated: true };
      }

      // 教师不允许签到
      const user = await manager.getRepository(User).findOne({
        where: { id: studentId },
        select: { id: true, role: true },
      });

      if (!user || user.role !== UserRole.STUDENT) {
        throw new ForbiddenException('教师无需签到');
      }

      // 签到窗口判定
      if (liveClass.status === LiveClassStatus.ENDED) {
        throw new BadRequestException('直播已结束，签到窗口已关闭');
      }
      if (liveClass.status !== LiveClassStatus.LIVE || !liveClass.actualStartTime) {
        throw new BadRequestException('签到尚未开始，请在直播开始后签到');
      }

      const elapsedSeconds =
        (Date.now() - new Date(liveClass.actualStartTime).getTime()) / 1000;

      let status: AttendanceStatus;
      if (elapsedSeconds < 0) {
        // 服务器时钟回拨等异常情况，按未开窗处理
        throw new BadRequestException('签到尚未开始，请在直播开始后签到');
      } else if (elapsedSeconds <= PRESENT_WINDOW_SECONDS) {
        status = AttendanceStatus.PRESENT;
      } else if (elapsedSeconds <= LATE_WINDOW_SECONDS) {
        status = AttendanceStatus.LATE;
      } else {
        throw new BadRequestException('签到窗口已关闭');
      }

      // 必须是已报名（加入）该课程的学生
      const enrollment = await manager
        .getRepository(CourseEnrollment)
        .createQueryBuilder('enrollment')
        .where('enrollment.studentId = :studentId', { studentId })
        .andWhere('enrollment.courseId = :courseId', { courseId: liveClass.courseId })
        .getRawOne();

      if (!enrollment) {
        throw new ForbiddenException('未报名该课程，无法签到');
      }

      const now = new Date();
      const record = manager.getRepository(AttendanceRecord).create({
        studentId,
        liveClassId,
        status,
        checkInTime: now,
        signInDuration: Math.max(0, Math.floor(elapsedSeconds)),
      });

      try {
        const saved = await manager.getRepository(AttendanceRecord).save(record);
        return { record: saved, repeated: false };
      } catch (error) {
        // 唯一约束 (liveClassId, studentId) 兜底并发重复提交
        if (error?.code === '23505') {
          const original = await this.attendanceRepository.findOne({
            where: { studentId, liveClassId },
          });
          return { record: original, repeated: true };
        }
        throw error;
      }
    });
  }

  /** 签到窗口状态 + 当前用户的签到记录，供页面回显与刷新后回读 */
  async getCheckInWindow(userId: string, role: UserRole, liveClassId: string): Promise<CheckInWindow> {
    const liveClass = await this.liveClassRepository.findOne({ where: { id: liveClassId } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }

    const myRecord =
      role === UserRole.STUDENT
        ? await this.attendanceRepository.findOne({ where: { studentId: userId, liveClassId } })
        : null;

    const base = {
      status: liveClass.status,
      actualStartTime: liveClass.actualStartTime,
      windowOpenAt: liveClass.actualStartTime,
      presentDeadline: liveClass.actualStartTime
        ? new Date(new Date(liveClass.actualStartTime).getTime() + PRESENT_WINDOW_SECONDS * 1000)
        : null,
      lateDeadline: liveClass.actualStartTime
        ? new Date(new Date(liveClass.actualStartTime).getTime() + LATE_WINDOW_SECONDS * 1000)
        : null,
    };

    const summary =
      liveClass.status === LiveClassStatus.ENDED
        ? await this.getSummary(liveClassId)
        : null;

    if (liveClass.status === LiveClassStatus.ENDED) {
      return {
        ...base,
        phase: 'closed',
        myRecord,
        canCheckIn: false,
        rejectReason: myRecord ? null : '签到窗口已关闭，直播已结束',
        summary,
      };
    }

    if (liveClass.status === LiveClassStatus.SCHEDULED || !liveClass.actualStartTime) {
      return {
        ...base,
        phase: 'not_open',
        myRecord,
        canCheckIn: false,
        rejectReason: role === UserRole.STUDENT ? '签到尚未开始，请在直播开始后签到' : null,
        summary: null,
      };
    }

    const elapsedSeconds =
      (Date.now() - new Date(liveClass.actualStartTime).getTime()) / 1000;

    if (elapsedSeconds <= PRESENT_WINDOW_SECONDS) {
      return {
        ...base,
        phase: 'present',
        myRecord,
        canCheckIn: role === UserRole.STUDENT && !myRecord,
        rejectReason: null,
        summary: null,
      };
    }

    if (elapsedSeconds <= LATE_WINDOW_SECONDS) {
      return {
        ...base,
        phase: 'late',
        myRecord,
        canCheckIn: role === UserRole.STUDENT && !myRecord,
        rejectReason: null,
        summary: null,
      };
    }

    return {
      ...base,
      phase: 'closed',
      myRecord,
      canCheckIn: false,
      rejectReason: myRecord ? null : '签到窗口已关闭',
      summary: null,
    };
  }

  /**
   * 直播结束的落盘动作（由 LiveClassesService 在结束事务内调用）：
   * 所有已报名但尚无签到记录的学生统一记缺勤，一次事务写入。
   */
  async markAbsentForEnrolledStudents(liveClass: LiveClass, manager?: DataSource['manager']) {
    const run = async (m: DataSource['manager']) => {
      const enrolledStudentIds: { studentId: string }[] = await m
        .getRepository(CourseEnrollment)
        .createQueryBuilder('enrollment')
        .select('enrollment.studentId', 'studentId')
        .where('enrollment.courseId = :courseId', { courseId: liveClass.courseId })
        .getRawMany();

      if (enrolledStudentIds.length === 0) {
        return;
      }

      const checkedInStudentIds: string[] = (
        await m
          .getRepository(AttendanceRecord)
          .createQueryBuilder('record')
          .select('record.studentId', 'studentId')
          .where('record.liveClassId = :liveClassId', { liveClassId: liveClass.id })
          .getRawMany<{ studentId: string }>()
      ).map((row) => row.studentId);

      const checkedInSet = new Set(checkedInStudentIds);
      const absentStudentIds = enrolledStudentIds
        .map((row) => row.studentId)
        .filter((studentId) => !checkedInSet.has(studentId));

      if (absentStudentIds.length === 0) {
        return;
      }

      const records = absentStudentIds.map((studentId) =>
        m.getRepository(AttendanceRecord).create({
          studentId,
          liveClassId: liveClass.id,
          status: AttendanceStatus.ABSENT,
        }),
      );

      // 分块保存，避免单次参数过多
      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        await m.getRepository(AttendanceRecord).save(records.slice(i, i + chunkSize));
      }
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  /** 某场直播的签到汇总：应到/出勤/迟到/缺勤 */
  async getSummary(liveClassId: string, manager?: DataSource['manager']): Promise<AttendanceSummary> {
    const repository = manager
      ? manager.getRepository(AttendanceRecord)
      : this.attendanceRepository;

    const rows = await repository
      .createQueryBuilder('record')
      .select('record.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('record.liveClassId = :liveClassId', { liveClassId })
      .groupBy('record.status')
      .getRawMany<{ status: AttendanceStatus; count: string }>();

    const counts = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.ABSENT]: 0,
    };
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }

    const present = counts[AttendanceStatus.PRESENT];
    const late = counts[AttendanceStatus.LATE];
    const absent = counts[AttendanceStatus.ABSENT];

    return {
      total: present + late + absent,
      present,
      late,
      absent,
    };
  }

  async getRecordsByLiveClass(liveClassId: string) {
    return this.attendanceRepository.find({
      where: { liveClassId },
      relations: ['student'],
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
