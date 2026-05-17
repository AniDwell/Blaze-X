// auth.js

window.app.components.auth = () => {
    // 1. Redirect if already logged in (ignore auto-generated anon guests)
    if (window.app.state && window.app.state.activeProfile && window.app.state.activeProfile.uid && !window.app.state.activeProfile.uid.startsWith('anon_')) {
        window.location.href = 'profile.html';
        return;
    }

    // 2. Remove existing modal if it's already open
    const existingModal = document.getElementById('auth-modal');
    if (existingModal) existingModal.remove();

    // 3. Initialize Random PFP (pfp1.jpeg to pfp10.jpeg)
    window.app.state.authSelectedPfp = `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`;

    // 4. Create Modal Overlay
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 opacity-0 transition-opacity duration-300';
    
    modal.innerHTML = `
        <div class="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden transform scale-95 transition-transform duration-300" id="auth-modal-box">
            
            <button onclick="window.app.closeAuthModal()" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20">
                <i class="fas fa-times text-xl"></i>
            </button>

            <div class="text-center pt-8 pb-4">
                <h2 class="text-2xl font-black text-white tracking-tight">Welcome to Blaze-X</h2>
                <p class="text-gray-400 text-xs mt-1 font-medium">Log in or create an account to sync your library.</p>
            </div>

            <div class="flex border-b border-white/10 text-xs font-bold uppercase tracking-widest px-6">
                <button onclick="window.app.switchAuthTab('login')" id="tab-login" class="flex-1 pb-3 text-white border-b-2 border-[#F47521] transition-colors">Sign In</button>
                <button onclick="window.app.switchAuthTab('register')" id="tab-register" class="flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors">Sign Up</button>
                <button onclick="window.app.switchAuthTab('guest')" id="tab-guest" class="flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors">Guest</button>
            </div>

            <div class="p-6 md:p-8">
                
                <form id="form-login" class="flex flex-col gap-4" onsubmit="window.app.handleLogin(event)">
                    <div class="relative">
                        <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="email" id="login-email" placeholder="Email Address" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="relative">
                        <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="password" id="login-password" placeholder="Password" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <div class="flex justify-end">
                        <button type="button" onclick="window.app.handlePasswordReset()" class="text-[10px] text-gray-400 hover:text-[#F47521] font-bold uppercase tracking-wider transition-colors">Forgot Password?</button>
                    </div>
                    <button type="submit" id="btn-login" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-[0_0_15px_rgba(244,117,33,0.3)] mt-2">Sign In</button>
                </form>

                <form id="form-register" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleRegister(event)">
                    <div class="flex justify-center mb-2">
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
                    <button type="submit" id="btn-register" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-[0_0_15px_rgba(244,117,33,0.3)] mt-2">Create Account</button>
                </form>

                <form id="form-guest" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleGuestLogin(event)">
                    <div class="flex justify-center mb-2">
                        <div class="relative cursor-pointer group" onclick="document.getElementById('guest-pfp-upload-input').click()">
                            <img id="guest-pfp-preview" src="${window.app.state.authSelectedPfp}" class="w-16 h-16 rounded-full object-cover border-2 border-white/10 group-hover:border-[#F47521] transition-colors shadow-lg">
                            <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-camera text-white text-sm"></i>
                            </div>
                        </div>
                        <input type="file" id="guest-pfp-upload-input" accept="image/*" class="hidden" onchange="window.app.handlePfpUpload(event, 'guest-pfp-preview')">
                    </div>
                    
                    <p class="text-xs text-gray-400 text-center mb-2">Guest data is saved locally. If you clear your browser data, your library will be lost.</p>

                    <div class="relative">
                        <i class="fas fa-user-ninja absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                        <input type="text" id="guest-name" placeholder="Choose a Display Name" required class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <button type="submit" id="btn-guest" class="w-full bg-white text-black font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-[#F47521] hover:text-white transition-colors mt-2">Continue as Guest</button>
                </form>

                <div id="social-login-container" class="mt-6 pt-6 border-t border-white/10">
                    <button onclick="window.app.handleGoogleLogin()" class="w-full bg-white/5 border border-white/10 text-white font-bold text-sm py-3 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-3">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5">
                        Continue with Google
                    </button>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Animate In
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('auth-modal-box').classList.remove('scale-95');
    }, 10);
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

window.app.switchAuthTab = (tab) => {
    // Hide all forms
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-guest').classList.add('hidden');
    
    // Reset tab styles
    const tabs = ['login', 'register', 'guest'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        el.className = `flex-1 pb-3 transition-colors ${t === tab ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
    });

    // Show target form
    document.getElementById(`form-${tab}`).classList.remove('hidden');

    // Hide Google login if on Guest tab
    const socialContainer = document.getElementById('social-login-container');
    if (tab === 'guest') socialContainer.classList.add('hidden');
    else socialContainer.classList.remove('hidden');
};


