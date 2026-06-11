import { api } from '../api.js';
import { Table } from '../components/table.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderPosts(container) {
    document.getElementById('breadcrumb').innerHTML = '<a href="#/">Dashboard</a> <span style="margin:0 8px">/</span> <span class="current">Bài đăng</span>';
    
    container.innerHTML = `
        <div class="page-toolbar">
            <div class="search-box">
                <input type="text" id="search-input" class="search-input" placeholder="Tìm kiếm bài đăng...">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
        </div>
        <div id="table-container"></div>
        <div class="pagination" id="pagination"></div>
    `;

    let currentIndex = 0;
    const count = 20;
    let isSearchMode = false;
    let keyword = '';

    const table = new Table('table-container', {
        isLoading: true,
        columns: [
            {
                label: 'Video',
                key: 'video',
                render: (val, row) => {
                    const thumb = val && val.length > 0 ? val[0].thumb : '';
                    return `
                        <div style="position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #000;">
                            <img src="${thumb || 'https://via.placeholder.com/64x64?text=Video'}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" onerror="this.onerror=null; this.src='https://via.placeholder.com/64x64?text=Video'">
                            <svg style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: rgba(255,255,255,0.9);" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                        </div>
                    `;
                }
            },
            {
                label: 'Nội dung',
                key: 'described',
                render: (val) => `<div style="max-width: 300px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${val || 'Không có nội dung'}</div>`
            },
            {
                label: 'Tác giả',
                key: 'author',
                render: (val) => {
                    const avatar = val?.avatar ? (val.avatar.startsWith('http') ? val.avatar : `http://localhost:3000${val.avatar}`) : `https://ui-avatars.com/api/?name=${val?.username || 'U'}`;
                    return `
                        <div style="display:flex; align-items:center; gap:8px;">
                            <img src="${avatar}" style="width:32px; height:32px; border-radius:50%; object-fit: cover;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=U'">
                            <div>
                                <div style="font-weight: 500">${val?.username || 'Unknown'}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted)">${val?.role || ''}</div>
                            </div>
                        </div>
                    `;
                }
            },
            {
                label: 'Tương tác',
                key: 'like',
                render: (val, row) => `
                    <div style="display: flex; gap: 1rem; color: var(--text-secondary)">
                        <span><span style="color:var(--danger)">❤️</span> ${val}</span>
                        <span><span style="color:var(--info)">💬</span> ${row.comment}</span>
                    </div>
                `
            },
            {
                label: 'Ngày đăng',
                key: 'created',
                render: (val) => new Date(parseInt(val)*1000).toLocaleDateString()
            }
        ],
        actions: [
            {
                name: 'view',
                title: 'Xem chi tiết',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
                class: 'view',
                onClick: (row) => window.location.hash = `#/posts/${row.post_id || row.id}`
            },
            {
                name: 'delete',
                title: 'Xóa bài đăng',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
                class: 'delete',
                onClick: async (row) => {
                    const confirmed = await modal.confirm(
                        'Xóa bài đăng',
                        'Bạn có chắc chắn muốn xóa bài đăng này không? Mọi comment sẽ bị mất.',
                        async () => {
                            await api.deletePost(row.post_id || row.id);
                            toast.success('Thành công', 'Đã xóa bài đăng');
                            loadData();
                        },
                        true
                    );
                }
            }
        ]
    });

    let allPostsCache = []; // Cache for client-side filtering

    async function loadData() {
        table.setLoading(true);
        try {
            let res;
            if (isSearchMode && keyword) {
                // Load a large batch for client-side search (Elasticsearch not available)
                if (allPostsCache.length === 0) {
                    res = await api.getListPosts('0', '200');
                    allPostsCache = res.posts || [];
                }
                // Client-side filter
                const kw = keyword.toLowerCase();
                const filtered = allPostsCache.filter(p => 
                    (p.described || '').toLowerCase().includes(kw) ||
                    (p.author?.username || '').toLowerCase().includes(kw)
                );
                // Manual pagination
                const paged = filtered.slice(currentIndex, currentIndex + count);
                table.updateData(paged);
                renderPagination(paged.length, filtered.length);
            } else {
                allPostsCache = []; // Reset cache when not searching
                res = await api.getListPosts(currentIndex.toString(), count.toString());
                const posts = res.posts || res || [];
                table.updateData(posts);
                renderPagination(posts.length);
            }
        } catch (error) {
            table.updateData([]);
            renderPagination(0);
        }
    }

    function renderPagination(loadedCount, totalFiltered) {
        const pagContainer = document.getElementById('pagination');
        const hasNext = totalFiltered 
            ? (currentIndex + count < totalFiltered) 
            : (loadedCount === count);
        
        pagContainer.innerHTML = `
            <button class="page-btn" id="btn-prev" ${currentIndex === 0 ? 'disabled' : ''}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span style="color: var(--text-secondary); margin: 0 1rem; font-size: 0.8125rem;">Trang ${(currentIndex/count) + 1}</span>
            <button class="page-btn" id="btn-next" ${!hasNext ? 'disabled' : ''}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        `;

        document.getElementById('btn-prev').addEventListener('click', () => {
            if (currentIndex >= count) {
                currentIndex -= count;
                loadData();
            }
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            if (hasNext) {
                currentIndex += count;
                loadData();
            }
        });
    }

    // Search input
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            keyword = e.target.value.trim();
            isSearchMode = keyword.length > 0;
            currentIndex = 0;
            if (!isSearchMode) allPostsCache = []; // Reset cache
            loadData();
        }, 400);
    });

    // Check for pending search from clicking a hashtag
    const pendingSearch = sessionStorage.getItem('pendingSearch');
    if (pendingSearch) {
        document.getElementById('search-input').value = pendingSearch;
        keyword = pendingSearch;
        isSearchMode = true;
        sessionStorage.removeItem('pendingSearch');
    }

    loadData();
}

