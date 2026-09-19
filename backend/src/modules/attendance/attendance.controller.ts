import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard)
  @Post('check-in')
  checkIn(@Body() body: { liveClassId: string }, @Request() req) {
    return this.attendanceService.checkIn(req.user.id, body.liveClassId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live-class/:liveClassId/window')
  getCheckInWindow(@Param('liveClassId') liveClassId: string, @Request() req) {
    return this.attendanceService.getCheckInWindow(req.user.id, req.user.role, liveClassId);
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
