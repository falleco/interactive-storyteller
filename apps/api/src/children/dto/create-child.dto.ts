import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateChildDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ minimum: 0, maximum: 18 })
  @IsInt()
  @Min(0)
  @Max(18)
  age!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;

  @ApiPropertyOptional({
    description: 'Existing image URL (e.g. social avatar)',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}
