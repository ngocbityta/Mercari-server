export interface Author {
    id: string;
    name: string;
    avatar: string;
    online?: string;
    role?: string;
}

export interface PostResponse {
    id: string;
    is_blocked: string;
    described?: string;
    created?: string;
    modified?: string;
    like?: string;
    comment?: string;
    is_liked?: string;
    video?: { url: string; thumb: string }[];
    author?: Author;
    exercise_id?: string;
    edited_times?: string;
    lecturer?: { id: string; name: string; avatar: string };
    time_series_poses?: any[];
}

export interface IPostQuery {
    getPost(token: string, postId: string, user_id?: string): Promise<any>;
    getListPosts(
        token?: string,
        category_id?: string,
        last_id?: string,
        index?: number,
        count?: number,
        user_id?: string,
    ): Promise<any>;
    checkNewItem(lastId?: string, category_id?: string): Promise<any>;
    searchPosts(
        token?: string,
        keyword?: string,
        category_id?: string,
        duration_min?: string,
        duration_max?: string,
        user_id?: string,
        index?: number,
        count?: number,
    ): Promise<any>;

    getComment(
        token: string,
        postId: string,
        index: number,
        count: number,
        user_id?: string,
    ): Promise<any>;
}

export interface IPostCommand {
    addPost(
        token: string,
        left_video?: string,
        right_video?: string,
        course_id?: string,
        exercise_id?: string,
        described?: string,
        device_slave?: string,
        device_master?: string,
    ): Promise<any>;
    editPost(
        token: string,
        postId: string,
        described?: string,
        video_indices?: string,
        left_video?: string,
        right_video?: string,
    ): Promise<any>;
    deletePost(postId: string): Promise<any>;

    reportPost(token: string, postId: string, subject: string, details: string): Promise<any>;
    likePost(token: string, postId: string): Promise<any>;
    setComment(
        token: string,
        postId: string,
        index: number,
        count: number,
        comment?: string,
        score?: string,
        detail_mistakes?: string,
    ): Promise<any>;
}
