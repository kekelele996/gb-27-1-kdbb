import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Course } from '../../common/entities/course.entity';
import { CourseEnrollment, EnrollmentStatus } from '../../common/entities/course-enrollment.entity';
import { Assignment } from '../../common/entities/assignment.entity';
import { AssignmentSubmission, SubmissionStatus } from '../../common/entities/assignment-submission.entity';
import { AttendanceRecord, AttendanceStatus } from '../../common/entities/attendance-record.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission)
    private readonly submissionRepository: Repository<AssignmentSubmission>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
  ) {}

  async getTeacherStats(teacherId: string) {
    const courses = await this.courseRepository.find({
      where: { teacherId },
    });
    
    const courseIds = courses.map(c => c.id);
    
    const totalSales = await this.enrollmentRepository.count({
      where: { courseId: In(courseIds) },
    });
    
    const totalRevenue = courses.reduce((sum, course) => {
      if (course.type === 'paid' && course.price) {
        return sum;
      }
      return sum;
    }, 0);
    
    const attendanceRecords = await this.attendanceRepository.find({
      where: { status: AttendanceStatus.PRESENT },
    });
    
    const totalAssignments = await this.assignmentRepository.count({
      where: { teacherId },
    });
    
    const submissions = await this.submissionRepository.find({
      where: { status: SubmissionStatus.GRADED },
    });
    
    const avgScore = submissions.length > 0 
      ? submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length 
      : 0;
    
    return {
      totalCourses: courses.length,
      totalSales,
      totalRevenue,
      attendanceRate: attendanceRecords.length > 0 ? 100 : 0,
      totalAssignments,
      averageScore: Math.round(avgScore),
    };
  }

  async getStudentStats(studentId: string) {
    const enrollments = await this.enrollmentRepository.find({
      where: { studentId },
      relations: ['course'],
    });
    
    const courseIds = enrollments.map(e => e.courseId);
    
    const assignments = await this.assignmentRepository.find({
      where: { courseId: In(courseIds) },
    });
    
    const submissions = await this.submissionRepository.find({
      where: { studentId, status: SubmissionStatus.GRADED },
    });
    
    const attendanceRecords = await this.attendanceRepository.find({
      where: { studentId },
    });
    
    const totalStudyHours = enrollments.reduce((sum, e) => {
      return sum + (e.progress || 0);
    }, 0);
    
    const avgScore = submissions.length > 0
      ? submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length
      : 0;
    
    const completedCourses = enrollments.filter(e => e.status === EnrollmentStatus.COMPLETED).length;
    
    return {
      totalCourses: enrollments.length,
      completedCourses,
      totalStudyHours: Math.round(totalStudyHours / 60),
      totalAssignments: assignments.length,
      completedAssignments: submissions.length,
      averageScore: Math.round(avgScore),
      attendanceRecords: attendanceRecords.length,
    };
  }
}
