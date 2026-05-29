// comment.js - Universal Bottom-Sheet Commenting Engine for Blaze-X

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

    // 1. INJECT THE BOTTOM SHEET HTML IF NOT EXISTS
    let sheet = document.getElementById('blazex-comments-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'blazex-comments-sheet';
        sheet.className = 'fixed inset-0 z-[100] hidden flex-col justify-end';
        sheet.innerHTML = `
            <div id="comments-backdrop" class="absolute inset-0 bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-300" onclick="window.app.closeComments()"></div>
            
            <div id="comments-panel" class="relative bg-[#0a0a0a] w-full md:max-w-2xl md:mx-auto h-[85vh] md:h-[90vh] rounded-t-3xl md:rounded-3xl border border-white/10 flex flex-col transition-transform duration-300 translate-y-full shadow-[0_-10px_40px_rgba(244,117,33,0.1)] md:mb-5">
                
                <div class="w-full flex justify-center py-3 cursor-pointer" onclick="window.app.closeComments()">
                    <div class="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div class="px-5 pb-3 border-b border-white/5 flex items-center justify-between">
                    <h2 class="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <i class="fas fa-comments text-[#F47521]"></i> Community Discussion
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

                <div class="p-4 border-t border-white/5 bg-[#111] rounded-b-3xl">
                    ${isGuest 
                        ? `<div class="w-full text-center py-2"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">You must be logged in to join the discussion.</p><button onclick="window.app.closeComments(); if(window.app.components.auth) window.app.components.auth()" class="bg-[#F47521] text-black px-6 py-2 rounded font-black text-[10px] uppercase shadow-lg">Log In / Register</button></div>`
                        : `<form id="comment-input-form" onsubmit="window.app.submitComment(event)" class="flex gap-3 items-end relative">
                            <input type="hidden" id="edit-comment-id" value="">
                            <img src="${profile?.photoURL || 'https://via.placeholder.com/100/222/fff?text=U'}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md shrink-0">
                            <div class="flex-1 bg-black border border-white/10 rounded-xl flex flex-col focus-within:border-[#F47521] transition-colors relative">
                                <textarea id="comment-textarea" rows="1" placeholder="Add a comment..." class="w-full bg-transparent text-white text-xs p-3 outline-none resize-none hide-scrollbar min-h-[44px] max-h-32" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
                                <div id="reply-tag-indicator" class="hidden absolute -top-8 left-0 bg-[#F47521] text-black px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
                                    Replying to <span id="reply-tag-name"></span> <button type="button" onclick="window.app.cancelReply()" class="hover:text-white"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                            <button type="submit" id="post-comment-btn" class="bg-[#F47521] text-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:bg-white hover:scale-105 transition-all shadow-lg">
                                <i class="fas fa-paper-plane text-xs"></i>
                            </button>
                           </form>`
                    }
                </div>

            </div>
        </div>
        `;
        document.body.appendChild(sheet);
    }

    // 2. OPEN ANIMATION
    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
    setTimeout(() => {
        document.getElementById('comments-backdrop').classList.remove('opacity-0');
        document.getElementById('comments-panel').classList.remove('translate-y-full');
    }, 10);

    // 3. FETCH & RENDER COMMENTS
    window.app.loadComments(animeId, profile);
};

// --- GLOBAL FUNCTIONS ---

window.app.closeComments = () => {
    const sheet = document.getElementById('blazex-comments-sheet');
    if (!sheet) return;
    
    document.getElementById('comments-backdrop').classList.add('opacity-0');
    document.getElementById('comments-panel').classList.add('translate-y-full');
    
    setTimeout(() => {
        sheet.classList.add('hidden');
        sheet.classList.remove('flex');
    }, 300); // Wait for animation to finish
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

// Toggle 3-Dots Menu
window.app.toggleCommentMenu = (commentId) => {
    const menu = document.getElementById(`menu-${commentId}`);
    const isHidden = menu.classList.contains('hidden');
    
    // Close all other menus first
    document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    
    if (isHidden) {
        menu.classList.remove('hidden');
    }
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-trigger-btn') && !e.target.closest('.comment-action-menu')) {
        document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    }
});

// Load Comments from Firestore
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
        snapshot.forEach(doc => {
            comments.push({ id: doc.id, ...doc.data() });
        });

        // Sorting Logic: 
        // 1. Sort by time (newest first)
        // 2. Put Current User's comments at the absolute top
        comments.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        const myUid = profile?.uid || 'guest';
        const myComments = comments.filter(c => c.userId === myUid);
        const otherComments = comments.filter(c => c.userId !== myUid);
        const sortedComments = [...myComments, ...otherComments];

        if (sortedComments.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 opacity-50">
                    <i class="fas fa-ghost text-5xl mb-4 text-gray-600"></i>
                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400">It's quiet here...</p>
                    <p class="text-[10px] text-gray-500 mt-1">Be the first to share your thoughts!</p>
                </div>
            `;
            return;
        }

        let html = '';
        sortedComments.forEach(comment => {
            const isMine = comment.userId === myUid;
            
            // 3-Dots Menu Options based on ownership
            const menuOptions = isMine 
                ? `
                    <button onclick="window.app.editComment('${comment.id}', '${comment.text.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-pen mr-2"></i> Edit</button>
                    <button onclick="window.app.deleteComment('${comment.id}')" class="w-full text-left px-3 py-2 text-red-400 hover:bg-white/10 hover:text-red-500 transition-colors"><i class="fas fa-trash mr-2"></i> Delete</button>
                ` 
                : `
                    <button onclick="window.location.href='profile.html?user=${comment.userId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-user mr-2"></i> View Profile</button>
                    <button onclick="window.location.href='cht.html?user=${comment.userId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-comment-dots mr-2"></i> Discuss</button>
                `;

            html += `
                <div class="flex gap-3 bg-white/5 border border-white/5 p-3 rounded-xl animate-fade-in relative group">
                    <img src="${comment.userAvatar || 'https://via.placeholder.com/100/222/fff?text=U'}" class="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0">
                    
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

// --- ACTION LOGIC ---

window.app.prepareReply = (username) => {
    const input = document.getElementById('comment-textarea');
    input.value = `@${username} ` + input.value;
    input.focus();
};

window.app.editComment = (commentId, text) => {
    const input = document.getElementById('comment-textarea');
    const editIdField = document.getElementById('edit-comment-id');
    const btn = document.getElementById('post-comment-btn');
    
    // Close menu
    document.getElementById(`menu-${commentId}`).classList.add('hidden');
    
    input.value = text;
    editIdField.value = commentId;
    
    // Change Button Icon to Check/Update
    btn.innerHTML = `<i class="fas fa-check text-xs"></i>`;
    btn.classList.replace('bg-[#F47521]', 'bg-green-500');
    
    input.focus();
};

window.app.deleteComment = async (commentId) => {
    if(!confirm("Are you sure you want to delete this comment?")) return;
    
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        await firestore.deleteDoc(firestore.doc(window.app.db, "comments", commentId));
        
        // Refresh
        const urlParams = new URLSearchParams(window.location.search);
        const animeId = urlParams.get('id') || urlParams.get('anime') || window.app.state?.currentAnimePage?.id;
        window.app.loadComments(animeId, window.app.state.activeProfile);
    } catch(e) {
        console.error("Delete Error:", e);
        alert("Failed to delete comment.");
    }
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

    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i>`;
    input.disabled = true;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");

        const editId = editIdField.value;

        if (editId) {
            // UPDATE EXISTING
            const docRef = firestore.doc(window.app.db, "comments", editId);
            await firestore.updateDoc(docRef, { 
                text: text,
                isEdited: true
            });
            
            // Reset Edit State
            editIdField.value = "";
            btn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i>`;
            btn.classList.replace('bg-green-500', 'bg-[#F47521]');
        } else {
            // CREATE NEW
            await firestore.addDoc(commentsRef, {
                animeId: animeId,
                userId: profile.uid,
                userName: profile.displayName || profile.name || "User",
                userAvatar: profile.photoURL || 'https://via.placeholder.com/100/222/fff?text=U',
                text: text,
                timestamp: firestore.serverTimestamp()
            });
        }

        input.value = '';
        input.style.height = '44px'; // Reset height
        input.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i>`;
        
        // Reload comments
        window.app.loadComments(animeId, profile);

    } catch (err) {
        console.error("Post Error:", err);
        alert("Failed to post comment.");
        input.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i>`;
    }
};

