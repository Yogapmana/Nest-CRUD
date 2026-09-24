import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminBootstrap } from './admin-bootstrap.js';
import { User } from '../users/entities/user.entity.js';
import * as bcrypt from 'bcrypt';

const mockUserRepository = {
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

describe('AdminBootstrap', () => {
  let bootstrap: AdminBootstrap;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBootstrap,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    bootstrap = module.get(AdminBootstrap);
  });

  it('should be defined', () => {
    expect(bootstrap).toBeDefined();
  });

  it('should skip when ADMIN_EMAIL is not set', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAIL' ? undefined : 'admin123',
    );

    await bootstrap.onApplicationBootstrap();

    expect(mockUserRepository.findOneBy).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should skip when ADMIN_PASSWORD is not set', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAIL' ? 'admin@example.com' : undefined,
    );

    await bootstrap.onApplicationBootstrap();

    expect(mockUserRepository.findOneBy).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('should create admin when none exists', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAIL' ? 'admin@example.com' : 'admin123',
    );
    mockUserRepository.findOneBy.mockResolvedValue(null);
    mockUserRepository.create.mockImplementation((data: unknown) => data);
    mockUserRepository.save.mockImplementation(async (data: unknown) => ({
      ...(data as object),
      id: 1,
    }));

    await bootstrap.onApplicationBootstrap();

    expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({
      email: 'admin@example.com',
    });
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Admin',
        email: 'admin@example.com',
        role: 'admin',
      }),
    );
    const created = mockUserRepository.create.mock.results[0].value as {
      password: string;
    };
    expect(await bcrypt.compare('admin123', created.password)).toBe(true);
    expect(mockUserRepository.save).toHaveBeenCalled();
  });

  it('should promote existing user to admin when role is not admin', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAIL' ? 'admin@example.com' : 'admin123',
    );
    const existing = {
      id: 1,
      email: 'admin@example.com',
      role: 'user',
    };
    mockUserRepository.findOneBy.mockResolvedValue(existing);
    mockUserRepository.save.mockResolvedValue(existing);

    await bootstrap.onApplicationBootstrap();

    expect(existing.role).toBe('admin');
    expect(mockUserRepository.save).toHaveBeenCalledWith(existing);
  });

  it('should do nothing when existing user already has admin role', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAIL' ? 'admin@example.com' : 'admin123',
    );
    mockUserRepository.findOneBy.mockResolvedValue({
      id: 1,
      email: 'admin@example.com',
      role: 'admin',
    });

    await bootstrap.onApplicationBootstrap();

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockUserRepository.create).not.toHaveBeenCalled();
  });
});
