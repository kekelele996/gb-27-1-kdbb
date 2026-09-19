import { IsUUID, IsNotEmpty } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  @IsNotEmpty()
  liveClassId: string;
}
