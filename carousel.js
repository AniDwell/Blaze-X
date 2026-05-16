// header.js

window.app.components.header = () => {
    const container = document.getElementById('header-container');
    if (!container) return;

    const profile = window.app.state.activeProfile;

    // --- SMART PROFILE AVATAR ---
    const avatarHtml = profile && profile.uid 
        ? `<img src="${profile.avatar || window.app.config.defaultAvatars[0]}" class="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-transparent hover:border-[#F47521] transition-all cursor-pointer shadow-lg" onclick="/* window.app.components.profile() */" alt="Profile">`
        : `<div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center cursor-pointer hover:bg-[#F47521] hover:text-white text-gray-300 transition-all border border-white/20 shadow-lg group" onclick="if(window.app.components.auth) { window.app.components.auth(); } else { alert('Please create the auth.js component first!'); }">
             <svg class="w-4 h-4 md:w-5 md:h-5 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
           </div>`;

    container.innerHTML = `
        <header class="w-full z-[80] bg-[#050505] border-b border-white/5 px-4 py-3 md:py-4 md:px-8 flex justify-between items-center" id="main-header-bar">
            
            <div class="flex items-center gap-4">
                <button id="burger-trigger" class="text-white hover:text-[#F47521] transition-colors p-2 -ml-2" onmouseenter="if(window.innerWidth >= 768) window.app.toggleSidebar(true)" onclick="window.app.toggleSidebar(true)">
                    <i class="fas fa-bars text-xl md:text-2xl"></i>
                </button>
                
                <div class="cursor-pointer flex items-center gap-2" onclick="window.location.reload()">
                    <span class="text-[#F47521] font-black text-xl md:text-3xl tracking-tighter drop-shadow-lg">BLAZE<span class="text-white">-X</span></span>
                </div>
            </div>

            <div class="flex items-center gap-4 md:gap-6">
                <button class="text-white hover:text-[#F47521] transition-colors hidden md:block" onclick="/* window.app.components.search() */">
                    <i class="fas fa-search text-xl drop-shadow-md"></i>
                </button>
                ${avatarHtml}
            </div>
        </header>

        <div id="sidebar-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] opacity-0 pointer-events-none transition-opacity duration-300" onclick="window.app.toggleSidebar(false)"></div>
        
        <div id="main-sidebar" class="fixed top-0 left-0 h-full w-64 md:w-72 bg-[#0a0a0a] border-r border-white/10 z-[100] transform -translate-x-full transition-transform duration-300 flex flex-col shadow-2xl" onmouseleave="if(window.innerWidth >= 768) window.app.toggleSidebar(false)">
            
            <div class="p-6 flex items-center justify-between border-b border-white/5">
                <span class="text-[#F47521] font-black text-2xl tracking-tighter">BLAZE<span class="text-white">-X</span></span>
                <button onclick="window.app.toggleSidebar(false)" class="text-gray-400 hover:text-white md:hidden">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto hide-scrollbar py-4 px-3 flex flex-col gap-1">
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-3 mb-2 mt-2">Discover</div>
                ${createSidebarLink('home', 'Home', 'fas fa-home', true)}
                ${createSidebarLink('search', 'Search', 'fas fa-search', false)}
                ${createSidebarLink('popular', 'Trending', 'fas fa-fire', false)}
                ${createSidebarLink('movies', 'Movies', 'fas fa-film', false)}
                ${createSidebarLink('series', 'TV Series', 'fas fa-tv', false)}
                
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-3 mb-2 mt-6">My Space</div>
                ${createSidebarLink('library', 'Library', 'fas fa-bookmark', false)}
                ${createSidebarLink('history', 'Watch History', 'fas fa-history', false)}
                
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-3 mb-2 mt-6">Application</div>
                ${createSidebarLink('settings', 'Settings', 'fas fa-cog', false)}
            </div>
        </div>
    `;
};

function createSidebarLink(view, label, icon, isActive) {
    const activeClass = isActive ? 'bg-[#F47521]/10 text-[#F47521]' : 'text-gray-300 hover:text-white hover:bg-white/5';
    const iconClass = isActive ? 'text-[#F47521]' : 'text-gray-400 group-hover:text-[#F47521]';
    
    return `
        <button onclick="window.app.toggleSidebar(false);" class="w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors group text-left ${activeClass}">
            <i class="${icon} text-lg w-5 text-center transition-colors ${iconClass}"></i>
            <span class="font-medium text-sm tracking-wide">${label}</span>
        </button>
    `;
}

window.app.toggleSidebar = (show) => {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    if (show) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
};
