import './polyfill.ts';

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module.ts';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.ts';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableCors();

    // Serve generated static grading detail HTML files.
    // Example URL: /it4788/static/grading-details/<student-post-id>.html
    app.useStaticAssets(join(process.cwd(), 'public'), {
        prefix: '/it4788/static/',
    });

    app.setGlobalPrefix('it4788');

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    const logger = new Logger('Bootstrap');
    logger.log(`Server is running on: http://localhost:${port}/it4788`);
}
void bootstrap();
