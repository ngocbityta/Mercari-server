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
    getSavedSearch(token: string, index?: string, count?: string, user_id?: string): Promise<any>;
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
    delSavedSearch(token: string, search_id?: string, all?: string): Promise<any>;
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
