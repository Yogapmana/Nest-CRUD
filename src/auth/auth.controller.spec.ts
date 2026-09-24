import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = { name: 'A', email: 'a@a.com', password: 'secret123' };
      const expected = { id: 1, ...dto };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login', async () => {
      const dto = { email: 'a@a.com', password: 'secret123' };
      const expected = { access_token: 'at', refresh_token: 'rt' };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh', async () => {
      const dto = { refresh_token: 'rt' };
      const expected = { access_token: 'at2', refresh_token: 'rt2' };
      mockAuthService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.refresh).toHaveBeenCalledWith(dto);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Berhasil logout' });

      const result = await controller.logout(1);

      expect(result).toEqual({ message: 'Berhasil logout' });
      expect(mockAuthService.logout).toHaveBeenCalledWith(1);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const dto = { email: 'a@a.com' };
      const expected = { message: 'ok' };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      const dto = { token: 'tok', password: 'newpass123' };
      const expected = { message: 'Password berhasil direset' };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });
});
