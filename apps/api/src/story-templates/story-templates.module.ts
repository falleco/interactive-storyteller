import { Module } from '@nestjs/common';
import { StoryTemplatesController } from './story-templates.controller';
import { StoryTemplatesService } from './story-templates.service';

@Module({
  controllers: [StoryTemplatesController],
  providers: [StoryTemplatesService],
  exports: [StoryTemplatesService],
})
export class StoryTemplatesModule {}
