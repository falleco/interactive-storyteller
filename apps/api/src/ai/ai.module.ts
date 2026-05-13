import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OpenAiProvider } from './providers/openai.provider';
import { ReplicateProvider } from './providers/replicate.provider';

@Global()
@Module({
  providers: [OpenAiProvider, ReplicateProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
