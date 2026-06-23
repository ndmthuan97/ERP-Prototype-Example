import { RegisterCommand } from '../../src/application/commands/register.command';
import { LoginCommand } from '../../src/application/commands/login.command';
import { RefreshTokenCommand } from '../../src/application/commands/refresh-token.command';
import { User } from '../../src/domain/entities/user.entity';
import { DuplicateEmailError, InvalidCredentialsError, InactiveUserError } from '../../src/domain/errors';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn().mockResolvedValue('hashed-password'),
    compare: jest.fn(),
  },
}));

import bcrypt from 'bcryptjs';
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Auth Application Layer', () => {
  // Shared mocks
  const mockUserRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    signAccessToken: jest.fn().mockReturnValue('access-token'),
    signRefreshToken: jest.fn().mockReturnValue('refresh-token'),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };

  const mockPrisma = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testUser = new User({
    id: 'test-uuid-0001',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    fullName: 'Test User',
    role: 'staff',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ========================================================================
  // RegisterCommand Tests
  // ========================================================================
  describe('RegisterCommand', () => {
    let command: RegisterCommand;

    beforeEach(() => {
      command = new RegisterCommand(mockUserRepo);
    });

    it('should register a new user successfully', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.save.mockResolvedValue(testUser);

      const result = await command.execute({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(result).toEqual({
        id: testUser.id,
        email: testUser.email,
        fullName: testUser.fullName,
        role: testUser.role,
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should throw DuplicateEmailError for existing email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(testUser);

      await expect(
        command.execute({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  // ========================================================================
  // LoginCommand Tests
  // ========================================================================
  describe('LoginCommand', () => {
    let command: LoginCommand;

    beforeEach(() => {
      command = new LoginCommand(mockUserRepo, mockJwtService as any, mockPrisma as any);
    });

    it('should login successfully with valid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(testUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await command.execute({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(testUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        command.execute({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        command.execute({ email: 'nonexistent@example.com', password: 'password' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InactiveUserError for inactive user', async () => {
      const inactiveUser = new User({ ...testUser, isActive: false, id: 'inactive', createdAt: new Date(), updatedAt: new Date() });
      mockUserRepo.findByEmail.mockResolvedValue(inactiveUser);

      await expect(
        command.execute({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(InactiveUserError);
    });
  });

  // ========================================================================
  // RefreshTokenCommand Tests
  // ========================================================================
  describe('RefreshTokenCommand', () => {
    let command: RefreshTokenCommand;

    beforeEach(() => {
      command = new RefreshTokenCommand(mockJwtService as any, mockPrisma as any);
    });

    it('should refresh tokens successfully', async () => {
      mockJwtService.verifyRefreshToken.mockReturnValue({ sub: 'user-1' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'old-refresh-token',
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: 'user-1', email: 'test@example.com', role: 'staff', fullName: 'Test User', isActive: true },
      });
      mockJwtService.signAccessToken.mockReturnValue('new-access-token');
      mockJwtService.signRefreshToken.mockReturnValue('new-refresh-token');

      const result = await command.execute({ refreshToken: 'old-refresh-token' });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError for expired token', async () => {
      mockJwtService.verifyRefreshToken.mockReturnValue({ sub: 'user-1' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000),
        user: { id: 'user-1', email: 'test@example.com', role: 'staff', fullName: 'Test User', isActive: true },
      });

      await expect(
        command.execute({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });
  });
});
