import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LiveClass, LiveClassStatus } from '../../common/entities/live-class.entity';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class LiveClassesService {
  constructor(
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
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

  async startLive(userId: string, id: string) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    if (liveClass.teacherId !== userId) {
      throw new ForbiddenException('无权操作此直播');
    }
    if (liveClass.status !== LiveClassStatus.SCHEDULED) {
      throw new BadRequestException('仅未开始的直播可以开播');
    }

    liveClass.status = LiveClassStatus.LIVE;
    liveClass.actualStartTime = new Date();
    liveClass.endTime = null;
    return this.liveClassRepository.save(liveClass);
  }

  /**
   * 结束直播：
   * - 行级悲观锁 + 状态判定保证并发重复结束只有一次成功；
   * - 未开始不可结束；已结束重复结束返回 409 冲突；
   * - 直播状态、缺勤补录、签到汇总在同一事务内一次落盘。
   */
  async endLive(userId: string, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const liveClass = await manager.findOne(LiveClass, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!liveClass) {
        throw new NotFoundException('直播课堂不存在');
      }
      if (liveClass.teacherId !== userId) {
        throw new ForbiddenException('无权操作此直播');
      }
      if (liveClass.status === LiveClassStatus.ENDED) {
        throw new ConflictException('直播已结束，请勿重复操作');
      }
      if (liveClass.status !== LiveClassStatus.LIVE) {
        throw new BadRequestException('直播尚未开始，无法结束');
      }

      liveClass.status = LiveClassStatus.ENDED;
      liveClass.endTime = new Date();
      const ended = await manager.save(liveClass);

      await this.attendanceService.finalizeAttendance(manager, ended);

      return ended;
    });
  }

  async updateParticipants(id: string, count: number) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) return;

    liveClass.currentParticipants = Math.max(0, count);
    return this.liveClassRepository.save(liveClass);
  }
}
