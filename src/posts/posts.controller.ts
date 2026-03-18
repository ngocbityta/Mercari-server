import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import {
    AddPostDto,
    EditPostDto,
    GetListPostsDto,
    CheckNewItemDto,
    GetSavedSearchDto,
    SearchPostsDto,
} from './posts.dto';

@Controller('api')
export class PostsController {
    constructor(private postsService: PostsService) {}

    @Post('add_post')
    async addPost(@Body() body: AddPostDto) {
        const { ownerId, content, media, hashtags } = body;
        return this.postsService.addPost(ownerId, content, media, hashtags);
    }

    @Patch('edit_post/:id')
    async editPost(@Param('id') postId: string, @Body() body: EditPostDto) {
        const { content, media, hashtags } = body;
        return this.postsService.editPost(postId, content, media, hashtags);
    }

    @Delete('delete_post/:id')
    async deletePost(@Param('id') postId: string) {
        return this.postsService.deletePost(postId);
    }

    @Get('get_post/:id')
    async getPost(@Param('id') postId: string) {
        return this.postsService.getPost(postId);
    }

    @Post('get_list_posts')
    async getListPosts(@Body() body: GetListPostsDto) {
        const { index, count, lastId } = body;
        return this.postsService.getListPosts(index, count, lastId);
    }

    @Post('check_new_item')
    async checkNewItem(@Body() body: CheckNewItemDto) {
        const { lastId } = body;
        return this.postsService.checkNewItem(lastId);
    }

    @Get('search')
    async search(@Query() query: SearchPostsDto) {
        const { q, index, count } = query;
        return this.postsService.searchPosts(q, index, count);
    }

    @Post('get_saved_search')
    getSavedSearch(@Body() body: GetSavedSearchDto) {
        const { userId } = body;
        return this.postsService.getSavedSearch(userId);
    }

    @Delete('del_saved_search/:id')
    delSavedSearch(@Param('id') searchId: string) {
        return this.postsService.delSavedSearch(searchId);
    }
}
