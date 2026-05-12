import { Global, Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';

@Global()
@Module({
  controllers: [MeController],
  providers: [SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
