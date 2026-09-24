import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  // Database sementara
  private users: User[] = [];
  private idCounter = 1;

  create(createUserDto: CreateUserDto) {
    const newUser: User = {
      id: this.idCounter++,
      ...createUserDto,
    };
    this.users.push(newUser);
    return newUser;
  }

  findAll() {
    return this.users; // Mengembalikan semua user
  }

  findOne(id: number) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    const user = this.findOne(id);
    Object.assign(user, updateUserDto);
    return user;
  }

  remove(id: number) {
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    this.users.splice(userIndex, 1);
    return { message: 'User berhasil dihapus' };
  }
}
