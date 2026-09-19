import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckInDto } from './dto/check-in.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard)
  @Post('check-in')
  checkIn(@Body() body: CheckInDto, @Request() req) {
    return this.attendanceService.checkIn(req.user, body.liveClassId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live-class/:liveClassId/window')
  getWindow(@Param('liveClassId') liveClassId: string, @Request() req) {
    return this.attendanceService.getWindow(req.user, liveClassId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live-class/:liveClassId/summary')
  getSummary(@Param('liveClassId') liveClassId: string) {
    return this.attendanceService.getSummary(liveClassId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live-class/:liveClassId')
  getRecordsByLiveClass(@Param('liveClassId') liveClassId: string) {
    return this.attendanceService.getRecordsByLiveClass(liveClassId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyRecords(@Query('courseId') courseId: string, @Request() req) {
    return this.attendanceService.getMyRecords(req.user.id, courseId);
  }
}
