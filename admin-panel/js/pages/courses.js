import { api } from '../api.js';
import { toast } from '../components/toast.js';

let currentTeacherId = null;

export async function renderCourses(container) {
    document.getElementById('breadcrumb').innerHTML = '<a href="#/">Dashboard</a> <span style="margin:0 6px;color:var(--text-muted)">/</span> <span class="current">Quản lý Khóa học</span>';
    
    container.innerHTML = `
        <!-- Teacher Selection Toolbar -->
        <div class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(99, 102, 241, 0.15); display: flex; align-items: center; justify-content: center; color: var(--accent);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                </div>
                <div>
                    <h2 style="font-size: 1rem; font-weight: 600; margin-bottom: 2px;">Chọn Giảng viên để quản lý lớp</h2>
                    <p style="color: var(--text-muted); font-size: 0.75rem; margin: 0;">Xem danh sách học viên và yêu cầu duyệt của bất kỳ lớp nào</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <select id="teacher-select" class="form-control" style="min-width: 250px; font-weight: 500; cursor: pointer;">
                    <option value="">Đang tải danh sách...</option>
                </select>
                <button class="btn btn-secondary" onclick="window.location.reload()" title="Tải lại trang">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </button>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
            <!-- Requests Column -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                    <div>
                        <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem;">Học viên chờ duyệt</h2>
                        <p style="color: var(--text-muted); font-size: 0.8125rem;">Yêu cầu xin vào lớp</p>
                    </div>
                    <span id="requests-count-badge" class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning);">0</span>
                </div>
                
                <div id="requests-container" style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
                    <div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div>
                    <div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div>
                </div>
            </div>

            <!-- Enrolled Students Column -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                    <div>
                        <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem;">Học viên trong lớp</h2>
                        <p style="color: var(--text-muted); font-size: 0.8125rem;">Đã được phê duyệt</p>
                    </div>
                    <span id="students-count-badge" class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success);">0</span>
                </div>
                
                <div id="students-container" style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
                    <div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div>
                </div>
            </div>
        </div>
    `;

    // Load teachers
    await loadTeachers();

    const selectEl = document.getElementById('teacher-select');
    selectEl.addEventListener('change', (e) => {
        currentTeacherId = e.target.value;
        if (currentTeacherId) {
            refreshData();
        }
    });
}

async function loadTeachers() {
    const selectEl = document.getElementById('teacher-select');
    try {
        const res = await api.getUsers('0', '1000');
        const users = Array.isArray(res) ? res : (res?.data || []);
        
        // Filter only GV (Giảng viên)
        const teachers = users.filter(u => u.role === 'GV');
        
        if (teachers.length === 0) {
            selectEl.innerHTML = '<option value="">Không tìm thấy giảng viên nào</option>';
            return;
        }

        // Get current admin user
        const userJson = localStorage.getItem('admin_user');
        const adminUser = userJson ? JSON.parse(userJson) : null;
        
        selectEl.innerHTML = teachers.map(t => {
            const isMe = adminUser && adminUser.id === t.id;
            return `<option value="${t.id}">${t.username || 'Không tên'} ${isMe ? '(Tôi)' : ''}</option>`;
        }).join('');

        // Set default selection to current admin if they are a teacher, otherwise first teacher
        if (adminUser && teachers.find(t => t.id === adminUser.id)) {
            currentTeacherId = adminUser.id;
            selectEl.value = currentTeacherId;
        } else {
            currentTeacherId = teachers[0].id;
            selectEl.value = currentTeacherId;
        }

        // Load data for selected teacher
        refreshData();

    } catch (error) {
        toast.error('Lỗi tải giảng viên', error.message);
        selectEl.innerHTML = '<option value="">Lỗi tải dữ liệu</option>';
    }
}

function refreshData() {
    if (!currentTeacherId) return;
    
    // Show loading state
    document.getElementById('requests-container').innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div>';
    document.getElementById('students-container').innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 1rem;"></div>';
    
    loadRequests(currentTeacherId);
    loadStudents(currentTeacherId);
}

async function loadRequests(teacherId) {
    const container = document.getElementById('requests-container');
    const badge = document.getElementById('requests-count-badge');
    try {
        const res = await api.getRequestedEnrollments(teacherId);
        const requests = Array.isArray(res) ? res : (res?.data || []);

        badge.textContent = requests.length;

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2.5rem 1rem;">
                    <div class="empty-state-text">Chưa có yêu cầu xin vào lớp nào</div>
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(item => {
            const req = item.request || item;
            const avatarSrc = req.avatar ? (req.avatar.startsWith('http') ? req.avatar : `http://localhost:3000${req.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user_name || 'U')}&background=6366F1&color=fff`;
            
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-bottom: 0.75rem; background: rgba(0,0,0,0.15);">
                    <div style="display: flex; align-items: center; gap: 0.875rem;">
                        <img src="${avatarSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(99,102,241,0.2);">
                        <div>
                            <div style="font-weight: 600; font-size: 0.9375rem;">${req.user_name || 'Học viên'}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${new Date(req.created).toLocaleString('vi-VN')}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                        <button class="btn btn-primary btn-approve" data-id="${req.id}" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">Phê duyệt</button>
                        <button class="btn btn-secondary btn-reject" data-id="${req.id}" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">Từ chối</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-id');
                await handleApproval(studentId, '1', teacherId);
            });
        });
        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-id');
                await handleApproval(studentId, '0', teacherId);
            });
        });

    } catch (error) {
        badge.textContent = '0';
        container.innerHTML = `<div class="empty-state" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">Lỗi tải yêu cầu: ${error.message}</div>`;
    }
}

async function handleApproval(studentId, isAccept, teacherId) {
    try {
        await api.setApproveEnrollment(studentId, isAccept);
        toast.success('Thành công', isAccept === '1' ? 'Đã phê duyệt học viên vào lớp' : 'Đã từ chối yêu cầu');
        refreshData();
    } catch (error) {
        toast.error('Lỗi', error.message);
    }
}

async function loadStudents(teacherId) {
    const container = document.getElementById('students-container');
    const badge = document.getElementById('students-count-badge');
    try {
        const res = await api.getListStudents(teacherId);
        const students = Array.isArray(res) ? res : (res?.data || res?.students || []);

        badge.textContent = students.length;

        if (students.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2.5rem 1rem;">
                    <div class="empty-state-text">Lớp học này chưa có học viên nào</div>
                </div>
            `;
            return;
        }

        container.innerHTML = students.map(s => {
            const avatarSrc = s.avatar ? (s.avatar.startsWith('http') ? s.avatar : `http://localhost:3000${s.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || 'U')}&background=10B981&color=fff`;
            return `
                <div class="glass-panel" style="padding: 0.875rem 1rem; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-color); margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.875rem;">
                        <img src="${avatarSrc}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: 600; font-size: 0.9375rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${s.name || 'Không có tên'}</div>
                            <span class="badge badge-hv" style="font-size: 0.625rem; margin-top: 2px;">Học viên</span>
                        </div>
                    </div>
                    <a href="#/users/${s.id}" class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">Hồ sơ</a>
                </div>
            `;
        }).join('');
    } catch (error) {
        badge.textContent = '0';
        container.innerHTML = `<div class="empty-state" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">Lỗi tải danh sách: ${error.message}</div>`;
    }
}
