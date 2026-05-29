// auth.js - REBUILT WITH CROPPER.JS & ENHANCED FIRESTORE DB

// Dynamically load Cropper.js CSS and JS if not already loaded
if (!document.getElementById('cropperjs-css')) {
    const css = document.createElement('link');
    css.id = 'cropperjs-css';
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'cropperjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js';
    document.head.appendChild(script);
}

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

// --- MODAL INITIALIZATION ---
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
    
    modal.innerHTML = `
        <style>
            .thought-bubble::after {
                content: ''; position: absolute; bottom: -5px; left: 20px;
                border-width: 6px 6px 0; border-style: solid; border-color: #ffffff transparent transparent transparent;
            }
            .cropper-view-box, .cropper-face { border-radius: 50%; } /* Makes crop box circular */
        </style>
        
        <div id="crop-modal" class="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center hidden">
            <div class="w-full max-w-md bg-[#111] p-5 rounded-2xl flex flex-col gap-4 border border-white/10 shadow-2xl">
                <h3 class="text-white font-black uppercase tracking-widest text-center border-b border-white/5 pb-2">Crop Profile Picture</h3>
                <div class="w-full h-64 bg-black relative rounded overflow-hidden">
                    <img id="cropper-img-target" src="" class="max-w-full max-h-full block">
                </div>
                <div class="flex gap-3 justify-between mt-2">
                    <button onclick="window.app.closeCropModal()" class="w-1/3 bg-white/10 text-white font-bold text-xs uppercase px-4 py-3 rounded-lg hover:bg-white/20 transition-colors">Cancel</button>
                    <button id="btn-crop-upload" onclick="window.app.executeCropAndUpload()" class="w-2/3 bg-[#F47521] text-black font-black text-xs uppercase px-4 py-3 rounded-lg shadow-lg hover:bg-white transition-colors flex justify-center items-center">Crop & Upload</button>
                </div>
            </div>
        </div>

        <div class="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] mt-20 md:mt-28 transform scale-95 transition-transform duration-300" id="auth-modal-box">
            
            <div class="absolute -top-24 left-0 md:-top-32 md:-left-4 z-50 flex items-end pointer-events-none">
                <img src="https://media.tenor.com/fYOO8YHxJsUAAAAi/genshin-impact-furina.gif" class="w-28 h-28 md:w-36 md:h-36 object-contain">
                <div class="thought-bubble relative bg-white text-black font-black text-[9px] md:text-[10px] px-3 py-1.5 rounded-xl mb-12 -ml-3 shadow-[0_4px_10px_rgba(0,0,0,0.5)] uppercase tracking-wider">
                    Welcome!
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
                                <i class="fas fa-crop-alt text-white text-sm"></i>
                            </div>
                        </div>
                        <input type="file" id="pfp-upload-input" accept="image/*" class="hidden" onchange="window.app.triggerPfpCropFlow(event)">
                    </div>

                    <div class="relative">
                        <i class="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="text" id="register-name" placeholder="Username" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
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

                <div id="social-container" class="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                    <button onclick="window.app.handleGoogleLogin()" class="w-full bg-white text-black font-black uppercase tracking-wider text-xs py-3.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-3">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-4 h-4">
                        Continue with Google
                    </button>
                    
                    <button onclick="window.app.handleGuestCreation(event)" class="w-full bg-transparent border border-white/20 text-gray-300 font-bold uppercase tracking-wider text-[11px] py-3 rounded-lg hover:border-white hover:text-white transition-colors flex items-center justify-center gap-2">
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

// --- CROPPER ENGINE ---
let globalCropperInstance = null;

window.app.triggerPfpCropFlow = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageTarget = document.getElementById('cropper-img-target');
        imageTarget.src = e.target.result;
        
        document.getElementById('crop-modal').classList.remove('hidden');
        
        // Initialize Cropper JS (1:1 ratio for PFP)
        if (globalCropperInstance) globalCropperInstance.destroy();
        globalCropperInstance = new Cropper(imageTarget, {
            aspectRatio: 1,
            viewMode: 1,
            background: false,
            dragMode: 'move'
        });
    };
    reader.readAsDataURL(file);
    
    // Clear input so same file can be selected again
    event.target.value = '';
};

window.app.closeCropModal = () => {
    document.getElementById('crop-modal').classList.add('hidden');
    if (globalCropperInstance) {
        globalCropperInstance.destroy();
        globalCropperInstance = null;
    }
};

window.app.executeCropAndUpload = () => {
    if (!globalCropperInstance) return;

    const btn = document.getElementById('btn-crop-upload');
    const originalBtnText = btn.innerText;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-sm"></i>`;
    btn.disabled = true;

    // Get the cropped area as a Blob
    globalCropperInstance.getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toBlob(async (blob) => {
        const formData = new FormData();
        formData.append("image", blob, "pfp.jpg");
        
        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=4a683051e76ed12880a42aefa6ed427b`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if(data.success && data.data?.url) {
                window.app.state.authSelectedPfp = data.data.url;
                document.getElementById('register-pfp-preview').src = data.data.url;
                window.app.showCustomAlert('Profile picture cropped & uploaded!', 'success');
                window.app.closeCropModal();
            } else {
                throw new Error("ImgBB API rejected upload.");
            }
        } catch(e) {
            window.app.showCustomAlert("Upload failed. Try again.", 'error');
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    }, 'image/jpeg', 0.9);
};


// --- UI CONTROLS ---
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
    ['view-login', 'view-register', 'view-forgot'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const tabs = document.getElementById('auth-tabs');
    const social = document.getElementById('social-container');
    
    if (view === 'login' || view === 'register') {
        if (tabs) tabs.classList.remove('hidden');
        if (social) social.classList.remove('hidden');
        document.getElementById('tab-login').className = `flex-1 pb-3 transition-colors ${view === 'login' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
        document.getElementById('tab-register').className = `flex-1 pb-3 transition-colors ${view === 'register' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
    } else {
        if (tabs) tabs.classList.add('hidden');
        if (social) social.classList.add('hidden');
    }

    const targetView = document.getElementById(`view-${view}`);
    if (targetView) targetView.classList.remove('hidden');
};

// ==========================================
// --- ENHANCED FIREBASE DB STRUCTURE ---
// ==========================================

window.app.handleLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const originalText = btn.innerText;
    btn.innerText = "Signing in...";
    btn.disabled = true;

    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { getAuth, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await window.app.syncProfileAfterAuth(userCredential.user);
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';
        
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            window.app.showCustomAlert("Account not found. Please Sign Up.", 'error');
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
    btn.innerText = "Creating Account...";
    btn.disabled = true;

    try {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const pfp = window.app.state.authSelectedPfp; 

        // 1. Create Auth Account
        const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Prepare Structured Profile Data for Firestore
        const newProfile = {
            uid: user.uid,
            name: name,
            email: email,
            pfpLink: pfp, // Updated key 
            library: [], // Anime saved to user's library
            watchProgress: {}, // Resumed Data Mapping (e.g., { 'one-piece': { ep: 5, timestamp: 124 } })
            history: [], // Quick history array
            createdAt: new Date().toISOString()
        };

        // 3. Create Dedicated Document inside 'users' collection using UID
        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userDocRef = firestore.doc(window.app.db, "users", user.uid);
            await firestore.setDoc(userDocRef, newProfile);
        } catch (dbError) {
            console.warn("Firestore write blocked.", dbError);
        }

        // 4. Save Locally and Redirect
        window.app.state.activeProfile = newProfile;
        localStorage.setItem('blazex_user_profile', JSON.stringify(newProfile));
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            window.app.showCustomAlert("This email is already registered. Try signing in.", 'error');
        } else {
            window.app.showCustomAlert(error.message.replace('Firebase:', '').trim(), 'error');
        }
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

        // Same Structured Data
        let profileData = {
            uid: user.uid,
            name: user.displayName || 'Google User',
            email: user.email,
            pfpLink: user.photoURL || `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`,
            library: [],
            watchProgress: {},
            history: [],
            createdAt: new Date().toISOString()
        };

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userDocRef = firestore.doc(window.app.db, "users", user.uid);
            const docSnap = await firestore.getDoc(userDocRef);
            
            if (docSnap.exists()) {
                profileData = docSnap.data();
            } else {
                await firestore.setDoc(userDocRef, profileData);
            }
        } catch(dbErr) {
            console.warn("Firestore sync failed.");
        }

        window.app.state.activeProfile = profileData;
        localStorage.setItem('blazex_user_profile', JSON.stringify(profileData));
        
        window.app.closeAuthModal();
        window.location.href = 'profile.html';

    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/popup-blocked') {
            window.app.showCustomAlert("Sign-in popup blocked by browser. Please allow popups.", 'error');
        } else {
            window.app.showCustomAlert("Google Sign-In failed or was closed.", 'error');
        }
    }
};

window.app.handleGuestCreation = (e) => {
    if (e) e.preventDefault();
    const guestUid = 'anon_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const guestProfile = {
        uid: guestUid,
        name: "Guest User",
        email: "Guest Mode",
        pfpLink: `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`,
        library: [],
        watchProgress: {},
        history: [],
        createdAt: new Date().toISOString()
    };

    window.app.state.activeProfile = guestProfile;
    localStorage.setItem('blazex_user_profile', JSON.stringify(guestProfile));

    window.app.closeAuthModal();
    window.location.href = 'profile.html';
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

window.app.syncProfileAfterAuth = async (firebaseUser) => {
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userDocRef = firestore.doc(window.app.db, "users", firebaseUser.uid);
        const docSnap = await firestore.getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.app.state.activeProfile = data;
            localStorage.setItem('blazex_user_profile', JSON.stringify(data));
        } else {
            const fallbackProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || "User",
                email: firebaseUser.email,
                pfpLink: firebaseUser.photoURL || `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`,
                library: [],
                watchProgress: {},
                history: [],
                createdAt: new Date().toISOString()
            };
            window.app.state.activeProfile = fallbackProfile;
            localStorage.setItem('blazex_user_profile', JSON.stringify(fallbackProfile));
        }
    } catch(syncErr) {
        console.warn("Could not sync profile from Firestore.");
    }
};
