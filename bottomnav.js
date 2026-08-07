// bottomnav.js - Sleek Glassmorphism Bottom Navigation Menu

window.app = window.app || {};
window.app.components = window.app.components || {};

// --- GLOBAL VIEW SWITCHER ---
// Handles routing between the bottom nav tabs
window.app.switchNavView = (targetView) => {
    if (window.app.state.currentView === targetView) return; // Already on this view
    
    window.app.state.currentView = targetView;
    
    // Instantly update the bottom nav UI to reflect the active tab
    if (window.app.components.bottomnav) window.app.components.bottomnav();

    const homeView = document.getElementById('home-view');
    const dynamicView = document.getElementById('dynamic-view');

    if (targetView === 'home') {
        // Route to Home
        if (dynamicView) dynamicView.classList.add('hidden');
        if (homeView) homeView.classList.remove('hidden');
        
        // Re-trigger sliders to ensure they render properly if they were hidden
        if (window.app.renderHome) window.app.renderHome();
    } else {
        // Route to other pages (Placeholder UI for now)
        if (homeView) homeView.classList.add('hidden');
        if (dynamicView) {
            dynamicView.classList.remove('hidden');
            
            // Icon mapping for the placeholder
            const iconMap = {
                'feeds': 'fa-fire',
                'library': 'fa-bookmark',
                'profile': 'fa-user'
            };
            const displayIcon = iconMap[targetView] || 'fa-tools';

            dynamicView.innerHTML = `
                <div class="flex flex-col items-center justify-center h-[75vh] text-center px-6 animate-fade-in">
                    <div class="w-20 h-20 bg-[#111] rounded-full flex items-center justify-center mb-5 border border-white/10 shadow-[0_0_30px_rgba(244,117,33,0.15)] relative">
                        <i class="fas ${displayIcon} text-3xl text-[#F47521]"></i>
                        <div class="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                    </div>
                    <h2 class="text-2xl font-black text-white mb-2 uppercase tracking-wider drop-shadow-md">${targetView}</h2>
                    <p class="text-gray-400 text-sm max-w-[250px] leading-relaxed">This section is currently under construction. Check back soon!</p>
                    
                    <button onclick="window.app.switchNavView('home')" class="mt-8 bg-white/5 border border-white/10 px-6 py-2.5 rounded-lg text-white font-bold text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-black transition-colors">
                        Return Home
                    </button>
                </div>
            `;
        }
    }
};

// --- BOTTOM NAV COMPONENT ---
window.app.components.bottomnav = () => {
    const container = document.getElementById('bottomnav-container');
    if (!container) return;

    // Inject CSS for Mobile Safe Areas and Padding if not present
    if (!document.getElementById('bottomnav-safe-styles')) {
        const style = document.createElement('style');
        style.id = 'bottomnav-safe-styles';
        style.innerHTML = `
            .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
            /* Ensure main content isn't hidden behind the fixed bottom nav */
            #main-content { padding-bottom: calc(70px + env(safe-area-inset-bottom, 16px)) !important; }
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

    // Fixed to bottom, extremely high z-index, glassmorphism background
    container.className = "fixed bottom-0 left-0 w-full z-[999]";
    container.innerHTML = `
        <div class="w-full bg-[#050505]/90 backdrop-blur-xl border-t border-white/10 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div class="flex items-center justify-around h-16 md:h-20 max-w-2xl mx-auto px-2">
                ${navHtml}
            </div>
        </div>
    `;
};
