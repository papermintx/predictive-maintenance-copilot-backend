import { Module } from '@nestjs/common';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
