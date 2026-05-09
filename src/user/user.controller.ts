import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('user')
export class UserController {
  @Get('users')
  findAll(@Req() request: Request): string {
    return 'This actions gets all users';
  }
  @Post()
  @HttpCode(204)
  create(): string {
    return 'This actions creates a new user';
  }

  @Get('abcd/*')
  findAllNot() {
    return 'This route uses a wildcard';
  }

  @Get(':id')
  findOne(@Param() params: any): string {
    console.log(params.id);
    return `This action returns a #${params.id} cat`;
  }
}
