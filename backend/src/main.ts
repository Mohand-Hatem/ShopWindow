import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS with exposed telemetry headers so the cross-origin frontend can inspect them
  app.enableCors({
    origin: '*',
    exposedHeaders: ['X-Cache', 'ETag', 'Cache-Control'],
  });

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[ShopWindow] Application is running on: http://localhost:${port}`);
}
bootstrap();
