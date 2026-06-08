import { api } from '../api.js';
import { Table } from '../components/table.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderUsers(container) {
    document.getElementById('breadcrumb').innerHTML = '<a href="#/">Dashboard</a> <span style="margin:0 8px">/</span> <span class="current">Thành viên</span>';
    
    container.innerHTML = `
        <div class="page-toolbar">
            <div class="search-box">
                <input type="text" id="search-input" class="search-input" placeholder="Tìm theo tên hoặc số điện thoại...">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <div class="filters">
                <select id="filter-role" class="filter-select">
                    <option value="ALL">Tất cả vai trò</option>
                    <option value="HV">Học viên (HV)</option>
                    <option value="GV">Giảng viên (GV)</option>
                </select>
                <select id="filter-status" class="filter-select">
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="LOCKED">Đã khóa</option>
                </select>
            </div>
        </div>
        <div id="table-container"></div>
    `;

    let allUsers = [];
    
    // Config table
    const table = new Table('table-container', {
        isLoading: true,
        columns: [
            { 
                label: 'Thành viên', 
                key: 'username',
                render: (val, row) => {
                    const avatarSrc = row.avatar ? (row.avatar.startsWith('http') ? row.avatar : `http://localhost:3000${row.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(val || 'U')}&background=random`;
                    return `
                        <div class="table-user-info">
                            <img src="${avatarSrc}" class="table-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                            <div class="table-user-details">
                                <span class="table-user-name">${val || 'Không tên'}</span>
                                <span class="table-user-sub">${row.phonenumber}</span>
                            </div>
                        </div>
                    `;
                }
            },
            {
                label: 'Vai trò',
                key: 'role',
                render: (val) => `<span class="badge ${val === 'HV' ? 'badge-hv' : 'badge-gv'}">${val}</span>`
            },
            {
                label: 'Trạng thái',
                key: 'status',
                render: (val) => `<span class="badge ${val === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${val}</span>`
            },
            {
                label: 'Online',
                key: 'online',
                render: (val) => val ? `<span style="color:var(--success)">● Online</span>` : `<span style="color:var(--text-muted)">○ Offline</span>`
            },
            {
                label: 'Ngày tạo',
                key: 'createdAt',
                render: (val) => new Date(val).toLocaleDateString('vi-VN')
            }
        ],
        actions: [
            {
                name: 'view',
                title: 'Xem chi tiết',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
                class: 'view',
                onClick: (row) => {
                    window.location.hash = `#/users/${row.id}`;
                }
            },
            {
                name: 'toggle_lock',
                title: 'Khóa / Mở khóa',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
                class: 'lock',
                onClick: async (row) => {
                    const isLocked = row.status === 'LOCKED';
                    const newStatus = isLocked ? 'ACTIVE' : 'LOCKED';
                    const actionName = isLocked ? 'mở khóa' : 'KHÓA';
                    
                    const confirmed = await modal.confirm(
                        `Xác nhận ${actionName}`,
                        `Bạn có chắc chắn muốn ${actionName} tài khoản của <b>${row.username}</b> (${row.phonenumber}) không?`,
                        async () => {
                            await api.updateUser(row.id, { status: newStatus });
                            toast.success('Thành công', `Đã ${actionName} tài khoản ${row.username}`);
                        },
                        !isLocked
                    );
                    
                    if (confirmed) {
                        loadData(); // reload table
                    }
                }
            },
            {
                name: 'delete',
                title: 'Xóa tài khoản',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
                class: 'delete',
                onClick: async (row) => {
                    const confirmed = await modal.confirm(
                        'Xóa tài khoản',
                        `CẢNH BÁO: Bạn đang xóa vĩnh viễn tài khoản <b>${row.username}</b>. Toàn bộ dữ liệu liên quan cũng có thể bị xóa. Tiếp tục?`,
                        async () => {
                            await api.deleteUser(row.id);
                            toast.success('Thành công', `Đã xóa tài khoản ${row.username}`);
                        },
                        true
                    );
                    
                    if (confirmed) {
                        loadData(); // reload table
                    }
                }
            }
        ]
    });

    async function loadData() {
        table.setLoading(true);
        try {
            const rawData = await api.getUsers();
            allUsers = Array.isArray(rawData) ? rawData : [];
            applyFilters();
        } catch (error) {
            toast.error('Lỗi tải dữ liệu', error.message);
            table.updateData([]);
        }
    }

    function applyFilters() {
        const keyword = document.getElementById('search-input').value.toLowerCase().trim();
        const role = document.getElementById('filter-role').value;
        const status = document.getElementById('filter-status').value;

        let filtered = allUsers;

        if (keyword) {
            filtered = filtered.filter(u => 
                (u.username || '').toLowerCase().includes(keyword) || 
                (u.phonenumber || '').includes(keyword)
            );
        }

        if (role !== 'ALL') {
            filtered = filtered.filter(u => u.role === role);
        }

        if (status !== 'ALL') {
            filtered = filtered.filter(u => u.status === status);
        }

        table.updateData(filtered);
    }

    // Attach listeners
    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('filter-role').addEventListener('change', applyFilters);
    document.getElementById('filter-status').addEventListener('change', applyFilters);

    // Initial load
    loadData();
}
