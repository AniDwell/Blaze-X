// auth.js

// --- CUSTOM CSS ALERT SYSTEM ---
window.app.showCustomAlert = (message, type = 'error', actionText = null, actionCallback = null) => {
    const existing = document.getElementById('custom-toast-alert');
    if (existing) existing.remove();

    const bgColor = type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-green-500/10 border-green-500/30 text-green-400';
    const icon = type === 'error' ? '<i class="fas fa-exclamation-circle text-lg"></i>' : '<i class="fas fa-check-circle text-lg"></i>';
    
    let actionBtn = '';
    if (actionText && actionCallback) {
        window._tempAlertCallback = () => {
            actionCallback();
            document.getElementById('custom-toast-alert')?.remove();
        };
        actionBtn = `<button onclick="window._tempAlertCallback()" class="mt-2 w-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest py-1.5 rounded transition-colors">${actionText}</button>`;
    }

    const alertHtml = `
        <div id="custom-toast-alert" class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm ${bgColor} border backdrop-blur-md rounded-lg p-4 shadow-2xl flex flex-col transform translate-y-[-20px] opacity-0 transition-all duration-300">
            <div class="flex items-center gap-3">
                ${icon}
                <p class="text-xs md:text-sm font-bold leading-tight flex-1">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-white transition-colors ml-2"><i class="fas fa-times"></i></button>
            </div>
            ${actionBtn}
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    setTimeout(() => {
        const toast = document.getElementById('custom-toast-alert');
        if(toast) {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }
    }, 10);

    if (!actionText) {
        setTimeout(() => {
            const toast = document.getElementById('custom-toast-alert');
            if(toast) {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-[-20px]', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
};

// --- AUTHENTICATION MODAL ENGINE ---
window.app.components.auth = () => {
    if (window.app.state && window.app.state.activeProfile && window.app.state.activeProfile.uid && !window.app.state.activeProfile.uid.startsWith('anon_')) {
        window.location.href = 'profile.html';
        return;
    }

    const existingModal = document.getElementById('auth-modal');
    if (existingModal) existingModal.remove();

    window.app.state.authSelectedPfp = `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`;

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 opacity-0 transition-opacity duration-300';
    
    const customStyles = `
        <style>
            .thought-bubble::after {
                content: ''; position: absolute; bottom: -5px; left: 20px;
                border-width: 6px 6px 0; border-style: solid; border-color: #ffffff transparent transparent transparent;
            }
        </style>
    `;

    modal.innerHTML = `
        ${customStyles}
        <div class="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] mt-20 md:mt-28 transform scale-95 transition-transform duration-300" id="auth-modal-box">
            
            <div class="absolute -top-24 left-0 md:-top-32 md:-left-4 z-50 flex items-end pointer-events-none">
                <img src="https://media.tenor.com/fYOO8YHxJsUAAAAi/genshin-impact-furina.gif" class="w-28 h-28 md:w-36 md:h-36 object-contain">
                <div class="thought-bubble relative bg-white text-black font-black text-[9px] md:text-[10px] px-3 py-1.5 rounded-xl mb-12 -ml-3 shadow-[0_4px_10px_rgba(0,0,0,0.5)] uppercase tracking-wider">
                    Please Login!
                </div>
            </div>

            <button onclick="window.app.closeAuthModal()" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20">
                <i class="fas fa-times text-xl"></i>
            </button>

            <div class="text-center pt-10 pb-6 flex flex-col items-center justify-center">
                <div class="flex items-center justify-center gap-3 text-2xl font-black text-white tracking-tight">
                    Welcome to <img src="logo.png" class="h-8 md:h-10 object-contain pointer-events-none">
                </div>
            </div>

            <div id="auth-tabs" class="flex border-b border-white/10 text-xs font-bold uppercase tracking-widest px-6">
                <button onclick="window.app.switchAuthView('login')" id="tab-login" class="flex-1 pb-3 text-white border-b-2 border-[#F47521] transition-colors">Sign In</button>
                <button onclick="window.app.switchAuthView('register')" id="tab-register" class="flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors">Sign Up</button>
            </div>

            <div class="p-6 md:p-8">
                
                <form id="view-login" class="flex flex-col gap-4" onsubmit="window.app.handleLogin(event)">
                    <div class="relative">
                        <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="email" id="login-email" placeholder="Email Address" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="relative">
                        <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="password" id="login-password" placeholder="Password" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="flex justify-end">
                        <button type="button" onclick="window.app.switchAuthView('forgot')" class="text-[10px] text-gray-400 hover:text-[#F47521] font-bold uppercase tracking-wider transition-colors">Forgot Password?</button>
                    </div>
                    <button type="submit" id="btn-login" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-lg mt-2">Sign In</button>
                </form>

                <form id="view-register" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleRegister(event)">
                    <div class="flex justify-center mb-1">
                        <div class="relative cursor-pointer group" onclick="document.getElementById('pfp-upload-input').click()">
                            <img id="register-pfp-preview" src="${window.app.state.authSelectedPfp}" class="w-16 h-16 rounded-full object-cover border-2 border-white/10 group-hover:border-[#F47521] transition-colors shadow-lg">
                            <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-camera text-white text-sm"></i>
                            </div>
                        </div>
                        <input type="file" id="pfp-upload-input" accept="image/*" class="hidden" onchange="window.app.handlePfpUpload(event, 'register-pfp-preview')">
                    </div>

                    <div class="relative">
                        <i class="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="text" id="register-name" placeholder="Unique Username" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="relative">
                        <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="email" id="register-email" placeholder="Email Address" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="relative">
                        <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="password" id="register-password" placeholder="Password (Min 6 chars)" required minlength="6" class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <button type="submit" id="btn-register" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-lg mt-2">Create Account</button>
                </form>

                <form id="view-forgot" class="flex flex-col gap-4 hidden" onsubmit="window.app.handlePasswordReset(event)">
                    <div class="text-center mb-2">
                        <i class="fas fa-key text-3xl text-[#F47521] mb-3"></i>
                        <p class="text-xs text-gray-400">Enter your email to receive a password reset link.</p>
                    </div>
                    <div class="relative">
                        <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="email" id="forgot-email" placeholder="Email Address" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <button type="submit" id="btn-forgot" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-lg mt-2">Send Reset Link</button>
                    <button type="button" onclick="window.app.switchAuthView('login')" class="text-xs text-gray-400 hover:text-white font-bold uppercase tracking-wider mt-2">Back to Sign In</button>
                </form>

                <form id="view-guest" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleGuestCreation(event)">
                    <div class="text-center mb-2">
                        <p class="text-xs text-red-400 font-bold uppercase tracking-widest mb-2"><i class="fas fa-exclamation-triangle"></i> Local Storage Only</p>
                        <p class="text-[10px] text-gray-400">Guest data is not synced. If you clear your browser data, your library will be lost.</p>
                    </div>
                    
                    <div class="flex justify-center mb-1">
                        <div class="relative cursor-pointer group" onclick="document.getElementById('guest-pfp-upload-input').click()">
                            <img id="guest-pfp-preview" src="${window.app.state.authSelectedPfp}" class="w-16 h-16 rounded-full object-cover border-2 border-white/10 group-hover:border-[#F47521] transition-colors shadow-lg">
                            <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-camera text-white text-sm"></i>
                            </div>
                        </div>
                        <input type="file" id="guest-pfp-upload-input" accept="image/*" class="hidden" onchange="window.app.handlePfpUpload(event, 'guest-pfp-preview')">
                    </div>

                    <div class="relative">
                        <i class="fas fa-user-ninja absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="text" id="guest-name" placeholder="Choose a Display Name" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <button type="submit" id="btn-guest" class="w-full bg-white text-black font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-[#F47521] hover:text-white transition-colors mt-2">Start Browsing</button>
                    <button type="button" onclick="window.app.switchAuthView('login')" class="text-xs text-gray-400 hover:text-white font-bold uppercase tracking-wider mt-2">Cancel</button>
                </form>

                <div id="social-container" class="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                    <button onclick="window.app.handleGoogleLogin()" class="w-full bg-white text-black font-black uppercase tracking-wider text-xs py-3.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-3">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-4 h-4">
                        Continue with Google
                    </button>
                    
                    <button onclick="window.app.switchAuthView('guest')" class="w-full bg-transparent border border-white/20 text-gray-300 font-bold uppercase tracking-wider text-[11px] py-3 rounded-lg hover:border-white hover:text-white transition-colors flex items-center justify-center gap-2">
                        <i class="fas fa-user-secret"></i> Continue as Guest
                    </button>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('auth-modal-box').classList.remove('scale-95');
    }, 10);
};

