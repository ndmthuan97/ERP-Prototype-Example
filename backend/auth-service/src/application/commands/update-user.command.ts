// =============================================================================
// UPDATE USER COMMAND — Admin changes a user's role / active status (RBAC)
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../../domain/errors.js';
import { updateUserSchema } from '../dtos/auth.dto.js';

@Injectable()
export class UpdateUserCommand {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    id: string,
    input: unknown,
  ): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }> {
    const dto = updateUserSchema.parse(input);

    // Load the aggregate — NotFound maps to 404 via DomainExceptionFilter.
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }

    // Apply changes through entity methods so business rules are enforced.
    if (dto.role !== undefined) {
      user.changeRole(dto.role);
    }
    if (dto.isActive !== undefined) {
      user.setActive(dto.isActive);
    }

    const saved = await this.userRepo.update(user);

    return {
      id: saved.id,
      email: saved.email,
      fullName: saved.fullName,
      role: saved.role,
      isActive: saved.isActive,
    };
  }
}
