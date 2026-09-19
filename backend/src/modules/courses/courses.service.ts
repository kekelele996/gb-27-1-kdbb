import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Course, CourseType, CourseStatus } from '../../common/entities/course.entity';
import { CourseLesson } from '../../common/entities/course-lesson.entity';
import { CourseEnrollment, EnrollmentStatus } from '../../common/entities/course-enrollment.entity';
import { UserRole } from '../../common/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseLesson)
    private readonly lessonRepository: Repository<CourseLesson>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
  ) {}

  async findAll(query: { category?: string; tag?: string; type?: CourseType; keyword?: string }) {
    const where: any = { status: CourseStatus.PUBLISHED };
    
    if (query.category) where.category = query.category;
    if (query.type) where.type = query.type;
    if (query.keyword) where.name = Like(`%${query.keyword}%`);
    
    const courses = await this.courseRepository.find({
      where,
      relations: ['teacher'],
      order: { createdAt: 'DESC' },
    });
    
    if (query.tag) {
      return courses.filter(course => 
        course.tags && course.tags.includes(query.tag)
      );
    }
    
    return courses;
  }

  async findMyCourses(userId: string, role: UserRole) {
    if (role === UserRole.TEACHER) {
      return this.courseRepository.find({
        where: { teacherId: userId },
        relations: ['teacher', 'lessons'],
        order: { createdAt: 'DESC' },
      });
    }
    
    if (role === UserRole.STUDENT) {
      const enrollments = await this.enrollmentRepository.find({
        where: { studentId: userId },
        relations: ['course', 'course.teacher'],
      });
      return enrollments.map(e => e.course);
    }
    
    return [];
  }

  async findOne(id: string) {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['teacher', 'lessons'],
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    return course;
  }

  async create(userId: string, courseData: Partial<Course>) {
    const course = this.courseRepository.create({
      ...courseData,
      teacherId: userId,
      status: CourseStatus.DRAFT,
    });
    return this.courseRepository.save(course);
  }

  async update(userId: string, id: string, courseData: Partial<Course>) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    if (course.teacherId !== userId) {
      throw new ForbiddenException('无权修改此课程');
    }
    
    Object.assign(course, courseData);
    return this.courseRepository.save(course);
  }

  async publish(userId: string, id: string) {
    return this.update(userId, id, { status: CourseStatus.PUBLISHED });
  }

  async enroll(studentId: string, courseId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { studentId, courseId },
    });
    
    if (existingEnrollment) {
      return existingEnrollment;
    }
    
    const enrollment = this.enrollmentRepository.create({
      studentId,
      courseId,
      enrolledAt: new Date(),
    });
    
    return this.enrollmentRepository.save(enrollment);
  }

  async getEnrollment(studentId: string, courseId: string) {
    return this.enrollmentRepository.findOne({
      where: { studentId, courseId },
    });
  }

  async createLesson(userId: string, courseId: string, lessonData: Partial<CourseLesson>) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    if (course.teacherId !== userId) {
      throw new ForbiddenException('无权操作此课程');
    }
    
    const maxOrder = await this.lessonRepository
      .createQueryBuilder('lesson')
      .where('lesson.courseId = :courseId', { courseId })
      .select('MAX(lesson.order)', 'max')
      .getRawOne();
    
    const lesson = this.lessonRepository.create({
      ...lessonData,
      courseId,
      order: (maxOrder?.max || 0) + 1,
    });
    
    return this.lessonRepository.save(lesson);
  }

  async findLesson(id: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id },
      relations: ['course'],
    });
    if (!lesson) {
      throw new NotFoundException('课时不存在');
    }
    return lesson;
  }
}
