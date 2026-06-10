import { api } from '../api.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { Table } from '../components/table.js';

export async function renderUserDetail(container, userId) {
    document.getElementById('breadcrumb').innerHTML = '<a href="#/">Dashboard</a> <span style="margin:0 8px">/</span> <a href="#/users">Thành viên</a> <span style="margin:0 8px">/</span> <span class="current">Chi tiết</span>';
    
    // Skeleton load
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
            <!-- Cột trái: Profile Skeleton -->
            <div class="glass-panel" style="overflow: hidden;">
                <div class="skeleton" style="height: 120px; width: 100%;"></div>
                <div style="padding: 0 1.5rem 1.5rem; text-align: center; margin-top: -50px;">
                    <div class="skeleton" style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 1rem; border: 4px solid var(--bg-secondary);"></div>
                    <div class="skeleton skeleton-text" style="width: 60%; margin: 0 auto 0.5rem;"></div>
                    <div class="skeleton skeleton-text short" style="margin: 0 auto 1.5rem;"></div>
                </div>
            </div>
            <!-- Cột phải: Tabs Skeleton -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 2rem;"></div>
                <div class="skeleton skeleton-text" style="height: 200px;"></div>
            </div>
        </div>
    `;

    let user = null;

    try {
        user = await api.getUser(userId);
    } catch (err) {
        container.innerHTML = `<div class="glass-panel" style="padding: 3rem; text-align: center; color: var(--danger)">Lỗi: Không tìm thấy người dùng. ${err.message}</div>`;
        return;
    }

    const avatarSrc = user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:3000${user.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'U')}&background=random&size=200`;
    const coverSrc = user.cover_image ? (user.cover_image.startsWith('http') ? user.cover_image : `http://localhost:3000${user.cover_image}`) : 'https://via.placeholder.com/600x200/1E293B/334155?text=No+Cover';
    
    const isLocked = user.status === 'LOCKED';

    // Render Actual Content
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; align-items: start;">
            
            <!-- Trái: Profile Card -->
            <div class="glass-panel" style="overflow: hidden; position: sticky; top: 90px;">
                <div style="height: 120px; background: url('${coverSrc}') center/cover; position: relative;">
                    <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, rgba(15,23,42,0.8));"></div>
                </div>
                
                <div style="padding: 0 1.5rem 1.5rem; text-align: center; margin-top: -50px; position: relative; z-index: 10;">
                    <div style="position: relative; display: inline-block;">
                        <img src="${avatarSrc}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid var(--bg-secondary); object-fit: cover; background: #fff;" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                        <div class="${user.online ? 'online-dot animate' : 'offline-dot'}" style="position: absolute; bottom: 8px; right: 8px; width: 16px; height: 16px; border: 3px solid var(--bg-secondary);"></div>
                    </div>
                    
                    <h2 style="margin-top: 0.5rem;">${user.username || 'Không có tên'}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">${user.phonenumber}</div>
                    
                    <div style="display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1.5rem;">
                        <span class="badge ${user.role === 'HV' ? 'badge-hv' : 'badge-gv'}">${user.role === 'HV' ? 'Học Viên' : 'Giảng Viên'}</span>
                        <span id="profile-status-badge" class="badge ${isLocked ? 'badge-danger' : 'badge-success'}">${user.status}</span>
                    </div>

                    ${user.description ? `<p style="font-style: italic; color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">"${user.description}"</p>` : ''}
                    
                    <div style="text-align: left; font-size: 0.875rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted)">Ngày tạo:</span>
                            <span>${new Date(user.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted)">Cập nhật:</span>
                            <span>${new Date(user.updatedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button id="btn-toggle-lock" class="btn ${isLocked ? 'btn-primary' : 'btn-ghost'}" style="width: 100%; border-color: ${isLocked ? '' : 'var(--warning)'}; color: ${isLocked ? '' : 'var(--warning)'}">
                            ${isLocked ? '🔓 Mở khóa tài khoản' : '🔒 Khóa tài khoản'}
                        </button>
                        <button id="btn-delete" class="btn btn-ghost" style="width: 100%; border-color: var(--danger); color: var(--danger)">
                            🗑 Xóa tài khoản
                        </button>
                    </div>
                </div>
            </div>

            <!-- Phải: Hành vi -->
            <div class="glass-panel" style="padding: 0;">
                
                <!-- Tabs Header -->
                <div style="display: flex; border-bottom: 1px solid var(--border-color); padding: 0 1.5rem;">
                    <div class="tab-btn active" data-tab="tab-posts">Bài Đăng</div>
                    <div class="tab-btn" data-tab="tab-enroll">
                        ${user.role === 'GV' ? 'Học viên & Yêu cầu' : 'Khóa học đã đăng ký'}
                    </div>
                    ${user.role === 'HV' ? `<div class="tab-btn" data-tab="tab-blocks">Lịch sử Block</div>` : ''}
                </div>

                <!-- Tab Content: Posts -->
                <div id="tab-posts" class="tab-pane active" style="padding: 1.5rem;">
                    <div id="user-posts-container">
                        <div style="text-align:center; padding: 2rem;"><span class="skeleton" style="display:inline-block;width:30px;height:30px;border-radius:50%"></span> Đang tải...</div>
                    </div>
                </div>

                <!-- Tab Content: Enrollments -->
                <div id="tab-enroll" class="tab-pane" style="padding: 1.5rem; display: none;">
                    ${user.role === 'GV' ? `
                        <h3 style="margin-bottom: 1rem;">Học viên đang theo học</h3>
                        <div id="students-table-container">Đang tải...</div>
                        
                        <h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--warning)">Yêu cầu chờ duyệt</h3>
                        <div id="requests-table-container">Đang tải...</div>
                    ` : `
                        <h3 style="margin-bottom: 1rem;">Khóa học đang theo (Giảng viên)</h3>
                        <div id="courses-table-container">Đang tải...</div>
                    `}
                </div>

                <!-- Tab Content: Blocks -->
                ${user.role === 'HV' ? `
                <div id="tab-blocks" class="tab-pane" style="padding: 1.5rem; display: none;">
                    <h3 style="margin-bottom: 1rem; color: var(--danger)">Danh sách người dùng đã chặn</h3>
                    <div id="blocks-table-container">Đang tải...</div>
                </div>
                ` : ''}

            </div>
        </div>
    `;

    // Add Tab CSS
    if (!document.getElementById('tab-styles')) {
        const style = document.createElement('style');
        style.id = 'tab-styles';
        style.innerHTML = `
            .tab-btn {
                padding: 1rem 1.5rem; cursor: pointer; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 500; transition: all 0.2s;
            }
            .tab-btn:hover { color: var(--text-primary); }
            .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
            .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
            .post-card { background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; transition: transform 0.2s; cursor: pointer;}
            .post-card:hover { transform: translateY(-3px); border-color: var(--accent); }
            .post-card-thumb { width: 100%; height: 150px; background: #000; position: relative; }
            .post-card-thumb img { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; }
            .post-card-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: rgba(255,255,255,0.8); }
            .post-card-body { padding: 1rem; }
            .post-card-text { font-size: 0.875rem; color: var(--text-primary); margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .post-card-stats { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 1rem; }
        `;
        document.head.appendChild(style);
    }

    // Handle Tabs
    const tabBtns = container.querySelectorAll('.tab-btn');
    const tabPanes = container.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.style.display = 'none');
            
            btn.classList.add('active');
            container.querySelector(`#${btn.getAttribute('data-tab')}`).style.display = 'block';
        });
    });

    // Event Actions
    const btnToggleLock = document.getElementById('btn-toggle-lock');
    btnToggleLock.addEventListener('click', async () => {
        const isLocked = btnToggleLock.innerText.includes('Mở');
        const newStatus = isLocked ? 'ACTIVE' : 'LOCKED';
        const actionName = isLocked ? 'mở khóa' : 'KHÓA';
        
        const confirmed = await modal.confirm(
            `Xác nhận ${actionName}`,
            `Bạn có chắc chắn muốn ${actionName} tài khoản này không?`,
            async () => {
                await api.updateUser(user.id, { status: newStatus });
                toast.success('Thành công', `Đã ${actionName} tài khoản`);
                
                // Update UI manually to avoid full reload
                const badge = document.getElementById('profile-status-badge');
                badge.className = `badge ${newStatus === 'LOCKED' ? 'badge-danger' : 'badge-success'}`;
                badge.innerText = newStatus;
                
                btnToggleLock.innerText = newStatus === 'LOCKED' ? '🔓 Mở khóa tài khoản' : '🔒 Khóa tài khoản';
                btnToggleLock.className = `btn ${newStatus === 'LOCKED' ? 'btn-primary' : 'btn-ghost'}`;
                btnToggleLock.style.borderColor = newStatus === 'LOCKED' ? '' : 'var(--warning)';
                btnToggleLock.style.color = newStatus === 'LOCKED' ? '' : 'var(--warning)';
            },
            !isLocked
        );
    });

    document.getElementById('btn-delete').addEventListener('click', async () => {
        const confirmed = await modal.confirm(
            'Xóa tài khoản',
            'CẢNH BÁO: Hành động này không thể hoàn tác. Mọi dữ liệu sẽ bị xóa!',
            async () => {
                await api.deleteUser(user.id);
                toast.success('Thành công', 'Đã xóa tài khoản');
                window.location.hash = '#/users';
            },
            true
        );
    });

    // Load Posts
    loadUserPosts(user.id);

    // Load Enrollments
    if (user.role === 'GV') {
        loadStudentsAndRequests(user.id);
    } else {
        loadCourses(user.id);
    }

    // Load Blocks
    if (user.role === 'HV') {
        loadBlocks(user.id);
    }
}

