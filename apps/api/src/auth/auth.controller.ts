import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, UserDataExport } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { AuthGuard, AuthenticatedRequest, AuthenticatedUser } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 300, keyPrefix: 'auth_register' })
  @ApiOperation({ summary: 'Register a new user account with default personal workspace' })
  @ApiResponse({ status: 201, description: 'User registered and session created' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  @ApiResponse({ status: 429, description: 'Too many registration requests' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const session = await this.authService.register(dto, ip);

    if (res && typeof res.cookie === 'function') {
      res.cookie('sessionToken', session.sessionToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(session.expiresAt),
      });
    }

    return session;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth_login' })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful, session token returned' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    const session = await this.authService.login(dto, ip);

    if (res && typeof res.cookie === 'function') {
      res.cookie('sessionToken', session.sessionToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(session.expiresAt),
      });
    }

    return session;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke active session token' })
  @ApiResponse({ status: 200, description: 'Session successfully revoked' })
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res?: Response) {
    if (res && typeof res.clearCookie === 'function') {
      res.clearCookie('sessionToken', { path: '/' });
    }
    return this.authService.logout(req.sessionToken);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions for current user' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions for current user across all devices' })
  @ApiResponse({ status: 200, description: 'All active sessions revoked' })
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (res && typeof res.clearCookie === 'function') {
      res.clearCookie('sessionToken', { path: '/' });
    }
    return this.authService.revokeAllSessions(user.id);
  }

  @Get('export-data')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'GDPR Article 20 user data export' })
  @ApiResponse({ status: 200, description: 'Structured JSON dump of user data' })
  async exportUserData(@CurrentUser() user: AuthenticatedUser): Promise<UserDataExport> {
    return this.authService.exportUserData(user.id);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Permanently delete user account and associated personal data' })
  @ApiResponse({ status: 200, description: 'Account successfully deleted' })
  @ApiResponse({ status: 401, description: 'Invalid password confirmation' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    if (res && typeof res.clearCookie === 'function') {
      res.clearCookie('sessionToken', { path: '/' });
    }
    return this.authService.deleteAccount(user.id, dto.passwordConfirm, ip);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 300, keyPrefix: 'auth_forgot' })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Generic dispatch notification' })
  @ApiResponse({ status: 429, description: 'Too many password reset attempts' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.authService.forgotPassword(dto, ip);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 300, keyPrefix: 'auth_reset' })
  @ApiOperation({ summary: 'Reset password with reset token and revoke all active sessions' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.authService.resetPassword(dto, ip);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with verification token' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile and memberships' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    };
  }
}
