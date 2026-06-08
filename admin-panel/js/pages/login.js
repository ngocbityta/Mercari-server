import { api } from '../api.js';
import { toast } from '../components/toast.js';

export async function renderLogin(container) {
    container.innerHTML = `
        <div class="login-page">
            <div class="login-card glass-panel">
                <div class="login-logo">
                    <div class="logo-icon">M</div>
                    <h1 class="login-title">Mercari Admin</h1>
                    <p class="login-subtitle">Đăng nhập</p>
                </div>
                
                <form id="login-form">
                    <div class="form-group">
                        <input type="text" id="phonenumber" class="form-input" placeholder="Số điện thoại" required autocomplete="off">
                        <label for="phonenumber" class="form-label">Số điện thoại</label>
                        <svg class="form-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    
                    <div class="form-group">
                        <input type="password" id="password" class="form-input" placeholder="Mật khẩu" required>
                        <label for="password" class="form-label">Mật khẩu</label>
                        <svg class="form-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    
                    <button type="submit" id="btn-submit" class="btn btn-primary btn-block" style="padding: 0.75rem; font-size: 0.9375rem; margin-top: 0.5rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                        Đăng Nhập
                    </button>
                </form>

                <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color); text-align: center;">
                    <p style="font-size: 0.75rem; color: var(--text-muted);">Chỉ dành cho tài khoản Giảng viên (GV)</p>
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById('login-form');
    const btnSubmit = document.getElementById('btn-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phone = document.getElementById('phonenumber').value.trim();
        const pwd = document.getElementById('password').value;
        
        if (!phone || !pwd) {
            toast.warning('Thiếu thông tin', 'Vui lòng nhập đủ số điện thoại và mật khẩu');
            return;
        }

        try {
            btnSubmit.innerHTML = `<span class="spinner" style="display:inline-block; width:18px; height:18px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; animation:spin 0.8s ease-in-out infinite;"></span> Đang xử lý...`;
            btnSubmit.disabled = true;

            const res = await api.login(phone, pwd);
            
            // Validate role
            if (res.role !== 'GV') {
                throw new Error('Chỉ có Giảng Viên (GV) mới được quyền truy cập Admin Panel.');
            }

            // Save to localStorage
            localStorage.setItem('admin_token', res.token);
            localStorage.setItem('admin_user', JSON.stringify({
                id: res.id,
                username: res.username,
                avatar: res.avatar,
                role: res.role
            }));

            toast.success('Đăng nhập thành công', `Chào mừng ${res.username} trở lại!`);
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.hash = '#/';
            }, 800);

        } catch (error) {
            btnSubmit.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Đăng Nhập`;
            btnSubmit.disabled = false;
            toast.error('Đăng nhập thất bại', error.message);
        }
    });
}

// Add keyframes for spinner if not exists
if (!document.getElementById('spinner-style')) {
    const style = document.createElement('style');
    style.id = 'spinner-style';
    style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
}
