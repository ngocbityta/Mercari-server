import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IPostQuery, IPostCommand } from './posts.interfaces.ts';

@Injectable()
export class PostsService implements IPostQuery, IPostCommand {
    constructor(private prisma: PrismaService) {}

    async addPost(
        token: string,
        left_video?: string,
        right_video?: string,
        course_id?: string,
        exercise_id?: string,
        described?: string,
        device_slave?: string,
        device_master?: string,
    ) {
        // Validate token - get user from token
        const user = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!user) {
            throw new Error('Invalid token');
        }

        // Validate device_master is provided
        if (!device_master) {
            throw new Error('device_master is required');
        }

        // Validate that if exercise_id is provided, course_id must also be provided (student posting)
        if (exercise_id && !course_id) {
            throw new Error('course_id is required when exercise_id is provided');
        }

        // Validate that if course_id is provided, it must be the same as the user's ID (teacher posting)
        if (course_id && user.id !== course_id) {
            throw new Error('course_id must match user ID for teacher posting');
        }

        // Validate that if exercise_id is provided, the post exists and is owned by a teacher
        if (exercise_id) {
            const exercisePost = await this.prisma.post.findUnique({
                where: { id: exercise_id },
            });

            if (!exercisePost) {
                throw new Error('Exercise post not found');
            }

            // Check if the exercise post is owned by a teacher (course owner)
            const exerciseOwner = await this.prisma.user.findUnique({
                where: { id: exercisePost.ownerId },
            });

            if (!exerciseOwner) {
                throw new Error('Exercise post owner not found');
            }
        }

        // Create media array with video files
        const media: string[] = [];
        if (left_video) {
            media.push(left_video);
        }
        if (right_video) {
            media.push(right_video);
        }

        // Create the post
        const post = await this.prisma.post.create({
            data: {
                ownerId: user.id,
                content: described || '',
                media,
                hashtags: [],
                courseId: course_id || null,
                exerciseId: exercise_id || null,
                deviceMaster: device_master,
                deviceSlave: device_slave || null,
                leftVideo: left_video || null,
                rightVideo: right_video || null,
            },
            include: {
                owner: true,
            },
        });