// --- PFP UPLOAD LOGIC ---
// Silently uses your ImgBB key for instantaneous remote image URLs
window.app.handlePfpUpload = async (event, previewId) => {
    const file = event.target.files[0];
    if (!file) return;

    const imgPreview = document.getElementById(previewId);
    const originalSrc = imgPreview.src;
    imgPreview.src = 'https://i.gifer.com/ZKZg.gif'; // Temporary loading gif

    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=4a683051e76ed12880a42aefa6ed427b`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if(data.success) {
            window.app.state.authSelectedPfp = data.data.url;
            imgPreview.src = data.data.url;
        } else {
            throw new Error("Upload failed");
        }
    } catch(e) {
        alert("Image upload failed. Try again or use default.");
        imgPreview.src = originalSrc;
    }
};


// --- FIREBASE AUTHENTICATION LOGIC ---

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
        window.location.reload(); // Refresh to apply states globally
        
    } catch (error) {
        alert(error.message.replace('Firebase:', '').trim());
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

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const usersRef = firestore.collection(window.app.db, "users");
        
        // 1. Enforce Unique Username
        const q = firestore.query(usersRef, firestore.where("name", "==", name));
        const querySnapshot = await firestore.getDocs(q);
        
        if (!querySnapshot.empty) {
            alert("This Username is already taken! Please choose another.");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        btn.innerText = "Creating Account...";

        // 2. Create Auth Account
        const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. Save to Firestore
        const newProfile = {
            uid: user.uid,
            name: name,
            email: email,
            pfp: pfp,
            history: [],
            watchlist: [],
            createdAt: new Date().toISOString()
        };

        const userDocRef = firestore.doc(window.app.db, "users", user.uid);
        await firestore.setDoc(userDocRef, newProfile);

        // 4. Set local state & close
        window.app.state.activeProfile = newProfile;
        localStorage.setItem('blazex_user_profile', JSON.stringify(newProfile));
        
        window.app.closeAuthModal();
        window.location.reload();

    } catch (error) {
        alert(error.message.replace('Firebase:', '').trim());
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.app.handlePasswordReset = async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        alert("Please enter your email address in the Login Email field first.");
        return;
    }
    
    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        await sendPasswordResetEmail(auth, email);
        alert(`A password reset link has been sent to ${email}`);
    } catch (error) {
        alert(error.message.replace('Firebase:', '').trim());
    }
};

window.app.handleGoogleLogin = async () => {
    try {
        const { getAuth, signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        const provider = new GoogleAuthProvider();
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user exists in DB to avoid overwriting library, otherwise create
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userDocRef = firestore.doc(window.app.db, "users", user.uid);
        const docSnap = await firestore.getDoc(userDocRef);

        let profileData;
        if (docSnap.exists()) {
            profileData = docSnap.data();
        } else {
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
        window.location.reload();

    } catch (error) {
        console.error("Google Auth Error", error);
    }
};

// --- GUEST LOGIN LOGIC ---
window.app.handleGuestLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guest');
    btn.innerText = "Loading...";
    btn.disabled = true;

    const name = document.getElementById('guest-name').value.trim();
    const pfp = window.app.state.authSelectedPfp;
    
    // Generate secure local UID
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
        console.log("Saving Guest locally only.");
    }

    window.app.closeAuthModal();
    
    // If they clicked auth from play.html or info.html, let them stay there instead of full reload if needed.
    // For standard headers, reload is safest to apply profile.
    window.location.reload(); 
};

// --- HELPER FUNCTION: Fetch DB Profile after standard Email Login ---
window.app.syncProfileAfterAuth = async (firebaseUser) => {
    const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    const userDocRef = firestore.doc(window.app.db, "users", firebaseUser.uid);
    const docSnap = await firestore.getDoc(userDocRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        window.app.state.activeProfile = data;
        localStorage.setItem('blazex_user_profile', JSON.stringify(data));
    }
};
