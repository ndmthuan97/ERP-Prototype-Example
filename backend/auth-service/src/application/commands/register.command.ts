// =============================================================================
// REGISTER COMMAND — Admin creates a new user account
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { v4 } from 'uuid';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/repositories/user.repository.js';
import { User, type UserRole } from '../../domain/entities/user.entity.js';
import { DuplicateEmailError } from '../../domain/errors.js';
import { registerSchema } from '../dtos/auth.dto.js';

@Injectable()
export class RegisterCommand {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: unknown): Promise<{ id: string; email: string; fullName: string; role: string }> {
    const dto = registerSchema.parse(input);

    // Check for duplicate email
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new DuplicateEmailError(dto.email);
    }

    // Hash password with bcrypt (12 salt rounds)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const now = new Date();
    const user = new User({
      id: v4(),
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role as UserRole,
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
