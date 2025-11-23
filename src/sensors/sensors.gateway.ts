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

  handleConnection(@ConnectedSocket() _client: Socket) {
    // Client connected
  }

  handleDisconnect(@ConnectedSocket() _client: Socket) {
    // Client disconnected
  }

  @SubscribeMessage('subscribe:sensor')
  async handleSubscribeSensor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { machineId: string },
  ) {
    const { machineId } = data;

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
    client.join('sensors:all');

    // Subscribe ke semua sensor changes
    this.supabaseRealtimeService.subscribeAllSensors((sensorData) => {
      this.server.to('sensors:all').emit('sensors:update', sensorData);
    });

    client.emit('subscribed', { all: true });
  }

  // Direct broadcast method for simulator
  broadcastSensorUpdate(data: any) {
    this.server.to('sensors:all').emit('sensors:update', data);
    this.server.to(`sensor:${data.machine_id}`).emit('sensor:update', data);
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

    client.emit('unsubscribed', data);
  }
}
