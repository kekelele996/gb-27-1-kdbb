import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, TeacherStatus } from '../../common/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, phone, username, password, name, role } = registerDto;
    
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { phone }, { username }].filter(Boolean),
    });
    
    if (existingUser) {
      throw new BadRequestException('用户已存在');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = this.userRepository.create({
      email,
      phone,
      username,
      password: hashedPassword,
      name,
      role,
      teacherStatus: role === UserRole.TEACHER ? TeacherStatus.PENDING : undefined,
    });
    
    const savedUser = await this.userRepository.save(user);
    const { password: _pwd, ...userWithoutPassword } = savedUser;
    
    const payload = { sub: savedUser.id, role: savedUser.role };
    const token = this.jwtService.sign(payload);
    
    return {
      accessToken: token,
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto) {
    const { account, password } = loginDto;
    
    const user = await this.userRepository.findOne({
      where: [{ email: account }, { phone: account }, { username: account }],
    });
    
    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      throw new UnauthorizedException('账号或密码错误');
    }
    
    const { password: _pwd, ...userWithoutPassword } = user;
    
    const payload = { sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);
    
    return {
      accessToken: token,
      user: userWithoutPassword,
    };
  }

  async validateUser(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }
}
