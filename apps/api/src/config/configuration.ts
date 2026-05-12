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
  };
};

/**
 * Configuration type for typesafety across the codebase
 */
export type AppConfigurationType = Awaited<
  ReturnType<typeof GetAppConfiguration>
>;
