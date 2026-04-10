import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import {
    AddPostDto,
    GetPostDto,
    EditPostDto,
    GetListPostsDto,
    CheckNewItemDto,
    GetSavedSearchDto,
    SearchPostsDto,
    GetCommentDto,
    LikePostDto,
    ReportPostDto,
    SetCommentDto,
} from './posts.dto';

@Controller()
export class PostsController {
    constructor(private postsService: PostsService) {}

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
            course_id,
            exercise_id,
            described,
            device_slave,
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
