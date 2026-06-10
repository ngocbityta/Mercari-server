// CSS styles cho Toast sẽ được tự động chèn vào head
const toastStyles = `
    .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .toast {
        min-width: 300px;
        max-width: 400px;
        padding: 16px;
        border-radius: 8px;
        background: rgba(30, 41, 59, 0.95);
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        border: 1px solid rgba(255,255,255,0.1);
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        overflow: hidden;
    }
    
    .toast.show {
        transform: translateX(0);
    }
    
    .toast-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
    }
    
    .toast-content {
        flex: 1;
    }
    
    .toast-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
        color: #fff;
    }
    
    .toast-message {
        font-size: 13px;
        color: #94A3B8;
        line-height: 1.4;
    }
    
    .toast-close {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        cursor: pointer;
        color: #64748B;
    }
    
    .toast-close:hover {
        color: #fff;
    }
    
    .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: currentColor;
        width: 100%;
        animation: toast-progress linear forwards;
    }
    
    @keyframes toast-progress {
        to { width: 0; }
    }
    
    /* Types */
    .toast.success { border-left: 4px solid #10B981; }
    .toast.success .toast-icon { color: #10B981; }
    .toast.success .toast-progress { color: #10B981; }
    
    .toast.error { border-left: 4px solid #EF4444; }
    .toast.error .toast-icon { color: #EF4444; }
    .toast.error .toast-progress { color: #EF4444; }
    
    .toast.warning { border-left: 4px solid #F59E0B; }
    .toast.warning .toast-icon { color: #F59E0B; }
    .toast.warning .toast-progress { color: #F59E0B; }
`;

// Chèn CSS vào head nếu chưa có
if (!document.getElementById('toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toast-styles';
    styleSheet.innerText = toastStyles;
    document.head.appendChild(styleSheet);
}

const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
};

class Toast {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(options) {
        const { type = 'info', title, message, duration = 3000 } = options;
        
        const toastEl = document.createElement('div');
        toastEl.className = `toast ${type}`;
        
        toastEl.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <svg class="toast-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
        `;
        
        this.container.appendChild(toastEl);
        
        // Trigger reflow to start animation
        void toastEl.offsetWidth;
        
        toastEl.classList.add('show');
        
        const closeBtn = toastEl.querySelector('.toast-close');
        
        const removeToast = () => {
            toastEl.classList.remove('show');
            setTimeout(() => {
                if (this.container.contains(toastEl)) {
                    this.container.removeChild(toastEl);
                }
            }, 300); // Wait for transition
        };
        
        closeBtn.addEventListener('click', removeToast);
        
        if (duration > 0) {
            setTimeout(removeToast, duration);
        }
    }

    success(title, message, duration) {
        this.show({ type: 'success', title, message, duration });
    }

    error(title, message, duration) {
        this.show({ type: 'error', title, message, duration });
    }

    warning(title, message, duration) {
        this.show({ type: 'warning', title, message, duration });
    }

    info(title, message, duration) {
        this.show({ type: 'info', title, message, duration });
    }
}

export const toast = new Toast();
