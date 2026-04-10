export interface ICourseQuery {
    getRequestedEnrollment(
        token: string,
        index: number,
        count: number,
        user_id?: string,
    ): Promise<any>;
}
