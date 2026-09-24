import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './auth.guard.js';

const mockJwtService = {
  verifyAsync: vi.fn(),
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  const createContext = (authorization?: string) => {
    const request = {
      headers: authorization ? { authorization } : {},
      user: undefined as unknown,
    };
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
      request,
    } as unknown as ExecutionContext & { request: { user?: unknown } };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        Reflector,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow public routes without token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token is missing', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token tidak ditemukan',
    );
  });

  it('should throw UnauthorizedException when authorization header is not Bearer', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException on invalid token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    mockJwtService.verifyAsync.mockRejectedValue(new Error('expired'));
    const context = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token tidak valid atau kedaluwarsa',
    );
  });

  it('should reject refresh token used as access token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 1,
      type: 'refresh',
    });
    const context = createContext('Bearer refresh-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token refresh tidak valid untuk akses ini',
    );
  });

  it('should allow valid access token and attach payload to request', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const payload = { sub: 1, email: 'a@a.com', role: 'user' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);
    const context = createContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.request.user).toEqual(payload);
  });
});
