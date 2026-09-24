import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class AdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrap.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (!adminEmail || !adminPassword) {
      return;
    }
    const existing = await this.userRepository.findOneBy({ email: adminEmail });
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await this.userRepository.save(existing);
        this.logger.log(`Role admin diperbarui untuk ${adminEmail}`);
      }
      return;
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = this.userRepository.create({
      name: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    });
    await this.userRepository.save(admin);
    this.logger.log(`Admin account dibuat: ${adminEmail}`);
  }
}
