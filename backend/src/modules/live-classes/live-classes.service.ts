import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LiveClass, LiveClassStatus } from '../../common/entities/live-class.entity';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class LiveClassesService {
  constructor(
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly attendanceService: AttendanceService,
  ) {}

  async findAll() {
    return this.liveClassRepository.find({
      relations: ['course', 'teacher'],
      order: { scheduledStartTime: 'DESC' },
    });
  }

  async findOne(id: string) {
    const liveClass = await this.liveClassRepository.findOne({
      where: { id },
      relations: ['course', 'teacher'],
    });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    return liveClass;
  }

  async create(userId: string, data: Partial<LiveClass>) {
    const liveClass = this.liveClassRepository.create({
      ...data,
      teacherId: userId,
      status: LiveClassStatus.SCHEDULED,
    });
    return this.liveClassRepository.save(liveClass);
  }

  /**
   * 开始直播。幂等：重复开始不改变 actualStartTime，
   * 保证签到窗口（以 actualStartTime 为起点）不会被并发/重复操作挪动。
   */
  async startLive(userId: string, id: string) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    if (liveClass.teacherId !== userId) {
      throw new ForbiddenException('无权操作此直播');
    }

    if (liveClass.status === LiveClassStatus.ENDED) {
      throw new ConflictException('直播已结束，不能重新开始');
    }
    if (liveClass.status === LiveClassStatus.LIVE) {
      return liveClass;
    }

    const now = new Date();
    await this.liveClassRepository.update(
      { id, status: LiveClassStatus.SCHEDULED },
      { status: LiveClassStatus.LIVE, actualStartTime: now },
    );

    return this.liveClassRepository.findOne({ where: { id } });
  }

  /**
   * 结束直播。
   * - 条件更新 status: live -> ended，并发重复结束只有一次成功
   * - 同一事务内把已报名但未签到的学生统一记缺勤，签到汇总与结束状态一次落盘
   */
  async endLive(userId: string, id: string) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    if (liveClass.teacherId !== userId) {
      throw new ForbiddenException('无权操作此直播');
    }

    const endTime = new Date();

    return this.dataSource.transaction(async (manager) => {
      // 先锁定直播行，串行化并发结束请求
      await manager
        .getRepository(LiveClass)
        .createQueryBuilder('lc')
        .setLock('pessimistic_write')
        .where('lc.id = :id', { id })
        .getOne();

      // 条件更新：只有仍处于 live 的行可以结束
      const result = await manager
        .createQueryBuilder()
        .update(LiveClass)
        .set({ status: LiveClassStatus.ENDED, endTime })
        .where('id = :id', { id })
        .andWhere('status = :status', { status: LiveClassStatus.LIVE })
        .execute();

      if (!result.affected || result.affected === 0) {
        // 行锁内查到当前状态，给出准确的拒绝原因
        const current = await manager.getRepository(LiveClass).findOne({ where: { id } });
        if (current?.status === LiveClassStatus.ENDED) {
          throw new ConflictException('直播已结束，请勿重复操作');
        }
        throw new ConflictException('直播尚未开始，无法结束');
      }

      const endedLiveClass = await manager.getRepository(LiveClass).findOne({ where: { id } });

      // 未签到的已报名学生统一记缺勤，与结束状态在同一事务内提交
      await this.attendanceService.markAbsentForEnrolledStudents(endedLiveClass, manager);

      const summary = await this.attendanceService.getSummary(id, manager);

      return { liveClass: endedLiveClass, summary };
    });
  }

  async updateParticipants(id: string, count: number) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) return;

    liveClass.currentParticipants = Math.max(0, count);
    return this.liveClassRepository.save(liveClass);
  }
}
