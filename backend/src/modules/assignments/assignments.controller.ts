import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findByCourse(@Query('courseId') courseId: string) {
    return this.assignmentsService.findByCourse(courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() data: any) {
    return this.assignmentsService.create(req.user.id, data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  submit(@Param('id') assignmentId: string, @Body() data: any, @Request() req) {
    return this.assignmentsService.submit(req.user.id, assignmentId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/my-submission')
  findMySubmission(@Param('id') assignmentId: string, @Request() req) {
    return this.assignmentsService.findMySubmission(req.user.id, assignmentId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/submissions')
  findSubmissions(@Param('id') assignmentId: string) {
    return this.assignmentsService.findSubmissionsByAssignment(assignmentId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('submissions/:submissionId/grade')
  grade(
    @Param('submissionId') submissionId: string,
    @Body() body: { score: number; feedback: string },
    @Request() req,
  ) {
    return this.assignmentsService.grade(req.user.id, submissionId, body.score, body.feedback);
  }
}
