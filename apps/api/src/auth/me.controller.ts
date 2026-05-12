import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PublicUser } from '@wondertales/shared';
import { CurrentUser } from './current-user.decorator';
import { SessionGuard } from './session.guard';

@ApiTags('auth')
@Controller('me')
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
