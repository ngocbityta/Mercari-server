import { api } from '../api.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderPostDetail(container, postId) {
    document.getElementById('breadcrumb').innerHTML = '<a href="#/">Dashboard</a> <span style="margin:0 6px;color:var(--text-muted)">/</span> <a href="#/posts">Bài đăng</a> <span style="margin:0 6px;color:var(--text-muted)">/</span> <span class="current">Chi tiết</span>';
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 1.5rem; align-items: start;">
            <div id="video-container">
                <div class="glass-panel" style="padding: 1.5rem; text-align: center;">
                    <div class="skeleton" style="height: 350px; width: 100%; border-radius: var(--radius-lg);"></div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                <div id="author-container" class="glass-panel" style="padding: 1.25rem;">
                    <div class="skeleton" style="height: 56px;"></div>
                </div>
                <div class="glass-panel" style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column; max-height: calc(100vh - 200px);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
                        <h3 style="font-size: 0.9375rem;">💬 Bình luận & Chấm điểm</h3>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <button id="btn-grade-post" class="btn btn-primary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; display: none;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                Chấm điểm
                            </button>
                            <span id="comment-count-badge" style="font-size: 0.75rem; color: var(--text-muted);"></span>
                        </div>
                    </div>
                    <div id="comments-container" style="flex: 1; overflow-y: auto; padding-right: 0.25rem;">
                        <div class="skeleton skeleton-text" style="height: 60px; margin-bottom: 0.75rem;"></div>
                        <div class="skeleton skeleton-text" style="height: 60px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        const post = await api.getPost(postId);
        
        // Render Videos
        let videoHtml = '';
        if (post.video && post.video.length > 0) {
            const hasTwoVideos = post.video.length >= 2;
            videoHtml = `
                <div style="display: grid; grid-template-columns: ${hasTwoVideos ? '1fr 1fr' : '1fr'}; gap: 0.75rem; margin-bottom: 1.25rem;">
                    ${post.video.map(v => `
                        <div style="background: #000; border-radius: var(--radius-lg); overflow: hidden; aspect-ratio: 9/16; border: 1px solid var(--border-color);">
                            <video src="${v.url}" poster="${v.thumb}" controls style="width: 100%; height: 100%; object-fit: contain;"></video>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const author = post.author || {};
        const authorAvatar = author.avatar ? (author.avatar.startsWith('http') ? author.avatar : `http://localhost:3000${author.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name || 'U')}&background=6366F1&color=fff`;

        // Hashtag parsing
        let describedHtml = post.described || '';
        describedHtml = describedHtml.replace(/#([^\s#]+)/g, `<span class="hashtag-link" data-tag="$1">#$1</span>`);

        const likeCount = parseInt(post.like) || 0;
        const commentCount = parseInt(post.comment) || 0;
        const postDate = new Date(parseInt(post.created) * 1000).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });

        document.getElementById('video-container').innerHTML = `
            <div class="glass-panel" style="padding: 1.5rem;">
                ${videoHtml}
                <div id="post-content-container" style="font-size: 1rem; line-height: 1.7; margin-bottom: 1.25rem; white-space: pre-wrap;">${describedHtml}</div>
                
                <div style="display: flex; gap: 0; border-top: 1px solid var(--border-color); padding-top: 0.875rem;">
                    <div style="display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: var(--radius-full); font-size: 0.8125rem; color: var(--text-secondary); background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.1);">
                        <span>❤️</span>
                        <span style="font-weight: 600; color: var(--text-primary);">${likeCount}</span>
                        <span>thích</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: var(--radius-full); font-size: 0.8125rem; color: var(--text-secondary); margin-left: 0.5rem; background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.1);">
                        <span>💬</span>
                        <span style="font-weight: 600; color: var(--text-primary);">${commentCount}</span>
                        <span>bình luận</span>
                    </div>
                    <div style="margin-left: auto; display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-muted);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        ${postDate}
                    </div>
                </div>

                ${post.exercise_id ? `
                    <div style="margin-top: 1rem; padding: 0.625rem 0.875rem; background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.15); border-radius: var(--radius-lg); color: var(--accent); font-size: 0.8125rem; display: flex; align-items: center; gap: 0.5rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        Bài tập: <span style="font-family: var(--font-mono); font-weight: 500;">${post.exercise_id}</span>
                    </div>
                ` : ''}
            </div>
            
            <button id="btn-delete-post" class="btn btn-danger btn-block" style="margin-top: 1.25rem; padding: 0.75rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Xóa bài đăng
            </button>
        `;

        // Delete handler
        document.getElementById('btn-delete-post').addEventListener('click', async () => {
            await modal.confirm(
                'Cảnh báo xóa bài đăng',
                'Bạn có chắc chắn muốn xóa bài đăng này? Hành động này sẽ xóa toàn bộ video và bình luận liên quan.',
                async () => {
                    await api.deletePost(postId);
                    toast.success('Đã xóa', 'Bài đăng đã bị xóa khỏi hệ thống');
                    window.location.hash = '#/posts';
                },
                true
            );
        });

        // Hashtag click handler
        document.querySelectorAll('.hashtag-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const tag = e.currentTarget.getAttribute('data-tag');
                sessionStorage.setItem('pendingSearch', '#' + tag);
                window.location.hash = '#/posts';
            });
        });

        // Author
        document.getElementById('author-container').innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.875rem;">
                <img src="${authorAvatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(99,102,241,0.2);" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366F1&color=fff'">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9375rem;">${author.name || 'Không có tên'}</div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 2px;">
                        <span class="badge ${author.role === 'HV' ? 'badge-hv' : 'badge-gv'}" style="font-size: 0.625rem;">${author.role === 'HV' ? 'Học viên' : 'Giảng viên'}</span>
                        <a href="#/users/${author.id}" style="font-size: 0.75rem; color: var(--accent);">Xem hồ sơ →</a>
                    </div>
                </div>
            </div>
        `;

        loadComments(postId);

    } catch (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 3rem; color: var(--danger); text-align: center;">⚠️ Lỗi tải bài đăng: ${error.message}</div>`;
    }
}

