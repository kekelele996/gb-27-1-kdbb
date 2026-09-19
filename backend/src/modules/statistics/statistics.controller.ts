import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../common/entities/user.entity';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyStats(@Request() req) {
    if (req.user.role === UserRole.TEACHER) {
      return this.statisticsService.getTeacherStats(req.user.id);
    }
    return this.statisticsService.getStudentStats(req.user.id);
  }
}
