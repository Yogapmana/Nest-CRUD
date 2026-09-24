import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Roles } from '../roles/roles.decorator.js';
import { Role } from '../roles/role.enum.js';
import { CurrentUser } from '../auth/auth.decorators.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('sub') currentUserId: number,
    @CurrentUser('role') currentUserRole: string,
  ) {
    this.assertSelfOrAdmin(+id, currentUserId, currentUserRole);
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  private assertSelfOrAdmin(
    targetId: number,
    currentUserId: number,
    currentUserRole: string,
  ) {
    if (currentUserRole !== Role.ADMIN && targetId !== currentUserId) {
      throw new ForbiddenException(
        'Anda hanya dapat mengubah data diri sendiri',
      );
    }
  }
}
