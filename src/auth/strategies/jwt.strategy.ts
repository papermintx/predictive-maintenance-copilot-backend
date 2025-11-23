import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserService } from '../../user/user.service';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private supabaseService: SupabaseService,
  ) {
    const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'SUPABASE_JWT_SECRET is not defined. Please check your .env file.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true, // Enable request dalam validate
    });
  }

  async validate(req: Request, payload: any) {
    try {
      // Extract access token dari header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('No authorization header');
      }

      const accessToken = authHeader.replace('Bearer ', '');

      // Verifikasi token masih valid di Supabase (check session)
      const { data: supabaseUser, error: supabaseError } =
        await this.supabaseService.getUser(accessToken);

      if (supabaseError || !supabaseUser.user) {
        throw new UnauthorizedException('Session has been invalidated');
      }

      // Payload dari Supabase JWT berisi: sub (user id), email, role, dll
      const user = await this.userService.findBySupabaseId(payload.sub);

      if (!user) {
        // Jika user belum ada di database lokal, create dari Supabase data
        const newUser = await this.userService.createFromSupabase({
          id: payload.sub,
          email: payload.email,
          fullName: payload.user_metadata?.full_name,
        });
        console.log('✅ New user created:', payload.email);
        return newUser;
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      return user;
    } catch (error) {
      console.error('❌ JWT validation error:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
