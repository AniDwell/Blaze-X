// comment.js - Threaded, Episodic, and Notified System

window.app.submitComment = async (e, replyToId = null, parentUserName = null) => {
    e.preventDefault();
    const input = document.getElementById('comment-textarea');
    const btn = document.getElementById('post-comment-btn');
    const text = input.value.trim();
    
    if (!text) return;

    const animeId = window.app.state?.currentAnimePage?.id;
    const epNum = window.app.state?.currentPlayingEpNum || 1;
    const profile = window.app.state.activeProfile;

    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
    
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const commentsRef = firestore.collection(window.app.db, "comments");
        
        const commentData = {
            animeId,
            episodeNumber: epNum, // Locked to this episode
            userId: profile.uid,
            userName: profile.name,
            userAvatar: profile.pfpLink,
            text,
            timestamp: firestore.serverTimestamp(),
            replyTo: replyToId, // Agar reply hai toh parent ID
            likes: [],
            dislikes: []
        };

        const docRef = await firestore.addDoc(commentsRef, commentData);

        // 🚀 NOTIFICATION SYSTEM: Notify parent user if it's a reply
        if (replyToId) {
            const parentComment = await firestore.getDoc(firestore.doc(window.app.db, "comments", replyToId));
            const parentUid = parentComment.data().userId;
            
            if (parentUid !== profile.uid) {
                const notifRef = firestore.collection(window.app.db, `users/${parentUid}/notifications`);
                await firestore.addDoc(notifRef, {
                    type: 'reply',
                    fromUser: profile.name,
                    animeId,
                    episodeNumber: epNum,
                    timestamp: firestore.serverTimestamp(),
                    read: false
                });
            }
        }

        input.value = '';
        window.app.loadComments(animeId, profile);
    } catch (err) {
        alert("Failed to post.");
    } finally {
        btn.innerHTML = 'Post';
    }
};

// --- RENDER THREADED COMMENTS ---
window.app.loadComments = async (animeId, profile) => {
    const container = document.getElementById('comments-list-container');
    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    
    // Fetch all comments for this anime (series-wide)
    const q = firestore.query(firestore.collection(window.app.db, "comments"), firestore.where("animeId", "==", animeId));
    const snapshot = await firestore.getDocs(q);
    
    let comments = [];
    snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

    // Grouping into Threaded structure
    const rootComments = comments.filter(c => !c.replyTo);
    
    const renderComment = (comment, depth = 0) => {
        const replies = comments.filter(c => c.replyTo === comment.id);
        const hasReplies = replies.length > 0;
        
        return `
            <div class="flex flex-col ml-${depth * 4} border-l-2 border-white/10 pl-3 mt-2">
                <div class="flex gap-3 bg-white/5 p-3 rounded-lg">
                    <img src="${comment.userAvatar}" class="w-8 h-8 rounded-full">
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <span class="text-[10px] font-bold text-[#F47521]">EP ${comment.episodeNumber}</span>
                            <span class="text-[10px] text-gray-400">${comment.userName}</span>
                        </div>
                        <p class="text-xs text-white">${comment.text}</p>
                        <div class="flex gap-3 mt-1">
                            <button onclick="window.app.toggleLike('${comment.id}', 'likes')" class="text-[9px] text-gray-500">Like (${comment.likes.length})</button>
                            <button onclick="window.app.prepareReply('${comment.id}', '${comment.userName}')" class="text-[9px] text-gray-500">Reply</button>
                        </div>
                    </div>
                </div>
                ${hasReplies ? `<div class="replies-wrapper hidden">${replies.map(r => renderComment(r, depth + 1)).join('')}</div>
                                <button onclick="this.previousElementSibling.classList.toggle('hidden')" class="text-[9px] text-[#F47521] mt-1 ml-4">Show/Hide Replies</button>` : ''}
            </div>
        `;
    };

    container.innerHTML = rootComments.map(c => renderComment(c)).join('');
};
