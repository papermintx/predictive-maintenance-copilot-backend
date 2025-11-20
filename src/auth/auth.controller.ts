import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  SignUpDto,
  SignInDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ResendVerificationDto,
  VerifyEmailCallbackDto,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signOut() {
    return this.authService.signOut();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };
  }

  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Res() res: Response) {
    // Supabase mengirim token sebagai hash fragment (#), bukan query parameter
    // Kita perlu handle ini di client-side (HTML + JavaScript)
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .loading {
            font-size: 40px;
            margin-bottom: 20px;
          }
          .success-icon {
            font-size: 60px;
            color: #4CAF50;
            margin-bottom: 20px;
            display: none;
          }
          .error-icon {
            font-size: 60px;
            color: #f44336;
            margin-bottom: 20px;
            display: none;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s;
          }
          .button:hover {
            background: #764ba2;
          }
          #loading { display: block; }
          #success { display: none; }
          #error { display: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Loading State -->
          <div id="loading">
            <div class="loading">⏳</div>
            <h1>Verifying Your Email...</h1>
            <p>Please wait while we confirm your email address.</p>
          </div>

          <!-- Success State -->
          <div id="success">
            <div class="success-icon">✓</div>
            <h1>Email Verified Successfully!</h1>
            <p>Your email has been verified. You can now sign in to your account.</p>
            <p><strong>Email:</strong> <span id="userEmail"></span></p>
            <a href="#" class="button" onclick="window.close()">Close</a>
          </div>

          <!-- Error State -->
          <div id="error">
            <div class="error-icon">✗</div>
            <h1>Verification Failed</h1>
            <p id="errorMessage">An error occurred during verification.</p>
          </div>
        </div>

        <script>
          // Parse hash fragment untuk mendapatkan tokens
          function parseHashFragment() {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            return {
              access_token: params.get('access_token'),
              refresh_token: params.get('refresh_token'),
              expires_in: params.get('expires_in'),
              token_type: params.get('token_type'),
              type: params.get('type')
            };
          }

          // Verify email dengan backend
          async function verifyEmail() {
            try {
              const tokens = parseHashFragment();
              
              console.log('📧 Tokens from URL:', tokens);

              if (!tokens.access_token) {
                throw new Error('No access token found in URL');
              }

              // Call backend API untuk verify dan create user
              const response = await fetch('/auth/verify-email/callback', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  accessToken: tokens.access_token,
                  refreshToken: tokens.refresh_token,
                  type: tokens.type || 'signup'
                })
              });

              const result = await response.json();

              if (response.ok && result.success) {
                // Show success
                document.getElementById('loading').style.display = 'none';
                document.getElementById('success').style.display = 'block';
                document.querySelector('.success-icon').style.display = 'block';
                document.getElementById('userEmail').textContent = result.email;
              } else {
                throw new Error(result.message || 'Verification failed');
              }
            } catch (error) {
              console.error('❌ Verification error:', error);
              // Show error
              document.getElementById('loading').style.display = 'none';
              document.getElementById('error').style.display = 'block';
              document.querySelector('.error-icon').style.display = 'block';
              document.getElementById('errorMessage').textContent = error.message;
            }
          }

          // Auto verify on page load
          window.addEventListener('load', verifyEmail);
        </script>
      </body>
      </html>
    `);
  }

  @Public()
  @Post('update-password')
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Body() updatePasswordDto: { accessToken: string; newPassword: string },
  ) {
    return this.authService.updatePassword(
      updatePasswordDto.accessToken,
      updatePasswordDto.newPassword,
    );
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendDto.email);
  }

  @Public()
  @Post('verify-email/callback')
  @HttpCode(HttpStatus.OK)
  async verifyEmailCallback(@Body() callbackDto: VerifyEmailCallbackDto) {
    return this.authService.verifyEmailWithToken(
      callbackDto.accessToken,
      callbackDto.type,
    );
  }

  @Public()
  @Get('reset-password-confirm')
  @HttpCode(HttpStatus.OK)
  async resetPasswordConfirm(@Res() res: Response) {
    // Handle reset password link from Supabase
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            color: #555;
            margin-bottom: 8px;
            font-weight: bold;
          }
          input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.3s;
          }
          input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
          }
          .button {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.3s;
          }
          .button:hover {
            background: #764ba2;
          }
          .button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          .message {
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            display: none;
          }
          .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .info-text {
            font-size: 13px;
            color: #666;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Reset Password</h1>
          
          <form id="resetForm">
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input 
                type="password" 
                id="newPassword" 
                name="password"
                placeholder="Enter your new password"
                required
                minlength="6"
              />
              <p class="info-text">Minimum 6 characters</p>
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                name="confirmPassword"
                placeholder="Confirm your new password"
                required
                minlength="6"
              />
            </div>

            <button type="submit" class="button" id="submitBtn">Reset Password</button>
          </form>

          <div id="message" class="message"></div>
        </div>

        <script>
          document.getElementById('resetForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const messageDiv = document.getElementById('message');
            const submitBtn = document.getElementById('submitBtn');

            // Validate passwords match
            if (newPassword !== confirmPassword) {
              messageDiv.textContent = 'Passwords do not match!';
              messageDiv.className = 'message error';
              messageDiv.style.display = 'block';
              return;
            }

            try {
              submitBtn.disabled = true;
              submitBtn.textContent = 'Resetting...';

              // Get access token from URL hash
              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const accessToken = params.get('access_token');

              if (!accessToken) {
                throw new Error('Invalid reset link. Please request a new password reset.');
              }

              // Call backend to update password
              const response = await fetch('/auth/update-password', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  accessToken,
                  newPassword
                })
              });

              const result = await response.json();

              if (response.ok && result.success) {
                messageDiv.textContent = '✅ Password reset successfully! You can now log in with your new password.';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                document.getElementById('resetForm').style.display = 'none';
              } else {
                throw new Error(result.message || 'Failed to reset password');
              }
            } catch (error) {
              console.error('❌ Error:', error);
              messageDiv.textContent = error.message;
              messageDiv.className = 'message error';
              messageDiv.style.display = 'block';
              submitBtn.disabled = false;
              submitBtn.textContent = 'Reset Password';
            }
          });
        </script>
      </body>
      </html>
    `);
  }
}
