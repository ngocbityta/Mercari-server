import { api } from '../api.js';

export async function renderReports(container) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = '<h2>Quản lý Báo cáo Bài viết</h2>';
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>Danh sách Báo cáo</h3>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Người báo cáo</th>
                                <th>Bài viết (ID)</th>
                                <th>Nội dung bài</th>
                                <th>Tiêu đề (Subject)</th>
                                <th>Chi tiết (Details)</th>
                                <th>Ngày tạo</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody id="reports-list">
                            <tr><td colspan="8" style="text-align: center;">Đang tải...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const reportsList = document.getElementById('reports-list');

    try {
        const reports = await api.getListReports('0', '50');
        
        if (reports.length === 0) {
            reportsList.innerHTML = '<tr><td colspan="8" style="text-align: center;">Không có báo cáo nào.</td></tr>';
            return;
        }

        reportsList.innerHTML = reports.map(report => `
            <tr>
                <td>${report.id.substring(0, 8)}...</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${report.reporter.avatar ? `<img src="${report.reporter.avatar}" width="32" height="32" style="border-radius: 50%;">` : '<div style="width:32px;height:32px;border-radius:50%;background:#ccc;"></div>'}
                        <span>${report.reporter.username || 'Không có tên'}</span>
                    </div>
                </td>
                <td>
                    <a href="#/posts/${report.post.id}" class="btn btn-sm btn-outline">Xem bài viết</a>
                </td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${report.post.content || '(Không có nội dung)'}
                </td>
                <td><span class="badge ${report.subject === 'Spam' ? 'badge-danger' : 'badge-warning'}">${report.subject}</span></td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${report.details}">
                    ${report.details}
                </td>
                <td>${new Date(report.created).toLocaleString('vi-VN')}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-delete-post" data-post-id="${report.post.id}">Xóa bài</button>
                </td>
            </tr>
        `).join('');

        // Event listeners cho các nút xóa bài
        document.querySelectorAll('.btn-delete-post').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const postId = e.target.getAttribute('data-post-id');
                if (confirm('Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.')) {
                    try {
                        const originalText = e.target.innerText;
                        e.target.innerText = 'Đang xóa...';
                        e.target.disabled = true;
                        
                        await api.deletePost(postId);
                        alert('Đã xóa bài viết thành công.');
                        // Tải lại trang reports
                        renderReports(container);
                    } catch (error) {
                        alert('Lỗi xóa bài: ' + error.message);
                        e.target.innerText = originalText;
                        e.target.disabled = false;
                    }
                }
            });
        });

    } catch (error) {
        reportsList.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    }
}
