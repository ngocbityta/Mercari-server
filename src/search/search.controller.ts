import { Controller, Post } from '@nestjs/common';
import { SearchService } from './search.service.ts';

@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Post('sync-all')
    async syncAll() {
        return this.searchService.syncAll();
    }
}
