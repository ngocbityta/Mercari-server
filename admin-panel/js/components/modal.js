const modalStyles = `
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(4px);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
    
    .modal-overlay.show {
        opacity: 1;
        visibility: visible;
    }
    
    .modal-box {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        width: 90%;
        max-width: 500px;
        transform: scale(0.95);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex;
        flex-direction: column;
        max-height: 90vh;
    }
    
    .modal-box.large {
        max-width: 900px;
    }
    
    .modal-overlay.show .modal-box {
        transform: scale(1);
    }
    
    .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .modal-close {
        color: var(--text-muted);
        cursor: pointer;
        transition: color 0.2s;
    }
    
    .modal-close:hover {
        color: var(--text-primary);
    }
    
    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
    }
    
    .modal-footer {
        padding: 1.5rem;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
    }
`;

if (!document.getElementById('modal-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'modal-styles';
    styleSheet.innerText = modalStyles;
    document.head.appendChild(styleSheet);
}

export class Modal {
    constructor() {
        this.container = document.getElementById('modal-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'modal-container';
            document.body.appendChild(this.container);
        }
    }

    createHTML(options) {
        const { title, body, showFooter = true, confirmText = 'Xác nhận', cancelText = 'Hủy', isDanger = false, size = 'default' } = options;
        
        return `
            <div class="modal-overlay" id="modal-overlay">
                <div class="modal-box ${size === 'large' ? 'large' : ''}">
                    <div class="modal-header">
                        <div class="modal-title">${title}</div>
                        <svg class="modal-close" id="modal-close-btn" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                    <div class="modal-body">
                        ${body}
                    </div>
                    ${showFooter ? `
                    <div class="modal-footer">
                        <button class="btn btn-ghost" id="modal-cancel-btn">${cancelText}</button>
                        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    show(options) {
        return new Promise((resolve, reject) => {
            this.container.innerHTML = this.createHTML(options);
            
            const overlay = document.getElementById('modal-overlay');
            const closeBtn = document.getElementById('modal-close-btn');
            const cancelBtn = document.getElementById('modal-cancel-btn');
            const confirmBtn = document.getElementById('modal-confirm-btn');
            
            // Show animation
            setTimeout(() => {
                overlay.classList.add('show');
            }, 10);
            
            const closeModal = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    this.container.innerHTML = '';
                    resolve(result);
                }, 300);
            };
            
            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(false));
            if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(false));
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    if (options.onConfirm) {
                        try {
                            const originalText = confirmBtn.innerText;
                            confirmBtn.innerText = 'Đang xử lý...';
                            confirmBtn.disabled = true;
                            await options.onConfirm();
                            closeModal(true);
                        } catch (err) {
                            confirmBtn.innerText = originalText;
                            confirmBtn.disabled = false;
                        }
                    } else {
                        closeModal(true);
                    }
                });
            }
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(false);
            });
        });
    }

    confirm(title, message, onConfirm, isDanger = false) {
        return this.show({
            title,
            body: `<p style="color: var(--text-secondary)">${message}</p>`,
            showFooter: true,
            isDanger,
            onConfirm
        });
    }
}

export const modal = new Modal();
