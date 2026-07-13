// =============================================================================
// AUTH CONTROLLER — Presentation Layer
// =============================================================================
// Controller only receives HTTP requests, delegates to Application layer,
// and returns responses. No business logic here (Single Responsibility — SOLID "S").
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  Ip,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import { RegisterCommand } from '../application/commands/register.command.js';
import { UpdateUserCommand } from '../application/commands/update-user.command.js';
import { ExchangeSessionCommand } from '../application/commands/exchange-session.command.js';
import { EndSessionCommand } from '../application/commands/end-session.command.js';
import { GetMeQuery } from '../application/queries/get-me.query.js';
import { ListUsersQuery } from '../application/queries/list-users.query.js';
import {
  RegisterBodyDto,
  UpdateUserBodyDto,
  SsoCallbackBodyDto,
} from '../application/dtos/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerCommand: RegisterCommand,
    private readonly updateUserCommand: UpdateUserCommand,
    private readonly exchangeSessionCommand: ExchangeSessionCommand,
    private readonly endSessionCommand: EndSessionCommand,
    private readonly getMeQuery: GetMeQuery,
    private readonly listUsersQuery: ListUsersQuery,
  ) {}

  /** POST /auth/register — Admin creates a new user (password-less) */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: RegisterBodyDto })
  async register(
    @Body() body: RegisterBodyDto,
    @Headers('x-user-role') role?: string,
  ) {
    // Admin-only: the DTO accepts a `role` field, so without this guard any
    // authenticated user could self-register an `admin` account (privilege
    // escalation). The gateway forwards the caller's role via x-user-role.
    if (role !== 'admin') {
      throw new HttpException(
        'Forbidden: admin access required',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.registerCommand.execute(body);
  }

  /** PATCH /auth/users/:id — Admin updates a user's role / active status (RBAC) */
  @Patch('users/:id')
  @ApiBody({ type: UpdateUserBodyDto })
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserBodyDto,
    @Headers('x-user-role') role?: string,
    @Headers('x-user-id') actorId?: string,
  ) {
    // Admin-only (mirrors listUsers): only admins may change roles / status.
    if (role !== 'admin') {
      throw new HttpException(
        'Forbidden: admin access required',
        HttpStatus.FORBIDDEN,
      );
    }

    // Self-lockout guard: an admin must not demote themselves out of `admin`
    // or deactivate their own account (would lock the last admin out).
    if (
      id === actorId &&
      (body.role !== undefined || body.isActive === false)
    ) {
      throw new HttpException(
        'Cannot change your own role / deactivate yourself',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.updateUserCommand.execute(id, body);
  }

  /** POST /auth/sso/callback — Exchange a Firebase ID token for an app token */
  @Post('sso/callback')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: SsoCallbackBodyDto })
  async ssoCallback(
    @Body() body: SsoCallbackBodyDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.exchangeSessionCommand.execute(body, { ip, userAgent });
  }

  /** POST /auth/logout — Revoke the current server-side session */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Headers('x-user-sid') sid?: string) {
    // The gateway injects x-user-sid (the session id embedded in the app token).
    await this.endSessionCommand.execute(sid ?? '');
  }

  /** GET /auth/me — Return current user info (requires x-user-id header from gateway) */
  @Get('me')
  async me(@Headers('x-user-id') userId?: string) {
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.getMeQuery.execute(userId);
  }

  /** GET /auth/users — Admin-only: list users with pagination + optional search */
  @Get('users')
  async listUsers(
    @Headers('x-user-role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    if (role !== 'admin') {
      throw new HttpException(
        'Forbidden: admin access required',
        HttpStatus.FORBIDDEN,
      );
    }

    const pageNum = Number.parseInt(page ?? '', 10);
    const limitNum = Number.parseInt(limit ?? '', 10);

    return this.listUsersQuery.execute(
      Number.isNaN(pageNum) ? undefined : pageNum,
      Number.isNaN(limitNum) ? undefined : limitNum,
      q,
    );
  }
}
