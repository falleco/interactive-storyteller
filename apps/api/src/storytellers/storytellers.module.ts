import { Module } from '@nestjs/common';
import { StorytellersController } from './storytellers.controller';
import { StorytellersService } from './storytellers.service';

@Module({
  controllers: [StorytellersController],
  providers: [StorytellersService],
  exports: [StorytellersService],
})
export class StorytellersModule {}
