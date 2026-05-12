import { Test } from '@nestjs/testing';
import { name, version } from '../../package.json';
import { AppController } from '../app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  describe('getInfo', () => {
    it('returns the package name and version', () => {
      expect(controller.getInfo()).toEqual({ name, version });
    });

    it('returns string fields with non-empty values', () => {
      const info = controller.getInfo();
      expect(typeof info.name).toBe('string');
      expect(info.name.length).toBeGreaterThan(0);
      expect(typeof info.version).toBe('string');
      expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
