// commentsss.js - Inline Real-Time Comment Section Engine

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.commentsss = async () => {
    const root = document.getElementById('comments-section-root');
    if (!root) return;

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id') || urlParams.get('anime') || window.app.state?.currentAnimePage?.id;

    if (!animeId) {
        root.innerHTML = `<div class="text-center text-gray-500 text-xs py-10 w-full">Cannot load comments: Missing ID.</div>`;
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    const isGuest = !profile || !profile.uid || profile.uid.startsWith('anon_');

    // Default SVG Avatar (Fallback for users without PFP)
    if (!window.app.getAvatarHtml) {
        window.app.getAvatarHtml = (url) => {
            if (!url || url.includes('placeholder.com') || url.includes('pfp') || url.trim() === '') {
                return `
                    <div class="w-10 h-10 rounded-full border border-white/10 shrink-0 flex items-center justify-center bg-[#111] overflow-hidden shadow-md">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-gray-400 mt-2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                `;
            }
            return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md shrink-0">`;
        };
    }

    // Straight Paper Plane SVG
    const paperPlaneSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    `;

    // 1. RENDER INLINE SHELL (List Area + Input Area)
    root.innerHTML = `
        <div class="w-full flex flex-col min-h-[300px] max-h-[600px] bg-transparent">
            
            <div id="inline-comments-list" class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-4 relative bg-[#0a0a0a] rounded-t-xl border-b border-white/5">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                </div>
            </div>

            <div class="p-4 bg-[#111] rounded-b-xl border-t-0 shrink-0">
                ${isGuest 
                    ? `<div class="w-full text-center py-2"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Join the conversation</p><button onclick="if(window.app.components.auth) window.app.components.auth()" class="bg-[#F47521] text-black px-6 py-2 rounded font-black text-[10px] uppercase shadow-lg hover:bg-white transition-colors">Log In / Register</button></div>`
                    : `<form id="inline-comment-form" onsubmit="window.app.submitInlineComment(event)" class="flex gap-3 items-end relative">
                        <input type="hidden" id="inline-edit-comment-id" value="">
                        ${window.app.getAvatarHtml(profile?.photoURL || profile?.pfpLink)}
                        <div class="flex-1 bg-black border border-white/10 rounded-xl flex flex-col focus-within:border-[#F47521] transition-colors relative">
                            <textarea id="inline-comment-textarea" rows="1" placeholder="Write a comment..." class="w-full bg-transparent text-white text-xs p-3 outline-none resize-none hide-scrollbar min-h-[44px] max-h-32" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
                            <div id="inline-reply-tag-indicator" class="hidden absolute -top-8 left-0 bg-[#F47521] text-black px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
                                Replying to <span id="inline-reply-tag-name"></span> <button type="button" onclick="window.app.cancelInlineReply()" class="hover:text-white"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                        <button type="submit" id="inline-post-comment-btn" class="bg-[#F47521] text-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:bg-white hover:scale-105 transition-all shadow-lg">
                            ${paperPlaneSvg}
                        </button>
                       </form>`
                }
            </div>

        </div>
    `;

    // 2. FETCH & RENDER COMMENTS (LIVE LISTENER)
    if (!window.app.db) {
        document.getElementById('inline-comments-list').innerHTML = `<div class="text-center text-gray-500 text-xs py-10 w-full">Database connection error.</div>`;
        return;
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");
        const q = firestore.query(commentsRef, firestore.where("animeId", "==", animeId));

        // Cleanup existing listener if re-rendering
        if (window.app.inlineCommentsUnsub) window.app.inlineCommentsUnsub();

        window.app.inlineCommentsUnsub = firestore.onSnapshot(q, (snapshot) => {
            let comments = [];
            snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

            comments.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            
            const myUid = profile?.uid || 'guest';
            const myComments = comments.filter(c => c.userId === myUid);
            const otherComments = comments.filter(c => c.userId !== myUid);
            
            // Priority: Your comments at the top, then others
            const sortedComments = [...myComments, ...otherComments];

            const listContainer = document.getElementById('inline-comments-list');
            
            if (sortedComments.length === 0) {
                listContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 opacity-90 h-full animate-fade-in w-full">
                        <img src="https://media.tenor.com/VOoSARm1t7wAAAAm/anime-girl.webp" alt="No Comments" class="w-28 h-28 object-contain mb-3 drop-shadow-xl rounded-xl">
                        <p class="text-[10px] font-black uppercase tracking-widest text-white mb-1">No comments here</p>
                        <p class="text-[9px] text-gray-500 font-medium">Be the first one to comment!</p>
                    </div>
                `;
                return;
            }

            let html = '';
            sortedComments.forEach(comment => {
                const isMine = comment.userId === myUid;
                const displayAvatar = isMine ? (profile?.photoURL || profile?.pfpLink || comment.userAvatar) : comment.userAvatar;
                
                const menuOptions = isMine 
                    ? `<button onclick="window.app.editInlineComment('${comment.id}', '${comment.text.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-pen mr-2"></i> Edit</button>
                       <button onclick="window.app.deleteInlineComment('${comment.id}')" class="w-full text-left px-3 py-2 text-red-400 hover:bg-white/10 hover:text-red-500 transition-colors"><i class="fas fa-trash mr-2"></i> Delete</button>` 
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
                                    <span class="text-gray-500 text-[9px] whitespace-nowrap">${window.app.formatTimeAgo ? window.app.formatTimeAgo(comment.timestamp) : 'Recently'}</span>
                                </div>
                                
                                <div class="relative">
                                    <button onclick="window.app.toggleInlineCommentMenu('${comment.id}')" class="menu-trigger-btn text-gray-500 hover:text-white w-6 h-6 flex items-center justify-center transition-colors">
                                        <i class="fas fa-ellipsis-v text-[10px]"></i>
                                    </button>
                                    <div id="inline-menu-${comment.id}" class="comment-action-menu hidden absolute right-0 top-full mt-1 w-28 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden text-[10px] font-bold uppercase tracking-wider">
                                        ${menuOptions}
                                    </div>
                                </div>
                            </div>
                            <p class="text-gray-300 text-[11px] leading-relaxed mt-1 whitespace-pre-wrap break-words">${comment.text}</p>
                            <div class="flex items-center gap-4 mt-2">
                                <button onclick="window.app.prepareInlineReply('${comment.userName}')" class="text-gray-500 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                                    <i class="fas fa-reply"></i> Reply
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
            
        }, (error) => {
            console.error("Inline Comments Snapshot Error:", error);
        });

    } catch (e) {
        console.error("Comment Load Error:", e);
        document.getElementById('inline-comments-list').innerHTML = `<div class="text-center text-red-500 text-xs py-10 w-full">Failed to load comments.</div>`;
    }
};

