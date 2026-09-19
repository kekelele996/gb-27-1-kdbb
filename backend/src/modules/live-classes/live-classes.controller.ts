import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { LiveClassesService } from './live-classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('live-classes')
export class LiveClassesController {
  constructor(private readonly liveClassesService: LiveClassesService) {}

  @Get()
  findAll() {
    return this.liveClassesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() data: any) {
    return this.liveClassesService.create(req.user.id, data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.liveClassesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  startLive(@Param('id') id: string, @Request() req) {
    return this.liveClassesService.startLive(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/end')
  endLive(@Param('id') id: string, @Request() req) {
    return this.liveClassesService.endLive(req.user.id, id);
  }
}
