import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { MailService } from '../mail/mail.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const RESET_TOKEN_EXPIRY_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<Partial<User>> {
    const existing = await this.userRepository.findOneBy({
      email: registerDto.email,
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      BCRYPT_ROUNDS,
    );
    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      role: 'user',
    });
    const saved = await this.userRepository.save(user);
    const { password: _password, ...result } = saved;
    return result;
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userRepository.findOneBy({ email: loginDto.email });
    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Akun terkunci. Coba lagi dalam ${minutesLeft} menit.`,
      );
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordValid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000);
        user.failedLoginAttempts = 0;
        await this.userRepository.save(user);
        throw new ForbiddenException(
          `Akun terkunci selama ${LOCK_DURATION_MINUTES} menit karena terlalu banyak percobaan gagal.`,
        );
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Email atau password salah');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    const tokens = await this.generateTokens(user);
    user.refreshTokenHash = this.hashToken(tokens.refresh_token);
    await this.userRepository.save(user);
    return tokens;
  }

  async refresh(
    refreshDto: RefreshDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    let payload: { sub: number; type: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshDto.refresh_token);
    } catch {
      throw new UnauthorizedException(
        'Refresh token tidak valid atau kedaluwarsa',
      );
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token bukan refresh token');
    }

    const user = await this.userRepository.findOneBy({ id: payload.sub });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    const tokenHash = this.hashToken(refreshDto.refresh_token);
    if (tokenHash !== user.refreshTokenHash) {
      throw new UnauthorizedException(
        'Refresh token tidak valid (sudah dirotasi)',
      );
    }

    const tokens = await this.generateTokens(user);
    user.refreshTokenHash = this.hashToken(tokens.refresh_token);
    await this.userRepository.save(user);
    return tokens;
  }

  async logout(userId: number): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (user) {
      user.refreshTokenHash = null;
      await this.userRepository.save(user);
    }
    return { message: 'Berhasil logout' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({
      email: forgotPasswordDto.email,
    });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = this.hashToken(token);
      user.passwordResetExpiresAt = new Date(
        Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60000,
      );
      await this.userRepository.save(user);
      this.mailService.sendPasswordReset(user.email, token);
    }
    return {
      message: 'Jika email terdaftar, instruksi reset password telah dikirim',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(resetPasswordDto.token);
    const user = await this.userRepository.findOneBy({
      passwordResetTokenHash: tokenHash,
    });
    if (!user || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Token reset tidak valid atau kedaluwarsa');
    }
    if (user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Token reset kedaluwarsa');
    }
    user.password = await bcrypt.hash(resetPasswordDto.password, BCRYPT_ROUNDS);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.refreshTokenHash = null;
    await this.userRepository.save(user);
    return { message: 'Password berhasil direset' };
  }

  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }
    return user;
  }

  private async generateTokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessExpiration = this.configService.get<string>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    );
    const refreshExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: accessExpiration as never,
    });
    const refresh_token = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', jti: crypto.randomUUID() },
      { expiresIn: refreshExpiration as never },
    );
    return { access_token, refresh_token };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
