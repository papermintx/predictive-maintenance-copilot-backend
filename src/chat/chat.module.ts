import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AiModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
