import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../storytellers/storyteller-catalog';

export class UpdateStoryTemplateDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  theme?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LANGUAGES,
    description:
      'Lock the template to a specific language (or null/omit for any)',
    nullable: true,
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES, null] as unknown as string[])
  language?: string | null;

  @ApiPropertyOptional({
    description: 'Disable a template without deleting it.',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
