import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PostsModule } from '../posts/posts.module';

@Module({
    imports: [PrismaModule, PostsModule],
    controllers: [CoursesController],
    providers: [CoursesService],
})
export class CoursesModule {}
