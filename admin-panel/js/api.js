// Tự động nhận diện môi trường để kết nối đúng Database
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = 'https://group1.it4788.sukkaito.id.vn/it4788';

class ApiClient {
    // Helper nội bộ xử lý fetch
    async request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        
        // Khởi tạo headers nếu chưa có
        if (!options.headers) {
            options.headers = {};
        }

        // Tự động thêm Content-Type json nếu là POST/PATCH và có body (và không phải FormData)
        if (options.body && typeof options.body === 'string') {
            options.headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            // Xử lý chung các mã lỗi
            if (data.code === '9998') {
                // Token invalid -> Logout
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_user');
                window.location.hash = '#/login';
                throw new Error('Phiên đăng nhập hết hạn');
            }

            // Treat NO_DATA as empty list
            if (data.code === '9994') {
                return [];
            }

            if (data.code !== '1000') {
                throw new Error(data.message || 'Lỗi không xác định');
            }

            return data.data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Helper tạo request có token trong body
    async authPost(endpoint, body = {}) {
        const token = localStorage.getItem('admin_token');
        if (!token) throw new Error('Không tìm thấy token');
        
        body.token = token;
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // ---------------- AUTH ----------------
    async login(phonenumber, password) {
        // Dùng device token ảo cho Admin Web
        const devtoken = 'web-admin-' + Date.now();
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ phonenumber, password, devtoken })
        });
    }

    async logout() {
        return this.authPost('/logout');
    }

    // ---------------- USERS (REST, No token) ----------------
    async getUsers() {
        return this.request('/users', { method: 'GET' });
    }

    async getUser(id) {
        return this.request(`/users/${id}`, { method: 'GET' });
    }

    async updateUser(id, updateData) {
        return this.request(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
    }

    async deleteUser(id) {
        return this.request(`/users/${id}`, { method: 'DELETE' });
    }

    // ---------------- POSTS ----------------
    async getListPosts(index = '0', count = '10', userId = null) {
        const body = { index: index.toString(), count: count.toString() };
        if (userId) body.user_id = userId;
        
        // Gọi bằng authPost để có quyền cao nhất xem bài (không bị limit)
        return this.authPost('/get_list_posts', body);
    }

    async getPost(id) {
        return this.authPost('/get_post', { id });
    }

    async deletePost(id) {
        // endpoint này hiện là DELETE /delete_post/:id không cần token trong param nhưng có thể server cần. 
        // Tuy controller định nghĩa DELETE không có body. 
        return this.request(`/delete_post/${id}`, { method: 'DELETE' });
    }

    async searchPosts(keyword, index = '0', count = '10') {
        return this.authPost('/search', { keyword, index: index.toString(), count: count.toString() });
    }

    async getListReports(index = '0', count = '20') {
        return this.authPost('/get_list_reports', { index: index.toString(), count: count.toString() });
    }

    async getComments(postId, index = '0', count = '20') {
        return this.authPost('/get_comment', { id: postId, index: index.toString(), count: count.toString() });
    }

    async setComment(postId, index = '0', count = '10', comment = '', score = '', detailMistakes = '') {
        const body = { id: postId, index: index.toString(), count: count.toString() };
        if (comment) body.comment = comment;
        if (score) body.score = score;
        if (detailMistakes) body.detail_mistakes = detailMistakes;
        return this.authPost('/set_comment', body);
    }

    // ---------------- ENROLLMENTS & COURSES ----------------
    async getListCourses(index = '0', count = '100') {
        return this.authPost('/get_list_courses', { index: index.toString(), count: count.toString() });
    }

    async setApproveEnrollment(userId, isAccept = '1') {
        return this.authPost('/set_approve_enrollment', { user_id: userId, is_accept: isAccept.toString() });
    }

    async getListStudents(teacherId, index = '0', count = '100') {
        return this.authPost('/get_list_students', { user_id: teacherId, index: index.toString(), count: count.toString() });
    }

    async getRequestedEnrollments(teacherId, index = '0', count = '100') {
        return this.authPost('/get_requested_enrollment', { user_id: teacherId, index: index.toString(), count: count.toString() });
    }

    async getListCoursesOfStudent(studentId, index = '0', count = '100') {
        return this.authPost('/get_list_courses_of_student', { user_id: studentId, index: index.toString(), count: count.toString() });
    }

    // ---------------- BLOCKS ----------------
    async getListBlocks(userId, index = '0', count = '100') {
        return this.authPost('/get_list_blocks', { user_id: userId, index: index.toString(), count: count.toString() });
    }
}

// Export singleton instance
export const api = new ApiClient();

