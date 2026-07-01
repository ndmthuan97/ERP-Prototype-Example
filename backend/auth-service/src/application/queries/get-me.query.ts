// =============================================================================
// GET ME QUERY — Return current user info from JWT payload
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../../domain/errors.js';

@Injectable()
export class GetMeQuery {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
  }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
