import { Test, TestingModule } from '@nestjs/testing';
import { \[cat\]Controller } from './\[cat\].controller';

describe('\[cat\]Controller', () => {
  let controller: \[cat\]Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [\[cat\]Controller],
    }).compile();

    controller = module.get<\[cat\]Controller>(\[cat\]Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
