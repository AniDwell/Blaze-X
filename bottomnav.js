// bottomnav.js - Sleek Glassmorphism Bottom Navigation Menu

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};

// Determine which page we are currently on based on the URL
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
if (currentPage.includes('index')) window.app.state.currentView = 'home';
else if (currentPage.includes('profile')) window.app.state.currentView = 'profile';
else if (currentPage.includes('library')) window.app.state.currentView = 'library';
else window.app.state.currentView = 'feeds'; // Fallback

// --- GLOBAL VIEW SWITCHER ---
// Handles routing between the separate HTML pages
window.app.switchNavView = (targetView) => {
    if (window.app.state.currentView === targetView) return; // Already on this view
    
    // Multi-page routing logic
    if (targetView === 'home') {
        window.location.href = 'index.html';
    } else if (targetView === 'library') {
        window.location.href = 'library.html';
    } else if (targetView === 'profile') {
        window.location.href = 'profile.html';
    } else {
        // For feeds/other pages you haven't built yet
        alert("This section is under construction!");
    }
};

// --- BOTTOM NAV COMPONENT ---
window.app.components.bottomnav = () => {
    // FIX 1: Look for the correct ID ('bottomnav-mount') used in your HTML
    const container = document.getElementById('bottomnav-mount');
    if (!container) return;

    // Inject CSS for Mobile Safe Areas and Padding if not present
    if (!document.getElementById('bottomnav-safe-styles')) {
        const style = document.createElement('style');
        style.id = 'bottomnav-safe-styles';
        style.innerHTML = `
            .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
            body { padding-bottom: calc(80px + env(safe-area-inset-bottom, 16px)) !important; }
        `;
        document.head.appendChild(style);
    }

    const currentView = window.app.state.currentView || 'home';

    const navItems = [
        { id: 'home', icon: 'fas fa-home', label: 'Home' },
        { id: 'feeds', icon: 'fas fa-fire', label: 'Feeds' },
        { id: 'library', icon: 'fas fa-bookmark', label: 'Library' },
        { id: 'profile', icon: 'fas fa-user', label: 'Profile' }
    ];

    let navHtml = navItems.map(item => {
        const isActive = currentView === item.id;
        
        // Active vs Inactive styling
        const colorClass = isActive ? 'text-[#F47521]' : 'text-gray-500 hover:text-gray-300';
        const iconAnim = isActive ? 'scale-110 -translate-y-1' : '';
        const textWeight = isActive ? 'font-black' : 'font-bold';
        const dotIndicator = isActive ? `<div class="w-1 h-1 bg-[#F47521] rounded-full absolute -bottom-2 shadow-[0_0_5px_#F47521]"></div>` : '';

        return `
            <button onclick="window.app.switchNavView('${item.id}')" class="relative flex flex-col items-center justify-center w-full py-2 ${colorClass} transition-all duration-300 group">
                <i class="${item.icon} text-lg md:text-xl mb-1 transform ${iconAnim} transition-transform duration-300"></i>
                <span class="text-[9px] md:text-[10px] ${textWeight} tracking-widest uppercase transition-all duration-300">${item.label}</span>
                ${dotIndicator}
            </button>
        `;
    }).join('');

    // Set styling and inject the HTML
    container.className = "fixed bottom-0 left-0 w-full z-[999]";
    container.innerHTML = `
        <div class="w-full bg-[#050505]/90 backdrop-blur-xl border-t border-white/10 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div class="flex items-center justify-around h-16 md:h-20 max-w-2xl mx-auto px-2">
                ${navHtml}
            </div>
        </div>
    `;
};

// FIX 2: Automatically render the nav bar as soon as the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app.components.bottomnav();
});
