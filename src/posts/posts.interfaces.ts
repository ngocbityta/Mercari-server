export interface IPostQuery {
    getPost(postId: string): Promise<any>;
    getListPosts(index?: number, count?: number, lastId?: string): Promise<any>;
    checkNewItem(lastId: string): Promise<any>;
    searchPosts(query: string, index?: number, count?: number): Promise<any>;
    getSavedSearch(userId: string): any[];
}

export interface IPostCommand {
    addPost(ownerId: string, content: string, media: string[], hashtags?: string[]): Promise<any>;
    editPost(postId: string, content?: string, media?: string[], hashtags?: string[]): Promise<any>;
    deletePost(postId: string): Promise<any>;
    delSavedSearch(searchId: string): any;
}
