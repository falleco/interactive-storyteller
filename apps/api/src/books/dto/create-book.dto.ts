import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../storytellers/storyteller-catalog';

const ALLOWED_MODES = ['classic', 'interactive'] as const;
type AllowedMode = (typeof ALLOWED_MODES)[number];

export class CreateBookDto {
  @ApiProperty({ enum: ALLOWED_MODES, default: 'classic' })
  @IsString()
  @IsIn(ALLOWED_MODES)
  mode!: AllowedMode;

  @ApiProperty({ enum: SUPPORTED_LANGUAGES })
  @IsString()
  @IsIn(SUPPORTED_LANGUAGES as unknown as string[])
  language!: string;

  @ApiProperty({
    description: 'Storyteller identifier (matches /storytellers)',
  })
  @IsString()
  @Length(1, 80)
  storyteller!: string;

  @ApiPropertyOptional({
    description:
      'Free-form theme for the story (e.g. "a dragon learning to bake"). Ignored when templateId is provided.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  theme?: string;

  @ApiPropertyOptional({
    description:
      'Existing story template to use as the prompt. The server loads the template text from the database; the client does not need to send the theme text.',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Child profile id to base the protagonist on',
  })
  @IsOptional()
  @IsString()
  childProfileId?: string;
}
