// =============================================================================
// AUTH CONTROLLER — Presentation Layer
// =============================================================================
// Controller only receives HTTP requests, delegates to Application layer,
// and returns responses. No business logic here (Single Responsibility — SOLID "S").
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import { RegisterCommand } from '../application/commands/register.command.js';
import { LoginCommand } from '../application/commands/login.command.js';
import { RefreshTokenCommand } from '../application/commands/refresh-token.command.js';
import { LogoutCommand } from '../application/commands/logout.command.js';
import { GetMeQuery } from '../application/queries/get-me.query.js';
import { ListUsersQuery } from '../application/queries/list-users.query.js';
import {
  RegisterBodyDto,
  LoginBodyDto,
  RefreshBodyDto,
  LogoutBodyDto,
} from '../application/dtos/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerCommand: RegisterCommand,
    private readonly loginCommand: LoginCommand,
    private readonly refreshTokenCommand: RefreshTokenCommand,
    private readonly logoutCommand: LogoutCommand,
    private readonly getMeQuery: GetMeQuery,
    private readonly listUsersQuery: ListUsersQuery,
  ) {}

  /** POST /auth/register — Admin creates a new user */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: RegisterBodyDto })
  async register(@Body() body: RegisterBodyDto) {
    return this.registerCommand.execute(body);
  }

  /** POST /auth/login — Authenticate and receive tokens */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginBodyDto })
  async login(@Body() body: LoginBodyDto) {
    return this.loginCommand.execute(body);
  }

  /** POST /auth/refresh — Rotate refresh token and get new access token */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RefreshBodyDto })
  async refresh(@Body() body: RefreshBodyDto) {
    return this.refreshTokenCommand.execute(body);
  }

  /** POST /auth/logout — Invalidate refresh token */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ type: LogoutBodyDto })
  async logout(@Body() body: LogoutBodyDto) {
    await this.logoutCommand.execute(body.refreshToken);
  }

  /** GET /auth/me — Return current user info (requires x-user-id header from gateway) */
  @Get('me')
  async me(@Headers('x-user-id') userId?: string) {
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.getMeQuery.execute(userId);
  }

  /** GET /auth/users — Admin-only: list users with pagination */
  @Get('users')
  async listUsers(
    @Headers('x-user-role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (role !== 'admin') {
      throw new HttpException('Forbidden: admin access required', HttpStatus.FORBIDDEN);
    }

    const pageNum = Number.parseInt(page ?? '', 10);
    const limitNum = Number.parseInt(limit ?? '', 10);

    return this.listUsersQuery.execute(
      Number.isNaN(pageNum) ? undefined : pageNum,
      Number.isNaN(limitNum) ? undefined : limitNum,
    );
  }
}
