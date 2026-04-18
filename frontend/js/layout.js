// frontend/js/layout.js

function renderSidebar() {
    const activePage = window.location.pathname.split('/').pop().split('.')[0] || 'index';
    
    // Si estamos en la raíz (index.html), activePage podría ser 'index' o vacía
    const isOverview = activePage === 'overview';
    const isCustomers = activePage === 'customers';
    const isAnalytics = activePage === 'analytics';
    const isInventory = activePage === 'inventory';
    const isTransactions = activePage === 'transactions';
    const isHistory = activePage === 'history';

    const sidebarHTML = `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <div class="brand-icon">🛒</div>
                <div>
                    <div class="brand-text">Supermarket BI</div>
                    <div class="brand-sub">Analytics Platform v2.4</div>
                </div>
            </div>
            <nav class="sidebar-nav">
                 <div class="nav-section-label">General</div>
                 <a href="/index.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${activePage === 'index' || activePage === '' ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-upload"></i></span> New Upload
                    </div>
                </a>
                <a href="/pages/history.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isHistory ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-history"></i></span> History
                    </div>
                </a>

                <div class="nav-section-label">Dashboard View</div>
                <a href="/pages/overview.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isOverview ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-th-large"></i></span> Overview
                    </div>
                </a>
                <a href="/pages/customers.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isCustomers ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-users"></i></span> Customers
                        <span class="badge" id="nav-badge-customers" style="display:none">—</span>
                    </div>
                </a>
                <a href="/pages/analytics.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isAnalytics ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-chart-line"></i></span> Analytics
                    </div>
                </a>
                <a href="/pages/inventory.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isInventory ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-box"></i></span> Inventory
                        <span class="badge" id="nav-badge-inventory" style="display:none">—</span>
                    </div>
                </a>
                <a href="/pages/transactions.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isTransactions ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-receipt"></i></span> Transactions
                    </div>
                </a>
            </nav>
            <div class="sidebar-user">
                <div class="user-avatar">AT</div>
                <div>
                    <div class="user-name">Alex Thompson</div>
                    <div class="user-role">Data Analyst</div>
                </div>
            </div>
        </aside>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
}

function renderTopbar(title, subtitle = '') {
    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-title">
                ${title}
                <span class="topbar-sub" id="topbar-filename">${subtitle}</span>
            </div>
            <div class="topbar-actions">
                <div class="search-bar">
                    <i class="fas fa-search" style="font-size:11px;color:var(--text-muted)"></i>
                    <input type="text" placeholder="Search...">
                </div>
                <div class="icon-btn"><i class="fas fa-bell"></i></div>
                <div class="icon-btn"><i class="fas fa-cog"></i></div>
                <a href="/index.html" style="text-decoration:none;">
                    <button class="btn-primary">
                        <i class="fas fa-upload"></i> Import Data
                    </button>
                </a>
            </div>
        </header>
    `;
    
    const mainEl = document.querySelector('main.main');
    if (mainEl) {
        mainEl.insertAdjacentHTML('afterbegin', topbarHTML);
    }
}

// Inicializa layout si está especificado en el body (útil para inyección en load)
document.addEventListener('DOMContentLoaded', () => {
    // Evita inyectar en páginas que ya traigan su header hardcodeado (ej. versiones viejas)
    if (!document.querySelector('.sidebar')) renderSidebar();
});

// --- SHARED HELPERS ---
const SEGMENT_COLORS = {
    'Champions': '#10b981',
    'Promising': '#3b82f6',
    'At Risk': '#f59e0b',
    'Hibernating': '#ef4444'
};
const SEGMENT_CLASS = {
    'Champions': 'seg-champions',
    'Promising': 'seg-promising',
    'At Risk': 'seg-risk',
    'Hibernating': 'seg-hibernating'
};
function fmt(num) {
    if (num == null || num === undefined || num === '' || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (isNaN(n) || !isFinite(n)) return '0';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}
function pct(n) {
    const p = parseFloat(n);
    return (isNaN(p) ? 0 : p * 100).toFixed(1) + '%';
}
function segTag(label) {
    const cls = SEGMENT_CLASS[label] || 'accent';
    return `<span class="pill ${cls}">${label || 'N/A'}</span>`;
}
function churnColor(prob) {
    const p = parseFloat(prob);
    if (p > 0.6) return '#ef4444';
    if (p > 0.3) return '#f59e0b';
    return '#10b981';
}
function invStatusClass(status) {
    if (status === 'Star') return 'inv-status-star';
    if (status === 'Underperformer') return 'inv-status-under';
    return 'inv-status-stable';
}
