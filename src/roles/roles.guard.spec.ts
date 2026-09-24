import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role } from './role.enum.js';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createContext = (user?: { role: string }, roles?: Role[]) => {
    return {
      getHandler: () =>
        roles ? { [Symbol.for('roles')]: roles } : ({} as never),
      getClass: () => ({}) as never,
      switchToHttp: () => ({
        getRequest: () => (user ? { user } : {}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow when no roles required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createContext({ role: 'user' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when user has required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createContext({ role: 'admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should forbid when user lacks required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createContext({ role: 'user' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should forbid when user is missing', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
