import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Post, User } from '@prisma/client';
import { ResponseCode } from '../enums/response-code.enum';
import { IPostQuery, IPostCommand, PostResponse } from './posts.interfaces.ts';
import { ApiException } from '../common/exceptions/api.exception.ts';
import { ConfigService } from '@nestjs/config';

import { MediaService } from './media.service';
import { EventsGateway } from '../events/events.gateway.ts';
import { SearchService } from '../search/search.service.ts';
import 'multer';

// Fixed UUID of the system bot user seeded via migration.
// This account is the author of all auto-generated score comments.
const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000001';

interface PostWithThumbs {
    leftVideoThumb?: string | null;
    rightVideoThumb?: string | null;
}

interface PoseGradeResult {
    score: number;
    rawDistance: number;
    detailMistakes?: string;
}

@Injectable()
export class PostsService implements IPostQuery, IPostCommand {
    constructor(
        private prisma: PrismaService,
        private mediaService: MediaService,
        private eventsGateway: EventsGateway,
        private searchService: SearchService,
        @Optional() private readonly configService?: ConfigService,
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

        const extractedHashtags = described
            ? (described.match(/#[\p{L}\p{N}_]+/gu) || []).map((t: string) => t.toLowerCase())
            : [];
        const uniqueHashtags = Array.from(new Set(extractedHashtags));

        // Create the post
        const post = await this.prisma.post.create({
            data: {
                ownerId: user.id,
                content: described || '',
                media,
                hashtags: uniqueHashtags,
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

        await this.searchService.indexPost(post);

        // Trigger pose grading in background if this is a student's submission to a teacher's exercise
        if (user.role === 'HV' && post.exerciseId) {
            this.triggerPoseGrading(post.id).catch((err) => {
                console.error('[PoseGrade] Background grading initialization failed:', err);
            });
        }

        if (user.role === 'GV') {
            try {
                const enrollments = await this.prisma.enrollment.findMany({
                    where: { teacherId: user.id },
                    include: { student: { include: { pushSetting: true } } },
                });

                const notificationsToCreate: {
                    userId: string;
                    actorId: string;
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
                        pushSetting && pushSetting.notificationOn === 1 && pushSetting.video === 1;

                    if (canSend) {
                        const title = exercise_id
                            ? `${user.username || 'Giảng viên'} đã đăng bài tập mới`
                            : `${user.username || 'Giảng viên'} có bài đăng mới`;

                        notificationsToCreate.push({
                            userId: student.id,
                            actorId: user.id,
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
                } else if (index === '0' || index === '1') {
                    const idx = parseInt(index, 10);
                    if (post.media && post.media[idx]) {
                        const url = post.media[idx];
                        if (url === post.leftVideo) {
                            videosToDelete.push('left');
                        } else if (url === post.rightVideo) {
                            videosToDelete.push('right');
                        }
                    }
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
        let finalLeftVideo = post.leftVideo;
        let finalRightVideo = post.rightVideo;

        let leftVideoThumbUrl = (post as unknown as PostWithThumbs).leftVideoThumb;
        let rightVideoThumbUrl = (post as unknown as PostWithThumbs).rightVideoThumb;

        if (hasLeftVideoToAdd) {
            const url = await this.mediaService.uploadFile(left_video);
            finalLeftVideo = url;
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
            finalLeftVideo = null;
            leftVideoThumbUrl = null;
        }

        if (hasRightVideoToAdd) {
            const url = await this.mediaService.uploadFile(right_video);
            finalRightVideo = url;
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
            finalRightVideo = null;
            rightVideoThumbUrl = null;
        }

        const newMedia: string[] = [];
        if (finalLeftVideo) {
            newMedia.push(finalLeftVideo);
        }
        if (finalRightVideo) {
            newMedia.push(finalRightVideo);
        }

        // Ensure at least one video exists
        if (newMedia.length === 0 && (post.leftVideo || post.rightVideo)) {
            throw new ApiException(
                ResponseCode.INVALID_PARAMETER_VALUE,
                'Post must have at least one video',
            );
        }

        let uniqueHashtags = post.hashtags || [];
        if (described !== undefined) {
            const extractedHashtags = (described.match(/#[\p{L}\p{N}_]+/gu) || []).map(
                (t: string) => t.toLowerCase(),
            );
            uniqueHashtags = Array.from(new Set(extractedHashtags));
        }

        // 10. Update the post
        const updatedPost = await this.prisma.post.update({
            where: { id: postId },
            data: {
                content: described !== undefined ? described : post.content,
                hashtags: uniqueHashtags,
                media: newMedia,
                leftVideo: finalLeftVideo,
                rightVideo: finalRightVideo,
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
        await this.searchService.removePost(postId);
        return { message: 'Post deleted successfully' };
    }

    async getPost(token: string, postId: string, user_id?: string) {
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
            try {
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
            } catch (err) {
                if (err instanceof ApiException) {
                    throw err;
                }
                throw new ApiException(
                    ResponseCode.INVALID_PARAMETER_VALUE,
                    'Invalid parameter value',
                );
            }
        }

        let post: (Post & { owner: User }) | null = null;
        try {
            post = await this.prisma.post.findUnique({
                where: { id: postId },
                include: {
                    owner: true,
                },
            });
        } catch {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

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
            try {
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
            } catch {
                // Ignore: courseId may not be a valid UUID
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

        let where: Prisma.PostWhereInput;
        const searchTags = standardizedKeyword.split(' ').filter((w) => w !== '');
        const isHashtagSearch = searchTags.length > 0 && searchTags.every((w) => w.startsWith('#'));

        let esPostIds: string[] = [];
        try {
            const esResults = await this.searchService.searchPosts(
                isHashtagSearch ? '' : keyword,
                isHashtagSearch ? searchTags : [],
            );
            esPostIds = esResults.map((res: any) => String(res.id));
        } catch (e) {
            console.error('ES search failed, fallback to DB', e);
        }

        if (esPostIds.length > 0) {
            where = { id: { in: esPostIds } };
        } else {
            if (isHashtagSearch) {
                where = {
                    hashtags: { hasEvery: searchTags },
                };
            } else {
                where = {
                    content: { contains: keyword, mode: 'insensitive' },
                };
            }
        }

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
            score: c.score,
            detail_mistakes: c.detailMistakes,
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

        // Score comments are attributed to the system bot, not the requester,
        // so they appear as posted by "Hệ thống" instead of the post author.
        const commentAuthorId = hasScore ? SYSTEM_BOT_USER_ID : user.id;

        await this.prisma.comment.create({
            data: {
                postId,
                authorId: commentAuthorId,
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
                        actorId: user.id,
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
                        object_id: notif.objectId ?? '0',
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
                        actorId: user.id,
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
                        object_id: notif.objectId ?? '0',
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

        // Send notification to post owner about the report
        if (post.ownerId !== user.id) {
            try {
                let ownerPushSetting = await this.prisma.pushSetting.findUnique({
                    where: { userId: post.ownerId },
                });
                if (!ownerPushSetting) {
                    ownerPushSetting = await this.prisma.pushSetting.upsert({
                        where: { userId: post.ownerId },
                        update: {},
                        create: { userId: post.ownerId },
                    });
                }

                if (
                    ownerPushSetting &&
                    ownerPushSetting.notificationOn === 1 &&
                    ownerPushSetting.report === 1
                ) {
                    const notif = await this.prisma.notification.create({
                        data: {
                            userId: post.ownerId,
                            actorId: user.id,
                            type: 'report',
                            objectId: post.id,
                            title: `Bài viết của bạn đã bị báo cáo vi phạm`,
                            avatar: user.avatar || 'default_avatar.jpg',
                            groupType: 1,
                            isRead: false,
                        },
                    });

                    if (this.eventsGateway) {
                        this.eventsGateway.sendPushNotification(post.ownerId, {
                            type: notif.type ?? 'home',
                            object_id: notif.objectId ?? '0',
                            title: notif.title,
                            notificationId: notif.id,
                            created: notif.createdAt.toISOString(),
                            avatar: notif.avatar ?? 'app_icon',
                            group: notif.groupType === 0 ? '0' : '1',
                            read: '0',
                        });
                    }
                }
            } catch (error) {
                console.error('Lỗi khi gửi thông báo report bài viết', error);
            }
        }

        return {};
    }

    private extractVideoId(url: string | null | undefined): string | null {
        if (!url) {
            return null;
        }
        const match = url.match(/\/videos\/([^/]+)/);
        return match ? match[1] : null;
    }

    private formatNumber(value: number, digits = 2): string {
        if (!Number.isFinite(value)) {
            return '0';
        }

        return Number(value.toFixed(digits)).toString();
    }

    private normalizeScoreToTen(score: number): number {
        if (!Number.isFinite(score)) {
            return 0;
        }

        // Some grading servers return 0-10, others return 0-100.
        // Keep the stored score unchanged, but normalize only for feedback wording.
        if (score > 10) {
            return Math.max(0, Math.min(score / 10, 10));
        }

        return Math.max(0, Math.min(score, 10));
    }

    private readNumber(value: unknown, fallback = 0): number {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return fallback;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private stringifyFeedbackValue(value: unknown): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (Array.isArray(value)) {
            const parts = value
                .map((item) => this.stringifyFeedbackValue(item))
                .filter((item): item is string => Boolean(item));
            return parts.length > 0 ? parts.join('; ') : null;
        }

        if (typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const directMessage =
                this.stringifyFeedbackValue(record.message) ||
                this.stringifyFeedbackValue(record.feedback) ||
                this.stringifyFeedbackValue(record.comment) ||
                this.stringifyFeedbackValue(record.description) ||
                this.stringifyFeedbackValue(record.error);

            const side = this.stringifyFeedbackValue(record.side || record.video || record.part);
            const bodyPart = this.stringifyFeedbackValue(
                record.body_part || record.bodyPart || record.joint || record.keypoint,
            );
            const severity = this.stringifyFeedbackValue(record.severity || record.level);

            if (directMessage) {
                const prefix = [side, bodyPart, severity]
                    .filter((item): item is string => Boolean(item))
                    .join(' - ');
                return prefix ? `${prefix}: ${directMessage}` : directMessage;
            }

            const compactFields = Object.entries(record)
                .map(([key, fieldValue]) => {
                    const text = this.stringifyFeedbackValue(fieldValue);
                    return text ? `${key}: ${text}` : null;
                })
                .filter((item): item is string => Boolean(item));

            return compactFields.length > 0 ? compactFields.join(', ') : null;
        }

        return null;
    }

    private extractDetailMistakesFromJobOutput(
        jobOutput: Record<string, unknown>,
    ): string | undefined {
        const detailKeys = [
            'detail_mistakes',
            'detailMistakes',
            'detailed_mistakes',
            'detailedMistakes',
            'mistakes',
            'errors',
            'feedback',
            'comments',
            'comment',
            'analysis',
            'error_details',
            'errorDetails',
        ];

        for (const key of detailKeys) {
            const value = jobOutput[key];
            const detail = this.stringifyFeedbackValue(value);
            if (detail) {
                return detail;
            }
        }

        return undefined;
    }

    private splitFeedbackIntoItems(feedback?: string): string[] {
        if (!feedback) {
            return [];
        }

        return feedback
            .split(/(?:\r?\n|;|\.\s+)/)
            .map((item) => item.replace(/^[-•\s]+/, '').trim())
            .filter((item) => item.length > 0)
            .slice(0, 6);
    }

    private buildSideFeedbackItems(sideLabel: string, result: PoseGradeResult): string[] {
        const serverItems = this.splitFeedbackIntoItems(result.detailMistakes);
        if (serverItems.length > 0) {
            return serverItems.map((item) => `Video bên ${sideLabel}: ${item}`);
        }

        const score10 = this.normalizeScoreToTen(result.score);
        const items: string[] = [];

        if (score10 >= 9) {
            items.push(
                `Video bên ${sideLabel}: động tác gần giống video mẫu, chưa phát hiện lỗi lớn.`,
            );
        } else if (score10 >= 8) {
            items.push(
                `Video bên ${sideLabel}: có sai lệch nhỏ so với video mẫu; cần giữ ổn định nhịp và biên độ động tác.`,
            );
        } else if (score10 >= 6.5) {
            items.push(
                `Video bên ${sideLabel}: sai lệch mức trung bình; cần kiểm tra lại độ cao tay/chân, góc các khớp và nhịp thực hiện.`,
            );
        } else if (score10 >= 5) {
            items.push(
                `Video bên ${sideLabel}: sai lệch nhiều; cần chỉnh lại tư thế thân người, hướng chuyển động tay/chân và tốc độ thực hiện.`,
            );
        } else {
            items.push(
                `Video bên ${sideLabel}: sai lệch rất lớn; nên xem lại toàn bộ động tác và tập lại theo video chuẩn.`,
            );
        }

        if (result.rawDistance > 0) {
            const distanceText = this.formatNumber(result.rawDistance, 4);
            if (result.rawDistance >= 0.3) {
                items.push(
                    `Khoảng cách DTW bên ${sideLabel} là ${distanceText}, cho thấy chuỗi tư thế khác đáng kể so với video mẫu.`,
                );
            } else if (result.rawDistance >= 0.15) {
                items.push(
                    `Khoảng cách DTW bên ${sideLabel} là ${distanceText}, cho thấy còn sai lệch vừa về tư thế hoặc thời điểm thực hiện.`,
                );
            } else {
                items.push(
                    `Khoảng cách DTW bên ${sideLabel} là ${distanceText}, sai lệch tổng thể không lớn.`,
                );
            }
        }

        return items;
    }

    private buildFeedbackListHtml(items: string[]): string {
        const listItems = items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('');
        return `<ul>${listItems}</ul>`;
    }

    private buildGradingDetailMistakes(
        leftResult: PoseGradeResult,
        rightResult: PoseGradeResult,
        averageScore: number,
    ): string {
        const leftItems = this.buildSideFeedbackItems('trái', leftResult);
        const rightItems = this.buildSideFeedbackItems('phải', rightResult);
        const overallItems: string[] = [];

        const leftScore10 = this.normalizeScoreToTen(leftResult.score);
        const rightScore10 = this.normalizeScoreToTen(rightResult.score);
        const scoreGap = Math.abs(leftScore10 - rightScore10);

        if (scoreGap >= 1.5) {
            const weakerSide = leftScore10 < rightScore10 ? 'trái' : 'phải';
            overallItems.push(
                `Video bên ${weakerSide} có điểm thấp hơn rõ rệt, nên ưu tiên sửa bên này trước.`,
            );
        } else {
            overallItems.push(
                'Hai video có mức sai lệch tương đối gần nhau; nên luyện lại đồng đều cả hai bên.',
            );
        }

        overallItems.push(
            'Lưu ý: DTW so khớp chuỗi tư thế theo thời gian; khoảng cách DTW càng nhỏ thì động tác càng giống video mẫu.',
        );

        return [
            '<div class="pose-grading-detail">',
            '<h3>Chi tiết chấm điểm bằng DTW</h3>',
            `<p><strong>Điểm trung bình:</strong> ${this.escapeHtml(this.formatNumber(averageScore, 2))}</p>`,
            '<table border="1" cellpadding="6" cellspacing="0">',
            '<thead><tr><th>Video</th><th>Điểm</th><th>Khoảng cách DTW</th><th>Danh sách lỗi sai / nhận xét</th></tr></thead>',
            '<tbody>',
            `<tr><td>Bên trái</td><td>${this.escapeHtml(this.formatNumber(leftResult.score, 2))}</td><td>${this.escapeHtml(this.formatNumber(leftResult.rawDistance, 4))}</td><td>${this.buildFeedbackListHtml(leftItems)}</td></tr>`,
            `<tr><td>Bên phải</td><td>${this.escapeHtml(this.formatNumber(rightResult.score, 2))}</td><td>${this.escapeHtml(this.formatNumber(rightResult.rawDistance, 4))}</td><td>${this.buildFeedbackListHtml(rightItems)}</td></tr>`,
            '</tbody>',
            '</table>',
            '<h4>Tổng kết</h4>',
            this.buildFeedbackListHtml(overallItems),
            '</div>',
        ].join('');
    }

    private async runGradingJob(
        baseUrl: string,
        apiKey: string,
        subject: string,
        teacherVideoId: string,
        studentVideoId: string,
    ): Promise<PoseGradeResult> {
        const response = await fetch(`${baseUrl}/v1/pose-grade/jobs`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-WHAM-Subject': subject,
                'X-WHAM-Api-Key': apiKey,
            },
            body: JSON.stringify({
                source_video_id_a: teacherVideoId,
                source_video_id_b: studentVideoId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let parsedError = errorText;
            try {
                const parsed = JSON.parse(errorText) as unknown;
                if (parsed && typeof parsed === 'object') {
                    const parsedRecord = parsed as Record<string, unknown>;
                    parsedError =
                        (typeof parsedRecord.error === 'string' ? parsedRecord.error : null) ||
                        (typeof parsedRecord.message === 'string' ? parsedRecord.message : null) ||
                        errorText;
                }
            } catch {
                // Keep original text
            }
            throw new Error(parsedError);
        }

        const jobData = (await response.json()) as { job_id: string; status: string };
        const jobId = jobData.job_id;

        let attempts = 0;
        const maxAttempts = 3;
        let success = false;
        let score = 0;
        let rawDistance = 0;
        let detailMistakes: string | undefined;

        while (attempts < maxAttempts) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const checkResponse = await fetch(`${baseUrl}/v1/jobs/${jobId}`, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'X-WHAM-Subject': subject,
                    'X-WHAM-Api-Key': apiKey,
                },
            });

            if (!checkResponse.ok) {
                console.error(`[PoseGrade] Error checking job status: ${checkResponse.statusText}`);
                continue;
            }

            const checkData = (await checkResponse.json()) as {
                status: string;
                job_output?: Record<string, unknown>;
                error_summary?: string;
            };

            // eslint-disable-next-line no-console
            console.log(
                `[PoseGrade] Checking job ${jobId} status, attempt ${attempts}/${maxAttempts}: ${checkData.status}`,
            );

            if (checkData.status === 'success') {
                success = true;
                const jobOutput = checkData.job_output || {};
                score = this.readNumber(jobOutput.score, 0);
                rawDistance = this.readNumber(
                    jobOutput.raw_distance ?? jobOutput.rawDistance ?? jobOutput.distance,
                    0,
                );
                detailMistakes = this.extractDetailMistakesFromJobOutput(jobOutput);
                break;
            } else if (checkData.status === 'failed') {
                console.error(`[PoseGrade] Job ${jobId} failed on server.`);
                let errMsg = checkData.error_summary || 'Job failed on server';
                try {
                    const parsed = JSON.parse(errMsg) as Record<string, unknown>;
                    if (parsed && typeof parsed.error === 'string') {
                        errMsg = parsed.error;
                    }
                } catch {
                    // Keep original
                }
                throw new Error(errMsg);
            }
        }

        if (!success) {
            throw new Error(`Job ${jobId} did not complete successfully.`);
        }

        return { score, rawDistance, detailMistakes };
    }

    async triggerPoseGrading(studentPostId: string): Promise<void> {
        const studentPost = await this.prisma.post.findUnique({
            where: { id: studentPostId },
        });

        if (!studentPost || !studentPost.exerciseId) {
            // eslint-disable-next-line no-console
            console.log(
                `[PoseGrade] Post ${studentPostId} is not a student submission or not found.`,
            );
            return;
        }

        const exercisePost = await this.prisma.post.findUnique({
            where: { id: studentPost.exerciseId },
        });

        if (!exercisePost) {
            // eslint-disable-next-line no-console
            console.log(`[PoseGrade] Exercise post ${studentPost.exerciseId} not found.`);
            return;
        }

        const studentLeftVideoId = this.extractVideoId(studentPost.leftVideo);
        const studentRightVideoId = this.extractVideoId(studentPost.rightVideo);
        const teacherLeftVideoId = this.extractVideoId(exercisePost.leftVideo);
        const teacherRightVideoId = this.extractVideoId(exercisePost.rightVideo);

        if (
            !studentLeftVideoId ||
            !studentRightVideoId ||
            !teacherLeftVideoId ||
            !teacherRightVideoId
        ) {
            // eslint-disable-next-line no-console
            console.log(
                `[PoseGrade] Could not extract all required video IDs for student post ${studentPostId}`,
            );
            return;
        }

        const baseUrl =
            this.configService?.get<string>('MEDIA_BASE_URL') ||
            process.env.MEDIA_BASE_URL ||
            'http://localhost:8000';
        const apiKey =
            this.configService?.get<string>('MEDIA_API_KEY') ||
            process.env.MEDIA_API_KEY ||
            'default_key';
        const subject =
            this.configService?.get<string>('MEDIA_API_SUBJECT') ||
            process.env.MEDIA_API_SUBJECT ||
            'default_subject';

        try {
            // eslint-disable-next-line no-console
            console.log(`[PoseGrade] Submitting sequential jobs for student post ${studentPostId}`);

            // Run grading jobs sequentially to prevent server / GPU overload
            const leftResult = await this.runGradingJob(
                baseUrl,
                apiKey,
                subject,
                teacherLeftVideoId,
                studentLeftVideoId,
            );
            const rightResult = await this.runGradingJob(
                baseUrl,
                apiKey,
                subject,
                teacherRightVideoId,
                studentRightVideoId,
            );

            const averageScore = (leftResult.score + rightResult.score) / 2;
            // eslint-disable-next-line no-console
            console.log(
                `[PoseGrade] Both jobs successful! Left Score: ${leftResult.score}, Right Score: ${rightResult.score}, Avg: ${averageScore}`,
            );

            // Create the comment on the student's post authored by the system bot user
            const detailMistakes = this.buildGradingDetailMistakes(
                leftResult,
                rightResult,
                averageScore,
            );

            await this.prisma.comment.create({
                data: {
                    postId: studentPostId,
                    authorId: SYSTEM_BOT_USER_ID,
                    score: averageScore.toString(),
                    detailMistakes,
                },
            });

            // eslint-disable-next-line no-console
            console.log(
                `[PoseGrade] Successfully saved AI grading comment for post ${studentPostId}`,
            );
        } catch (error) {
            console.error('[PoseGrade] Failed to complete pose grading:', error);

            const commentContent =
                'There are no longer any instances available with the requested specifications. Please refresh and try again.';

            try {
                await this.prisma.comment.create({
                    data: {
                        postId: studentPostId,
                        authorId: SYSTEM_BOT_USER_ID,
                        content: commentContent,
                    },
                });
                // eslint-disable-next-line no-console
                console.log(`[PoseGrade] Saved error comment for post ${studentPostId}`);
            } catch (commentError) {
                console.error('[PoseGrade] Failed to save error comment:', commentError);
            }
        }
    }

    async regradePost(token: string, postId: string) {
        const user = await this.prisma.user.findFirst({ where: { token } });
        if (!user) {
            throw new ApiException(ResponseCode.TOKEN_INVALID, 'Token is invalid');
        }

        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new ApiException(ResponseCode.POST_NOT_FOUND, 'Post not found');
        }

        // Delete all existing system bot comments on this post
        await this.prisma.comment.deleteMany({
            where: {
                postId,
                authorId: SYSTEM_BOT_USER_ID,
            },
        });

        // Re-trigger grading in background
        this.triggerPoseGrading(postId).catch((err) => {
            console.error('[PoseGrade] Background regrade failed:', err);
        });

        return {};
    }

    async getListReports(token: string, indexStr: string, countStr: string) {
        const adminUser = await this.prisma.user.findFirst({ where: { token } });
        if (!adminUser || adminUser.role !== 'GV') {
            throw new ApiException(ResponseCode.NOT_ACCESS, 'Permission denied');
        }

        const index = parseInt(indexStr, 10);
        const count = parseInt(countStr, 10);

        if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
            throw new ApiException(ResponseCode.INVALID_PARAMETER_VALUE, 'Invalid parameters');
        }

        const reports = await this.prisma.report.findMany({
            skip: index,
            take: count,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, username: true, avatar: true } },
                post: { select: { id: true, content: true, media: true } },
            },
        });

        if (reports.length === 0) {
            throw new ApiException(ResponseCode.NO_DATA, 'No data');
        }

        return reports.map((r) => ({
            id: r.id,
            subject: r.subject,
            details: r.details,
            created: r.createdAt.toISOString(),
            reporter: {
                id: r.user.id,
                username: r.user.username,
                avatar: r.user.avatar,
            },
            post: {
                id: r.post.id,
                content: r.post.content,
                media: r.post.media.map((url) => this.mediaService.getProxiedUrl(url)),
            },
        }));
    }
}
