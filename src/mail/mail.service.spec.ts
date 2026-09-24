import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service.js';

const mockConfigService = {
  get: vi.fn(),
};

describe('MailService', () => {
  let service: MailService;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation(
      (_key: string, def?: unknown) => def,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(MailService);
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log reset URL built from APP_URL', () => {
    mockConfigService.get.mockReturnValue('https://myapp.example');

    service.sendPasswordReset('user@example.com', 'abc123');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://myapp.example/auth/reset-password?token=abc123',
      ),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('user@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('abc123'));
  });

  it('should fall back to localhost when APP_URL is not set', () => {
    service.sendPasswordReset('user@example.com', 'tok');

    expect(mockConfigService.get).toHaveBeenCalledWith(
      'APP_URL',
      'http://localhost:3000',
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/auth/reset-password'),
    );
  });
});
