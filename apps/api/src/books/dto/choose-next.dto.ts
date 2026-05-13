import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ChooseNextDto {
  @ApiProperty({
    minimum: 0,
    description: 'Index of the BookChoice on the latest page to pick',
  })
  @IsInt()
  @Min(0)
  choiceIndex!: number;
}
