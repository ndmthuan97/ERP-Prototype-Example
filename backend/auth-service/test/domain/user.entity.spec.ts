import { User, UserRole } from '../../src/domain/entities/user.entity';

describe('User Entity', () => {
  const createUser = (
    overrides: Partial<{
      id: string;
      email: string;
      passwordHash: string;
      fullName: string;
      role: UserRole;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ): User => {
    return new User({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      fullName: 'Test User',
      role: 'staff',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    });
  };

  it('should create a user with correct properties', () => {
    const user = createUser();
    expect(user.id).toBe('user-1');
    expect(user.email).toBe('test@example.com');
    expect(user.fullName).toBe('Test User');
    expect(user.role).toBe('staff');
    expect(user.isActive).toBe(true);
  });

  it('should activate a user', () => {
    const user = createUser({ isActive: false });
    user.activate();
    expect(user.isActive).toBe(true);
  });

  it('should deactivate a user', () => {
    const user = createUser({ isActive: true });
    user.deactivate();
    expect(user.isActive).toBe(false);
  });

  it('should change role', () => {
    const user = createUser({ role: 'staff' });
    user.changeRole('manager');
    expect(user.role).toBe('manager');
  });

  it('should check canPerform for admin (all allowed)', () => {
    const admin = createUser({ role: 'admin' });
    expect(admin.canPerform('read')).toBe(true);
    expect(admin.canPerform('delete')).toBe(true);
    expect(admin.canPerform('manage_users')).toBe(true);
    expect(admin.canPerform('anything')).toBe(true);
  });

  it('should check canPerform for manager', () => {
    const manager = createUser({ role: 'manager' });
    expect(manager.canPerform('read')).toBe(true);
    expect(manager.canPerform('approve')).toBe(true);
    expect(manager.canPerform('delete')).toBe(false);
    expect(manager.canPerform('manage_users')).toBe(false);
  });

  it('should check canPerform for staff', () => {
    const staff = createUser({ role: 'staff' });
    expect(staff.canPerform('read')).toBe(true);
    expect(staff.canPerform('create')).toBe(true);
    expect(staff.canPerform('update')).toBe(false);
    expect(staff.canPerform('delete')).toBe(false);
  });

  it('should update profile', () => {
    const user = createUser();
    user.updateProfile('New Name', 'new@example.com');
    expect(user.fullName).toBe('New Name');
    expect(user.email).toBe('new@example.com');
  });
});
