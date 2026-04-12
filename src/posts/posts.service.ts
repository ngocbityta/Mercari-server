import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Post, User } from '@prisma/client';
import { ResponseCode, ResponseMessage } from '../enums/response-code.enum';
import { IPostQuery, IPostCommand } from './posts.interfaces.ts';

@Injectable()
export class PostsService implements IPostQuery, IPostCommand {
    constructor(private prisma: PrismaService) {}

    async addPost(
        token: string,
        left_video: string,
        right_video: string,
        described: string,
        device_slave: string,
        course_id?: string,
        exercise_id?: string,
        device_master?: string,
    ) {
        try {
            // Validate token - get user from token
            const user = await this.prisma.user.findFirst({
                where: { token },
            });

            if (!user) {
                return {
                    code: ResponseCode.TOKEN_INVALID,
                    message: ResponseMessage[ResponseCode.TOKEN_INVALID],
                };
            }

            // Check if user account is active
            if (user.status !== 'ACTIVE') {
                return {
                    code: ResponseCode.ACCOUNT_LOCKED,
                    message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
                };
            }

            // Logic for Student (HV) vs Teacher (GV)
            if (user.role === 'HV') {
                // If student is posting, exercise_id and course_id are mandatory (NN: X)
                if (!exercise_id || !course_id) {
                    return {
                        code: ResponseCode.MISSING_PARAMETER,
                        message: 'exercise_id and course_id are required for students',
                    };
                }

                // Check if the exercise post exists
                const exercisePost = await this.prisma.post.findUnique({
                    where: { id: exercise_id },
                    include: { owner: true },
                });

                if (!exercisePost) {
                    return {
                        code: ResponseCode.POST_NOT_FOUND,
                        message: 'Exercise post not found',
                    };
                }

                // Requirement states: exercise owner must be a teacher
                if (exercisePost.owner.role !== 'GV') {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: 'Students can only submit assignments to teacher posts',
                    };
                }

                // Requirement states: course_id must match teacher's ID (the owner of the exercise post)
                if (course_id !== exercisePost.ownerId) {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: 'course_id must match the owner of the exercise post',
                    };
                }
            }

            // Create media array with video files
            const media: string[] = [left_video, right_video];

