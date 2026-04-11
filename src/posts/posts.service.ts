import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum';
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

    async getListPosts(
        token?: string,
        category_id?: string,
        last_id?: string,
        index: number = 0,
        count: number = 10,
        user_id?: string,
    ) {
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        let viewer = requester;
        if (user_id) {
            if (requester.role === 'GV') {
                const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
                if (targetUser) {
                    viewer = targetUser;
                }
            }
        }

        const where: Prisma.PostWhereInput = {};

        // Category filter (if implemented in schema, currently not used)
        if (category_id && category_id !== '0') {
            // where.categoryId = category_id;
        }

        let lastPost: any = null;
        if (last_id) {
            lastPost = await this.prisma.post.findUnique({
                where: { id: last_id },
            });
            if (lastPost && lastPost.createdAt) {
                where.createdAt = { lt: lastPost.createdAt };
            }
        }

        const skip = index * count;

        const posts = await this.prisma.post.findMany({
            where,
            include: {
                owner: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: count,
        });

        if (posts.length === 0 && index === 0) {
            return {
                code: ResponseCode.NO_DATA,
                message: ResponseMessage[ResponseCode.NO_DATA],
            };
        }

        const lastIdReported = posts.length > 0 ? posts[posts.length - 1].id : last_id;

        // Calculate new_items count
        let newItemsCount = 0;
        if (lastPost) {
            newItemsCount = await this.prisma.post.count({
                where: {
                    createdAt: { gt: lastPost.createdAt },
                },
            });
        }

        const mappedPosts = (await Promise.all(
            posts.map(async (post) => {
                const content = post.content || '';
                const media = post.media || [];

                const isLiked = viewer ? (post.likeIds || []).includes(viewer.id) : false;
                
                let isBlocked = false;
                if (viewer) {
                    const blockRelationship = await this.prisma.block.findFirst({
                        where: {
                            OR: [
                                { blockerId: post.ownerId, blockedId: viewer.id },
                                { blockerId: viewer.id, blockedId: post.ownerId },
                            ],
                        },
                    });
                    isBlocked = !!blockRelationship;
                }

                const canEdit = viewer ? (post.ownerId === viewer.id && !post.isLocked) : false;
                const canComment = !post.isLocked;

                return {
                    id: post.id,
                    described: content,
                    video: media.map((url, idx) => ({
                        url,
                        thumb: `thumbnail_${idx}.jpg`,
                    })),
                    created: post.createdAt.toISOString(),
                    like: (post.likeIds?.length || 0).toString(),
                    comment: (post.commentIds?.length || 0).toString(),
                    is_liked: isLiked ? '1' : '0',
                    is_blocked: isBlocked ? '1' : '0',
                    can_comment: canComment ? '1' : '0',
                    can_edit: canEdit ? '1' : '0',
                    banned: post.owner.status === 'LOCKED' ? '1' : '0',
                    author: {
                        id: post.owner.id,
                        name: post.owner.username || '',
                        avatar: post.owner.avatar || '',
                        role: post.owner.role,
                    },
                    exercise_id: post.exerciseId || '',
                    time_series_poses: post.owner.role === 'GV' ? [] : undefined,
                };
            }),
        )).filter(post => post.described !== '' || post.video.length > 0);

        if (mappedPosts.length === 0 && posts.length > 0 && index === 0) {
            return {
                code: ResponseCode.NO_DATA,
                message: ResponseMessage[ResponseCode.NO_DATA],
            };
        }

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: {
                posts: mappedPosts,
                new_items: newItemsCount.toString(),
                last_id: lastIdReported || '',
            },
        };
    }

    async checkNewItem(last_id?: string, _category_id?: string) {
        try {
            if (!last_id) {
                return {
                    code: ResponseCode.OK,
                    message: ResponseMessage[ResponseCode.OK],
                    data: { new_items: '0' },
                };
            }

            const lastPost = await this.prisma.post.findUnique({
                where: { id: last_id },
            });

            if (!lastPost || !lastPost.createdAt) {
                return {
                    code: ResponseCode.OK,
                    message: ResponseMessage[ResponseCode.OK],
                    data: { new_items: '0' },
                };
            }

            const newCount = await this.prisma.post.count({
                where: {
                    createdAt: { gt: lastPost.createdAt },
                },
            });

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: { new_items: newCount.toString() },
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async searchPosts(
        token?: string,
        keyword?: string,
        category_id?: string,
        _duration_min?: string,
        _duration_max?: string,
        user_id?: string,
        index: number = 0,
        count: number = 10,
    ) {
        if (!keyword) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
            };
        }

        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        // Save to SearchHistory (unless it's a hashtag)
        if (keyword && !keyword.startsWith('#')) {
            try {
                await (this.prisma as any).searchHistory.create({
                    data: {
                        userId: requester.id,
                        keyword: keyword,
                        durationMin: _duration_min,
                        durationMax: _duration_max,
                    },
                });
            } catch (err) {
                console.error('Failed to save search history:', err);
            }
        }

        // [Test Case 13]: Kiểm tra index và count hợp lệ
        if (index < 0 || count <= 0) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
            };
        }

        // Lấy danh sách những người liên quan đến block
        const allBlocks = await this.prisma.block.findMany({
            where: {
                OR: [{ blockerId: requester.id }, { blockedId: requester.id }],
            },
        });
        const blockedUserIds = allBlocks
            .flatMap((b) => [b.blockerId, b.blockedId])
            .filter((id) => id !== requester.id);

        const where: Prisma.PostWhereInput = {
            content: { contains: keyword, mode: 'insensitive' },
            // Filter out blocked users
            ...(blockedUserIds.length > 0 ? { ownerId: { notIn: blockedUserIds } } : {}),
        };

        if (user_id) {
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                };
            }
            where.ownerId = user_id;
        }

        const skip = index * count;

        const posts = await this.prisma.post.findMany({
            where,
            include: { owner: true },
            orderBy: { createdAt: 'desc' },
            skip,
            take: count,
        });

        if (posts.length === 0 && index === 0) {
            return {
                code: ResponseCode.NO_DATA,
                message: ResponseMessage[ResponseCode.NO_DATA],
            };
        }

        const mappedPosts = (await Promise.all(
            posts.map(async (post) => {
                if (!post.owner || !post.owner.id) return null;

                const content = post.content || '';
                const media = post.media || [];

                const isLiked = (post.likeIds || []).includes(requester.id);
                
                const blockRelationship = await this.prisma.block.findFirst({
                    where: {
                        OR: [
                            { blockerId: post.ownerId, blockedId: requester.id },
                            { blockerId: requester.id, blockedId: post.ownerId },
                        ],
                    },
                });
                const isBlocked = !!blockRelationship;

                const canEdit = post.ownerId === requester.id && !post.isLocked;
                const canComment = !post.isLocked;

                return {
                    id: post.id,
                    described: content,
                    video: media.map((url, idx) => ({
                        url,
                        thumb: `thumbnail_${idx}.jpg`,
                    })),
                    created: post.createdAt.toISOString(),
                    like: (post.likeIds?.length || 0).toString(),
                    comment: (post.commentIds?.length || 0).toString(),
                    is_liked: isLiked ? '1' : '0',
                    is_blocked: isBlocked ? '1' : '0',
                    can_comment: canComment ? '1' : '0',
                    can_edit: canEdit ? '1' : '0',
                    banned: post.owner.status === 'LOCKED' ? '1' : '0',
                    author: {
                        id: post.owner.id,
                        name: post.owner.username || '',
                        avatar: post.owner.avatar || '',
                        role: post.owner.role,
                    },
                    exercise_id: post.exerciseId || '',
                    time_series_poses: post.owner.role === 'GV' ? [] : undefined,
                };
            }),
        )).filter(post => post !== null && (post.described !== '' || post.video.length > 0));

        if (mappedPosts.length === 0 && posts.length > 0 && index === 0) {
            return {
                code: ResponseCode.NO_DATA,
                message: ResponseMessage[ResponseCode.NO_DATA],
            };
        }

        return {
            code: ResponseCode.OK,
            message: ResponseMessage[ResponseCode.OK],
            data: { posts: mappedPosts },
        };
    }

    async getSavedSearch(token: string, index?: string, count?: string, user_id?: string) {
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        let targetUserId = requester.id;
        if (user_id) {
            // Admin only check
            if (requester.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: ResponseMessage[ResponseCode.NOT_ACCESS],
                };
            }
            targetUserId = user_id;
        }

        const idx = index ? parseInt(index) : 0;
        const cnt = count ? parseInt(count) : 20;

        try {
            const histories = await (this.prisma as any).searchHistory.findMany({
                where: { userId: targetUserId },
                orderBy: { createdAt: 'desc' },
                skip: idx * cnt,
                take: cnt,
            });

            if (histories.length === 0 && idx === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                    data: [],
                };
            }

            const data = histories.map(h => ({
                id: h.id,
                keyword: h.keyword,
                user_id: h.userId,
                duration_min: h.durationMin || '0',
                duration_max: h.durationMax || '0',
                created: h.createdAt.toISOString(),
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data,
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async delSavedSearch(token: string, search_id?: string, all?: string) {
        if (!token) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        try {
            if (all === '1') {
                // Check if history exists
                const count = await (this.prisma as any).searchHistory.count({
                    where: { userId: requester.id },
                });

                if (count === 0) {
                    return {
                        code: ResponseCode.NO_DATA,
                        message: ResponseMessage[ResponseCode.NO_DATA],
                    };
                }

                // Delete all history for this user
                await (this.prisma as any).searchHistory.deleteMany({
                    where: { userId: requester.id },
                });
            } else {
                if (!search_id) {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                    };
                }

                // Verify ownership and existence
                const history = await (this.prisma as any).searchHistory.findUnique({
                    where: { id: search_id },
                });

                if (!history) {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                    };
                }

                if (history.userId !== requester.id) {
                    return {
                        code: ResponseCode.NOT_ACCESS,
                        message: ResponseMessage[ResponseCode.NOT_ACCESS],
                    };
                }

                await (this.prisma as any).searchHistory.delete({
                    where: { id: search_id },
                });
            }

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async getComment(
        token: string,
        postId: string,
        index: number,
        count: number,
        user_id?: string,
    ) {
        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (requester.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        let viewer = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: ResponseMessage[ResponseCode.NOT_ACCESS],
                };
            }
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                return {
                    code: ResponseCode.USER_NOT_VALIDATED,
                    message: ResponseMessage[ResponseCode.USER_NOT_VALIDATED],
                };
            }
            viewer = targetUser;
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return {
                code: ResponseCode.POST_NOT_FOUND,
                message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
            };
        }

        if (post.isLocked) {
            return {
                code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                message: ResponseMessage[ResponseCode.ACTION_DONE_PREVIOUSLY],
            };
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
            };
        }

        const isBlocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: post.ownerId, blockedId: viewer.id },
                    { blockerId: viewer.id, blockedId: post.ownerId },
                ],
            },
        });

        try {
            const allBlocks = await this.prisma.block.findMany({
                where: {
                    OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }],
                },
            });
            const blockedUserIds = allBlocks
                .flatMap((b) => [b.blockerId, b.blockedId])
                .filter((id) => id !== viewer.id);

            const skip = index * count;

            const comments = await this.prisma.comment.findMany({
                where: {
                    postId,
                    ...(blockedUserIds.length > 0 ? { authorId: { notIn: blockedUserIds } } : {}),
                },
                include: {
                    author: {
                        select: { id: true, username: true, avatar: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: count,
            });

            if (comments.length === 0 && index === 0) {
                return {
                    code: ResponseCode.NO_DATA,
                    message: ResponseMessage[ResponseCode.NO_DATA],
                };
            }

            const data = comments.map((c) => ({
                id: c.id,
                comment: c.content,
                created: c.createdAt.toISOString(),
                poster: {
                    id: c.author.id,
                    name: c.author.username ?? '',
                    avatar: c.author.avatar ?? '',
                },
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data,
                is_blocked: isBlocked ? '1' : '0',
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async setComment(
        token: string,
        postId: string,
        index: number,
        count: number,
        comment?: string,
        score?: string,
        detail_mistakes?: string,
    ) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (user.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return {
                code: ResponseCode.POST_NOT_FOUND,
                message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
            };
        }

        if (post.isLocked) {
            return {
                code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                message: ResponseMessage[ResponseCode.ACTION_DONE_PREVIOUSLY],
            };
        }

        const hasComment = comment !== undefined && comment.trim() !== '';
        const hasScore = score !== undefined && score.trim() !== '';

        if (!hasComment && !hasScore) {
            return {
                code: ResponseCode.MISSING_PARAMETER,
                message: ResponseMessage[ResponseCode.MISSING_PARAMETER],
            };
        }

        if (hasComment && hasScore) {
            return {
                code: ResponseCode.INVALID_PARAMETER_VALUE,
                message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
            };
        }

        const isBlocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: post.ownerId, blockedId: user.id },
                    { blockerId: user.id, blockedId: post.ownerId },
                ],
            },
        });

        try {
            await this.prisma.comment.create({
                data: {
                    postId,
                    authorId: user.id,
                    ...(hasComment
                        ? { content: comment }
                        : { score, detailMistakes: detail_mistakes ?? null }),
                } as any,
            });

            const allBlocks = await this.prisma.block.findMany({
                where: {
                    OR: [{ blockerId: user.id }, { blockedId: user.id }],
                },
            });
            const blockedUserIds = allBlocks
                .flatMap((b) => [b.blockerId, b.blockedId])
                .filter((id) => id !== user.id);

            const skip = index * count;
            const comments = await this.prisma.comment.findMany({
                where: {
                    postId,
                    ...(blockedUserIds.length > 0 ? { authorId: { notIn: blockedUserIds } } : {}),
                },
                include: {
                    author: {
                        select: { id: true, username: true, avatar: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: count,
            });

            const data = comments.map((c) => ({
                id: c.id,
                comment: c.content ?? '',
                created: c.createdAt.toISOString(),
                poster: {
                    id: c.author.id,
                    name: c.author.username ?? '',
                    avatar: c.author.avatar ?? '',
                },
            }));

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data,
                is_blocked: isBlocked ? '1' : '0',
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async likePost(token: string, postId: string) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (user.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return {
                code: ResponseCode.POST_NOT_FOUND,
                message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
            };
        }

        if (post.isLocked) {
            return {
                code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                message: ResponseMessage[ResponseCode.ACTION_DONE_PREVIOUSLY],
            };
        }

        try {
            const alreadyLiked = post.likeIds.includes(user.id);

            const updated = await this.prisma.post.update({
                where: { id: postId },
                data: {
                    likeIds: alreadyLiked
                        ? { set: post.likeIds.filter((id) => id !== user.id) }
                        : { push: user.id },
                },
            });

            const rawCount = updated.likeIds.length;
            const safeCount = Math.max(0, rawCount);

            const isLiked = alreadyLiked ? '0' : '1';
            const correctedCount = isLiked === '1' && safeCount === 0 ? '1' : safeCount.toString();

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    like: correctedCount,
                    is_liked: isLiked,
                },
            };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }

    async reportPost(token: string, postId: string, subject: string, details: string) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            return {
                code: ResponseCode.TOKEN_INVALID,
                message: ResponseMessage[ResponseCode.TOKEN_INVALID],
            };
        }

        if (user.status === 'LOCKED') {
            return {
                code: ResponseCode.ACCOUNT_LOCKED,
                message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
            };
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return {
                code: ResponseCode.POST_NOT_FOUND,
                message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
            };
        }

        if (post.isLocked) {
            return {
                code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                message: ResponseMessage[ResponseCode.ACTION_DONE_PREVIOUSLY],
            };
        }

        try {
            const existed = await this.prisma.report.findUnique({
                where: { postId_userId: { postId, userId: user.id } },
            });
            if (existed) {
                return {
                    code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                    message: ResponseMessage[ResponseCode.ACTION_DONE_PREVIOUSLY],
                };
            }

            await this.prisma.report.create({
                data: { postId, userId: user.id, subject, details },
            });

            return { code: ResponseCode.OK, message: ResponseMessage[ResponseCode.OK] };
        } catch {
            return {
                code: ResponseCode.CAN_NOT_CONNECT,
                message: ResponseMessage[ResponseCode.CAN_NOT_CONNECT],
            };
        }
    }
}