        return post;
    }

    async editPost(
        token: string,
        postId: string,
        described?: string,
        video_indices?: string,
        left_video?: string,
        right_video?: string,
    ) {
        // Validate token - get user
        const user = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!user) {
            throw new Error('Invalid token');
        }

        // Check if user is a teacher (GV)
        if (user.role !== 'GV') {
            throw new Error('Only teachers can edit posts');
        }

        // Check if user account is active
        if (user.status !== 'ACTIVE') {
            throw new Error('User account is locked');
        }

        // Get the post
        const post = await this.prisma.post.findUnique({
            where: { id: postId },
        });

        if (!post) {
            throw new Error('Post not found');
        }

        // Check if the user owns this post
        if (post.ownerId !== user.id) {
            throw new Error('You do not own this post');
        }

        // Parse video_indices to determine which videos to delete
        const videosToDelete: string[] = [];

        if (video_indices) {
            const indices = video_indices.split(',').map((s: string) => s.trim().toLowerCase());

            for (const index of indices) {
                if (index === 'l' || index === 'left' || index === 'all' || index === 'lr') {
                    videosToDelete.push('left');
                } else if (index === 'r' || index === 'right') {
                    videosToDelete.push('right');
                }
            }
        }

        // Validate video replacement logic
        const hasLeftVideoToDelete = videosToDelete.includes('left');
        const hasRightVideoToDelete = videosToDelete.includes('right');
        const hasLeftVideoToAdd = left_video !== undefined && left_video !== '';
        const hasRightVideoToAdd = right_video !== undefined && right_video !== '';

        // If deleting left video, must have replacement
        if (hasLeftVideoToDelete && !hasLeftVideoToAdd) {
            throw new Error('Must provide replacement video for deleted left video');
        }

        // If deleting right video, must have replacement
        if (hasRightVideoToDelete && !hasRightVideoToAdd) {
            throw new Error('Must provide replacement video for deleted right video');
        }

        // If adding left video without specifying deletion, it's an update
        if (hasLeftVideoToAdd && !hasLeftVideoToDelete) {
            // This is valid - updating left video
        }

        // If adding right video without specifying deletion, it's an update
        if (hasRightVideoToAdd && !hasRightVideoToDelete) {
            // This is valid - updating right video
        }

        // Check for mismatched video indices and uploads
        if (
            (hasLeftVideoToDelete || hasRightVideoToDelete) &&
            !hasLeftVideoToAdd &&
            !hasRightVideoToAdd
        ) {
            throw new Error('Deleted videos must have replacements');
        }

        // Build the updated media array
        const currentMedia = post.media || [];
        const newMedia: string[] = [];

        // Process current media and apply deletions/additions
        if (currentMedia.length > 0) {
            for (let i = 0; i < currentMedia.length; i++) {
                const mediaItem = currentMedia[i];
                const isLeftVideo = mediaItem === post.leftVideo;
                const isRightVideo = mediaItem === post.rightVideo;

                // Skip deleted videos
                if (isLeftVideo && hasLeftVideoToDelete) {
                    continue;
                }
                if (isRightVideo && hasRightVideoToDelete) {
                    continue;
                }

                newMedia.push(mediaItem);
            }
        }

        // Add new videos
        if (hasLeftVideoToAdd) {
            newMedia.push(left_video);
        }
        if (hasRightVideoToAdd) {
            newMedia.push(right_video);
        }

        // Ensure at least one video exists
        if (newMedia.length === 0 && (post.leftVideo || post.rightVideo)) {
            throw new Error('Post must have at least one video');
        }

        // Update the post
        const updatedPost = await this.prisma.post.update({
            where: { id: postId },
            data: {
                content: described !== undefined ? described : post.content,
                media: newMedia,
                leftVideo: hasLeftVideoToAdd
                    ? left_video
                    : hasLeftVideoToDelete
                      ? null
                      : post.leftVideo,
                rightVideo: hasRightVideoToAdd
                    ? right_video
                    : hasRightVideoToDelete
                      ? null
                      : post.rightVideo,
            },
            include: {
                owner: true,
            },
        });

        return {
            id: updatedPost.id,
            url: '', // Placeholder for future use
        };
    }

    async deletePost(postId: string) {
        await this.prisma.post.delete({
            where: { id: postId },
        });
        return { message: 'Post deleted successfully' };
    }

    async getPost(token: string, postId: string, _user_id?: string) {
        // Validate token - get viewer user
        const viewer = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!viewer) {
            throw new Error('Invalid token');
        }

        // Get the post
        const post = await this.prisma.post.findUnique({
            where: { id: postId },
            include: {
                owner: true,
            },
        });

        if (!post) {
            throw new Error('Post not found');
        }

        // Check if the post owner has blocked the viewer
        const isBlocked = await this.prisma.block.findFirst({
            where: {
                blockerId: post.ownerId,
                blockedId: viewer.id,
            },
        });

        // Check if viewer is student and post owner is teacher for time_series_poses
        const isViewerStudent = viewer.role === 'HV';
        const isOwnerTeacher = post.owner.role === 'GV';
        let timeSeriesPoses: any[] | undefined;

        // Only include time_series_poses if viewer is student and owner is teacher
        if (isViewerStudent && isOwnerTeacher) {
            // This would be populated from a separate table if it exists
            // For now, return empty array
            timeSeriesPoses = [];
        }

        // Build the response data
        const responseData = {
            id: post.id,
            described: post.content,
            created: post.createdAt.toISOString(),
            modified: post.updatedAt.toISOString(),
            like: '0', // Will be calculated from likeIds array
            comment: '0', // Will be calculated from commentIds array
            is_liked: '0', // Will be set based on viewer's like status
            video: post.media.map((url, index) => ({
                url: url,
                thumb: `thumbnail_${index}.jpg`, // Placeholder for thumbnail
            })),
            author: {
                id: post.owner.id,
                name: post.owner.username || 'Người dùng',
                avatar: post.owner.avatar || 'default_avatar.jpg',
                online: post.owner.online ? '1' : '0',
            },
            exercise_id: post.exerciseId || '',
            edited_times: '0', // Placeholder for edit count
            is_blocked: isBlocked ? '1' : '0',
        };

        // Add lecturer info if exercise_id exists and author != lecturer
        if (post.exerciseId && post.ownerId !== post.courseId && post.courseId) {
            // Get the course owner (teacher) as lecturer
            const lecturer = await this.prisma.user.findFirst({
                where: {
                    id: post.courseId,
                    role: 'GV',
                },
            });

            if (lecturer) {
                (responseData as any).lecturer = {
                    id: lecturer.id,
                    name: lecturer.username || 'Giảng viên',
                    avatar: lecturer.avatar || 'default_lecturer_avatar.jpg',
                };
            }
        }

        // Add time_series_poses only if viewer is student and owner is teacher
        if (timeSeriesPoses !== undefined) {
            (responseData as any).time_series_poses = timeSeriesPoses;
        }

        return responseData;
    }

    async getListPosts(index: number = 0, count: number = 10, lastId?: string) {
        const skip = index * count;
        const where: Prisma.PostWhereInput = {};

        if (lastId) {
            const lastPost = await this.prisma.post.findUnique({
                where: { id: lastId },
            });
            if (lastPost && lastPost.createdAt) {
                where.createdAt = { lt: lastPost.createdAt };
            }
        }

        const posts = await this.prisma.post.findMany({
            where,
            include: {
                owner: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: count,
        });

        const total = await this.prisma.post.count({ where });

        return {
            data: posts,
            total,
            index,
            count,
        };
    }

    async checkNewItem(lastId: string) {
        if (!lastId) {
            return { hasNew: false, count: 0 };
        }

        const lastPost = await this.prisma.post.findUnique({
            where: { id: lastId },
        });

        if (!lastPost || !lastPost.createdAt) {
            return { hasNew: false, count: 0 };
        }

        const newCount = await this.prisma.post.count({
            where: {
                createdAt: { gt: lastPost.createdAt },
            },
        });

        return { hasNew: newCount > 0, count: newCount };
    }

    async searchPosts(query: string, index: number = 0, count: number = 10) {
        const skip = index * count;

        const posts = await this.prisma.post.findMany({
            where: {
                OR: [
                    { content: { contains: query, mode: 'insensitive' } },
                    { hashtags: { hasSome: [query] } },
                ],
            },
            include: {
                owner: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: count,
        });

        const total = await this.prisma.post.count({
            where: {
                OR: [
                    { content: { contains: query, mode: 'insensitive' } },
                    { hashtags: { hasSome: [query] } },
                ],
            },
        });

        return {
            data: posts,
            total,
            index,
            count,
        };
    }

    getSavedSearch(_userId: string) {
        return [];
    }

    delSavedSearch(_searchId: string) {
        return { message: 'Saved search deleted' };
    }
}
