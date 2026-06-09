export const GetAppConfiguration = async () => {
  const config = {
    ...process.env,
  };

  return {
    port: config.PORT ? Number.parseInt(config.PORT, 10) : 4000,
    bind: config.BIND_ADDR || '0.0.0.0',
    pathPrefix: config.PATH_PREFIX || '',
    swagger: {
      enabled: config.FEATURE_SWAGGER_ENABLED === 'true',
    },
    log: {
      level: config.LOG_LEVEL || 'info',
    },
    cors: config.CORS_URL || '*',
    redis: {
      url: config.REDIS_URL as string,
      ttl: 60, // 1 minute cache
    },
    s3: {
      bucket: config.S3_BUCKET ?? '',
      region: config.S3_REGION ?? '',
      accessKeyId: config.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? '',
      endpoint: config.S3_ENDPOINT,
      publicBaseUrl: config.S3_PUBLIC_BASE_URL,
    },
    ai: {
      openai: {
        apiKey: config.OPENAI_API_KEY ?? '',
      },
      replicate: {
        apiToken: config.REPLICATE_API_TOKEN ?? '',
      },
      providers: {
        text: (config.AI_TEXT_PROVIDER ?? 'openai') as 'openai' | 'replicate',
        image: (config.AI_IMAGE_PROVIDER ?? 'replicate') as
          | 'openai'
          | 'replicate',
        speech: (config.AI_SPEECH_PROVIDER ?? 'replicate') as
          | 'openai'
          | 'replicate',
      },
      models: {
        text: config.AI_TEXT_MODEL ?? 'gpt-4o-mini',
        image:
          config.AI_IMAGE_MODEL ?? // ??
          'prunaai/z-image-turbo',
        // ?? 'black-forest-labs/flux-2-klein-4b',
        speech: config.AI_SPEECH_MODEL ?? 'minimax/speech-2.8-turbo',
      },
    },
  };
};

/**
 * Configuration type for typesafety across the codebase
 */
export type AppConfigurationType = Awaited<
  ReturnType<typeof GetAppConfiguration>
>;
