import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Roles the parent can self-assign. Stored as the literal string on the row
 * so we don't need a DB enum migration to add a new label later.
 */
export const PARENT_ROLES = ['mom', 'dad', 'guardian', 'other'] as const;
export type ParentRole = (typeof PARENT_ROLES)[number];

export class UpdateParentDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minimum: 13, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ enum: PARENT_ROLES, nullable: true })
  @IsOptional()
  @IsIn([...PARENT_ROLES, null] as unknown as string[])
  parentRole?: ParentRole | null;
}
