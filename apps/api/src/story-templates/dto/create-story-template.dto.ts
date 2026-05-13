import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../storytellers/storyteller-catalog';

export class CreateStoryTemplateDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  theme!: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LANGUAGES,
    description: 'Lock the template to a specific language',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES as unknown as string[])
  language?: string;
}
