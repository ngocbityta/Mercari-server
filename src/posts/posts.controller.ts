import { Controller, Post, Get, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PostsService } from './posts.service.ts';
import { SearchHistoryService } from './search-history.service.ts';
import {
    AddPostDto,
    GetPostDto,
    EditPostDto,
    GetListPostsDto,
    CheckNewItemDto,
    GetSavedSearchDto,
    SearchPostsDto,
    DelSavedSearchDto,
    GetCommentDto,
    LikePostDto,
    ReportPostDto,
    SetCommentDto,
} from './posts.dto.ts';
import { ApiResponse } from '../common/dto/api-response.dto.ts';

@Controller()
export class PostsController {
    constructor(
        private readonly postsService: PostsService,
        private readonly searchHistoryService: SearchHistoryService,
    ) {}

    @Post('add_post')
    @HttpCode(HttpStatus.OK)
    async addPost(@Body() body: AddPostDto) {
        const result = await this.postsService.addPost(
            body.token,
            body.left_video,
            body.right_video,
            body.described,
            body.device_slave,
            body.course_id,
            body.exercise_id,
            body.device_master,
        );
        return ApiResponse.success(result);
    }

    @Post('get_post')
    @HttpCode(HttpStatus.OK)
    async getPost(@Body() body: GetPostDto) {
        const result = await this.postsService.getPost(body.token, body.id, body.user_id);
        return ApiResponse.success(result);
    }

    @Post('edit_post')
    @HttpCode(HttpStatus.OK)
    async editPost(@Body() body: EditPostDto) {
        const result = await this.postsService.editPost(
            body.token,
            body.id,
            body.described,
            body.video_indices,
            body.left_video,
            body.right_video,
        );
        return ApiResponse.success(result);
    }

    @Delete('delete_post/:id')
    @HttpCode(HttpStatus.OK)
    async deletePost(@Param('id') postId: string) {
        const result = await this.postsService.deletePost(postId);
        return ApiResponse.success(result);
    }

    @Get('get_post/:id')
    @HttpCode(HttpStatus.OK)
    async getPostLegacy(@Param('id') postId: string) {
        const result = await this.postsService.getPost('', postId);
        return ApiResponse.success(result);
    }

    @Post('get_list_posts')
    @HttpCode(HttpStatus.OK)
    async getListPosts(@Body() body: GetListPostsDto) {
        const result = await this.postsService.getListPosts(
            body.token,
            body.category_id,
            body.last_id,
            body.index,
            body.count,
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('check_new_item')
    @HttpCode(HttpStatus.OK)
    async checkNewItem(@Body() body: CheckNewItemDto) {
        const result = await this.postsService.checkNewItem(body.last_id, body.category_id);
        return ApiResponse.success(result);
    }

    @Post('search')
    @HttpCode(HttpStatus.OK)
    async search(@Body() body: SearchPostsDto) {
        const result = await this.postsService.searchPosts(
            body.token,
            body.keyword,
            body.category_id,
            body.duration_min,
            body.duration_max,
            body.user_id,
            body.index,
            body.count,
        );
        return ApiResponse.success(result);
    }

    @Post('get_saved_search')
    @HttpCode(HttpStatus.OK)
    async getSavedSearch(@Body() body: GetSavedSearchDto) {
        const result = await this.searchHistoryService.getSavedSearch(
            body.token,
            body.index,
            body.count,
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('del_saved_search')
    @HttpCode(HttpStatus.OK)
    async delSavedSearch(@Body() body: DelSavedSearchDto) {
        const result = await this.searchHistoryService.delSavedSearch(
            body.token,
            body.search_id,
            body.all,
        );
        return ApiResponse.success(result);
    }

    @Post('get_comment')
    @HttpCode(HttpStatus.OK)
    async getComment(@Body() body: GetCommentDto) {
        const result = await this.postsService.getComment(
            body.token,
            body.id,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
        return ApiResponse.success(result);
    }

    @Post('like_post')
    @HttpCode(HttpStatus.OK)
    async likePost(@Body() body: LikePostDto) {
        const result = await this.postsService.likePost(body.token, body.id);
        return ApiResponse.success(result);
    }

    @Post('report_post')
    @HttpCode(HttpStatus.OK)
    async reportPost(@Body() body: ReportPostDto) {
        const result = await this.postsService.reportPost(
            body.token,
            body.id,
            body.subject,
            body.details,
        );
        return ApiResponse.success(result);
    }

    @Post('set_comment')
    @HttpCode(HttpStatus.OK)
    async setComment(@Body() body: SetCommentDto) {
        const result = await this.postsService.setComment(
            body.token,
            body.id,
            parseInt(body.index),
            parseInt(body.count),
            body.comment,
            body.score,
            body.detail_mistakes,
        );
        return ApiResponse.success(result);
    }
}