// --- ACTION LOGIC FOR INLINE SECTION ---

window.app.toggleInlineCommentMenu = (commentId) => {
    const menu = document.getElementById(`inline-menu-${commentId}`);
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    if (isHidden) menu.classList.remove('hidden');
};

window.app.prepareInlineReply = (username) => {
    const input = document.getElementById('inline-comment-textarea');
    input.value = `@${username} ` + input.value;
    input.focus();
};

window.app.cancelInlineReply = () => {
    const input = document.getElementById('inline-comment-textarea');
    input.value = input.value.replace(/@\w+\s?/, '');
    document.getElementById('inline-reply-tag-indicator').classList.add('hidden');
};

window.app.editInlineComment = (commentId, text) => {
    const input = document.getElementById('inline-comment-textarea');
    const editIdField = document.getElementById('inline-edit-comment-id');
    const btn = document.getElementById('inline-post-comment-btn');
    
    document.getElementById(`inline-menu-${commentId}`).classList.add('hidden');
    input.value = text;
    editIdField.value = commentId;
    
    btn.innerHTML = `<i class="fas fa-check text-xs"></i>`;
    btn.classList.replace('bg-[#F47521]', 'bg-green-500');
    input.focus();
};

window.app.deleteInlineComment = async (commentId) => {
    if(!confirm("Delete this comment permanently?")) return;
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        await firestore.deleteDoc(firestore.doc(window.app.db, "comments", commentId));
    } catch(e) { 
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to delete comment.", "error"); 
    }
};

window.app.submitInlineComment = async (e) => {
    e.preventDefault();
    const input = document.getElementById('inline-comment-textarea');
    const editIdField = document.getElementById('inline-edit-comment-id');
    const btn = document.getElementById('inline-post-comment-btn');
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
        
        // No need to manually reload, onSnapshot will trigger auto-update!

    } catch (err) {
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to post comment.", "error");
        input.disabled = false;
        btn.innerHTML = paperPlaneSvg;
    }
};

// Event listener for closing menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-trigger-btn') && !e.target.closest('.comment-action-menu')) {
        document.querySelectorAll('.comment-action-menu').forEach(m => m.classList.add('hidden'));
    }
});
