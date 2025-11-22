import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseRealtimeService implements OnModuleInit {
  private supabase: SupabaseClient;
  private logger = new Logger('SupabaseRealtimeService');
  private subscriptions: Map<string, any> = new Map();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    this.logger.log('Supabase Realtime initialized');
  }

  subscribeSensorChanges(machineId: string, callback: (data: any) => void) {
    const channelKey = `sensor:${machineId}`;

    // Jika sudah subscribe, skip
    if (this.subscriptions.has(channelKey)) {
      return;
    }

    const channel = this.supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'sensor_data',
          filter: `machine_id=eq.${machineId}`,
        },
        (payload) => {
          this.logger.debug(
            `📡 Supabase Realtime - Machine ${machineId}:`,
            payload,
          );
          callback(payload.new || payload.old);
        },
      )
      .subscribe((status) => {
        this.logger.log(
          `📡 Supabase channel '${channelKey}' status: ${status}`,
        );
      });

    this.subscriptions.set(channelKey, channel);
  }

  subscribeAllSensors(callback: (data: any) => void) {
    const channelKey = 'sensors:all';

    if (this.subscriptions.has(channelKey)) {
      return;
    }

    const channel = this.supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sensor_data',
        },
        (payload) => {
          this.logger.debug(
            `📡 Supabase Realtime - All sensors event:`,
            payload,
          );
          callback(payload.new || payload.old);
        },
      )
      .subscribe((status) => {
        this.logger.log(`📡 Supabase channel 'sensors:all' status: ${status}`);
      });

    this.subscriptions.set(channelKey, channel);
  }

  async unsubscribe(channelKey: string) {
    const channel = this.subscriptions.get(channelKey);
    if (channel) {
      await this.supabase.removeChannel(channel);
      this.subscriptions.delete(channelKey);
      this.logger.log(`Unsubscribed from ${channelKey}`);
    }
  }

  async unsubscribeAll() {
    for (const [key, channel] of this.subscriptions.entries()) {
      await this.supabase.removeChannel(channel);
      this.logger.log(`Unsubscribed from ${key}`);
    }
    this.subscriptions.clear();
  }
}
