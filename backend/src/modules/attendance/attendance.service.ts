import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from '../../common/entities/attendance-record.entity';
import { LiveClass } from '../../common/entities/live-class.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(LiveClass)
    private readonly liveClassRepository: Repository<LiveClass>,
  ) {}

  async checkIn(studentId: string, liveClassId: string) {
    const liveClass = await this.liveClassRepository.findOne({ where: { id: liveClassId } });
    if (!liveClass) {
      throw new NotFoundException('直播课堂不存在');
    }
    
    const existingRecord = await this.attendanceRepository.findOne({
      where: { studentId, liveClassId },
    });
    
    if (existingRecord) {
      existingRecord.status = AttendanceStatus.PRESENT;
      existingRecord.checkInTime = new Date();
      return this.attendanceRepository.save(existingRecord);
    }
    
    const record = this.attendanceRepository.create({
      studentId,
      liveClassId,
      status: AttendanceStatus.PRESENT,
      checkInTime: new Date(),
    });
    
    return this.attendanceRepository.save(record);
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
