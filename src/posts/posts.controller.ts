import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { PostsService } from './posts.service';
import { SearchHistoryService } from './search-history.service';
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
} from './posts.dto';

@Controller()
export class PostsController {
    constructor(
        private postsService: PostsService,
        private searchHistoryService: SearchHistoryService,
    ) {}

    @Post('add_post')
    async addPost(@Body() body: AddPostDto) {
        const {
            token,
            left_video,
            right_video,
            course_id,
            exercise_id,
            described,
            device_slave,
            device_master,
        } = body;
        return this.postsService.addPost(
            token,
            left_video,
            right_video,
            described,
            device_slave,
            course_id,
            exercise_id,
            device_master,
        );
    }

    @Post('get_post')
    async getPost(@Body() body: GetPostDto) {
        const { token, id, user_id } = body;
        return this.postsService.getPost(token, id, user_id);
    }

    @Post('edit_post')
    async editPost(@Body() body: EditPostDto) {
        const { token, id, described, video_indices, left_video, right_video } = body;
        return this.postsService.editPost(
            token,
            id,
            described,
            video_indices,
            left_video,
            right_video,
        );
    }

    @Delete('delete_post/:id')
    async deletePost(@Param('id') postId: string) {
        return this.postsService.deletePost(postId);
    }

    @Get('get_post/:id')
    async getPostLegacy(@Param('id') postId: string) {
        // Legacy endpoint for backward compatibility
        return this.postsService.getPost('', postId);
    }

    @Post('get_list_posts')
    async getListPosts(@Body() body: GetListPostsDto) {
        return this.postsService.getListPosts(
            body.token,
            body.category_id,
            body.last_id,
            body.index,
            body.count,
            body.user_id,
        );
    }

    @Post('check_new_item')
    async checkNewItem(@Body() body: CheckNewItemDto) {
        return this.postsService.checkNewItem(body.last_id, body.category_id);
    }

    @Post('search')
    async search(@Body() body: SearchPostsDto) {
        return this.postsService.searchPosts(
            body.token,
            body.keyword,
            body.category_id,
            body.duration_min,
            body.duration_max,
            body.user_id,
            body.index,
            body.count,
        );
    }

    @Post('get_saved_search')
    async getSavedSearch(@Body() body: GetSavedSearchDto) {
        return this.searchHistoryService.getSavedSearch(body.token, body.index, body.count, body.user_id);
    }

    @Post('del_saved_search')
    async delSavedSearch(@Body() body: DelSavedSearchDto) {
        return this.searchHistoryService.delSavedSearch(body.token, body.search_id, body.all);
    }

    @Post('get_comment')
    async getComment(@Body() body: GetCommentDto) {
        return this.postsService.getComment(
            body.token,
            body.id,
            parseInt(body.index),
            parseInt(body.count),
            body.user_id,
        );
    }

    @Post('like_post')
    async likePost(@Body() body: LikePostDto) {
        return this.postsService.likePost(body.token, body.id);
    }

    @Post('report_post')
    async reportPost(@Body() body: ReportPostDto) {
        return this.postsService.reportPost(body.token, body.id, body.subject, body.details);
    }

    @Post('set_comment')
    async setComment(@Body() body: SetCommentDto) {
        return this.postsService.setComment(
            body.token,
            body.id,
            parseInt(body.index),
            parseInt(body.count),
            body.comment,
            body.score,
            body.detail_mistakes,
        );
    }
}
