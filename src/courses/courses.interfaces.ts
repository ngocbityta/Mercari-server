export interface ICourseQuery {
    setApproveEnrollment(token: string, user_id: string, is_accept: string): Promise<any>;
    getListCoursesOfStudent(
        token: string,
        index: number,
        count: number,
        user_id: string,
    ): Promise<any>;
    getListStudents(token: string, index: number, count: number, user_id?: string): Promise<any>;
    getRequestedEnrollment(
        token: string,
        index: number,
        count: number,
        user_id?: string,
    ): Promise<any>;
    setRequestCourse(token: string, course_id: string, user_id: string): Promise<any>;
}
