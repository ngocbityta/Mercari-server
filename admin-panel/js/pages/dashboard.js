import { api } from '../api.js';
import { modal } from '../components/modal.js';

export async function renderDashboard(container) {
    document.getElementById('breadcrumb').innerHTML = '<span class="current">Dashboard</span>';
    
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Xin chào' : hour < 18 ? 'Xin chào' : 'Xin chào';
    const userJson = localStorage.getItem('admin_user');
    const currentUser = userJson ? JSON.parse(userJson) : { username: 'Admin' };

    container.innerHTML = `
        <div class="dashboard-header">
            <h2>${greeting}, <span class="text-gradient">${currentUser.username}</span> 👋</h2>
            <p style="color: var(--text-muted); margin-top: 0.25rem; font-size: 0.875rem;">Tổng quan hoạt động hệ thống Mercari hôm nay</p>
        </div>

        <div class="stats-grid" id="stats-container">
            ${[1, 2, 3, 4].map((_, i) => `
                <div class="stat-card glass-panel fade-in stagger-${i + 1}">
                    <div class="stat-info" style="width: 100%;">
                        <div class="skeleton skeleton-text short"></div>
                        <div class="skeleton skeleton-text" style="height: 2rem; width: 50px; margin-top: 8px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="display: grid; grid-template-columns: 5fr 3fr; gap: 1.25rem; margin-bottom: 1.75rem;">
            <div class="glass-panel fade-in stagger-2" style="padding: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h3 style="font-size: 1rem;">Tỷ lệ Vai trò</h3>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Phân bố hệ thống</span>
                </div>
                <div id="role-chart" style="height: 180px; display: flex; align-items: center; justify-content: center;">
                    <div class="skeleton" style="width: 140px; height: 140px; border-radius: 50%;"></div>
                </div>
            </div>
            
            <div class="glass-panel fade-in stagger-3" style="padding: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h3 style="font-size: 1rem;">Bài đăng gần đây</h3>
                    <a href="#/posts" style="font-size: 0.75rem; color: var(--accent);">Xem tất cả →</a>
                </div>
                <div id="recent-posts">
                    ${[1, 2, 3].map(() => `
                        <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: center;">
                            <div class="skeleton" style="width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0;"></div>
                            <div style="flex: 1;"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    try {
        const [usersRaw, postsRaw] = await Promise.all([
            api.getUsers(),
            api.getListPosts('0', '5')
        ]);

        const users = Array.isArray(usersRaw) ? usersRaw : [];
        const posts = (postsRaw && Array.isArray(postsRaw.posts)) ? postsRaw.posts : [];

        const totalUsers = users.length;
        const totalHV = users.filter(u => u.role === 'HV').length;
        const totalGV = users.filter(u => u.role === 'GV').length;
        const onlineCount = users.filter(u => u.online === true).length;
        const lockedCount = users.filter(u => u.status === 'LOCKED').length;

        document.getElementById('stats-container').innerHTML = `
            <div class="stat-card glass-panel hover-lift" id="stat-card-total" style="cursor: pointer;" title="Nhấn để xem chi tiết">
                <div class="stat-info">
                    <span class="stat-label">Tổng Thành Viên</span>
                    <span class="stat-value">${totalUsers}</span>
                </div>
                <div class="stat-icon primary">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
            </div>
            <div class="stat-card glass-panel hover-lift" id="stat-card-roles" style="cursor: pointer;" title="Nhấn để xem chi tiết">
                <div class="stat-info">
                    <span class="stat-label">Học Viên / Giảng Viên</span>
                    <span class="stat-value">${totalHV} <span style="font-size: 0.875rem; color: var(--text-muted); font-weight: 400;">/ ${totalGV}</span></span>
                </div>
                <div class="stat-icon info">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                </div>
            </div>
            <div class="stat-card glass-panel hover-lift" id="stat-card-online" style="cursor: pointer;" title="Nhấn để xem chi tiết">
                <div class="stat-info">
                    <span class="stat-label">Đang Online</span>
                    <span class="stat-value"><span class="online-dot animate" style="margin-right: 6px;"></span>${onlineCount}</span>
                </div>
                <div class="stat-icon success">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
            </div>
            <div class="stat-card glass-panel hover-lift" id="stat-card-locked" style="cursor: pointer;" title="Nhấn để xem chi tiết">
                <div class="stat-info">
                    <span class="stat-label">Tài Khoản Bị Khóa</span>
                    <span class="stat-value" style="color: ${lockedCount > 0 ? 'var(--danger)' : 'var(--text-primary)'}">${lockedCount}</span>
                </div>
                <div class="stat-icon danger">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
            </div>
        `;

        // Helper func to render modal list
        function showUsersModal(title, userList) {
            let content = '';
            if (userList.length === 0) {
                content = '<div class="empty-state" style="padding: 2rem;"><div class="empty-state-icon">📭</div><div class="empty-state-text">Không có dữ liệu</div></div>';
            } else {
                content = `
                    <div style="max-height: 50vh; overflow-y: auto; padding-right: 4px;">
                        ${userList.map(u => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 0.5rem; border-bottom: 1px solid var(--border-color);">
                                <div style="display: flex; align-items: center; gap: 0.875rem;">
                                    <img src="${u.avatar ? (u.avatar.startsWith('http') ? u.avatar : 'http://localhost:3000' + u.avatar) : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.username || 'U') + '&background=random'}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=U'">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-primary);">${u.username || 'Không tên'}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${u.phonenumber}</div>
                                    </div>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                                    <span class="badge ${u.role === 'HV' ? 'badge-hv' : 'badge-gv'}">${u.role}</span>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 4px;">
                                        ${u.online ? '<span style="display: flex; align-items: center; gap: 4px; color: var(--success); font-size: 0.6875rem; font-weight: 600;"><span class="online-dot"></span> Online</span>' : '<span style="display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 0.6875rem;"><span class="offline-dot"></span> Offline</span>'}
                                        ${u.status === 'LOCKED' ? '<span style="color: var(--danger); font-size: 0.6875rem; font-weight: 600; display: flex; align-items: center; gap: 2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Khóa</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 1rem; text-align: center;">
                        <a href="#/users" class="btn btn-ghost" style="width: 100%; font-size: 0.8125rem;">Đi đến trang Quản lý Thành viên →</a>
                    </div>
                `;
            }
            modal.show({
                title: title,
                body: content,
                showFooter: false
            });
        }

        // Attach events to cards
        document.getElementById('stat-card-total').addEventListener('click', () => {
            showUsersModal('📋 Toàn bộ Thành viên', users);
        });

        document.getElementById('stat-card-roles').addEventListener('click', () => {
            // Sort GV first then HV
            const sorted = [...users].sort((a, b) => a.role === 'GV' ? -1 : 1);
            showUsersModal('🎓 Danh sách Giảng viên & Học viên', sorted);
        });

        document.getElementById('stat-card-online').addEventListener('click', () => {
            showUsersModal('🟢 Thành viên Đang Online', users.filter(u => u.online === true));
        });

        document.getElementById('stat-card-locked').addEventListener('click', () => {
            showUsersModal('🔒 Tài khoản Bị Khóa', users.filter(u => u.status === 'LOCKED'));
        });

        // Donut Chart
        const hvPercent = totalUsers === 0 ? 0 : Math.round((totalHV / totalUsers) * 100);
        const gvPercent = 100 - hvPercent;
        document.getElementById('role-chart').innerHTML = `
            <div style="position: relative; width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(var(--accent) 0 ${hvPercent}%, var(--primary) ${hvPercent}% 100%); box-shadow: 0 0 30px rgba(6, 182, 212, 0.15);">
                <div style="position: absolute; inset: 22px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                    <span style="font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono);">${hvPercent}%</span>
                    <span style="font-size: 0.6875rem; color: var(--text-muted);">Học viên</span>
                </div>
            </div>
            <div style="margin-left: 1.5rem; display: flex; flex-direction: column; gap: 0.625rem;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem;">
                    <div style="width:10px; height:10px; border-radius:3px; background:var(--accent); box-shadow: 0 0 6px var(--accent-glow);"></div>
                    <span style="color: var(--text-secondary);">Học viên</span>
                    <span style="font-weight: 600; margin-left: auto; font-family: var(--font-mono);">${totalHV}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem;">
                    <div style="width:10px; height:10px; border-radius:3px; background:var(--primary); box-shadow: 0 0 6px var(--primary-glow);"></div>
                    <span style="color: var(--text-secondary);">Giảng viên</span>
                    <span style="font-weight: 600; margin-left: auto; font-family: var(--font-mono);">${totalGV}</span>
                </div>
                <div style="margin-top: 0.25rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-muted);">
                    Tổng: ${totalUsers} thành viên
                </div>
            </div>
        `;

        // Recent Posts
        let postsHtml = '';
        if (posts.length === 0) {
            postsHtml = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Chưa có bài đăng nào</div></div>`;
        } else {
            postsHtml = posts.map(p => {
                const thumb = (p.video && p.video.length > 0) ? p.video[0].thumb : '';
                return `
                <a href="#/posts/${p.post_id}" class="recent-post-item" style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem; align-items: center; padding: 0.5rem; border-radius: var(--radius-lg); transition: all 0.2s; text-decoration: none;">
                    <div style="width: 44px; height: 44px; border-radius: var(--radius-md); overflow: hidden; background: #000; flex-shrink: 0; position: relative;">
                        <img src="${thumb || 'https://via.placeholder.com/44x44?text=▶'}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" onerror="this.onerror=null; this.src='https://via.placeholder.com/44x44?text=▶'">
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.8125rem;">${p.described || 'Không có mô tả'}</div>
                        <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 2px; display: flex; gap: 0.5rem; align-items: center;">
                            <span style="color: var(--accent); font-weight: 500;">${p.author?.username || 'Ẩn danh'}</span>
                            <span>❤️ ${p.like}</span>
                            <span>💬 ${p.comment}</span>
                        </div>
                    </div>
                </a>
                `;
            }).join('');
        }
        
        if (!document.getElementById('dashboard-hover-style')) {
            const style = document.createElement('style');
            style.id = 'dashboard-hover-style';
            style.innerHTML = `.recent-post-item:hover { background: rgba(255,255,255,0.04) !important; }`;
            document.head.appendChild(style);
        }

        document.getElementById('recent-posts').innerHTML = postsHtml;

    } catch (error) {
        console.error(error);
        container.innerHTML += `<div style="padding: 1.5rem; color: var(--danger); background: var(--danger-bg); border-radius: var(--radius-lg); margin-top: 1rem; font-size: 0.875rem; border: 1px solid rgba(239, 68, 68, 0.15);">⚠️ Lỗi tải dữ liệu Dashboard: ${error.message}</div>`;
    }
}

