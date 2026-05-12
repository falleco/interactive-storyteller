import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { name, version } from '../package.json';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  @Get()
  getHello() {
    return { name, version };
  }

  @Get('health')
  health(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
