export function renderSidebar(currentPath) {
    const userJson = localStorage.getItem('admin_user');
    const user = userJson ? JSON.parse(userJson) : { username: 'Admin', role: 'GV', avatar: null };
    
    // SVG Icons
    const dashIcon = `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>`;
    const usersIcon = `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
    const postsIcon = `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;

    const navItems = [
        { path: '#/', name: 'Dashboard', icon: dashIcon },
        { path: '#/users', name: 'Quản lý Thành viên', icon: usersIcon },
        { path: '#/posts', name: 'Quản lý Bài đăng', icon: postsIcon }
    ];

    const navHtml = navItems.map(item => {
        const isActive = currentPath === item.path || (currentPath.startsWith(item.path) && item.path !== '#/');
        const realIsActive = (item.path === '#/') ? (currentPath === '#/') : isActive;
        
        return `
            <a href="${item.path}" class="nav-item ${realIsActive ? 'active' : ''}">
                ${item.icon}
                <span>${item.name}</span>
            </a>
        `;
    }).join('');

    const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username) + '&background=6366F1&color=fff&bold=true&size=64';
    const avatarSrc = user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:3000${user.avatar}`) : defaultAvatar;

    return `
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <div class="logo-icon">M</div>
                    <span>Mercari Admin</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-section-label">Điều hướng</div>
                ${navHtml}
            </nav>
            <div class="sidebar-footer">
                <div class="user-mini-profile">
                    <img src="${avatarSrc}" alt="Avatar" class="user-avatar-small" onerror="this.src='https://ui-avatars.com/api/?name=A&background=6366F1&color=fff'">
                    <div class="user-info-mini">
                        <div class="user-name-mini">${user.username}</div>
                        <div class="user-role-mini">${user.role === 'GV' ? 'Giảng viên' : 'Học viên'}</div>
                    </div>
                    <button id="logout-btn" class="logout-btn" title="Đăng xuất">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </div>
        </aside>
    `;
}
