// =============================================================================
// REGISTER COMMAND — Admin provisions a new user account (password-less)
// =============================================================================
// Under B1 there is no password: the admin adds an email + role to the
// allowlist; the Google account links itself on first sign-in (firebaseUid).
import { Injectable, Inject } from '@nestjs/common';
import { v4 } from 'uuid';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.js';
import { User } from '../../domain/entities/user.entity.js';
import { DuplicateEmailError } from '../../domain/errors.js';
import { registerSchema } from '../dtos/auth.dto.js';

@Injectable()
export class RegisterCommand {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    input: unknown,
  ): Promise<{ id: string; email: string; fullName: string; role: string }> {
    const dto = registerSchema.parse(input);

    // Check for duplicate email
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new DuplicateEmailError(dto.email);
    }

    const now = new Date();
    const user = new User({
      id: v4(),
      email: dto.email,
      firebaseUid: null,
      fullName: dto.fullName,
      role: dto.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      email: saved.email,
      fullName: saved.fullName,
      role: saved.role,
    };
  }
}
