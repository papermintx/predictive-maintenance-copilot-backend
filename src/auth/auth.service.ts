import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { UserService } from '../user/user.service';
import { SignUpInput, SignInInput } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private userService: UserService,
  ) {}

  async signUp(signUpDto: SignUpInput) {
    const { email, password, fullName } = signUpDto;

    // Sign up ke Supabase Auth
    const { data, error } = await this.supabaseService.signUp(email, password, {
      full_name: fullName,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new BadRequestException('Failed to create user');
    }

    // Create user di database lokal
    try {
      await this.userService.createFromSupabase({
        id: data.user.id,
        email: data.user.email!,
        fullName: fullName,
      });
    } catch (error) {
      // Jika gagal create di database lokal, tidak masalah karena akan dibuat saat login
      console.error('Failed to create user in local database:', error);
    }

    return {
      message:
        'Sign up successful. Please check your email for verification link.',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: data.session,
    };
  }

  async signIn(signInDto: SignInInput) {
    const { email, password } = signInDto;

    const { data, error } = await this.supabaseService.signIn(email, password);

    if (error) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Pastikan user ada di database lokal
    let user = await this.userService.findBySupabaseId(data.user.id);

    if (!user) {
      // Create user jika belum ada
      user = await this.userService.createFromSupabase({
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name,
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return {
      message: 'Sign in successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    };
  }

  async refreshToken(refreshToken: string) {
    const { data, error } =
      await this.supabaseService.refreshToken(refreshToken);

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    };
  }

  async resetPassword(email: string) {
    const { error } = await this.supabaseService.resetPassword(email);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Password reset email sent. Please check your inbox.',
    };
  }

  async signOut() {
    const { error } = await this.supabaseService.signOut();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Sign out successful',
    };
  }

  async verifyEmail(token: string, type: string) {
    try {
      console.log('🔍 Verifying email with:', {
        tokenLength: token?.length,
        type,
      });

      // Validate input
      if (!token) {
        console.error('❌ No token provided');
        return {
          success: false,
          message: 'Verification token is required',
        };
      }

      // Verify token dengan Supabase
      console.log('📞 Calling Supabase verifyOtp...');
      const { data, error } = await this.supabaseService.verifyOtp(token, type);

      if (error) {
        console.error('❌ Supabase verification error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        return {
          success: false,
          message: error.message || 'Email verification failed',
        };
      }

      console.log('✅ Supabase verification successful:', {
        userId: data.user?.id,
        email: data.user?.email,
      });

      if (!data.user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Update user di database lokal jika belum ada
      let user = await this.userService.findBySupabaseId(data.user.id);

      if (!user) {
        user = await this.userService.createFromSupabase({
          id: data.user.id,
          email: data.user.email!,
          fullName: data.user.user_metadata?.full_name,
        });
      }

      return {
        success: true,
        message: 'Email verified successfully',
        email: data.user.email,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Email verification failed',
      };
    }
  }

  async verifyEmailWithToken(accessToken: string, _type?: string) {
    try {
      console.log('🔍 Verifying email with access token');

      // Get user data from Supabase menggunakan access token
      const { data, error } = await this.supabaseService.getUser(accessToken);

      if (error) {
        console.error('❌ Supabase getUser error:', error);
        return {
          success: false,
          message: error.message || 'Email verification failed',
        };
      }

      if (!data.user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      console.log('✅ User data retrieved:', {
        userId: data.user.id,
        email: data.user.email,
      });

      // Check if user already exists in database
      let user = await this.userService.findBySupabaseId(data.user.id);

      if (!user) {
        // Create user in database
        console.log('Creating user in database...');
        user = await this.userService.createFromSupabase({
          id: data.user.id,
          email: data.user.email!,
          fullName: data.user.user_metadata?.full_name,
        });
        console.log('✅ User created in database');
      } else {
        console.log('✅ User already exists in database');
      }

      return {
        success: true,
        message: 'Email verified successfully',
        email: data.user.email,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch (error) {
      console.error('❌ Verification error:', error);
      return {
        success: false,
        message: error.message || 'Email verification failed',
      };
    }
  }

  async resendVerificationEmail(email: string) {
    const { error } = await this.supabaseService.resendVerification(email);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Verification email has been resent. Please check your inbox.',
    };
  }

  async updatePassword(accessToken: string, newPassword: string) {
    try {
      // Update password di Supabase menggunakan access token
      await this.supabaseService.updatePassword(accessToken, newPassword);

      return {
        success: true,
        message:
          'Password updated successfully. You can now log in with your new password.',
      };
    } catch (error: any) {
      console.error('❌ Update password error:', error);
      return {
        success: false,
        message: error.message || 'Failed to update password',
      };
    }
  }
}
