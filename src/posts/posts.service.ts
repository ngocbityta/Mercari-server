import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Post, User } from '@prisma/client';
import { ResponseCode } from '../enums/response-code.enum';
import { IPostQuery, IPostCommand, PostResponse } from './posts.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';

import { MediaService } from './media.service';
import { EventsGateway } from '../events/events.gateway.ts';
import 'multer';

interface PostWithThumbs {
    leftVideoThumb?: string | null;
    rightVideoThumb?: string | null;
}

@Injectable()
export class PostsService implements IPostQuery, IPostCommand {
    constructor(
        private prisma: PrismaService,
        private mediaService: MediaService,
        private eventsGateway: EventsGateway,
    ) {}

    async addPost(
        token: string,
        left_video?: Express.Multer.File,
        right_video?: Express.Multer.File,
        described?: string,
        device_slave?: string,
        course_id?: string,
        exercise_id?: string,
        device_master?: string,
    ) {
        // Validate token - get user from token
        const user = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        // Check if user account is active
        if (user.status !== 'ACTIVE') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        // Both left_video and right_video are required
        if (!left_video || !right_video) {
            throw new ApiException(
                ResponseCode.MISSING_PARAMETER,
                'Both left_video and right_video are required',
            );
        }

        // Logic for Student (HV) vs Teacher (GV)
        if (user.role === 'HV') {
            // If student is posting, exercise_id and course_id are mandatory (NN: X)
            if (!exercise_id || !course_id) {
                throw new ApiException(
                    ResponseCode.MISSING_PARAMETER,
                    'exercise_id and course_id are required for students',
                );
            }

            // Check if the exercise post exists
            const exercisePost = await this.prisma.post.findUnique({
                where: { id: exercise_id },
                include: { owner: true },
            });

            if (!exercisePost) {
                throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Exercise post not found');
            }

            // Requirement states: exercise owner must be a teacher
            if (exercisePost.owner.role !== 'GV') {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Students can only submit assignments to teacher posts',
                );
            }

            // Requirement states: course_id must match teacher's ID (the owner of the exercise post)
            if (course_id !== exercisePost.ownerId) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'course_id must match the owner of the exercise post',
                );
            }
        }

        // Upload videos to media server
        let leftVideoUrl = '';
        let rightVideoUrl = '';
        let leftVideoThumbUrl = '';
        let rightVideoThumbUrl = '';

        if (left_video) {
            leftVideoUrl = await this.mediaService.uploadFile(left_video);
            try {
                leftVideoThumbUrl = await this.mediaService.generateAndUploadThumbnail(
                    left_video,
                    leftVideoUrl,
                );
            } catch (err) {
                console.error('Failed to generate thumbnail for left video:', err);
            }
        }
        if (right_video) {
            rightVideoUrl = await this.mediaService.uploadFile(right_video);
            try {
                rightVideoThumbUrl = await this.mediaService.generateAndUploadThumbnail(
                    right_video,
                    rightVideoUrl,
                );
            } catch (err) {
                console.error('Failed to generate thumbnail for right video:', err);
            }
        }

        // Create media array with video URLs
        const media: string[] = [];
        if (leftVideoUrl) {
            media.push(leftVideoUrl);
        }
        if (rightVideoUrl) {
            media.push(rightVideoUrl);
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
                deviceMaster: device_master || null,
                deviceSlave: device_slave || null,
                leftVideo: leftVideoUrl || null,
                rightVideo: rightVideoUrl || null,
                leftVideoThumb: leftVideoThumbUrl || null,
                rightVideoThumb: rightVideoThumbUrl || null,
            },
        });

        if (user.role === 'GV') {
            try {
                const enrollments = await this.prisma.enrollment.findMany({
                    where: { teacherId: user.id },
                    include: { student: { include: { pushSetting: true } } },
                });

                const notificationsToCreate: {
                    userId: string;
                    type: string;
                    objectId: string;
                    title: string;
                    avatar: string | null;
                    groupType: number;
                    isRead: boolean;
                }[] = [];

                for (const enrollment of enrollments) {
                    const student = enrollment.student;
                    let pushSetting = student.pushSetting;
                    if (!pushSetting) {
                        // Use upsert to avoid Unique constraint violation on concurrent requests
                        pushSetting = await this.prisma.pushSetting.upsert({
                            where: { userId: student.id },
                            update: {},
                            create: { userId: student.id },
                        });
                    }
                    const canSend =
                        pushSetting &&
                        pushSetting.notificationOn === 1 &&
                        pushSetting.fromFriends === 1;

                    if (canSend) {
                        const title = exercise_id
                            ? `${user.username || 'Giảng viên'} đã đăng bài tập mới`
                            : `${user.username || 'Giảng viên'} có bài đăng mới`;

                        notificationsToCreate.push({
                            userId: student.id,
                            type: 'new_post',
                            objectId: post.id,
                            title,
                            avatar: user.avatar,
                            groupType: 1,
                            isRead: false,
                        });
                    }
                }

                if (notificationsToCreate.length > 0) {
                    Promise.all(
                        notificationsToCreate.map(async (n) => {
                            try {
                                const notification = await this.prisma.notification.create({
                                    data: n,
                                });
                                this.eventsGateway.sendPushNotification(n.userId, {
                                    type: notification.type,
                                    object_id: notification.objectId,
                                    title: notification.title,
                                    notificationId: notification.id,
                                    created: notification.createdAt.toISOString(),
                                    avatar: notification.avatar,
                                    group: notification.groupType.toString(),
                                    read: '0',
                                });
                            } catch {
                                // Ignore error for individual notification
                            }
                        }),
                    ).catch(() => {});
                }
            } catch (error) {
                console.error('Lỗi khi xử lý notification cho GV', error);
            }
        }

        return {
            id: post.id,
        };
    }

    async editPost(
        token: string,
        postId: string,
        described?: string,
        video_indices?: string,
        left_video?: Express.Multer.File,
        right_video?: Express.Multer.File,
    ) {
        // 1. Validate token - get user
        const user = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        // 2. Check if user account is active
        if (user.status !== 'ACTIVE') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        // 3. Check if user is a teacher (GV)
        if (user.role !== 'GV') {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'Only teachers can edit posts');
        }

        // 4. Get the post
        const post = await this.prisma.post.findUnique({
            where: { id: postId },
        });

        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        // 5. Check if the user owns this post
        if (post.ownerId !== user.id) {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'You do not own this post');
        }

        // 6. Logic check: Chỉ được gọi nếu chưa có HV nào nộp bài
        // (A student submission is a Post with exerciseId pointing to this post)
        const submissionCount = await this.prisma.post.count({
            where: { exerciseId: postId },
        });
        if (submissionCount > 0) {
            throw new ApiException(
                ResponseCode.ACTION_DONE_PREVIOUSLY,
                'Cannot edit post as students have already submitted',
            );
        }

        // 7. Parse video_indices to determine which videos to delete
        const videosToDelete: string[] = [];

        if (video_indices) {
            const indices = video_indices.split(',').map((s) => s.trim().toLowerCase());

            for (const index of indices) {
                if (index === 'l' || index === 'left') {
                    videosToDelete.push('left');
                } else if (index === 'r' || index === 'right') {
                    videosToDelete.push('right');
                } else if (index === 'all' || index === 'lr') {
                    videosToDelete.push('left');
                    videosToDelete.push('right');
                }
            }
        }

        // 8. Validate video replacement logic (TC 6, 7, 8)
        const hasLeftVideoToDelete = videosToDelete.includes('left');
        const hasRightVideoToDelete = videosToDelete.includes('right');
        const hasLeftVideoToAdd = !!left_video;
        const hasRightVideoToAdd = !!right_video;

        // TC 6 & 7: If deleting video, must have replacement
        if (hasLeftVideoToDelete && !hasLeftVideoToAdd) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Must provide replacement video for deleted left video',
            );
        }
        if (hasRightVideoToDelete && !hasRightVideoToAdd) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Must provide replacement video for deleted right video',
            );
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

        let leftVideoThumbUrl = (post as unknown as PostWithThumbs).leftVideoThumb;
        let rightVideoThumbUrl = (post as unknown as PostWithThumbs).rightVideoThumb;

        if (hasLeftVideoToAdd) {
            const url = await this.mediaService.uploadFile(left_video);
            newMedia.push(url);
            post.leftVideo = url; // Update temp object for DB update below
            try {
                leftVideoThumbUrl = await this.mediaService.generateAndUploadThumbnail(
                    left_video,
                    url,
                );
            } catch (err) {
                console.error('Failed to generate left video thumb on edit:', err);
                leftVideoThumbUrl = null;
            }
        } else if (hasLeftVideoToDelete) {
            leftVideoThumbUrl = null;
        }

        if (hasRightVideoToAdd) {
            const url = await this.mediaService.uploadFile(right_video);
            newMedia.push(url);
            post.rightVideo = url; // Update temp object for DB update below
            try {
                rightVideoThumbUrl = await this.mediaService.generateAndUploadThumbnail(
                    right_video,
                    url,
                );
            } catch (err) {
                console.error('Failed to generate right video thumb on edit:', err);
                rightVideoThumbUrl = null;
            }
        } else if (hasRightVideoToDelete) {
            rightVideoThumbUrl = null;
        }

        // Ensure at least one video exists
        if (newMedia.length === 0 && (post.leftVideo || post.rightVideo)) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Post must have at least one video',
            );
        }

        // 10. Update the post
        const updatedPost = await this.prisma.post.update({
            where: { id: postId },
            data: {
                content: described !== undefined ? described : post.content,
                media: newMedia,
                leftVideo: hasLeftVideoToAdd
                    ? post.leftVideo
                    : hasLeftVideoToDelete
                      ? null
                      : post.leftVideo,
                rightVideo: hasRightVideoToAdd
                    ? post.rightVideo
                    : hasRightVideoToDelete
                      ? null
                      : post.rightVideo,
                leftVideoThumb: leftVideoThumbUrl,
                rightVideoThumb: rightVideoThumbUrl,
            },
        });

        return {
            id: updatedPost.id,
        };
    }

    async deletePost(postId: string) {
        await this.prisma.post.delete({
            where: { id: postId },
        });
        return { message: 'Post deleted successfully' };
    }

    async getPost(token: string, postId: string, user_id?: string) {
        // Validate token - get viewer user (requester)
        const requester = await this.prisma.user.findFirst({
            where: { token },
        });

        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        // Determine effective viewer (for impersonation)
        let viewer = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            const targetUser = await this.prisma.user.findUnique({
                where: { id: user_id },
            });
            if (!targetUser) {
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Invalid parameter value',
                );
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
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        // Check if post is locked (violation) -> Return 9992 as per Test Case 3
        if (post.isLocked) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
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
        };

        let lecturer: { id: string; name: string; avatar: string } | undefined;
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
        const responseData: PostResponse = {
            id: post.id,
            is_blocked,
        };

        if (is_blocked === '0') {
            responseData.described = post.content || '';
            responseData.created = Math.floor(post.createdAt.getTime() / 1000).toString();
            responseData.modified = Math.floor(post.updatedAt.getTime() / 1000).toString();
            responseData.like = likeCount.toString();
            responseData.comment = commentCount.toString();
            responseData.is_liked = isLiked ? '1' : '0';
            responseData.video = post.media.map((url, index) => {
                let thumbUrl = '';
                const postWithThumbs = post as unknown as PostWithThumbs;
                if (url === post.leftVideo && postWithThumbs.leftVideoThumb) {
                    thumbUrl = this.mediaService.getProxiedUrl(postWithThumbs.leftVideoThumb);
                } else if (url === post.rightVideo && postWithThumbs.rightVideoThumb) {
                    thumbUrl = this.mediaService.getProxiedUrl(postWithThumbs.rightVideoThumb);
                }
                return {
                    url: this.mediaService.getProxiedUrl(url),
                    thumb: thumbUrl || `thumbnail_${index}.jpg`,
                };
            });
            responseData.author = author;

            // "nếu author và lecturer là một thì không cần trường này"
            if (lecturer) {
                responseData.lecturer = lecturer;
                responseData.exercise_id = post.exerciseId || '';
            }

            responseData.edited_times = '0';

            if (lecturer) {
                responseData.lecturer = lecturer;
            }

            // Time series poses logic (if student viewing a teacher's post)
            if (viewer.role === 'HV' && post.owner.role === 'GV') {
                responseData.time_series_poses = [
                    {
                        frame: [
                            {
                                frame_id: '0',
                                created: Math.floor(Date.now() / 1000).toString(),
                                poses: [
                                    {
                                        pose_name: 'nose',
                                        pose_coord: {
                                            x: '0.0',
                                            y: '0.0',
                                            z: '0.0',
                                        },
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

        return responseData;
    }

    async getListPosts(
        token?: string,
        category_id?: string,
        last_id?: string,
        index?: string,
        count?: string,
        user_id?: string,
    ) {
        let requester: User | null = null;
        if (token) {
            requester = await this.prisma.user.findFirst({ where: { token } });
            if (!requester) {
                throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
            }
            if (requester.status === 'LOCKED') {
                throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
            }
        }

        const nIndex = index ? parseInt(index, 10) : 0;
        const nCount = count ? parseInt(count, 10) : 10;

        if (isNaN(nIndex) || isNaN(nCount) || nIndex < 0 || nCount <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
        }

        let viewerId: string | undefined = requester?.id;
        if (user_id && requester && requester.role === 'GV') {
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (targetUser) {
                viewerId = targetUser.id;
            }
        }

        // [REQ]: Không hiển thị bài của những người bị chặn
        let blockedIds: string[] = [];
        if (viewerId) {
            const blockedUsers = await this.prisma.block.findMany({
                where: {
                    OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
                },
            });
            blockedIds = blockedUsers.map((b) =>
                b.blockerId === viewerId ? b.blockedId : b.blockerId,
            );
        }

        const where: Prisma.PostWhereInput = {};

        if (blockedIds.length > 0) {
            where.ownerId = { notIn: blockedIds };
        }

        if (user_id) {
            if (blockedIds.includes(user_id)) {
                // If searching for a blocked user, return no data
                where.ownerId = 'non_existent_id';
            } else {
                where.ownerId = user_id;
            }
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
        let teacherIds: string[] = [];
        if (viewerId) {
            const enrollments = await this.prisma.enrollment.findMany({
                where: { studentId: viewerId },
                select: { teacherId: true },
            });
            teacherIds = enrollments.map((e) => e.teacherId);
        }

        const skipTotal = nIndex * nCount;
        const takeTotal = nCount;

        const postInclude = { owner: true, _count: { select: { comments: true } } } as const;
        type PostWithCount = Post & { owner: User; _count: { comments: number } };

        let finalPosts: PostWithCount[] = [];

        if (user_id) {
            // When filtering by a specific user, skip teacher-priority logic entirely
            finalPosts = await this.prisma.post.findMany({
                where,
                include: postInclude,
                orderBy: { createdAt: 'desc' },
                skip: skipTotal,
                take: takeTotal,
            });
        } else {
            // 1. Prepare teacher filter — no user_id constraint, safe to override ownerId
            const teacherWhere: Prisma.PostWhereInput = {
                ...where,
                ownerId: { in: teacherIds },
            };
            const totalTeacherPosts =
                teacherIds.length > 0 ? await this.prisma.post.count({ where: teacherWhere }) : 0;

            // 2. Prepare others filter
            const othersWhere: Prisma.PostWhereInput = {
                ...where,
                ownerId: { notIn: [...blockedIds, ...teacherIds] },
            };

            if (skipTotal < totalTeacherPosts) {
                // Fetch from teachers first
                const tPosts = await this.prisma.post.findMany({
                    where: teacherWhere,
                    include: postInclude,
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
                        include: postInclude,
                        orderBy: { createdAt: 'desc' },
                        skip: 0,
                        take: remaining,
                    });
                    finalPosts = [...finalPosts, ...oPosts];
                }
            } else {
                // Skip past teacher posts, fetch only from others
                const othersSkip = skipTotal - totalTeacherPosts;
                const oPosts = await this.prisma.post.findMany({
                    where: othersWhere,
                    include: postInclude,
                    orderBy: { createdAt: 'desc' },
                    skip: othersSkip,
                    take: takeTotal,
                });
                finalPosts = [...oPosts];
            }
        }

        const posts: PostWithCount[] = finalPosts;

        if (posts.length === 0 && nIndex === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        const lastIdReported = posts.length > 0 ? posts[posts.length - 1].id : last_id || '';

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

                    const isLiked = viewerId ? (post.likeIds || []).includes(viewerId) : false;

                    let isBlocked = false;
                    if (viewerId) {
                        const blockRelationship = await this.prisma.block.findFirst({
                            where: {
                                OR: [
                                    { blockerId: post.ownerId, blockedId: viewerId },
                                    { blockerId: viewerId, blockedId: post.ownerId },
                                ],
                            },
                        });
                        isBlocked = !!blockRelationship;
                    }

                    const canEdit = viewerId ? post.ownerId === viewerId && !post.isLocked : false;
                    const canComment = !post.isLocked;

                    return {
                        post_id: post.id,
                        described: content,
                        video: media.map((url, idx) => {
                            let thumbUrl = '';
                            const postWithThumbs = post as unknown as PostWithThumbs;
                            if (url === post.leftVideo && postWithThumbs.leftVideoThumb) {
                                thumbUrl = this.mediaService.getProxiedUrl(
                                    postWithThumbs.leftVideoThumb,
                                );
                            } else if (url === post.rightVideo && postWithThumbs.rightVideoThumb) {
                                thumbUrl = this.mediaService.getProxiedUrl(
                                    postWithThumbs.rightVideoThumb,
                                );
                            }
                            return {
                                url: this.mediaService.getProxiedUrl(url),
                                thumb: thumbUrl || `thumbnail_${idx}.jpg`,
                            };
                        }),
                        created: (post.createdAt.getTime() / 1000).toString(),
                        like: (post.likeIds?.length || 0).toString(),
                        comment: (post._count?.comments || 0).toString(),
                        is_liked: isLiked ? '1' : '0',
                        is_blocked: isBlocked ? '1' : '0',
                        can_comment: canComment ? '1' : '0',
                        can_edit: canEdit ? '1' : '0',
                        banned: post.owner.status === 'LOCKED' ? '1' : '0',
                        author: {
                            id: post.owner.id,
                            username: post.owner.username || '',
                            avatar: post.owner.avatar || '',
                            role: post.owner.role,
                        },
                        exercise_id: post.exerciseId || '',
                        time_series_poses: post.owner.role === 'GV' ? [] : undefined,
                    };
                }),
            )
        ).filter((post) => post !== null && (post.described !== '' || post.video.length > 0));

        if (mappedPosts.length === 0 && posts.length > 0 && nIndex === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        return {
            posts: mappedPosts,
            new_items: newItemsCount.toString(),
            last_id: lastIdReported || '',
        };
    }

    async checkNewItem(last_id?: string, _category_id?: string) {
        if (!last_id) {
            return { new_items: '0' };
        }

        const lastPost = await this.prisma.post.findUnique({
            where: { id: last_id },
        });

        if (!lastPost || !lastPost.createdAt) {
            return { new_items: '0' };
        }

        const newCount = await this.prisma.post.count({
            where: {
                createdAt: { gt: lastPost.createdAt },
            },
        });

        return { new_items: newCount.toString() };
    }

    async searchPosts(
        token?: string,
        keyword?: string,
        category_id?: string,
        duration_min?: string,
        duration_max?: string,
        user_id?: string,
        index?: string,
        count?: string,
    ) {
        if (!keyword) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid keyword');
        }

        if (!token) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        const requester = await this.prisma.user.findFirst({ where: { token } });
        if (!requester) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        // Ứng dụng phải tạo ra xâu chuẩn từ keyword
        const standardizedKeyword = keyword.trim().replace(/\s+/g, ' ').toLowerCase();

        // Save to SearchHistory (unless it's a hashtag)
        if (standardizedKeyword && !standardizedKeyword.startsWith('#')) {
            try {
                await this.prisma.searchHistory.create({
                    data: {
                        userId: requester.id,
                        keyword: standardizedKeyword,
                        durationMin: duration_min,
                        durationMax: duration_max,
                    },
                });
            } catch (err) {
                console.error('Failed to save search history:', err);
            }
        }

        const nIndex = index ? parseInt(index, 10) : 0;
        const nCount = count ? parseInt(count, 10) : 10;

        // [Test Case 13]: Kiểm tra index và count hợp lệ
        if (isNaN(nIndex) || isNaN(nCount) || nIndex < 0 || nCount <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid index or count');
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
        };

        if (blockedUserIds.length > 0) {
            where.ownerId = { notIn: blockedUserIds };
        }

        if (user_id) {
            if (blockedUserIds.includes(user_id)) {
                where.ownerId = 'non_existent_id';
            } else {
                where.ownerId = user_id;
            }
        }

        const skip = nIndex * nCount;

        const posts = await this.prisma.post.findMany({
            where,
            include: { owner: true, _count: { select: { comments: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: nCount,
        });

        // Search for users whose username contains the keyword
        const users = await this.prisma.user.findMany({
            where: {
                username: { contains: keyword, mode: 'insensitive' },
                id: { notIn: [...blockedUserIds, requester.id] },
                status: 'ACTIVE',
            },
            select: {
                id: true,
                username: true,
                avatar: true,
                role: true,
            },
            take: nCount,
        });

        if (posts.length === 0 && users.length === 0 && nIndex === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
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
                        post_id: post.id,
                        described: content,
                        video: media.map((url, idx) => {
                            let thumbUrl = '';
                            const postWithThumbs = post as unknown as PostWithThumbs;
                            if (url === post.leftVideo && postWithThumbs.leftVideoThumb) {
                                thumbUrl = this.mediaService.getProxiedUrl(
                                    postWithThumbs.leftVideoThumb,
                                );
                            } else if (url === post.rightVideo && postWithThumbs.rightVideoThumb) {
                                thumbUrl = this.mediaService.getProxiedUrl(
                                    postWithThumbs.rightVideoThumb,
                                );
                            }
                            return {
                                url: this.mediaService.getProxiedUrl(url),
                                thumb: thumbUrl || `thumbnail_${idx}.jpg`,
                            };
                        }),
                        created: post.createdAt.toISOString(),
                        like: (post.likeIds?.length || 0).toString(),
                        comment: (post._count?.comments || 0).toString(),
                        is_liked: isLiked ? '1' : '0',
                        is_blocked: isBlocked ? '1' : '0',
                        can_comment: canComment ? '1' : '0',
                        can_edit: canEdit ? '1' : '0',
                        banned: post.owner.status === 'LOCKED' ? '1' : '0',
                        author: {
                            id: post.owner.id,
                            username: post.owner.username || '',
                            avatar: post.owner.avatar || '',
                            role: post.owner.role,
                        },
                        exercise_id: post.exerciseId || '',
                        time_series_poses: post.owner.role === 'GV' ? [] : undefined,
                    };
                }),
            )
        ).filter((post) => post !== null && (post.described !== '' || post.video.length > 0));

        if (mappedPosts.length === 0 && posts.length > 0 && nIndex === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        return {
            posts: mappedPosts,
            users: users.map((u) => ({
                id: u.id,
                username: u.username || '',
                avatar: u.avatar || '',
                role: u.role,
            })),
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
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (requester.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        let viewer = requester;
        if (user_id) {
            if (requester.role !== 'GV') {
                throw new ApiException(ResponseCode.NOT_ACCESS, 'Not access');
            }
            const targetUser = await this.prisma.user.findUnique({ where: { id: user_id } });
            if (!targetUser) {
                throw new ApiException(ResponseCode.USER_NOT_VALIDATED, 'User not validated');
            }
            viewer = targetUser;
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        if (post.isLocked) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action done previously');
        }

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
        }

        const isBlocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: post.ownerId, blockedId: viewer.id },
                    { blockerId: viewer.id, blockedId: post.ownerId },
                ],
            },
        });

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
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
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
            data,
            is_blocked: isBlocked ? '1' : '0',
        };
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
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (user.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        if (post.isLocked) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action done previously');
        }

        const hasComment = comment !== undefined && comment.trim() !== '';
        const hasScore = score !== undefined && score.trim() !== '';

        if (!hasComment && !hasScore) {
            throw new ApiException(ResponseCode.MISSING_PARAMETER, 'Missing parameter');
        }

        if (hasComment && hasScore) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameter value');
        }

        const isBlocked = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: post.ownerId, blockedId: user.id },
                    { blockerId: user.id, blockedId: post.ownerId },
                ],
            },
        });

        await this.prisma.comment.create({
            data: {
                postId,
                authorId: user.id,
                ...(hasComment
                    ? { content: comment }
                    : { score, detailMistakes: detail_mistakes ?? null }),
            },
        });

        if (post.ownerId !== user.id && this.prisma.pushSetting && this.prisma.notification) {
            let ownerPushSetting = await this.prisma.pushSetting.findUnique({
                where: { userId: post.ownerId },
            });
            if (!ownerPushSetting) {
                ownerPushSetting = await this.prisma.pushSetting.create({
                    data: { userId: post.ownerId },
                });
            }

            if (
                ownerPushSetting &&
                ownerPushSetting.notificationOn === 1 &&
                ownerPushSetting.likeComment === 1
            ) {
                const notif = await this.prisma.notification.create({
                    data: {
                        userId: post.ownerId,
                        type: 'comment',
                        objectId: post.id,
                        title: `${user.username || 'Người dùng'} đã bình luận về bài viết của bạn`,
                        avatar: user.avatar || 'default_avatar.jpg',
                        groupType: 2,
                        isRead: false,
                    },
                });

                if (this.eventsGateway) {
                    this.eventsGateway.sendPushNotification(post.ownerId, {
                        type: notif.type ?? 'home',
                        objectId: notif.objectId ?? '0',
                        title: notif.title,
                        notificationId: notif.id,
                        created: notif.createdAt.toISOString(),
                        avatar: notif.avatar ?? 'app_icon',
                        group: notif.groupType === 0 ? '0' : '1',
                        read: '0',
                    });
                }
            }
        }

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
            data,
            is_blocked: isBlocked ? '1' : '0',
        };
    }

    async likePost(token: string, postId: string) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (user.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        if (post.isLocked) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action done previously');
        }

        const alreadyLiked = post.likeIds.includes(user.id);

        const updated = await this.prisma.post.update({
            where: { id: postId },
            data: {
                likeIds: alreadyLiked
                    ? { set: post.likeIds.filter((id) => id !== user.id) }
                    : { push: user.id },
            },
        });

        if (
            !alreadyLiked &&
            post.ownerId !== user.id &&
            this.prisma.pushSetting &&
            this.prisma.notification
        ) {
            let ownerPushSetting = await this.prisma.pushSetting.findUnique({
                where: { userId: post.ownerId },
            });
            if (!ownerPushSetting) {
                ownerPushSetting = await this.prisma.pushSetting.create({
                    data: { userId: post.ownerId },
                });
            }

            if (
                ownerPushSetting &&
                ownerPushSetting.notificationOn === 1 &&
                ownerPushSetting.likeComment === 1
            ) {
                const notif = await this.prisma.notification.create({
                    data: {
                        userId: post.ownerId,
                        type: 'like',
                        objectId: post.id,
                        title: `${user.username || 'Người dùng'} đã thích bài viết của bạn`,
                        avatar: user.avatar || 'default_avatar.jpg',
                        groupType: 1,
                        isRead: false,
                    },
                });

                if (this.eventsGateway) {
                    this.eventsGateway.sendPushNotification(post.ownerId, {
                        type: notif.type ?? 'home',
                        objectId: notif.objectId ?? '0',
                        title: notif.title,
                        notificationId: notif.id,
                        created: notif.createdAt.toISOString(),
                        avatar: notif.avatar ?? 'app_icon',
                        group: notif.groupType === 0 ? '0' : '1',
                        read: '0',
                    });
                }
            }
        }

        const rawCount = updated.likeIds.length;
        const safeCount = Math.max(0, rawCount);

        const isLiked = alreadyLiked ? '0' : '1';
        const correctedCount = isLiked === '1' && safeCount === 0 ? '1' : safeCount.toString();

        return {
            like: correctedCount,
            is_liked: isLiked,
        };
    }

    async reportPost(token: string, postId: string, subject: string, details: string) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        if (user.status === 'LOCKED') {
            throw new ApiException(ResponseCode.ACCOUNT_LOCKED, 'Account is locked');
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        if (post.isLocked) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action done previously');
        }

        const existed = await this.prisma.report.findUnique({
            where: { postId_userId: { postId, userId: user.id } },
        });
        if (existed) {
            throw new ApiException(ResponseCode.ACTION_DONE_PREVIOUSLY, 'Action done previously');
        }

        await this.prisma.report.create({
            data: { postId, userId: user.id, subject, details },
        });

        return {};
    }
}
