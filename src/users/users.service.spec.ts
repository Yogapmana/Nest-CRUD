import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';

const mockUserRepository = {
  find: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  const sampleUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword',
    created_at: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      const dto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
      };
      mockUserRepository.create.mockReturnValue(sampleUser);
      mockUserRepository.save.mockResolvedValue(sampleUser);

      const result = await service.create(dto);

      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
      expect(result.password).toBe('hashedpassword');
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      mockUserRepository.find.mockResolvedValue([sampleUser]);

      const result = await service.findAll();

      expect(result).toEqual([sampleUser]);
      expect(mockUserRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(sampleUser);

      const result = await service.findOne(1);

      expect(result).toEqual(sampleUser);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updatedUser = { ...sampleUser, name: 'Jane Doe' };
      mockUserRepository.findOneBy.mockResolvedValue(sampleUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update(1, { name: 'Jane Doe' });

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update(999, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user and return message', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(sampleUser);
      mockUserRepository.remove.mockResolvedValue(sampleUser);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'User berhasil dihapus' });
      expect(mockUserRepository.remove).toHaveBeenCalledWith(sampleUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
