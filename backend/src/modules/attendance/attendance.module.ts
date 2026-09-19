import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../../common/entities/attendance-record.entity';
import { AttendanceSummary } from '../../common/entities/attendance-summary.entity';
import { LiveClass } from '../../common/entities/live-class.entity';
import { CourseEnrollment } from '../../common/entities/course-enrollment.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, AttendanceSummary, LiveClass, CourseEnrollment]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
