import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { SearchHistoryService } from './search-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaService } from './media.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, ConfigModule],
    controllers: [PostsController],
    providers: [PostsService, SearchHistoryService, MediaService],
    exports: [PostsService, SearchHistoryService, MediaService],
})
export class PostsModule {}
