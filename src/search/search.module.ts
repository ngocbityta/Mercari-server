import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchService } from './search.service.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { SearchController } from './search.controller.ts';

@Module({
    imports: [
        ElasticsearchModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                node: configService.get<string>('ELASTICSEARCH_NODE') || 'http://localhost:9200',
                auth: {
                    username: configService.get<string>('ELASTICSEARCH_USERNAME') || 'elastic',
                    password: configService.get<string>('ELASTICSEARCH_PASSWORD') || 'changeme',
                },
            }),
            inject: [ConfigService],
        }),
        PrismaModule,
    ],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule {}
