import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { User } from '../users/entities/user.entity.js';
import { MailService } from '../mail/mail.service.js';

const mockUserRepository = {
  find: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockJwtService = {
  signAsync: vi.fn(),
  verifyAsync: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

const mockMailService = {
  sendPasswordReset: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  const baseUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword',
    role: 'user',
    failedLoginAttempts: 0,
    lockedUntil: null,
    refreshTokenHash: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation(
      (_key: string, def?: unknown) => def,
    );
    mockJwtService.signAsync.mockResolvedValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user with hashed password and role user', async () => {
      const dto = {
        name: 'John',
        email: 'j@example.com',
        password: 'secret123',
      };
      mockUserRepository.findOneBy.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((data: unknown) => data);
      mockUserRepository.save.mockImplementation(async (data: unknown) => ({
        ...(data as object),
        id: 1,
      }));

      const result = await service.register(dto);

      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({
        email: dto.email,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email');
      expect((result as User).role).toBe('user');

      const created = mockUserRepository.create.mock.results[0].value as {
        password: string;
      };
      const bcrypt = await import('bcrypt');
      expect(created.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, created.password)).toBe(true);
    });

    it('should throw ConflictException when email exists', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(baseUser);

      await expect(
        service.register({
          name: 'X',
          email: 'john@example.com',
          password: 'secret123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@x.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when account is locked', async () => {
      const lockedUser = {
        ...baseUser,
        lockedUntil: new Date(Date.now() + 60000),
      };
      mockUserRepository.findOneBy.mockResolvedValue(lockedUser);

      await expect(
        service.login({ email: baseUser.email, password: 'secret123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow login when lock has expired', async () => {
      const bcrypt = await import('bcrypt');
      const user = {
        ...baseUser,
        password: await bcrypt.hash('secret123', 4),
        lockedUntil: new Date(Date.now() - 1000),
        failedLoginAttempts: 3,
      };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.login({
        email: user.email,
        password: 'secret123',
      });

      expect(result).toHaveProperty('access_token');
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    it('should throw UnauthorizedException on wrong password and increment attempts', async () => {
      const user = { ...baseUser };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(user.failedLoginAttempts).toBe(1);
    });

    it('should lock account after max failed attempts', async () => {
      const user = { ...baseUser, failedLoginAttempts: 4 };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrongpass' }),
      ).rejects.toThrow(ForbiddenException);
      expect(user.lockedUntil).toBeInstanceOf(Date);
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should return tokens on successful login', async () => {
      const user = { ...baseUser };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);
      // bcrypt.compare will be called; mock via spy is complex, use real bcrypt against known hash
      // baseUser.password is 'hashedpassword' which is not a valid bcrypt hash.
      // Instead, set password to a real bcrypt hash of 'secret123' via bcrypt in test.
      const bcrypt = await import('bcrypt');
      user.password = await bcrypt.hash('secret123', 4);

      const result = await service.login({
        email: user.email,
        password: 'secret123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(user.refreshTokenHash).toBeTruthy();
      expect(user.failedLoginAttempts).toBe(0);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refresh({ refresh_token: 'bad' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token type is not refresh', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'access' });

      await expect(service.refresh({ refresh_token: 'tok' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate refresh token on valid request', async () => {
      const crypto = await import('crypto');
      const token = 'valid-refresh-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = { ...baseUser, refreshTokenHash: tokenHash };
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'refresh' });
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.refresh({ refresh_token: token });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(user.refreshTokenHash).not.toBe(tokenHash);
    });

    it('should reject already-rotated token', async () => {
      const crypto = await import('crypto');
      const oldToken = 'old-token';
      const newHash = crypto
        .createHash('sha256')
        .update('new-token')
        .digest('hex');
      const user = { ...baseUser, refreshTokenHash: newHash };
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'refresh' });
      mockUserRepository.findOneBy.mockResolvedValue(user);

      await expect(
        service.refresh({ refresh_token: oldToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 999,
        type: 'refresh',
      });
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.refresh({ refresh_token: 'tok' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no refresh token hash', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'refresh' });
      mockUserRepository.findOneBy.mockResolvedValue({
        ...baseUser,
        refreshTokenHash: null,
      });

      await expect(service.refresh({ refresh_token: 'tok' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      const user = { ...baseUser, refreshTokenHash: 'somehash' };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.logout(1);

      expect(result).toEqual({ message: 'Berhasil logout' });
      expect(user.refreshTokenHash).toBeNull();
    });

    it('should still succeed when user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      const result = await service.logout(999);

      expect(result).toEqual({ message: 'Berhasil logout' });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should always return generic message and send mail for existing user', async () => {
      const user = { ...baseUser };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.forgotPassword({ email: user.email });

      expect(result.message).toContain('Jika email terdaftar');
      expect(mockMailService.sendPasswordReset).toHaveBeenCalled();
      expect(user.passwordResetTokenHash).toBeTruthy();
    });

    it('should return same message for non-existent email (no enumeration)', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'none@none.com' });

      expect(result.message).toContain('Jika email terdaftar');
      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException on invalid token', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad', password: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset password on valid token', async () => {
      const crypto = await import('crypto');
      const bcrypt = await import('bcrypt');
      const token = 'reset-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = {
        ...baseUser,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 60000),
        failedLoginAttempts: 4,
        lockedUntil: new Date(Date.now() + 60000),
        refreshTokenHash: 'old-refresh-hash',
      };
      mockUserRepository.findOneBy.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.resetPassword({
        token,
        password: 'newpass123',
      });

      expect(result.message).toBe('Password berhasil direset');
      expect(await bcrypt.compare('newpass123', user.password)).toBe(true);
      expect(user.passwordResetTokenHash).toBeNull();
      expect(user.passwordResetExpiresAt).toBeNull();
      expect(user.refreshTokenHash).toBeNull();
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    it('should throw BadRequestException on expired token', async () => {
      const crypto = await import('crypto');
      const token = 'expired-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = {
        ...baseUser,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      };
      mockUserRepository.findOneBy.mockResolvedValue(user);

      await expect(
        service.resetPassword({ token, password: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(baseUser);

      const result = await service.validateUser(1);

      expect(result).toEqual(baseUser);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.validateUser(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
