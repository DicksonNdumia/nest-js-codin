import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserService } from 'src/users/user.service';
import { EmailService } from './email.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { Response } from 'express';
import type { User } from 'src/db/schema';
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(`An account already exists`);
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000, //24 hours from now
    );
    const user = await this.userService.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
      verificationToken,
      verificationTokenExpiresAt,
    });
    void this.emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: 'Registration Successful. Please Check Your email to confirm',
    };
  }
  async verifyEmail(token: string, res: Response) {
    const user = await this.userService.findByVerificationToken(token);
    if (!user || !user.verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }
    if (
      user.verificationTokenExpiresAt &&
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'verification token it has expired please request a new one',
      );
    }
    await this.userService.update(user.id, {
      isVerifies: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });
    const tokens = await this.generateToken(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      message: 'Email verified Successful',
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
  async login(dto: LoginDto, res: Response) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Wrong Credentials');
    }
    const comparePassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!comparePassword) {
      throw new UnauthorizedException('Wrong Credentials');
    }
    if (!user.isVerifies) {
      throw new UnauthorizedException('Please verify  your Account');
    }
    const token = await this.generateToken(user);
    await this.saveRefreshToken(user.id, token.refreshToken);
    this.setRefreshTokenCookie(res, token.refreshToken);

    return {
      accessToken: token.accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
  async logout(userId: string, res: Response) {
    await this.userService.update(userId, { refreshTokenHash: null });
    res.clearCookie('refresh_token');
    return {
      message: 'Logged Out Successful',
    };
  }
  async refresh(refreshToken: string, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('No Token provided');
    }
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh Token');
    }
    const user = await this.userService.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    const tokenMatch = await bcrypt.compare(
      refreshToken,

      user.refreshTokenHash,
    );
    if (!tokenMatch) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }
    const token = await this.generateToken(user);
    await this.saveRefreshToken(user.id, refreshToken);
    this.setRefreshTokenCookie(res, token.refreshToken);

    return {
      accessToken: token.accessToken,
    };
  }

  private async generateToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRE_IN'),
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });
    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userService.update(userId, { refreshTokenHash });
  }

  private async setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
