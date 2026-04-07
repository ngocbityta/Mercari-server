export interface IPostQuery {
    getPost(token: string, postId: string, user_id?: string): Promise<any>;
    getListPosts(index?: number, count?: number, lastId?: string): Promise<any>;
    checkNewItem(lastId: string): Promise<any>;
    searchPosts(query: string, index?: number, count?: number): Promise<any>;
    getSavedSearch(userId: string): any[];
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
    delSavedSearch(searchId: string): any;
}
