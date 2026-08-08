import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collectionGroup, onSnapshot, query, where, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// --- POPUP UI MANAGER ---
class NotificationManager {
    constructor() {
        this.containerId = 'blazex-notification-container';
        this.initContainer();
    }

    initContainer() {
        if (!document.getElementById(this.containerId)) {
            const container = document.createElement('div');
            container.id = this.containerId;
            // Fixed at top, pointer-events-none so it doesn't block clicks when empty
            container.className = 'fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex flex-col items-center p-4 gap-3 overflow-hidden';
            document.body.appendChild(container);
        }
    }

    show(senderId, senderName, senderPfp, messageText) {
        // Prevent showing popup if the user is currently in the chat room with this person
        if (window.targetUserId === senderId) return;

        const container = document.getElementById(this.containerId);
        
        // Create popup element
        const popup = document.createElement('div');
        // Re-enable pointer events for the popup itself so it can be clicked
        popup.className = `
            pointer-events-auto w-full max-w-sm bg-[#111]/95 backdrop-blur-md border border-white/10 
            rounded-2xl p-3 shadow-2xl flex items-center gap-3 cursor-pointer 
            transform transition-all duration-300 ease-out translate-y-[-120%] opacity-0
        `;

        // Default PFP if none is provided
        const pfpSrc = senderPfp || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=111&color=F47521`;

        // Format message text (truncate if too long, or show "Sent an image" if it's an image)
        const displayMessage = messageText ? messageText : '📷 Sent an image';

        popup.innerHTML = `
            <img src="${pfpSrc}" class="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0" alt="${senderName}">
            <div class="flex-1 min-w-0 flex flex-col justify-center">
                <h4 class="text-white text-sm font-bold truncate leading-tight mb-0.5">${senderName}</h4>
                <p class="text-gray-400 text-xs truncate leading-tight">${displayMessage}</p>
            </div>
            <div class="shrink-0 w-2 h-2 rounded-full bg-[#F47521] mr-1 shadow-[0_0_8px_#F47521]"></div>
        `;

        // Click event to navigate to chat
        popup.onclick = () => {
            const currentUserId = getAuth().currentUser?.uid;
            if (currentUserId) {
                window.location.href = `/chat.html?userA=${currentUserId}&userB=${senderId}`;
            }
        };

        container.prepend(popup);

        // Animate In
        requestAnimationFrame(() => {
            popup.classList.remove('translate-y-[-120%]', 'opacity-0');
            popup.classList.add('translate-y-0', 'opacity-100');
        });

        // Haptic Feedback (if supported by mobile device)
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Auto Remove after 4 seconds
        setTimeout(() => {
            popup.classList.remove('translate-y-0', 'opacity-100');
            popup.classList.add('translate-y-[-120%]', 'opacity-0');
            
            // Remove from DOM after animation completes
            setTimeout(() => popup.remove(), 300);
        }, 4000);
    }
}

const notifier = new NotificationManager();

// --- FIREBASE LISTENER ---
// Initialize this in your global layout/app file so it runs everywhere
export function initializeGlobalNotifications(app) {
    const auth = getAuth(app);
    const db = getFirestore(app);
    let isInitialLoad = true;
    let unsubscribe = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Listen to all messages across all chats using a Collection Group query
            // Note: You may need to create a Firestore index for this query to work.
            const messagesQuery = query(
                collectionGroup(db, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    // Only trigger on NEW messages added after the initial load
                    if (change.type === 'added' && !isInitialLoad) {
                        const msgData = change.doc.data();
                        
                        // Check if the message is NOT from the current user
                        if (msgData.senderId && msgData.senderId !== user.uid) {
                            
                            // Get the Chat Room ID from the document reference path
                            // Path is usually: chats/{chatRoomId}/messages/{messageId}
                            const chatRoomId = change.doc.ref.parent.parent.id;
                            
                            // Check if the current user is part of this chat room
                            if (chatRoomId.includes(user.uid)) {
                                
                                // Fetch sender's profile info
                                try {
                                    const senderDoc = await getDoc(doc(db, "users", msgData.senderId));
                                    if (senderDoc.exists()) {
                                        const senderData = senderDoc.data();
                                        notifier.show(
                                            msgData.senderId, 
                                            senderData.username || "User", 
                                            senderData.photoURL || null, 
                                            msgData.text
                                        );
                                    }
                                } catch (error) {
                                    console.error("Error fetching sender profile for notification:", error);
                                }
                            }
                        }
                    }
                });
                
                // After first fetch, flag initial load as false so new messages trigger popups
                if (isInitialLoad) {
                    setTimeout(() => isInitialLoad = false, 1000);
                }
            });
        } else {
            // Stop listening if user logs out
            if (unsubscribe) unsubscribe();
            isInitialLoad = true;
        }
    });
}

// Expose manual trigger to window for testing or custom implementations
window.showBlazeXNotification = (senderId, name, pfp, text) => {
    notifier.show(senderId, name, pfp, text);
};
