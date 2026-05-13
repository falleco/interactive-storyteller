import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { isLanguage, SUPPORTED_LANGUAGES } from './storyteller-catalog';
import { StorytellersService } from './storytellers.service';

@ApiTags('storytellers')
@Controller('storytellers')
export class StorytellersController {
  constructor(private readonly storytellers: StorytellersService) {}

  @Get()
  @ApiOperation({ summary: 'List enabled storytellers for a given language' })
  @ApiQuery({
    name: 'language',
    enum: SUPPORTED_LANGUAGES as unknown as string[],
    required: true,
  })
  list(@Query('language') language: string) {
    if (!isLanguage(language)) {
      throw new BadRequestException(
        `Unsupported language. Allowed: ${SUPPORTED_LANGUAGES.join(', ')}`,
      );
    }
    return this.storytellers.listByLanguage(language);
  }
}
