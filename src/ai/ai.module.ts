import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiAgentService } from './services/agent.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AiAgentService],
  exports: [AiAgentService],
})
export class AiModule {}
