import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CompleteGameDto {
  @ApiPropertyOptional({ description: 'Completed game id' })
  @IsOptional()
  @IsString()
  gameId?: string;

  @ApiPropertyOptional({ description: 'Whether the game was completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Score achieved by the child' })
  @IsOptional()
  @IsInt()
  score?: number;

  @ApiPropertyOptional({ description: 'Total possible score' })
  @IsOptional()
  @IsInt()
  total?: number;

  @ApiPropertyOptional({ description: 'Optional game-specific metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