async function loadComments(postId) {
    const container = document.getElementById('comments-container');
    const countBadge = document.getElementById('comment-count-badge');
    const btnGrade = document.getElementById('btn-grade-post');
    try {
        const res = await api.getComments(postId, '0', '100');
        const comments = Array.isArray(res) ? res : (res?.data || []);

        if (countBadge) countBadge.textContent = `${comments.length} bình luận`;

        // Check if there is already a score
        const hasScore = comments.some(c => c.score !== undefined && c.score !== null);
        if (btnGrade) {
            btnGrade.style.display = hasScore ? 'none' : 'flex';
            
            // Remove old listener to avoid duplicates if re-rendering
            const newBtn = btnGrade.cloneNode(true);
            btnGrade.parentNode.replaceChild(newBtn, btnGrade);
            
            newBtn.addEventListener('click', () => {
                modal.custom(`
                    <div style="padding: 1.5rem;">
                        <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: var(--warning);">⭐</span> Chấm điểm bài tập
                        </h3>
                        <div class="form-group">
                            <label class="form-label">Điểm số (VD: 8.5, 10)</label>
                            <input type="number" id="grade-score" class="form-control" step="0.5" min="0" max="10" placeholder="Nhập điểm...">
                        </div>
                        <div class="form-group" style="margin-top: 1rem;">
                            <label class="form-label">Chi tiết lỗi sai / Nhận xét</label>
                            <textarea id="grade-details" class="form-control" rows="4" placeholder="Nhập chi tiết nhận xét để học viên cải thiện..."></textarea>
                        </div>
                        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                            <button id="btn-cancel-grade" class="btn btn-secondary">Hủy</button>
                            <button id="btn-submit-grade" class="btn btn-primary">Xác nhận</button>
                        </div>
                    </div>
                `);

                document.getElementById('btn-cancel-grade').addEventListener('click', () => modal.close());
                document.getElementById('btn-submit-grade').addEventListener('click', async () => {
                    const score = document.getElementById('grade-score').value.trim();
                    const details = document.getElementById('grade-details').value.trim();
                    
                    if (!score) {
                        toast.error('Lỗi', 'Vui lòng nhập điểm số');
                        return;
                    }

                    try {
                        document.getElementById('btn-submit-grade').disabled = true;
                        document.getElementById('btn-submit-grade').textContent = 'Đang xử lý...';
                        
                        await api.setComment(postId, '0', '1', '', score, details);
                        
                        modal.close();
                        toast.success('Thành công', 'Đã chấm điểm bài đăng!');
                        loadComments(postId); // Reload comments to show the grade
                    } catch (error) {
                        toast.error('Lỗi chấm điểm', error.message);
                        document.getElementById('btn-submit-grade').disabled = false;
                        document.getElementById('btn-submit-grade').textContent = 'Xác nhận';
                    }
                });
            });
        }

        if (comments.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">Chưa có bình luận nào</div></div>`;
            return;
        }

        container.innerHTML = comments.map(c => {
            const userAvatar = c.poster?.avatar ? (c.poster.avatar.startsWith('http') ? c.poster.avatar : `http://localhost:3000${c.poster.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.poster?.name || 'U')}&background=334155&color=fff&size=64`;
            
            return `
            <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 0.875rem; margin-bottom: 0.625rem; transition: border-color 0.2s;" onmouseenter="this.style.borderColor='var(--border-color-light)'" onmouseleave="this.style.borderColor='var(--border-color)'">
                <div style="display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.5rem;">
                    <img src="${userAvatar}" style="width: 30px; height: 30px; border-radius: 50%;" onerror="this.src='https://ui-avatars.com/api/?name=U&background=334155&color=fff'">
                    <div style="flex: 1;">
                        <span style="font-weight: 600; font-size: 0.8125rem;">${c.poster?.name || 'User'}</span>
                        <span style="font-size: 0.6875rem; color: var(--text-muted); margin-left: 0.5rem;">${new Date(c.created).toLocaleString('vi-VN')}</span>
                    </div>
                </div>
                
                <div style="color: var(--text-primary); font-size: 0.875rem; line-height: 1.5; ${c.score ? 'margin-bottom: 0.75rem;' : ''}">${c.comment || ''}</div>
                
                ${c.score ? `
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-md); padding: 0.625rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: ${c.detail_mistakes ? '0.5rem' : '0'};">
                            <span style="background: var(--warning); color: #000; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">Điểm: ${c.score}/10</span>
                        </div>
                        ${c.detail_mistakes ? `
                            <div style="font-size: 0.8125rem; color: var(--text-secondary);">
                                <div style="color: var(--warning); font-weight: 600; margin-bottom: 2px; font-size: 0.75rem;">Chi tiết lỗi:</div>
                                <div style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.85;">${c.detail_mistakes}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');

    } catch (error) {
        container.innerHTML = `<div style="color: var(--danger); font-size: 0.875rem;">⚠️ Lỗi tải bình luận: ${error.message}</div>`;
    }
}

// Inject hashtag styles
if (!document.getElementById('hashtag-styles')) {
    const style = document.createElement('style');
    style.id = 'hashtag-styles';
    style.innerHTML = `
        .hashtag-link {
            color: var(--accent);
            cursor: pointer;
            display: inline-block;
            padding: 1px 6px;
            background: rgba(6,182,212,0.08);
            border-radius: 4px;
            transition: all 0.2s;
            font-weight: 600;
            font-size: 0.9375em;
        }
        .hashtag-link:hover {
            background: rgba(6,182,212,0.18);
            color: var(--accent-hover);
        }
    `;
    document.head.appendChild(style);
}
