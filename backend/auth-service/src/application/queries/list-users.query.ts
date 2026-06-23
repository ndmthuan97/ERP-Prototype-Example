// =============================================================================
// LIST USERS QUERY — Admin-only: paginated user list
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, type IUserRepository, type PaginatedResult } from '../../domain/repositories/user.repository.js';

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class ListUsersQuery {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(page?: number, limit?: number): Promise<PaginatedResult<UserListItem>> {
    const p = Math.max(1, page ?? 1);
    const l = Math.min(100, Math.max(1, limit ?? 20));

    const result = await this.userRepo.findAll(p, l);

    return {
      data: result.data.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
