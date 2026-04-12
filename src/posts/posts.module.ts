import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { SearchHistoryService } from './search-history.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PostsController],
    providers: [PostsService, SearchHistoryService],
    exports: [PostsService, SearchHistoryService],
})
export class PostsModule {}
