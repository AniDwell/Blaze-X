// comment.js - Real-Time Threaded, Episodic, and Notified Bottom-Sheet System

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.formatTimeAgo = window.app.formatTimeAgo || function (timestamp) {
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

window.app.getDefaultAvatarSVG = window.app.getDefaultAvatarSVG || function () {
    return `
        <div class="w-10 h-10 rounded-full border border-white/10 shrink-0 flex items-center justify-center bg-[#111] overflow-hidden shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-gray-400 mt-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        </div>
    `;
};

window.app.getAvatarHtml = window.app.getAvatarHtml || function (url) {
    if (!url || url.includes('placeholder.com') || url.includes('pfp') || url.trim() === '') {
        return window.app.getDefaultAvatarSVG();
    }
    return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md shrink-0">`;
};

window.app.components.comment = async () => {
    // 🚀 FIXED EXTRACTION LOGIC: Prioritizes 'anime' param over 'id' for play.html compatibility
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime') || urlParams.get('id') || window.app.state?.currentAnimePage?.id;

    if (!animeId) {
        if (window.app.showCustomAlert) window.app.showCustomAlert("Cannot load comments: Anime ID missing.", "error");
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    const isGuest = !profile || !profile.uid || profile.uid.startsWith('anon_');

    let sheet = document.getElementById('blazex-comments-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'blazex-comments-sheet';
        sheet.className = 'fixed inset-x-0 bottom-0 z-[100] hidden flex-col justify-end overflow-hidden';
        
        const paperPlaneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

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
                    <button onclick="window.app.closeComments()" class="text-gray-400 hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-times"></i></button>
                </div>
                <div id="comments-list-container" class="flex-1 overflow-y-auto hide-scrollbar p-5 flex flex-col gap-4 relative">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                    </div>
                </div>
                <div class="p-4 border-t border-white/5 bg-[#111] shrink-0 pb-6 md:pb-4">
                    ${isGuest 
                        ? `<div class="w-full text-center py-2"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">You must be logged in to join the discussion.</p><button onclick="window.app.closeComments(); if(window.app.components.auth) window.app.components.auth()" class="bg-[#F47521] text-black px-6 py-2 rounded font-black text-[10px] uppercase shadow-lg hover:bg-white transition-colors">Log In / Register</button></div>`
                        : `<form id="comment-input-form" onsubmit="window.app.submitComment(event)" class="flex gap-3 items-end relative">
                            <input type="hidden" id="reply-to-id" value="">
                            <input type="hidden" id="edit-comment-id" value="">
                            ${window.app.getAvatarHtml(profile?.photoURL || profile?.pfpLink)}
                            <div class="flex-1 bg-black border border-white/10 rounded-xl flex flex-col focus-within:border-[#F47521] transition-colors relative">
                                <textarea id="comment-textarea" rows="1" placeholder="Add a comment..." class="w-full bg-transparent text-white text-xs p-3 outline-none resize-none hide-scrollbar min-h-[44px] max-h-32" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
                                <div id="reply-tag-indicator" class="hidden absolute -top-8 left-0 bg-[#F47521] text-black px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
                                    Replying to <span id="reply-tag-name" class="font-bold border-b border-black/30"></span> 
                                    <button type="button" onclick="window.app.cancelReply()" class="hover:text-white"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                            <button type="submit" id="post-comment-btn" class="bg-[#F47521] text-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:bg-white hover:scale-105 transition-all shadow-lg">${paperPlaneSvg}</button>
                           </form>`
                    }
                </div>
            </div>
        `;
        document.body.appendChild(sheet);
        window.app.initDraggableSheet();
    }

    if (!isGuest) window.app.cancelReply();

    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
    setTimeout(() => {
        document.getElementById('comments-backdrop').classList.remove('opacity-0');
        const panel = document.getElementById('comments-panel');
        panel.style.transition = 'height 0.3s ease-out';
        panel.style.height = '60vh'; 
        window.app.state.commentHeight = 60; 
    }, 10);

    window.app.loadComments(animeId, profile);
};

window.app.initDraggableSheet = () => {
    const panel = document.getElementById('comments-panel');
    const handle = document.getElementById('drag-handle-area');
    let startY = 0; let isDragging = false; let currentHeightVh = 60; 

    const dragStart = (e) => { startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY; isDragging = true; panel.style.transition = 'none'; currentHeightVh = window.app.state.commentHeight || 60; };
    const dragMove = (e) => { if (!isDragging) return; e.preventDefault(); const y = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY; let newHeightVh = currentHeightVh + (((startY - y) / window.innerHeight) * 100); if (newHeightVh > 90) newHeightVh = 90; if (newHeightVh < 0) newHeightVh = 0; panel.style.height = `${newHeightVh}vh`; };
    const dragEnd = () => { if (!isDragging) return; isDragging = false; panel.style.transition = 'height 0.3s ease-out'; const currentVh = parseFloat(panel.style.height); if (currentVh > 75) { window.app.state.commentHeight = 90; panel.style.height = `90vh`; } else if (currentVh > 35) { window.app.state.commentHeight = 60; panel.style.height = `60vh`; } else { window.app.closeComments(); } };
    
    handle.addEventListener('mousedown', dragStart); handle.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('mousemove', dragMove); document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', dragEnd); document.addEventListener('touchend', dragEnd);
};

window.app.closeComments = () => {
    const sheet = document.getElementById('blazex-comments-sheet');
    const panel = document.getElementById('comments-panel');
    if (!sheet) return;
    document.getElementById('comments-backdrop').classList.add('opacity-0');
    panel.style.transition = 'height 0.3s ease-out';
    panel.style.height = '0vh'; 
    setTimeout(() => { 
        sheet.classList.add('hidden'); sheet.classList.remove('flex'); window.app.state.commentHeight = 0; 
        if (window.app.commentsUnsub) { window.app.commentsUnsub(); window.app.commentsUnsub = null; }
    }, 300);
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

// --- GLOBAL LIVE LISTENER ---
window.app.loadComments = async (animeId, profile) => {
    const container = document.getElementById('comments-list-container');
    if (!window.app.db) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-10">Database connection error.</div>`;
        return;
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        // 🚀 ISOLATION APPLIED HERE
        const q = firestore.query(firestore.collection(window.app.db, "comments"), firestore.where("animeId", "==", animeId));
        
        if (window.app.commentsUnsub) window.app.commentsUnsub();

        window.app.commentsUnsub = firestore.onSnapshot(q, (snapshot) => {
            try {
                let comments = [];
                snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

                comments.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                if (comments.length === 0) {
                    container.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-10 opacity-90 h-full animate-fade-in">
                            <img src="https://media.tenor.com/VOoSARm1t7wAAAAm/anime-girl.webp" alt="No Comments" class="w-32 h-32 object-contain mb-4 drop-shadow-xl rounded-xl">
                            <p class="text-xs font-black uppercase tracking-widest text-white mb-1">No comments here</p>
                            <p class="text-[10px] text-gray-500 font-medium">Be the first one to comment!</p>
                        </div>
                    `;
                    return;
                }

                const myUid = profile?.uid || 'guest';
                
                const getDescendantCount = (parentId) => {
                    let count = 0;
                    const children = comments.filter(c => c.replyTo === parentId);
                    count += children.length;
                    children.forEach(child => { count += getDescendantCount(child.id); });
                    return count;
                };
                
                const renderCommentTree = (commentList, parentId = null, depth = 0) => {
                    const safeParentId = parentId || null;
                    const currentLevelComments = commentList.filter(c => (c.replyTo || null) === safeParentId);
                    
                    if (depth === 0) {
                        currentLevelComments.sort((a, b) => {
                            if (a.userId === myUid && b.userId !== myUid) return -1;
                            if (b.userId === myUid && a.userId !== myUid) return 1;
                            return 0; 
                        });
                    } else {
                        currentLevelComments.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
                    }

                    if (currentLevelComments.length === 0) return '';

                    let html = '';
                    currentLevelComments.forEach(comment => {
                        const isMine = comment.userId === myUid;
                        const displayAvatar = isMine ? (profile?.photoURL || profile?.pfpLink || comment.userAvatar) : comment.userAvatar;
                        
                        const safeText = encodeURIComponent(comment.text || "");
                        const escapedTextHtml = (comment.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        
                        const menuOptions = isMine 
                            ? `<button onclick="window.app.editComment('${comment.id}', decodeURIComponent('${safeText}'))" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-pen mr-2"></i> Edit</button>
                               <button onclick="window.app.deleteComment('${comment.id}')" class="w-full text-left px-3 py-2 text-red-400 hover:bg-white/10 hover:text-red-500 transition-colors"><i class="fas fa-trash mr-2"></i> Delete</button>` 
                            : `<button onclick="window.location.href='profile.html?user=${comment.userId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-user mr-2"></i> View Profile</button>
                               <button onclick="window.location.href='cht.html?id=${animeId}'" class="w-full text-left px-3 py-2 text-white hover:bg-white/10 hover:text-[#F47521] transition-colors"><i class="fas fa-comments mr-2"></i> Discuss</button>`;

                        const likesCount = Array.isArray(comment.likes) ? comment.likes.length : 0;
                        const dislikesCount = Array.isArray(comment.dislikes) ? comment.dislikes.length : 0;
                        const hasLiked = Array.isArray(comment.likes) && comment.likes.includes(myUid);
                        const hasDisliked = Array.isArray(comment.dislikes) && comment.dislikes.includes(myUid);
                        
                        const likeColor = hasLiked ? 'text-green-500' : 'text-gray-500 hover:text-green-400';
                        const dislikeColor = hasDisliked ? 'text-red-500' : 'text-gray-500 hover:text-red-400';

                        const marginStyle = depth > 0 ? `margin-left: ${Math.min(depth * 1.5, 3)}rem;` : '';
                        const borderStyle = depth > 0 ? `border-l-2 border-[#F47521]/30 pl-3 mt-3` : `bg-white/5 border border-white/5 p-3 rounded-xl mt-4`;

                        const descendantCount = getDescendantCount(comment.id);
                        const childRepliesHtml = renderCommentTree(commentList, comment.id, depth + 1);

                        let repliesSectionHtml = '';
                        if (childRepliesHtml !== '') {
                            if (depth === 0) {
                                repliesSectionHtml = `
                                    <div class="replies-wrapper hidden flex flex-col w-full mt-1">
                                        ${childRepliesHtml}
                                    </div>
                                    <button onclick="this.previousElementSibling.classList.toggle('hidden'); this.innerHTML = this.previousElementSibling.classList.contains('hidden') ? '<i class=\\'fas fa-chevron-down mr-1\\'></i> View Replies (${descendantCount})' : '<i class=\\'fas fa-chevron-up mr-1\\'></i> Hide Replies'" class="text-[9px] font-bold text-[#F47521] mt-3 ml-1 self-start flex items-center hover:text-white transition-colors">
                                        <i class="fas fa-chevron-down mr-1"></i> View Replies (${descendantCount})
                                    </button>
                                `;
                            } else {
                                repliesSectionHtml = `<div class="flex flex-col w-full mt-1">${childRepliesHtml}</div>`;
                            }
                        }

                        html += `
                            <div class="flex flex-col relative animate-fade-in ${borderStyle}" style="${marginStyle}">
                                <div class="flex gap-3">
                                    ${window.app.getAvatarHtml(displayAvatar)}
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between gap-2">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <span class="bg-white/10 border border-[#F47521]/40 text-[#F47521] text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">EP ${comment.episodeNumber || '1'}</span>
                                                <h4 class="text-white font-bold text-xs truncate">${comment.userName || 'Anonymous'}</h4>
                                                ${isMine ? `<span class="bg-[#F47521] text-black text-[8px] font-black uppercase px-1.5 py-[1px] rounded">You</span>` : ''}
                                                <span class="text-gray-500 text-[9px] whitespace-nowrap hidden sm:inline">${window.app.formatTimeAgo(comment.timestamp)}</span>
                                            </div>
                                            <div class="relative">
                                                <button onclick="window.app.toggleCommentMenu('${comment.id}')" class="menu-trigger-btn text-gray-500 hover:text-white w-6 h-6 flex items-center justify-center transition-colors"><i class="fas fa-ellipsis-v text-[10px]"></i></button>
                                                <div id="menu-${comment.id}" class="comment-action-menu hidden absolute right-0 top-full mt-1 w-32 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden text-[10px] font-bold uppercase tracking-wider">${menuOptions}</div>
                                            </div>
                                        </div>
                                        <p class="text-gray-300 text-[11px] leading-relaxed mt-1 whitespace-pre-wrap break-words">${escapedTextHtml}</p>
                                        
                                        <div class="flex items-center gap-5 mt-2">
                                            <div class="flex items-center gap-3">
                                                <button onclick="window.app.toggleCommentReaction('${comment.id}', 'like')" class="${likeColor} text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"><i class="fas fa-thumbs-up"></i> <span>${likesCount > 0 ? likesCount : ''}</span></button>
                                                <button onclick="window.app.toggleCommentReaction('${comment.id}', 'dislike')" class="${dislikeColor} text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"><i class="fas fa-thumbs-down"></i> <span>${dislikesCount > 0 ? dislikesCount : ''}</span></button>
                                            </div>
                                            <button onclick="window.app.prepareReply('${comment.id}', '${comment.userName}')" class="text-gray-400 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"><i class="fas fa-reply"></i> Reply</button>
                                        </div>
                                    </div>
                                </div>
                                ${repliesSectionHtml}
                            </div>
                        `;
                    });
                    return html;
                };

                container.innerHTML = renderCommentTree(comments, null, 0);

            } catch (err) {
                console.error("Render Loop Error:", err);
            }
        }, (error) => {
            container.innerHTML = `<div class="text-center text-red-500 text-xs py-10">Live sync failed. Check rules.</div>`;
        });

    } catch (e) {
        console.error("Comment Load Error:", e);
    }
};

window.app.prepareReply = (commentId, username) => {
    const input = document.getElementById('comment-textarea');
    const replyIdField = document.getElementById('reply-to-id');
    const tagIndicator = document.getElementById('reply-tag-indicator');
    const tagName = document.getElementById('reply-tag-name');
    replyIdField.value = commentId;
    tagName.innerText = `@${username}`;
    tagIndicator.classList.remove('hidden');
    input.focus();
};

window.app.cancelReply = () => {
    const input = document.getElementById('comment-textarea');
    if(input) input.value = input.value.replace(/@\w+\s?/, '');
    const replyIdField = document.getElementById('reply-to-id');
    if (replyIdField) replyIdField.value = '';
    const tagIndicator = document.getElementById('reply-tag-indicator');
    if (tagIndicator) tagIndicator.classList.add('hidden');
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

window.app.deleteComment = (commentId) => {
    document.getElementById(`menu-${commentId}`).classList.add('hidden');

    if (window.app.showCustomAlert) {
        window.app.showCustomAlert(
            "Are you sure you want to delete this comment?", 
            "error", 
            "Yes, Delete", 
            () => { window.app.performCommentDeletion(commentId); }
        );
    } else {
        if(confirm("Delete this comment permanently?")) {
            window.app.performCommentDeletion(commentId);
        }
    }
};

window.app.performCommentDeletion = async (commentId) => {
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const db = window.app.db;
        const commentRef = firestore.doc(db, "comments", commentId);
        const commentSnap = await firestore.getDoc(commentRef);
        
        if (commentSnap.exists()) {
            const commentData = commentSnap.data();
            if (commentData.replyTo) {
                const parentSnap = await firestore.getDoc(firestore.doc(db, "comments", commentData.replyTo));
                if (parentSnap.exists()) {
                    const parentUid = parentSnap.data().userId;
                    const notifRef = firestore.collection(db, `users/${parentUid}/notifications`);
                    const q = firestore.query(notifRef, firestore.where("commentId", "==", commentId));
                    const notifSnaps = await firestore.getDocs(q);
                    notifSnaps.forEach(async (nDoc) => { await firestore.deleteDoc(nDoc.ref); });
                }
            }
        }
        await firestore.deleteDoc(commentRef);
        if (window.app.showCustomAlert) window.app.showCustomAlert("Comment deleted successfully.", "success");
    } catch(e) {
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to delete comment.", "error");
    }
};

window.app.toggleCommentReaction = async (commentId, type) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
        if(window.app.components.auth) window.app.components.auth();
        return;
    }
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentRef = firestore.doc(window.app.db, "comments", commentId);
        const commentSnap = await firestore.getDoc(commentRef);
        if(!commentSnap.exists()) return;
        
        const data = commentSnap.data();
        let likes = data.likes || [];
        let dislikes = data.dislikes || [];

        if (type === 'like') {
            if (likes.includes(profile.uid)) {
                await firestore.updateDoc(commentRef, { likes: firestore.arrayRemove(profile.uid) });
            } else {
                await firestore.updateDoc(commentRef, { 
                    likes: firestore.arrayUnion(profile.uid),
                    dislikes: firestore.arrayRemove(profile.uid) 
                });
            }
        } else if (type === 'dislike') {
            if (dislikes.includes(profile.uid)) {
                await firestore.updateDoc(commentRef, { dislikes: firestore.arrayRemove(profile.uid) });
            } else {
                await firestore.updateDoc(commentRef, { 
                    dislikes: firestore.arrayUnion(profile.uid),
                    likes: firestore.arrayRemove(profile.uid) 
                });
            }
        }
    } catch (e) {}
};

