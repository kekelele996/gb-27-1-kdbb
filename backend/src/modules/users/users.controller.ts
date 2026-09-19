import { Controller, Get, Put, Param, Body, UseGuards, Request, Query, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../common/entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Request() req, @Body() updateData: any) {
    return this.usersService.updateProfile(req.user.id, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Post('teacher-certification')
  submitTeacherCertification(@Request() req, @Body() body: { certification: string }) {
    return this.usersService.submitTeacherCertification(req.user.id, body.certification);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/review-teacher')
  reviewTeacher(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
    @Request() req,
  ) {
    return this.usersService.reviewTeacher(id, body.approved, req.user.id);
  }
}
