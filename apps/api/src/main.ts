import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import type { AppConfigurationType } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.enableShutdownHooks();

  const cfg = app.get<ConfigService<AppConfigurationType, true>>(ConfigService);

  // Better Auth needs to be mounted before any body-parser/JSON middleware.
  // Using app.use with a path prefix matches all sub-paths and Express
  // strips the prefix before passing the request to better-auth's router.
  app.use('/api/auth', toNodeHandler(auth));

  app.use(json());
  app.use(urlencoded({ extended: true }));

  const prefix = cfg.getOrThrow('pathPrefix', { infer: true });
  if (prefix) {
    app.setGlobalPrefix(prefix);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (cfg.getOrThrow('swagger', { infer: true }).enabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Wonder Tales API')
      .setDescription('Wonder Tales backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(prefix ? `${prefix}/docs` : 'docs', app, document);
  }

  const port = cfg.getOrThrow('port', { infer: true });
  const bind = cfg.getOrThrow('bind', { infer: true });

  await app.listen(port, bind);

  const host = bind === '0.0.0.0' ? 'localhost' : bind;
  const baseURL = `http://${host}:${port}${prefix ? `/${prefix}` : ''}`;
  Logger.log(`API running on ${baseURL}`, 'NestApplication');
  Logger.log(`Swagger docs at ${baseURL}/docs`, 'NestApplication');
  Logger.log(`Better Auth mounted at ${baseURL}/api/auth`, 'NestApplication');
}

bootstrap();
