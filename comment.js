// comment.js - Interactive Draggable Bottom-Sheet Commenting Engine

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.comment = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || urlParams.get('anime') || window.app.state?.currentAnimePage?.id;

    if (!animeId) {
        alert("Cannot load comments: Anime ID missing.");
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    const isGuest = !profile || !profile.uid || profile.uid.startsWith('anon_');

    // Default SVG Profile Avatar Function
    window.app.getDefaultAvatarSVG = () => `
        <div class="w-10 h-10 rounded-full border border-white/10 shrink-0 flex items-center justify-center bg-[#111] overflow-hidden shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-gray-400 mt-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        </div>
    `;

    window.app.getAvatarHtml = (url) => {
        if (!url || url.includes('placeholder.com') || url.includes('pfp') || url.trim() === '') {
            return window.app.getDefaultAvatarSVG();
        }
        return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md shrink-0">`;
    };

    // 1. INJECT THE BOTTOM SHEET HTML
    let sheet = document.getElementById('blazex-comments-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'blazex-comments-sheet';
        sheet.className = 'fixed inset-x-0 bottom-0 z-[100] hidden flex-col justify-end overflow-hidden';
        
        // Clean Straight Paper Plane SVG
        const paperPlaneSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
        `;

        sheet.innerHTML = `
            <div id="comments-backdrop" class="absolute inset-0 bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-300" onclick="window.app.closeComments()"></div>
            
            <div id="comments-panel" class="relative bg-[#0a0a0a] w-full md:max-w-2xl md:mx-auto rounded-t-3xl border-t border-white/10 flex flex-col shadow-[0_-10px_40px_rgba(244,117,33,0.1)] transition-all duration-300 ease-out will-change-[height]" style="height: 0vh;">
                
                <div id="drag-handle-area" class="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing shrink-0 relative z-20">
                    <div class="w-12 h-1.5 bg-white/20 rounded-full pointer-events-none"></div>
                </div>

                <div class="px-5 pb-3 border-b border-white/5 flex items-center justify-between shrink-0">
                    <h2 class="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <i class="fas fa-comments text-[#F47521]"></i> Comments
                    </h2>
                    <button onclick="window.app.closeComments()" class="text-gray-400 hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div id="comments-list-container" class="flex-1 overflow-y-auto hide-scrollbar p-5 flex flex-col gap-4 relative">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                    </div>
                </div>

                <div class="p-4 border-t border-white/5 bg-[#111] shrink-0 pb-6 md:pb-4">
                    ${isGuest 
                        ? `<div class="w-full text-center py-2"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">You must be logged in to join the discussion.</p><button onclick="window.app.closeComments(); if(window.app.components.auth) window.app.components.auth()" class="bg-[#F47521] text-black px-6 py-2 rounded font-black text-[10px] uppercase shadow-lg">Log In / Register</button></div>`
                        : `<form id="comment-input-form" onsubmit="window.app.submitComment(event)" class="flex gap-3 items-end relative">
                            <input type="hidden" id="edit-comment-id" value="">
                            ${window.app.getAvatarHtml(profile?.photoURL || profile?.pfpLink)}
                            <div class="flex-1 bg-black border border-white/10 rounded-xl flex flex-col focus-within:border-[#F47521] transition-colors relative">
                                <textarea id="comment-textarea" rows="1" placeholder="Add a comment..." class="w-full bg-transparent text-white text-xs p-3 outline-none resize-none hide-scrollbar min-h-[44px] max-h-32" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
                                <div id="reply-tag-indicator" class="hidden absolute -top-8 left-0 bg-[#F47521] text-black px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
                                    Replying to <span id="reply-tag-name"></span> <button type="button" onclick="window.app.cancelReply()" class="hover:text-white"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                            <button type="submit" id="post-comment-btn" class="bg-[#F47521] text-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:bg-white hover:scale-105 transition-all shadow-lg">
                                ${paperPlaneSvg}
                            </button>
                           </form>`
                    }
                </div>

            </div>
        `;
        document.body.appendChild(sheet);
        
        // Initialize Drag Logic
        window.app.initDraggableSheet();
    }

    // 2. OPEN ANIMATION TO HALF SCREEN (50vh HEIGHT)
    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
    setTimeout(() => {
        document.getElementById('comments-backdrop').classList.remove('opacity-0');
        const panel = document.getElementById('comments-panel');
        panel.style.transition = 'height 0.3s ease-out';
        panel.style.height = '50vh';
        window.app.state.commentHeight = 50; 
    }, 10);

    // 3. FETCH & RENDER COMMENTS
    window.app.loadComments(animeId, profile);
};

// --- DRAG GESTURE LOGIC FOR SHEET ---
window.app.initDraggableSheet = () => {
    const panel = document.getElementById('comments-panel');
    const handle = document.getElementById('drag-handle-area');
    
    let startY = 0;
    let isDragging = false;
    let currentHeightVh = 50; 

    const dragStart = (e) => {
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        isDragging = true;
        panel.style.transition = 'none'; // Instant drag
        currentHeightVh = window.app.state.commentHeight || 50;
    };

    const dragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); 
        const y = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = startY - y; // Positive when swiping up
        
        const windowHeight = window.innerHeight;
        const deltaVh = (deltaY / windowHeight) * 100;
        
        let newHeightVh = currentHeightVh + deltaVh;
        
        if (newHeightVh > 90) newHeightVh = 90; // Max Full Screen limit
        if (newHeightVh < 0) newHeightVh = 0;   
        
        panel.style.height = `${newHeightVh}vh`;
    };

    const dragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = 'height 0.3s ease-out';
        
        const currentVh = parseFloat(panel.style.height);
        
        if (currentVh > 70) {
            // Dragged high up -> Expand to 90vh
            window.app.state.commentHeight = 90;
            panel.style.height = `90vh`;
        } else if (currentVh > 25) {
            // Dragged to middle -> Snap to 50vh
            window.app.state.commentHeight = 50;
            panel.style.height = `50vh`;
        } else {
            // Dragged too low -> Close
            window.app.closeComments();
        }
    };

    handle.addEventListener('mousedown', dragStart);
    handle.addEventListener('touchstart', dragStart, { passive: false });
    
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
};

// --- GLOBAL FUNCTIONS ---

window.app.closeComments = () => {
    const sheet = document.getElementById('blazex-comments-sheet');
    const panel = document.getElementById('comments-panel');
    if (!sheet) return;
    
    document.getElementById('comments-backdrop').classList.add('opacity-0');
    panel.style.transition = 'height 0.3s ease-out';
    panel.style.height = '0vh'; // Collapse height to 0
    
    setTimeout(() => {
        sheet.classList.add('hidden');
        sheet.classList.remove('flex');
        window.app.state.commentHeight = 0;
    }, 300);
};

window.app.formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

window.app.toggleCommentMenu = (commentId) => {
    const menu = document.getElementById(`menu-${commentId}`);
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    if (isHidden) menu.classList.remove('hidden');
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-trigger-btn') && !e.target.closest('.comment-action-menu')) {
        document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    }
});

window.app.loadComments = async (animeId, profile) => {
    const container = document.getElementById('comments-list-container');
    if (!window.app.db) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-10">Database connection error.</div>`;
        return;
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");
        const q = firestore.query(commentsRef, firestore.where("animeId", "==", animeId));
        
        const snapshot = await firestore.getDocs(q);
        let comments = [];
        snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

        comments.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        const myUid = profile?.uid || 'guest';
        const myComments = comments.filter(c => c.userId === myUid);
        const otherComments = comments.filter(c => c.userId !== myUid);
        const sortedComments = [...myComments, ...otherComments];

        // 🚀 EMPTY STATE WITH GIF
        if (sortedComments.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-90 h-full animate-fade-in">
                    <img src="https://media.tenor.com/VOoSARm1t7wAAAAm/anime-girl.webp" alt="No Comments" class="w-32 h-32 object-contain mb-4 drop-shadow-xl rounded-xl">
                    <p class="text-xs font-black uppercase tracking-widest text-white mb-1">No comments here</p>
                    <p class="text-[10px] text-gray-500 font-medium">Be the first one to comment!</p>
                </div>
            `;
            return;
        }

        let html = '';
        sortedComments.forEach(comment => {
            const isMine = comment.userId === myUid;
            const displayAvatar = isMine ? (profile?.photoURL || profile?.pfpLink || comment.userAvatar) : comment.userAvatar;
            
            const menuOptions = isMine 
                ? `<button onclick="window.app.editComment('${comment.id}', '${comment.text.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-pen mr-2"></i> Edit</button>
                   <button onclick="window.app.deleteComment('${comment.id}')" class="w-full text-left px-3 py-2 text-red-400 hover:bg-white/10 hover:text-red-500 transition-colors"><i class="fas fa-trash mr-2"></i> Delete</button>` 
                : `<button onclick="window.location.href='profile.html?user=${comment.userId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-user mr-2"></i> View Profile</button>
                   <button onclick="window.location.href='cht.html?user=${comment.userId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-comment-dots mr-2"></i> Discuss</button>`;

            html += `
                <div class="flex gap-3 bg-white/5 border border-white/5 p-3 rounded-xl animate-fade-in relative group">
                    ${window.app.getAvatarHtml(displayAvatar)}
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <h4 class="text-white font-bold text-xs truncate">${comment.userName || 'Anonymous'}</h4>
                                ${isMine ? `<span class="bg-[#F47521] text-black text-[8px] font-black uppercase px-1.5 py-[1px] rounded">You</span>` : ''}
                                <span class="text-gray-500 text-[10px] whitespace-nowrap">${window.app.formatTimeAgo(comment.timestamp)}</span>
                            </div>
                            
                            <div class="relative">
                                <button onclick="window.app.toggleCommentMenu('${comment.id}')" class="menu-trigger-btn text-gray-500 hover:text-white w-6 h-6 flex items-center justify-center transition-colors">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="menu-${comment.id}" class="comment-action-menu hidden absolute right-0 top-full mt-1 w-32 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden text-[10px] font-bold uppercase tracking-wider">
                                    ${menuOptions}
                                </div>
                            </div>
                        </div>
                        <p class="text-gray-300 text-xs leading-relaxed mt-1 whitespace-pre-wrap break-words">${comment.text}</p>
                        <div class="flex items-center gap-4 mt-2">
                            <button onclick="window.app.prepareReply('${comment.userName}')" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                                <i class="fas fa-reply"></i> Reply
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("Comment Load Error:", e);
        container.innerHTML = `<div class="text-center text-red-500 text-xs py-10">Failed to load comments.</div>`;
    }
};

window.app.prepareReply = (username) => {
    const input = document.getElementById('comment-textarea');
    input.value = `@${username} ` + input.value;
    input.focus();
};

window.app.cancelReply = () => {
    const input = document.getElementById('comment-textarea');
    input.value = input.value.replace(/@\w+\s?/, '');
    document.getElementById('reply-tag-indicator').classList.add('hidden');
};

window.app.editComment = (commentId, text) => {
    const input = document.getElementById('comment-textarea');
    const editIdField = document.getElementById('edit-comment-id');
    const btn = document.getElementById('post-comment-btn');
    
    document.getElementById(`menu-${commentId}`).classList.add('hidden');
    input.value = text;
    editIdField.value = commentId;
    
    btn.innerHTML = `<i class="fas fa-check text-xs"></i>`;
    btn.classList.replace('bg-[#F47521]', 'bg-green-500');
    input.focus();
};

window.app.deleteComment = async (commentId) => {
    if(!confirm("Delete this comment permanently?")) return;
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        await firestore.deleteDoc(firestore.doc(window.app.db, "comments", commentId));
        
        const urlParams = new URLSearchParams(window.location.search);
        const animeId = urlParams.get('id') || urlParams.get('anime') || window.app.state?.currentAnimePage?.id;
        window.app.loadComments(animeId, window.app.state.activeProfile);
    } catch(e) { alert("Failed to delete comment."); }
};

window.app.submitComment = async (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-textarea');
    const editIdField = document.getElementById('edit-comment-id');
    const btn = document.getElementById('post-comment-btn');
    const text = input.value.trim();
    
    if (!text) return;

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || urlParams.get('anime') || window.app.state?.currentAnimePage?.id;
    const profile = window.app.state.activeProfile;

    const paperPlaneSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `;

    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i>`;
    input.disabled = true;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");
        const editId = editIdField.value;

        if (editId) {
            const docRef = firestore.doc(window.app.db, "comments", editId);
            await firestore.updateDoc(docRef, { text: text, isEdited: true });
            
            editIdField.value = "";
            btn.innerHTML = paperPlaneSvg;
            btn.classList.replace('bg-green-500', 'bg-[#F47521]');
        } else {
            await firestore.addDoc(commentsRef, {
                animeId: animeId,
                userId: profile.uid,
                userName: profile.displayName || profile.name || "User",
                userAvatar: profile.photoURL || profile.pfpLink || '',
                text: text,
                timestamp: firestore.serverTimestamp()
            });
        }

        input.value = '';
        input.style.height = '44px'; 
        input.disabled = false;
        btn.innerHTML = paperPlaneSvg;
        
        window.app.loadComments(animeId, profile);

    } catch (err) {
        alert("Failed to post comment.");
        input.disabled = false;
        btn.innerHTML = paperPlaneSvg;
    }
};
