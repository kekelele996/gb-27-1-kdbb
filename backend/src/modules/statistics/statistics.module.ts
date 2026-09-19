import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../../common/entities/course.entity';
import { CourseEnrollment } from '../../common/entities/course-enrollment.entity';
import { Assignment } from '../../common/entities/assignment.entity';
import { AssignmentSubmission } from '../../common/entities/assignment-submission.entity';
import { AttendanceRecord } from '../../common/entities/attendance-record.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseEnrollment, Assignment, AssignmentSubmission, AttendanceRecord])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
