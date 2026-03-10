import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('api')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post('add_post')
  async addPost(@Body() body: any) {
    const { ownerId, content, media, hashtags } = body;
    return this.postsService.addPost(ownerId, content, media, hashtags);
  }

  @Patch('edit_post/:id')
  async editPost(@Param('id') postId: string, @Body() body: any) {
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
  async getListPosts(@Body() body: any) {
    const { index, count, last_id } = body;
    return this.postsService.getListPosts(index, count, last_id);
  }

  @Post('check_new_item')
  async checkNewItem(@Body() body: any) {
    const { last_id } = body;
    return this.postsService.checkNewItem(last_id);
  }

  @Get('search')
  async search(@Query('q') query: string, @Query('index') index: number = 0, @Query('count') count: number = 10) {
    return this.postsService.searchPosts(query, index, count);
  }

  @Post('get_saved_search')
  async getSavedSearch(@Body() body: any) {
    const { userId } = body;
    return this.postsService.getSavedSearch(userId);
  }

  @Delete('del_saved_search/:id')
  async delSavedSearch(@Param('id') searchId: string) {
    return this.postsService.delSavedSearch(searchId);
  }
}
