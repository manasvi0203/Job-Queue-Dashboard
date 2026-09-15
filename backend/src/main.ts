import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the React frontend (any origin, for simplicity in this take-home
  // project) to call the API from the browser.
  app.enableCors();

  // Global validation: strips unknown properties, rejects malformed
  // payloads before they reach the controller, and returns clear 400s.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Job Queue API listening on http://localhost:${port}`);
}
bootstrap();
