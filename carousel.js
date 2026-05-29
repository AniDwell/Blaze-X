// comment.js - ADVANCED DISCUSSION & NOTIFICATION ENGINE

window.app = window.app || {};
window.app.components = window.app.components || {};

// Universal Commenting Function
window.app.components.comment = async (animeId, episodeNum = null) => {
    // 1. UI Setup (Same Sheet Logic)
    // ... (Keep the sheet injection logic same as before, just add animeId/episodeNum as params) ...

    window.app.state.currentDiscussion = { animeId, episodeNum };
    window.app.loadComments(animeId, episodeNum);
};

// 2. LOAD COMMENTS (Anime-wide or Episode-specific)
window.app.loadComments = async (animeId, episodeNum = null) => {
    const container = document.getElementById('comments-list-container');
    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    
    let q = firestore.query(
        firestore.collection(window.app.db, "comments"),
        firestore.where("animeId", "==", animeId)
    );

    const snapshot = await firestore.getDocs(q);
    let comments = [];
    snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

    // Sort by timestamp
    comments.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    // Render Logic
    let html = '';
    comments.forEach(comment => {
        // Reply logic: Agar parentId hai toh wo reply hai
        const isReply = comment.parentId ? "ml-10 border-l-2 border-[#F47521]/20 pl-4" : "";
        
        html += `
            <div class="flex gap-3 bg-white/5 p-3 rounded-xl ${isReply}" id="comment-${comment.id}">
                ${window.app.getAvatarHtml(comment.userAvatar)}
                <div class="flex-1">
                    <div class="flex justify-between">
                        <span class="text-[#F47521] text-[10px] font-bold">Ep ${comment.episodeNum || 'Series'}</span>
                        <span class="text-gray-500 text-[9px]">${window.app.formatTimeAgo(comment.timestamp)}</span>
                    </div>
                    <h4 class="text-white text-xs font-bold">${comment.userName}</h4>
                    <p class="text-white text-xs mt-1">${comment.text}</p>
                    <button onclick="window.app.setReply('${comment.id}', '${comment.userName}')" class="text-[9px] text-gray-400 mt-2 hover:text-[#F47521]">Reply</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
};

// 3. SUBMIT COMMENT & NOTIFICATION ENGINE
window.app.submitComment = async (e) => {
    e.preventDefault();
    const text = document.getElementById('comment-textarea').value;
    const parentId = document.getElementById('edit-comment-id').value; // Stores parent comment ID if reply
    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    const profile = window.app.state.activeProfile;
    const animeId = window.app.state.currentDiscussion.animeId;
    const episodeNum = window.app.state.currentDiscussion.episodeNum;

    // Create Comment
    const commentRef = await firestore.addDoc(firestore.collection(window.app.db, "comments"), {
        animeId,
        episodeNum,
        text,
        parentId: parentId || null,
        userId: profile.uid,
        userName: profile.name,
        timestamp: firestore.serverTimestamp()
    });

    // 🚀 NOTIFICATION LOGIC
    if (parentId) {
        // Fetch parent comment owner ID
        const parentDoc = await firestore.getDoc(firestore.doc(window.app.db, "comments", parentId));
        const parentOwnerId = parentDoc.data().userId;

        // Push to Notifications sub-collection
        if (parentOwnerId !== profile.uid) {
            await firestore.addDoc(firestore.collection(window.app.db, "users", parentOwnerId, "notifications"), {
                type: "reply",
                fromUser: profile.name,
                animeId,
                commentId: commentRef.id,
                read: false,
                timestamp: firestore.serverTimestamp()
            });
        }
    }
    window.app.loadComments(animeId, episodeNum);
};
