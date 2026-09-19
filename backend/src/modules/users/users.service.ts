import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, TeacherStatus } from '../../common/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(role?: UserRole) {
    const where = role ? { role } : {};
    const users = await this.userRepository.find({ where });
    return users.map(({ password, ...user }) => user);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(id: string, updateData: Partial<User>) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    const updated = await this.userRepository.save({ ...user, ...updateData });
    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async submitTeacherCertification(id: string, certification: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师可以提交认证');
    }
    
    user.teacherCertification = certification;
    user.teacherStatus = TeacherStatus.PENDING;
    const updated = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async reviewTeacher(id: string, approved: boolean, reviewerId: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    user.teacherStatus = approved ? TeacherStatus.APPROVED : TeacherStatus.REJECTED;
    const updated = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }
}
