import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const mockUsersService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  const sampleUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword',
    role: 'user',
    created_at: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
      };
      mockUsersService.create.mockResolvedValue(sampleUser);

      const result = await controller.create(dto);

      expect(result).toEqual(sampleUser);
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUsersService.findAll.mockResolvedValue([sampleUser]);

      const result = await controller.findAll();

      expect(result).toEqual([sampleUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(sampleUser);

      const result = await controller.findOne('1');

      expect(result).toEqual(sampleUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update own user when target is self', async () => {
      const updated = { ...sampleUser, name: 'Jane' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update('1', { name: 'Jane' }, 1, 'user');

      expect(result).toEqual(updated);
      expect(mockUsersService.update).toHaveBeenCalledWith(1, { name: 'Jane' });
    });

    it('should allow admin to update another user', async () => {
      const updated = { ...sampleUser, name: 'Jane' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update(
        '1',
        { name: 'Jane' },
        99,
        'admin',
      );

      expect(result).toEqual(updated);
      expect(mockUsersService.update).toHaveBeenCalledWith(1, { name: 'Jane' });
    });

    it('should forbid non-admin updating another user', () => {
      expect(() => controller.update('2', { name: 'X' }, 1, 'user')).toThrow(
        'Anda hanya dapat mengubah data diri sendiri',
      );
      expect(mockUsersService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUsersService.remove.mockResolvedValue({
        message: 'User berhasil dihapus',
      });

      const result = await controller.remove('1');

      expect(result).toEqual({ message: 'User berhasil dihapus' });
      expect(mockUsersService.remove).toHaveBeenCalledWith(1);
    });
  });
});
