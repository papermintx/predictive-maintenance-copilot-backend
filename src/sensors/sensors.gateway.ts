import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SupabaseRealtimeService } from './supabase-realtime.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/sensors',
})
export class SensorsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('SensorsGateway');

  constructor(private supabaseRealtimeService: SupabaseRealtimeService) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:sensor')
  async handleSubscribeSensor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { machineId: string },
  ) {
    const { machineId } = data;
    this.logger.log(`Client ${client.id} subscribed to sensor:${machineId}`);

    // Join room untuk machine tertentu
    client.join(`sensor:${machineId}`);

    // Subscribe ke Supabase realtime
    this.supabaseRealtimeService.subscribeSensorChanges(
      machineId,
      (sensorData) => {
        this.server.to(`sensor:${machineId}`).emit('sensor:update', sensorData);
      },
    );

    client.emit('subscribed', { machineId });
  }

  @SubscribeMessage('subscribe:all-sensors')
  async handleSubscribeAllSensors(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to all sensors`);

    client.join('sensors:all');

    // Subscribe ke semua sensor changes
    this.supabaseRealtimeService.subscribeAllSensors((sensorData) => {
      this.logger.debug(`📤 Broadcasting sensor update to all:`, sensorData);
      this.server.to('sensors:all').emit('sensors:update', sensorData);
    });

    client.emit('subscribed', { all: true });
  }

  // Direct broadcast method for simulator
  broadcastSensorUpdate(data: any) {
    this.logger.debug(`📤 Direct broadcast:`, data);
    this.server.to('sensors:all').emit('sensors:update', data);
    this.server.to(`sensor:${data.machine_id}`).emit('sensor:update', data);
  }

  @SubscribeMessage('subscribe:prediction')
  async handleSubscribePrediction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { machineId: string },
  ) {
    const { machineId } = data;
    this.logger.log(
      `Client ${client.id} subscribed to prediction:${machineId}`,
    );

    client.join(`prediction:${machineId}`);

    // Subscribe ke prediction changes
    this.supabaseRealtimeService.subscribePredictionChanges(
      machineId,
      (predictionData) => {
        this.server
          .to(`prediction:${machineId}`)
          .emit('prediction:update', predictionData);
      },
    );

    client.emit('subscribed', { machineId, type: 'prediction' });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { machineId?: string; type?: string },
  ) {
    const { machineId, type } = data;

    if (machineId) {
      if (type === 'prediction') {
        client.leave(`prediction:${machineId}`);
      } else {
        client.leave(`sensor:${machineId}`);
      }
    } else {
      client.leave('sensors:all');
    }

    this.logger.log(`Client ${client.id} unsubscribed`);
    client.emit('unsubscribed', data);
  }
}
