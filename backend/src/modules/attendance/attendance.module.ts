import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../../common/entities/attendance-record.entity';
import { LiveClass } from '../../common/entities/live-class.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, LiveClass])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