// --- VIEW & UI PANEL TOGGLES ---
window.app.closeAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    const box = document.getElementById('auth-modal-box');
    if (modal && box) {
        modal.classList.add('opacity-0');
        box.classList.add('scale-95');
        setTimeout(() => modal.remove(), 300);
    }
};

window.app.switchAuthView = (view) => {
    ['view-login', 'view-register', 'view-forgot', 'view-guest'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const tabs = document.getElementById('auth-tabs');
    const social = document.getElementById('social-container');
    
    if (view === 'login' || view === 'register') {
        if (tabs) tabs.classList.remove('hidden');
        if (social) social.classList.remove('hidden');
        const tabL = document.getElementById('tab-login');
        const tabR = document.getElementById('tab-register');
        if (tabL) tabL.className = `flex-1 pb-3 transition-colors ${view === 'login' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
        if (tabR) tabR.className = `flex-1 pb-3 transition-colors ${view === 'register' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
    } else {
        if (tabs) tabs.classList.add('hidden');
        if (social) social.classList.add('hidden');
    }

    const targetView = document.getElementById(`view-${view}`);
    if (targetView) targetView.classList.remove('hidden');
};

// --- PFP UPLOAD HANDLER VIA IMGBB API ---
window.app.handlePfpUpload = async (event, previewId) => {
    const file = event.target.files[0];
    if (!file) return;

    const imgPreview = document.getElementById(previewId);
    const originalSrc = imgPreview.src;
    imgPreview.src = 'https://i.gifer.com/ZKZg.gif'; 

    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=4a683051e76ed12880a42aefa6ed427b`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if(data.success && data.data?.url) {
            const uploadedImgUrl = data.data.url;
            window.app.state.authSelectedPfp = uploadedImgUrl;
            imgPreview.src = uploadedImgUrl;

            // Direct mapping upload write sync if user profile layer session runs alive
            if (window.app.state.activeProfile && window.app.state.activeProfile.uid && !window.app.state.activeProfile.uid.startsWith('anon_')) {
                try {
                    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                    const userDocRef = firestore.doc(window.app.db, "users", window.app.state.activeProfile.uid);
                    await firestore.updateDoc(userDocRef, { pfp: uploadedImgUrl });
                    window.app.state.activeProfile.pfp = uploadedImgUrl;
                    localStorage.setItem('blazex_user_profile', JSON.stringify(window.app.state.activeProfile));
                } catch(dbErr) { console.error("Realtime firestore image write sync failed:", dbErr); }
            }
            window.app.showCustomAlert('Profile picture updated!', 'success');
        } else {
            throw new Error();
        }
    } catch(e) {
        window.app.showCustomAlert("Upload failed. Using default image.", 'error');
        imgPreview.src = originalSrc;
    }
};

// --- FIREBASE CORE AUTH LAYER MANAGEMENT LOGIC RUNTIME ---
window.app.handleLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const originalText = btn.innerText;
    btn.innerText = "Signing in...";
    btn.disabled = true;

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const { getAuth, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await window.app.syncProfileAfterAuth(userCredential.user);
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';
        
    } catch (error) {
        console.error("Login Module Failure Context Stack:", error);
        const errCode = error.code;
        if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') {
            window.app.showCustomAlert("Account not found. Would you like to create one?", 'error', 'Go to Sign Up', () => {
                window.app.switchAuthView('register');
                document.getElementById('register-email').value = email; 
            });
        } else {
            window.app.showCustomAlert(error.message.replace('Firebase:', '').trim(), 'error');
        }
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.app.handleRegister = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-register');
    const originalText = btn.innerText;
    btn.innerText = "Checking Username...";
    btn.disabled = true;

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const pfp = window.app.state.authSelectedPfp; 

    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
    const auth = getAuth(window.app.firebaseApp);

    let createdUser = null; // Track user instance for auto-rollback

    try {
        // Step 1: Safe Lookup Engine
        let isUsernameTaken = false;
        try {
            const usersRef = firestore.collection(window.app.db, "users");
            const q = firestore.query(usersRef, firestore.where("name", "==", name));
            const querySnapshot = await firestore.getDocs(q);
            if (!querySnapshot.empty) isUsernameTaken = true;
        } catch (queryErr) {
            console.log("Empty or uninitialized collection query bypassed.");
        }

        if (isUsernameTaken) {
            window.app.showCustomAlert("This Username is already taken! Please choose another.", 'error');
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        btn.innerText = "Creating Account...";

        // Step 2: Auth Creation
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        createdUser = userCredential.user;

        // Step 3: Cloud Database Profile Registration
        const newProfile = {
            uid: createdUser.uid,
            name: name,
            email: email,
            pfp: pfp, 
            history: [],
            watchlist: [],
            createdAt: new Date().toISOString()
        };

        const userDocRef = firestore.doc(window.app.db, "users", createdUser.uid);
        
        try {
            await firestore.setDoc(userDocRef, newProfile);
        } catch (dbError) {
            // THE AUTO-ROLLBACK ENGINE: Triggered if Firestore denies the write operation
            console.error("Firestore Permission Denied. Activating auto-rollback...");
            if (createdUser) {
                await createdUser.delete(); // Removes the corrupted "ghost" account from Firebase Auth
            }
            throw new Error("Database permissions blocked profile sync. The backend needs rules initialized.");
        }

        // Final Success Allocation
        window.app.state.activeProfile = newProfile;
        localStorage.setItem('blazex_user_profile', JSON.stringify(newProfile));
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';

    } catch (error) {
        console.error("Registration Core Fatal Crash:", error);
        
        // Manual cleanup check in case of mid-execution failures
        if (createdUser && error.message.includes('Database permissions')) {
             try { await createdUser.delete(); } catch(e){}
        }

        if (error.code === 'auth/email-already-in-use') {
            window.app.showCustomAlert("This email is already registered. Try signing in.", 'error', 'Go to Sign In', () => {
                window.app.switchAuthView('login');
                document.getElementById('login-email').value = email;
            });
        } else {
            window.app.showCustomAlert(error.message.replace('Firebase:', '').trim(), 'error');
        }
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.app.handlePasswordReset = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('btn-forgot');
    const originalText = btn.innerText;
    
    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        await sendPasswordResetEmail(auth, email);
        
        window.app.showCustomAlert(`Reset link sent to ${email}`, 'success');
        setTimeout(() => window.app.switchAuthView('login'), 2000);
        
    } catch (error) {
        window.app.showCustomAlert(error.message.replace('Firebase:', '').trim(), 'error');
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.app.handleGoogleLogin = async () => {
    try {
        const { getAuth, signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        const provider = new GoogleAuthProvider();
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userDocRef = firestore.doc(window.app.db, "users", user.uid);
        
        let profileData;
        try {
            const docSnap = await firestore.getDoc(userDocRef);
            if (docSnap.exists()) {
                profileData = docSnap.data();
            } else {
                throw new Error("Trigger database entry serialization.");
            }
        } catch(snapErr) {
            profileData = {
                uid: user.uid,
                name: user.displayName || 'Google User',
                email: user.email,
                pfp: user.photoURL || `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`,
                history: [],
                watchlist: [],
                createdAt: new Date().toISOString()
            };
            await firestore.setDoc(userDocRef, profileData);
        }

        window.app.state.activeProfile = profileData;
        localStorage.setItem('blazex_user_profile', JSON.stringify(profileData));
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';

    } catch (error) {
        console.error("--- GOOGLE POPUP AUTH BLOCK TRACE METRICS ---", error);
        
        if (error.code === 'auth/popup-blocked') {
            window.app.showCustomAlert("Sign-in popup was blocked by your browser! Please check the address bar options panel to allow popups.", 'error');
        } else if (error.code === 'auth/operation-not-allowed') {
            window.app.showCustomAlert("Google Sign-In is disabled in Firebase Console! Please go to your Console settings and enable Google provider support.", 'error');
        } else {
            window.app.showCustomAlert(`Authentication dropped context: ${error.code || 'Network Exception'}`, 'error');
        }
    }
};

window.app.handleGuestCreation = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guest');
    btn.innerText = "Loading...";
    btn.disabled = true;

    const name = document.getElementById('guest-name').value.trim();
    const pfp = window.app.state.authSelectedPfp;
    const guestUid = 'anon_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

    const guestProfile = {
        uid: guestUid,
        name: name,
        email: "Guest Mode",
        pfp: pfp,
        history: [],
        watchlist: [],
        createdAt: new Date().toISOString()
    };

    window.app.state.activeProfile = guestProfile;
    localStorage.setItem('blazex_user_profile', JSON.stringify(guestProfile));

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", guestUid);
        await firestore.setDoc(userRef, guestProfile);
    } catch (dbError) {
        console.log("Guest tracking cached locally.");
    }

    window.app.closeAuthModal();
    window.location.href = 'profile.html';
};

window.app.syncProfileAfterAuth = async (firebaseUser) => {
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userDocRef = firestore.doc(window.app.db, "users", firebaseUser.uid);
        const docSnap = await firestore.getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.app.state.activeProfile = data;
            localStorage.setItem('blazex_user_profile', JSON.stringify(data));
        }
    } catch(syncErr) {
        console.log("Active state caching sync tracking module handled safely.");
    }
};
