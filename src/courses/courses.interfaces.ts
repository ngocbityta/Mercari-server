export interface ICourseQuery {
    getListStudents(
        token: string,
        index: number,
        count: number,
        user_id?: string,
    ): Promise<any>;
    getRequestedEnrollment(
        token: string,
        index: number,
        count: number,
        user_id?: string,
    ): Promise<any>;
}
