import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiveClass } from '../../common/entities/live-class.entity';
import { LiveClassesController } from './live-classes.controller';
import { LiveClassesService } from './live-classes.service';

@Module({
  imports: [TypeOrmModule.forFeature([LiveClass])],
  controllers: [LiveClassesController],
  providers: [LiveClassesService],
})
export class LiveClassesModule {}
