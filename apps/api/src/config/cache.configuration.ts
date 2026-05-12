import KeyvRedis from '@keyv/redis';
import {
  type CacheManagerOptions,
  type CacheOptionsFactory,
} from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keyv } from 'keyv';
import type { AppConfigurationType } from './configuration';

@Injectable()
export class CacheConfigFactory implements CacheOptionsFactory {
  constructor(
    private readonly configService: ConfigService<AppConfigurationType, true>,
  ) {}

  createCacheOptions(): CacheManagerOptions {
    const redis = this.configService.getOrThrow('redis', { infer: true });
    return {
      stores: [new Keyv({ store: new KeyvRedis(redis.url) })],
      ttl: redis.ttl * 1000,
    };
  }
}
