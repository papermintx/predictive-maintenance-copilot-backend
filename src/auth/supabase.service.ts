import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Anon Key must be provided');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async signUp(email: string, password: string, metadata?: any) {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    return await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        // Redirect ke endpoint verification kita setelah konfirmasi email
        emailRedirectTo: `${baseUrl}/auth/verify-email`,
      },
    });
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async getUser(accessToken: string) {
    return await this.supabase.auth.getUser(accessToken);
  }

  async refreshToken(refreshToken: string) {
    return await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
  }

  async updateUser(accessToken: string, updates: any) {
    const { data: userData } = await this.supabase.auth.getUser(accessToken);

    if (!userData.user) {
      throw new Error('User not found');
    }

    return await this.supabase.auth.updateUser(updates);
  }

  async verifyOtp(token: string, type: string) {
    // Verify email menggunakan token_hash dari URL
    // Supabase mengirim token_hash di query params
    const verificationType = type === 'signup' ? 'signup' : 'email';

    return await this.supabase.auth.verifyOtp({
      token_hash: token,
      type: verificationType as any,
    });
  }

  async resendVerification(email: string) {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    return await this.supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${baseUrl}/auth/verify-email`,
      },
    });
  }

  async updatePassword(accessToken: string, newPassword: string) {
    try {
      // Decode JWT token untuk extract user ID
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        throw new BadRequestException('Invalid token format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );
      const userId = payload.sub;

      if (!userId) {
        throw new BadRequestException('Invalid token: no user ID found');
      }

      // Gunakan Admin API dengan service role key
      const adminClient = createClient(
        this.configService.get<string>('SUPABASE_URL')!,
        this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      // Update password menggunakan admin API
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        throw new BadRequestException(
          error.message || 'Failed to update password',
        );
      }

      return { success: true };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Failed to update password');
    }
  }

  async resetPassword(email: string) {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password-confirm`,
    });
  }
}
