import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveClass, LiveClassStatus } from '../../common/entities/live-class.entity';

@Injectable()
export class LiveClassesService {
  constructor(
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
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
    
    liveClass.status = LiveClassStatus.LIVE;
    liveClass.actualStartTime = new Date();
    return this.liveClassRepository.save(liveClass);
  }

  async endLive(userId: string, id: string) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    if (liveClass.teacherId !== userId) {
      throw new ForbiddenException('无权操作此直播');
    }
    
    liveClass.status = LiveClassStatus.ENDED;
    liveClass.endTime = new Date();
    return this.liveClassRepository.save(liveClass);
  }

  async updateParticipants(id: string, count: number) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id } });
    if (!liveClass) return;
    
    liveClass.currentParticipants = Math.max(0, count);
    return this.liveClassRepository.save(liveClass);
  }
}
