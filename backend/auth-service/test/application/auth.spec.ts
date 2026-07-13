// =============================================================================
// AUTH APPLICATION LAYER TESTS (B1 — Google sign-in + server-side sessions)
// =============================================================================
// Covers the security-critical branches of the new commands with pure mocks —
// no real Firebase/Redis/Postgres. The deleted email/password Login/Refresh/
// Logout commands are gone, so their tests are gone too.
// Stub the firebase-admin subpath modules: the real SDK ships ESM that ts-jest
// won't transform (node_modules), and we inject a mock FirebaseAdminService
// anyway — this just keeps the import graph loadable.
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  applicationDefault: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

import { RegisterCommand } from '../../src/application/commands/register.command';
import { ExchangeSessionCommand } from '../../src/application/commands/exchange-session.command';
import { EndSessionCommand } from '../../src/application/commands/end-session.command';
import { UpdateUserCommand } from '../../src/application/commands/update-user.command';
import { User } from '../../src/domain/entities/user.entity';
import {
  DuplicateEmailError,
  InvalidCredentialsError,
  InactiveUserError,
  NotProvisionedError,
} from '../../src/domain/errors';

const FIREBASE_UID = 'firebase-uid-abc';

const makeUser = (
  overrides: Partial<ConstructorParameters<typeof User>[0]> = {},
): User =>
  new User({
    id: 'test-uuid-0001',
    email: 'test@example.com',
    firebaseUid: null,
    fullName: 'Test User',
    role: 'staff',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('Auth Application Layer (B1)', () => {
  const mockUserRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockFirebaseAdmin = {
    verifyIdToken: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  };

  const mockSessionService = {
    create: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const mockJwtService = {
    signAccessToken: jest.fn().mockReturnValue('access-token'),
    verifyAccessToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwtService.signAccessToken.mockReturnValue('access-token');
  });

  // ==========================================================================
  // RegisterCommand — password-less provisioning
  // ==========================================================================
  describe('RegisterCommand', () => {
    let command: RegisterCommand;

    beforeEach(() => {
      command = new RegisterCommand(mockUserRepo);
    });

    it('provisions a user without a password (no password field, firebaseUid null)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.save.mockImplementation((u: User) => u);

      const result = await command.execute({
        email: 'new@example.com',
        fullName: 'New User',
        role: 'manager',
      });

      const [savedUser] = mockUserRepo.save.mock.calls[0] as [User];
      expect(savedUser.firebaseUid).toBeNull();
      expect(result).toEqual({
        id: savedUser.id,
        email: 'new@example.com',
        fullName: 'New User',
        role: 'manager',
      });
      // No password anywhere on the returned shape.
      expect(result).not.toHaveProperty('password');
    });

    it('throws DuplicateEmailError for an existing email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(makeUser());

      await expect(
        command.execute({
          email: 'test@example.com',
          fullName: 'X',
          role: 'staff',
        }),
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  // ==========================================================================
  // ExchangeSessionCommand — Firebase ID token → app access token
  // ==========================================================================
  describe('ExchangeSessionCommand', () => {
    let command: ExchangeSessionCommand;

    const verified = {
      uid: FIREBASE_UID,
      email: 'test@example.com',
      email_verified: true,
    };

    beforeEach(() => {
      command = new ExchangeSessionCommand(
        mockUserRepo,
        mockFirebaseAdmin,
        mockSessionService as any,
        mockJwtService as any,
      );
      mockSessionService.create.mockResolvedValue({ sid: 'session-xyz' });
    });

    it('(a) throws NotProvisionedError when the email is not in the allowlist', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue(verified);
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(command.execute({ idToken: 'tok' })).rejects.toThrow(
        NotProvisionedError,
      );
    });

    it('(b) throws InactiveUserError for a deactivated user', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue(verified);
      mockUserRepo.findByEmail.mockResolvedValue(
        makeUser({ isActive: false, firebaseUid: FIREBASE_UID }),
      );

      await expect(command.execute({ idToken: 'tok' })).rejects.toThrow(
        InactiveUserError,
      );
    });

    it('(c) rejects an unverified Firebase email', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue({
        ...verified,
        email_verified: false,
      });

      await expect(command.execute({ idToken: 'tok' })).rejects.toThrow(
        InvalidCredentialsError,
      );
      // Must never reach the allowlist / session for an unverified email.
      expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
      expect(mockSessionService.create).not.toHaveBeenCalled();
    });

    it('(d) links firebaseUid on first login (repo save called with the uid)', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue(verified);
      mockUserRepo.findByEmail.mockResolvedValue(
        makeUser({ firebaseUid: null }),
      );
      mockUserRepo.save.mockImplementation((u: User) => u);

      await command.execute({ idToken: 'tok' });

      const [savedUser] = mockUserRepo.save.mock.calls[0] as [User];
      expect(savedUser.firebaseUid).toBe(FIREBASE_UID);
    });

    it('rejects when the linked firebaseUid differs (email re-used by another Google account)', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue(verified);
      mockUserRepo.findByEmail.mockResolvedValue(
        makeUser({ firebaseUid: 'some-other-uid' }),
      );

      await expect(command.execute({ idToken: 'tok' })).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(mockSessionService.create).not.toHaveBeenCalled();
    });

    it('rejects a token that fails verification', async () => {
      mockFirebaseAdmin.verifyIdToken.mockRejectedValue(new Error('bad sig'));

      await expect(command.execute({ idToken: 'tok' })).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('(e) returns { accessToken, user } and signs a payload carrying the sid', async () => {
      mockFirebaseAdmin.verifyIdToken.mockResolvedValue(verified);
      mockUserRepo.findByEmail.mockResolvedValue(
        makeUser({ firebaseUid: FIREBASE_UID, role: 'manager' }),
      );

      const result = await command.execute({ idToken: 'tok' });

      expect(result).toEqual({
        accessToken: 'access-token',
        user: {
          id: 'test-uuid-0001',
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'manager',
        },
      });
      expect(mockJwtService.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sid: 'session-xyz', sub: 'test-uuid-0001' }),
      );
      // Returning login (uid already linked) must not re-save.
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EndSessionCommand — logout
  // ==========================================================================
  describe('EndSessionCommand', () => {
    let command: EndSessionCommand;

    beforeEach(() => {
      command = new EndSessionCommand(mockSessionService as any);
    });

    it('revokes the given session id', async () => {
      await command.execute('sid-1');
      expect(mockSessionService.revoke).toHaveBeenCalledWith('sid-1');
    });

    it('is a no-op when no sid is present', async () => {
      await command.execute('');
      expect(mockSessionService.revoke).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UpdateUserCommand — deactivation must instantly cut off access (FR-A13)
  // ==========================================================================
  describe('UpdateUserCommand', () => {
    let command: UpdateUserCommand;

    beforeEach(() => {
      command = new UpdateUserCommand(
        mockUserRepo,
        mockSessionService as any,
        mockFirebaseAdmin,
      );
    });

    it('deactivation revokes all sessions and the Firebase refresh tokens', async () => {
      const user = makeUser({ id: 'u-9', firebaseUid: FIREBASE_UID });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.update.mockImplementation((u: User) => u);

      await command.execute('u-9', { isActive: false });

      expect(mockSessionService.revokeAllForUser).toHaveBeenCalledWith('u-9');
      expect(mockFirebaseAdmin.revokeRefreshTokens).toHaveBeenCalledWith(
        FIREBASE_UID,
      );
    });

    it('does not touch sessions when only the role changes', async () => {
      const user = makeUser({ id: 'u-9', firebaseUid: FIREBASE_UID });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.update.mockImplementation((u: User) => u);

      await command.execute('u-9', { role: 'admin' });

      expect(mockSessionService.revokeAllForUser).not.toHaveBeenCalled();
      expect(mockFirebaseAdmin.revokeRefreshTokens).not.toHaveBeenCalled();
    });
  });
});
