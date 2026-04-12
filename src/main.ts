import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.ts';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.ts';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableCors();
    app.setGlobalPrefix('it4788');

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    const logger = new Logger('Bootstrap');
    logger.log(`Server is running on: http://localhost:${port}/it4788`);
}
void bootstrap();
