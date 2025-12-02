import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { MachineModule } from './machine/machine.module';
import { SensorsModule } from './sensors/sensors.module';
import { MaintenanceTicketModule } from './maintenance-ticket/maintenance-ticket.module';
import { ChatModule } from './chat/chat.module';
import { PredictionModule } from './prediction/prediction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    MachineModule,
    SensorsModule,
    ChatModule,
    MaintenanceTicketModule,
    PredictionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
