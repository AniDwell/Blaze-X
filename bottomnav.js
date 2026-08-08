// bottomnav.js - Sleek Glassmorphism Bottom Navigation Menu (Multi-Page Linked Version)

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.bottomnav = () => {
    // Targeting 'bottomnav-mount' exactly as it is written in your HTML
    const container = document.getElementById('bottomnav-container');
    if (!container) return;

    // Inject CSS for Mobile Safe Areas and Padding if not present
    if (!document.getElementById('bottomnav-safe-styles')) {
        const style = document.createElement('style');
        style.id = 'bottomnav-safe-styles';
        style.innerHTML = `
            .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
            /* Ensure main content isn't hidden behind the fixed bottom nav */
            body { padding-bottom: calc(80px + env(safe-area-inset-bottom, 16px)) !important; }
        `;
        document.head.appendChild(style);
    }

    // Auto-detect the current page URL to highlight the correct active icon
    const currentPath = window.location.pathname.split('/').pop().toLowerCase();
    let activeTab = 'home'; // Default fallback
    
    if (currentPath.includes('profile')) activeTab = 'profile';
    else if (currentPath.includes('library')) activeTab = 'library';
    else if (currentPath.includes('feed')) activeTab = 'feeds';
    else if (currentPath.includes('index') || currentPath === '') activeTab = 'home';

    // The actual links to your HTML files
    const navItems = [
        { id: 'home', icon: 'fas fa-home', label: 'Home', link: 'index.html' },
        { id: 'feeds', icon: 'fas fa-fire', label: 'Feeds', link: 'feeds.html' },
        { id: 'library', icon: 'fas fa-bookmark', label: 'Library', link: 'library.html' },
        { id: 'profile', icon: 'fas fa-user', label: 'Profile', link: 'profile.html' }
    ];

    let navHtml = navItems.map(item => {
        const isActive = activeTab === item.id;
        
        // Active vs Inactive styling
        const colorClass = isActive ? 'text-[#F47521]' : 'text-gray-500 hover:text-gray-300';
        const iconAnim = isActive ? 'scale-110 -translate-y-1' : '';
        const textWeight = isActive ? 'font-black' : 'font-bold';
        const dotIndicator = isActive ? `<div class="w-1 h-1 bg-[#F47521] rounded-full absolute -bottom-2 shadow-[0_0_5px_#F47521]"></div>` : '';

        // Changed from <button onclick="..."> to actual <a href="..."> links
        return `
            <a href="${item.link}" class="relative flex flex-col items-center justify-center w-full py-2 ${colorClass} transition-all duration-300 group cursor-pointer" style="text-decoration: none;">
                <i class="${item.icon} text-lg md:text-xl mb-1 transform ${iconAnim} transition-transform duration-300"></i>
                <span class="text-[9px] md:text-[10px] ${textWeight} tracking-widest uppercase transition-all duration-300">${item.label}</span>
                ${dotIndicator}
            </a>
        `;
    }).join('');

    // Apply fixed positioning and glassmorphism styling to the mount container
    container.className = "fixed bottom-0 left-0 w-full z-[999]";
    container.innerHTML = `
        <div class="w-full bg-[#050505]/90 backdrop-blur-xl border-t border-white/10 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div class="flex items-center justify-around h-16 md:h-20 max-w-2xl mx-auto px-2">
                ${navHtml}
            </div>
        </div>
    `;
};

// --- AUTO INITIALIZATION ---
// This ensures the bottom nav renders instantly as soon as the script loads,
// so you don't need to add any inline <script> tags to your HTML files.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.app.components.bottomnav());
} else {
    window.app.components.bottomnav();
}
