import { Global, Module } from '@nestjs/common';
import { GameMasterService } from './game-master.service';

@Global()
@Module({
  providers: [GameMasterService],
  exports: [GameMasterService],
})
export class GameMasterModule {}
