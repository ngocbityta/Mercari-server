import { renderSidebar } from './components/sidebar.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderUsers } from './pages/users.js';
import { renderUserDetail } from './pages/user-detail.js';
import { renderPosts } from './pages/posts.js';
import { renderPostDetail } from './pages/post-detail.js';

const routes = {
    '#/login': renderLogin,
    '#/': renderDashboard,
    '#/users': renderUsers,
};

function getRoute() {
    let hash = window.location.hash || '#/';
    
    // Handle dynamic routes like #/users/123
    if (hash.startsWith('#/users/') && hash.split('/').length === 3) {
        return { path: '#/users/:id', param: hash.split('/')[2] };
    }
    if (hash.startsWith('#/posts/') && hash.split('/').length === 3) {
        return { path: '#/posts/:id', param: hash.split('/')[2] };
    }
    
    return { path: hash, param: null };
}

async function router() {
    const { path, param } = getRoute();
    const appContainer = document.getElementById('app');
    
    // Check Auth
    const token = localStorage.getItem('admin_token');
    if (!token && path !== '#/login') {
        window.location.hash = '#/login';
        return;
    }
    
    if (token && path === '#/login') {
        window.location.hash = '#/';
        return;
    }

    // Render App Shell if not login
    if (path !== '#/login') {
        appContainer.innerHTML = `
            ${renderSidebar(path)}
            <div class="main-wrapper">
                <div class="topbar">
                    <div class="breadcrumb" id="breadcrumb">
                        <!-- Injected by page -->
                    </div>
                    <div class="topbar-actions">
                        <button class="action-icon-btn has-notification">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="main-content" id="main-content">
                    <!-- Page content injected here -->
                </div>
            </div>
        `;
        
        // Setup sidebar active state and logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.hash = '#/login';
        });
        
        // Execute page render logic
        const contentContainer = document.getElementById('main-content');
        
        // Match route
        let routeFunc = routes[path];
        if (path === '#/users/:id') routeFunc = renderUserDetail;
        else if (path === '#/posts') routeFunc = renderPosts;
        else if (path === '#/posts/:id') routeFunc = renderPostDetail;
        else if (path === '#/courses') {
            const { renderCourses } = await import('./pages/courses.js');
            routeFunc = renderCourses;
        }

        if (routeFunc) {
            await routeFunc(contentContainer, param);
        } else {
            contentContainer.innerHTML = '<h2>404 - Not Found</h2>';
        }
    } else {
        // Render Login page directly in #app
        appContainer.innerHTML = '';
        await renderLogin(appContainer);
    }
}

// Listen to hash changes
window.addEventListener('hashchange', router);

// Load on start
router();