window.app.submitComment = async (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-textarea');
    const editIdField = document.getElementById('edit-comment-id');
    const replyIdField = document.getElementById('reply-to-id');
    const btn = document.getElementById('post-comment-btn');
    const text = input.value.trim();
    if (!text) return;

    // 🚀 FIXED EXTRACTION LOGIC: Prioritizes 'anime' param over 'id' for play.html compatibility
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime') || urlParams.get('id') || window.app.state?.currentAnimePage?.id;
    const epNum = urlParams.get('ep') || window.app.state?.currentPlayingEpNum || 1;
    
    if (!animeId) {
        if (window.app.showCustomAlert) window.app.showCustomAlert("Error: Cannot find anime ID.", "error");
        return;
    }

    const profile = window.app.state.activeProfile;
    const paperPlaneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i>`;
    input.disabled = true;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");
        const editId = editIdField.value;
        const replyToId = replyIdField.value || null;

        if (editId) {
            await firestore.updateDoc(firestore.doc(window.app.db, "comments", editId), { text: text, isEdited: true });
            editIdField.value = "";
            btn.innerHTML = paperPlaneSvg;
            btn.classList.replace('bg-green-500', 'bg-[#F47521]');
        } else {
            const newCommentRef = await firestore.addDoc(commentsRef, {
                animeId, episodeNumber: epNum, userId: profile.uid,
                userName: profile.displayName || profile.name || "User",
                userAvatar: profile.photoURL || profile.pfpLink || '',
                text, timestamp: firestore.serverTimestamp(), replyTo: replyToId, likes: [], dislikes: []
            });

            if (replyToId) {
                const parentComment = await firestore.getDoc(firestore.doc(window.app.db, "comments", replyToId));
                if (parentComment.exists() && parentComment.data().userId !== profile.uid) {
                    await firestore.addDoc(firestore.collection(window.app.db, `users/${parentComment.data().userId}/notifications`), {
                        type: 'reply', 
                        fromUser: profile.name || "A user", 
                        animeId, 
                        episodeNumber: epNum, 
                        commentId: newCommentRef.id,
                        timestamp: firestore.serverTimestamp(), 
                        read: false
                    });
                }
            }
        }
        input.value = ''; input.style.height = '44px'; input.disabled = false; btn.innerHTML = paperPlaneSvg; btn.classList.remove('bg-green-500'); btn.classList.add('bg-[#F47521]');
        window.app.cancelReply();
    } catch (err) {
        if(window.app.showCustomAlert) window.app.showCustomAlert("Failed to post comment.", "error");
        input.disabled = false; btn.innerHTML = paperPlaneSvg;
    }
};