            // Create the post
            const post = await this.prisma.post.create({
                data: {
                    ownerId: user.id,
                    content: described || '',
                    media,
                    hashtags: [],
                    courseId: course_id || null,
                    exerciseId: exercise_id || null,
                    deviceMaster: device_master || null,
                    deviceSlave: device_slave || null,
                    leftVideo: left_video,
                    rightVideo: right_video,
                },
            });

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    id: post.id,
                },
            };
        } catch (error) {
            console.error('Error in addPost:', error);
            return {
                code: ResponseCode.EXCEPTION_ERROR,
                message: ResponseMessage[ResponseCode.EXCEPTION_ERROR],
            };
        }
    }

    async editPost(
        token: string,
        postId: string,
        described?: string,
        video_indices?: string,
        left_video?: string,
        right_video?: string,
    ) {
        try {
            // 1. Validate token - get user
            const user = await this.prisma.user.findFirst({
                where: { token },
            });

            if (!user) {
                return {
                    code: ResponseCode.TOKEN_INVALID,
                    message: ResponseMessage[ResponseCode.TOKEN_INVALID],
                };
            }

            // 2. Check if user account is active
            if (user.status !== 'ACTIVE') {
                return {
                    code: ResponseCode.ACCOUNT_LOCKED,
                    message: ResponseMessage[ResponseCode.ACCOUNT_LOCKED],
                };
            }

            // 3. Check if user is a teacher (GV)
            if (user.role !== 'GV') {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: 'Only teachers can edit posts',
                };
            }

            // 4. Get the post
            const post = await this.prisma.post.findUnique({
                where: { id: postId },
            });

            if (!post) {
                return {
                    code: ResponseCode.POST_NOT_FOUND,
                    message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
                };
            }

            // 5. Check if the user owns this post
            if (post.ownerId !== user.id) {
                return {
                    code: ResponseCode.NOT_ACCESS,
                    message: 'You do not own this post',
                };
            }

            // 6. Logic check: Chỉ được gọi nếu chưa có HV nào nộp bài
            // (A student submission is a Post with exerciseId pointing to this post)
            const submissionCount = await this.prisma.post.count({
                where: { exerciseId: postId },
            });
            if (submissionCount > 0) {
                return {
                    code: ResponseCode.ACTION_DONE_PREVIOUSLY,
                    message: 'Cannot edit post as students have already submitted',
                };
            }

            // 7. Parse video_indices to determine which videos to delete
            const videosToDelete: string[] = [];

            if (video_indices) {
                const indices = video_indices.split(',').map((s) => s.trim().toLowerCase());

                for (const index of indices) {
                    if (index === 'l' || index === 'left' || index === 'all' || index === 'lr') {
                        videosToDelete.push('left');
                    } else if (index === 'r' || index === 'right') {
                        videosToDelete.push('right');
                    }
                }
            }

            // 8. Validate video replacement logic (TC 6, 7, 8)
            const hasLeftVideoToDelete = videosToDelete.includes('left');
            const hasRightVideoToDelete = videosToDelete.includes('right');
            const hasLeftVideoToAdd = left_video !== undefined && left_video !== '';
            const hasRightVideoToAdd = right_video !== undefined && right_video !== '';

            // TC 6 & 7: If deleting video, must have replacement
            if (hasLeftVideoToDelete && !hasLeftVideoToAdd) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: 'Must provide replacement video for deleted left video',
                };
            }
            if (hasRightVideoToDelete && !hasRightVideoToAdd) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: 'Must provide replacement video for deleted right video',
                };
            }

            // 9. Build the updated media array
            const currentMedia = post.media || [];
            const newMedia: string[] = [];

            if (currentMedia.length > 0) {
                for (let i = 0; i < currentMedia.length; i++) {
                    const mediaItem = currentMedia[i];
                    const isLeftVideo = mediaItem === post.leftVideo;
                    const isRightVideo = mediaItem === post.rightVideo;

                    if (isLeftVideo && hasLeftVideoToDelete) {
                        continue;
                    }
                    if (isRightVideo && hasRightVideoToDelete) {
                        continue;
                    }

                    newMedia.push(mediaItem);
                }
            }

            if (hasLeftVideoToAdd) {
                newMedia.push(left_video);
            }
            if (hasRightVideoToAdd) {
                newMedia.push(right_video);
            }

            // Ensure at least one video exists
            if (newMedia.length === 0 && (post.leftVideo || post.rightVideo)) {
                return {
                    code: ResponseCode.INVALID_PARAMETER_VALUE,
                    message: 'Post must have at least one video',
                };
            }

            // 10. Update the post
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
            });

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: {
                    id: updatedPost.id,
                },
            };
        } catch (error) {
            console.error('Error in editPost:', error);
            return {
                code: ResponseCode.EXCEPTION_ERROR,
                message: ResponseMessage[ResponseCode.EXCEPTION_ERROR],
            };
        }
    }

    async deletePost(postId: string) {
        await this.prisma.post.delete({
            where: { id: postId },
        });
        return { message: 'Post deleted successfully' };
    }

    async getPost(token: string, postId: string, user_id?: string) {
        try {
            // Validate token - get viewer user (requester)
            const requester = await this.prisma.user.findFirst({
                where: { token },
            });

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

            // Determine effective viewer (for impersonation)
            let viewer = requester;
            if (user_id) {
                if (requester.role !== 'GV') {
                    return {
                        code: ResponseCode.NOT_ACCESS,
                        message: ResponseMessage[ResponseCode.NOT_ACCESS],
                    };
                }
                const targetUser = await this.prisma.user.findUnique({
                    where: { id: user_id },
                });
                if (!targetUser) {
                    return {
                        code: ResponseCode.INVALID_PARAMETER_VALUE,
                        message: ResponseMessage[ResponseCode.INVALID_PARAMETER_VALUE],
                    };
                }
                viewer = targetUser;
            }

            // Get the post
            const post = await this.prisma.post.findUnique({
                where: { id: postId },
                include: {
                    owner: true,
                },
            });

            if (!post) {
                return {
                    code: ResponseCode.POST_NOT_FOUND,
                    message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
                };
            }

            // Check if post is locked (violation) -> Return 9992 as per Test Case 3
            if (post.isLocked) {
                return {
                    code: ResponseCode.POST_NOT_FOUND,
                    message: ResponseMessage[ResponseCode.POST_NOT_FOUND],
                };
            }

            // Check if the post owner has blocked the viewer
            const isBlockedRelation = await this.prisma.block.findFirst({
                where: {
                    blockerId: post.ownerId,
                    blockedId: viewer.id,
                },
            });

            const is_blocked = isBlockedRelation ? '1' : '0';

            // Calculate counts
            const commentCount = await this.prisma.comment.count({ where: { postId: post.id } });
            const likeCount = post.likeIds?.length || 0;
            const isLiked = (post.likeIds || []).includes(viewer.id);

            // Lecturer and Author
            const author = {
                id: post.owner.id,
                name: post.owner.username || 'Người dùng',
                avatar: post.owner.avatar || 'default_avatar.jpg',
                online: post.owner.online ? '1' : '0',
            };

            let lecturer;
            // Add lecturer info if exercise_id exists and author != lecturer
            if (post.exerciseId && post.ownerId !== post.courseId && post.courseId) {
                const lecturerUser = await this.prisma.user.findFirst({
                    where: { id: post.courseId },
                });
                if (lecturerUser) {
                    lecturer = {
                        id: lecturerUser.id,
                        name: lecturerUser.username || 'Giảng viên',
                        avatar: lecturerUser.avatar || 'default_lecturer_avatar.jpg',
                    };
                }
            }

            // [Test Case 4]: If blocked, return empty fields except id and is_blocked
            const responseData: any = {
                id: post.id,
                is_blocked,
            };

            if (is_blocked === '0') {
                responseData.described = post.content || '';
                responseData.created = post.createdAt.toISOString();
                responseData.modified = post.updatedAt.toISOString();
                responseData.like = likeCount.toString();
                responseData.comment = commentCount.toString();
                responseData.is_liked = isLiked ? '1' : '0';
                responseData.video = post.media.map((url, index) => ({
                    url: url,
                    thumb: `thumbnail_${index}.jpg`,
                }));
                responseData.author = author;
                responseData.exercise_id = post.exerciseId || '';
                responseData.edited_times = '0';

                if (lecturer) {
                    responseData.lecturer = lecturer;
                }

                // Time series poses logic (if student viewing a teacher's post)
                if (viewer.role === 'HV' && post.owner.role === 'GV') {
                    // Structure matches get_post(3) doc with string coordinates
                    responseData.time_series_poses = [
                        {
                            frame: [
                                {
                                    frame_id: '0',
                                    created: Date.now().toString(),
                                    poses: [
                                        {
                                            pose_name: 'nose',
                                            pose_coord: ['0.0', '0.0', '0.0'], // x, y, z as strings
                                            confident: '0.0',
                                        },
                                    ],
                                },
                            ],
                        },
                    ];
                }
            } else {
                // Blocked: return empty structures for required fields
                responseData.described = '';
                responseData.created = '';
                responseData.modified = '';
                responseData.like = '0';
                responseData.comment = '0';
                responseData.is_liked = '0';
                responseData.video = [];
                responseData.author = { id: '', name: '', avatar: '' };
                responseData.exercise_id = '';
                responseData.edited_times = '0';
            }

            return {
                code: ResponseCode.OK,
                message: ResponseMessage[ResponseCode.OK],
                data: responseData,
            };
        } catch (error) {
            console.error('Error in getPost:', error);
            return {
                code: ResponseCode.EXCEPTION_ERROR,
                message: ResponseMessage[ResponseCode.EXCEPTION_ERROR],
            };
        }
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

        // [REQ]: Không hiển thị bài của những người bị chặn
        const blockedUsers = await this.prisma.block.findMany({
            where: {
                OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }],
            },
        });
        const blockedIds = blockedUsers.map((b) =>
            b.blockerId === viewer.id ? b.blockedId : b.blockerId,
        );

        const where: Prisma.PostWhereInput = {
            ownerId: { notIn: blockedIds },
        };

        // Category filter (if implemented in schema, currently not used)
        if (category_id && category_id !== '0') {
            // where.categoryId = category_id;
        }

        let lastPost: Post | null = null;
        if (last_id) {
            lastPost = await this.prisma.post.findUnique({
                where: { id: last_id },
            });
            if (lastPost && lastPost.createdAt) {
                where.createdAt = { lt: lastPost.createdAt };
            }
        }

        // [REQ]: Ưu tiên các bài viết của khóa học đã đăng ký
        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId: viewer.id },
            select: { teacherId: true },
        });
        const teacherIds = enrollments.map((e) => e.teacherId);

        const skipTotal = (index || 0) * count;
        const takeTotal = count;

        let finalPosts: (Post & { owner: User })[] = [];

        // 1. Prepare teacher filter
        const teacherWhere: Prisma.PostWhereInput = {
            ...where,
            ownerId: { in: teacherIds },
        };
        const totalTeacherPosts = await this.prisma.post.count({ where: teacherWhere });

        // 2. Prepare others filter
        const othersWhere: Prisma.PostWhereInput = {
            ...where,
            ownerId: { notIn: [...blockedIds, ...teacherIds] },
        };

        if (skipTotal < totalTeacherPosts) {
            // Fetch from teachers first
            const tPosts = await this.prisma.post.findMany({
                where: teacherWhere,
                include: { owner: true },
                orderBy: { createdAt: 'desc' },
                skip: skipTotal,
                take: takeTotal,
            });
            finalPosts = [...tPosts];

            if (finalPosts.length < takeTotal) {
                // Need more from others to fill the page
                const remaining = takeTotal - finalPosts.length;
                const oPosts = await this.prisma.post.findMany({
                    where: othersWhere,
                    include: { owner: true },
                    orderBy: { createdAt: 'desc' },
                    skip: 0,
                    take: remaining,
                });
                finalPosts = [...finalPosts, ...oPosts];
            }
        } else {
            // Skip past teacher posts, fetch only from others
            const othersSkip = skipTotal - totalTeacherPosts;
            finalPosts = await this.prisma.post.findMany({
                where: othersWhere,
                include: { owner: true },
                orderBy: { createdAt: 'desc' },
                skip: othersSkip,
                take: takeTotal,
            });
        }

        const posts: (Post & { owner: User })[] = finalPosts;

        if (posts.length === 0 && (index || 0) === 0) {
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

        const mappedPosts = (
            await Promise.all(
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

                    const canEdit = viewer ? post.ownerId === viewer.id && !post.isLocked : false;
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
            )
        ).filter((post) => post.described !== '' || post.video.length > 0);

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
                await this.prisma.searchHistory.create({
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

        const mappedPosts = (
            await Promise.all(
                posts.map(async (post) => {
                    if (!post.owner || !post.owner.id) {
                        return null;
                    }

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
            )
        ).filter((post) => post !== null && (post.described !== '' || post.video.length > 0));

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
                },
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
