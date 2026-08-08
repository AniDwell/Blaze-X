// bottomnav.js - Sleek Glassmorphism Bottom Navigation Menu for BlazeX

document.addEventListener("DOMContentLoaded", () => {
    renderBottomNav();
});

function renderBottomNav() {
    // Target the mount point added in your HTML files
    const container = document.getElementById('bottomnav-mount');
    if (!container) return;

    // Inject CSS for Mobile Safe Areas (fixes overlapping on iOS/modern Androids)
    if (!document.getElementById('bottomnav-safe-styles')) {
        const style = document.createElement('style');
        style.id = 'bottomnav-safe-styles';
        style.innerHTML = `
            .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
            /* Pushes body content up so it doesn't hide behind the fixed nav */
            body { padding-bottom: calc(75px + env(safe-area-inset-bottom, 16px)) !important; }
        `;
        document.head.appendChild(style);
    }

    // Auto-detect the active tab based on the current page URL
    const currentPath = window.location.pathname.toLowerCase();
    let currentView = 'home'; // Default
    
    if (currentPath.includes('profile')) currentView = 'profile';
    else if (currentPath.includes('library')) currentView = 'library';
    else if (currentPath.includes('feed')) currentView = 'feeds';

    // Define navigation structure
    const navItems = [
        { id: 'home', icon: 'fas fa-home', label: 'Home', url: 'index.html' },
        { id: 'feeds', icon: 'fas fa-fire', label: 'Feeds', url: 'feeds.html' },
        { id: 'library', icon: 'fas fa-bookmark', label: 'Library', url: 'library.html' },
        { id: 'profile', icon: 'fas fa-user', label: 'Profile', url: 'profile.html' }
    ];

    // Generate HTML for icons
    let navHtml = navItems.map(item => {
        const isActive = currentView === item.id;
        
        // Active vs Inactive styling rules
        const colorClass = isActive ? 'text-[#F47521]' : 'text-gray-500 hover:text-gray-300';
        const iconAnim = isActive ? 'scale-110 -translate-y-1' : '';
        const textWeight = isActive ? 'font-black' : 'font-bold';
        const dotIndicator = isActive ? `<div class="w-1.5 h-1.5 bg-[#F47521] rounded-full absolute -bottom-2 shadow-[0_0_8px_#F47521]"></div>` : '';

        return `
            <a href="${item.url}" class="relative flex flex-col items-center justify-center w-full py-2 ${colorClass} transition-all duration-300 group cursor-pointer decoration-none">
                <i class="${item.icon} text-xl mb-1 transform ${iconAnim} transition-transform duration-300"></i>
                <span class="text-[10px] ${textWeight} tracking-widest uppercase transition-all duration-300">${item.label}</span>
                ${dotIndicator}
            </a>
        `;
    }).join('');

    // Inject the final container with ultra-premium glassmorphism
    container.className = "fixed bottom-0 left-0 w-full z-[999]";
    container.innerHTML = `
        <div class="w-full bg-[#030305]/80 backdrop-blur-2xl border-t border-white/10 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
            <div class="flex items-center justify-around h-16 md:h-20 max-w-2xl mx-auto px-2">
                ${navHtml}
            </div>
        </div>
    `;
}
