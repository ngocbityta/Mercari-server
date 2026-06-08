export class Table {
    constructor(containerId, options) {
        this.container = document.getElementById(containerId);
        this.columns = options.columns || [];
        this.data = options.data || [];
        this.actions = options.actions || [];
        this.isLoading = options.isLoading || false;
        this.emptyMessage = options.emptyMessage || 'Không có dữ liệu';
        this.render();
    }

    updateData(newData) {
        this.data = newData;
        this.isLoading = false;
        this.render();
    }

    setLoading(isLoading) {
        this.isLoading = isLoading;
        this.render();
    }

    render() {
        if (!this.container) return;

        if (this.isLoading) {
            this.container.innerHTML = this.renderSkeleton();
            return;
        }

        if (this.data.length === 0) {
            this.container.innerHTML = this.renderEmpty();
            return;
        }

        const tableHtml = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                            ${this.actions.length > 0 ? `<th style="text-align: right;">Hành động</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.map((row, index) => this.renderRow(row, index)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        this.container.innerHTML = tableHtml;
        this.attachActionListeners();
    }

    renderRow(row, index) {
        let cells = this.columns.map(col => {
            let content = col.render ? col.render(row[col.key], row) : row[col.key];
            return `<td>${content || ''}</td>`;
        }).join('');

        let actionsHtml = '';
        if (this.actions.length > 0) {
            const btns = this.actions.map(act => {
                // Check if action should be shown
                if (act.show && !act.show(row)) return '';
                return `<button class="action-btn ${act.class}" data-action="${act.name}" data-index="${index}" title="${act.title}">${act.icon}</button>`;
            }).join('');
            actionsHtml = `<td class="table-actions">${btns}</td>`;
        }

        return `<tr>${cells}${actionsHtml}</tr>`;
    }

    renderSkeleton() {
        const rowCount = 5;
        const colCount = this.columns.length + (this.actions.length > 0 ? 1 : 0);
        
        let rows = '';
        for (let i = 0; i < rowCount; i++) {
            let cells = '';
            for (let j = 0; j < colCount; j++) {
                cells += `<td><div class="skeleton skeleton-text"></div></td>`;
            }
            rows += `<tr>${cells}</tr>`;
        }

        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                            ${this.actions.length > 0 ? `<th style="text-align: right;">Hành động</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    renderEmpty() {
        return `
            <div class="table-container" style="text-align: center; padding: 3rem;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <div style="color: var(--text-secondary);">${this.emptyMessage}</div>
            </div>
        `;
    }

    attachActionListeners() {
        if (this.actions.length === 0) return;

        const buttons = this.container.querySelectorAll('.action-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionName = btn.getAttribute('data-action');
                const index = btn.getAttribute('data-index');
                const actionDef = this.actions.find(a => a.name === actionName);
                if (actionDef && actionDef.onClick) {
                    actionDef.onClick(this.data[index], index);
                }
            });
        });
    }
}
