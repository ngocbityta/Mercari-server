import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { SearchHistoryService } from './search-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from '../search/search.module.ts';

@Module({
    imports: [PrismaModule, ConfigModule, SearchModule],
    controllers: [PostsController, MediaController],
    providers: [PostsService, SearchHistoryService, MediaService],
    exports: [PostsService, SearchHistoryService, MediaService],
})
export class PostsModule {}