async function loadUserPosts(userId) {
    const container = document.getElementById('user-posts-container');
    try {
        const res = await api.getListPosts('0', '100', userId);
        const posts = res.posts || [];
        
        if (posts.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted)">Không có bài đăng nào</div>`;
            return;
        }

        const html = `
            <div class="post-grid">
                ${posts.map(p => {
                    const thumb = (p.video && p.video.length > 0) ? p.video[0].thumb : '';
                    return `
                    <div class="post-card" onclick="window.location.hash='#/posts/${p.post_id}'">
                        <div class="post-card-thumb">
                            <img src="${thumb || 'https://via.placeholder.com/300x200?text=Video'}" onerror="this.src='https://via.placeholder.com/300x200?text=Video'">
                            <svg class="post-card-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                        </div>
                        <div class="post-card-body">
                            <div class="post-card-text">${p.described || 'Không có mô tả'}</div>
                            <div class="post-card-stats">
                                <span>❤️ ${p.like}</span>
                                <span>💬 ${p.comment}</span>
                                <span>📅 ${new Date(parseInt(p.created)*1000).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<div style="color: var(--danger)">Lỗi tải bài đăng: ${error.message}</div>`;
    }
}

async function loadStudentsAndRequests(teacherId) {
    try {
        const [students, requests] = await Promise.all([
            api.getListStudents(teacherId).catch(() => []),
            api.getRequestedEnrollments(teacherId).catch(() => [])
        ]);

        new Table('students-table-container', {
            data: students,
            emptyMessage: 'Chưa có học viên nào',
            columns: [
                { 
                    label: 'Học viên', key: 'username',
                    render: (val, row) => `
                        <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="window.location.hash='#/users/${row.id}'">
                            <img src="${row.avatar || `https://ui-avatars.com/api/?name=${val}`}" style="width:32px;height:32px;border-radius:50%">
                            <span>${val}</span>
                        </div>
                    `
                },
                { label: 'Ngày tham gia', key: 'createdAt', render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' }
            ]
        });

        new Table('requests-table-container', {
            data: requests,
            emptyMessage: 'Không có yêu cầu chờ duyệt',
            columns: [
                { 
                    label: 'Người gửi', key: 'username',
                    render: (val, row) => `
                        <div style="display:flex;align-items:center;gap:10px">
                            <img src="${row.avatar || `https://ui-avatars.com/api/?name=${val}`}" style="width:32px;height:32px;border-radius:50%">
                            <span>${val}</span>
                        </div>
                    `
                },
                { label: 'Ngày yêu cầu', key: 'createdAt', render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' }
            ]
        });

    } catch(err) {
        document.getElementById('students-table-container').innerHTML = `<div color="var(--danger)">Lỗi: ${err.message}</div>`;
    }
}

async function loadCourses(studentId) {
    try {
        const courses = await api.getListCoursesOfStudent(studentId).catch(() => []);
        
        new Table('courses-table-container', {
            data: courses,
            emptyMessage: 'Chưa đăng ký khóa học nào',
            columns: [
                { 
                    label: 'Giảng viên', key: 'username',
                    render: (val, row) => `
                        <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="window.location.hash='#/users/${row.id}'">
                            <img src="${row.avatar || `https://ui-avatars.com/api/?name=${val}`}" style="width:32px;height:32px;border-radius:50%">
                            <span>${val}</span>
                        </div>
                    `
                },
                { label: 'Mô tả', key: 'description' }
            ]
        });
    } catch(err) {
        document.getElementById('courses-table-container').innerHTML = `<div color="var(--danger)">Lỗi: ${err.message}</div>`;
    }
}

async function loadBlocks(userId) {
    try {
        const res = await api.getListBlocks(userId).catch(() => ({ users: [] }));
        const blocks = res.users || [];
        
        new Table('blocks-table-container', {
            data: blocks,
            emptyMessage: 'Chưa chặn người dùng nào',
            columns: [
                { 
                    label: 'Người dùng', key: 'name',
                    render: (val, row) => `
                        <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="window.location.hash='#/users/${row.id}'">
                            <img src="${row.avatar || `https://ui-avatars.com/api/?name=${val || 'U'}`}" style="width:32px;height:32px;border-radius:50%">
                            <span>${val || 'Không rõ'}</span>
                        </div>
                    `
                },
                { label: 'Hành động', key: 'id', render: () => '<span style="color:var(--text-muted)">Đã chặn</span>' }
            ]
        });
    } catch(err) {
        document.getElementById('blocks-table-container').innerHTML = `<div color="var(--danger)">Lỗi: ${err.message}</div>`;
    }
}
