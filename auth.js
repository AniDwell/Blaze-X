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

    // 3. Initialize Random PFP
    window.app.state.authSelectedPfp = `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`;

    // 4. Create Modal Overlay
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 opacity-0 transition-opacity duration-300';
    
    modal.innerHTML = `
        <div class="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden transform scale-95 transition-transform duration-300" id="auth-modal-box">
            
            <div class="absolute top-0 left-0 z-20 flex items-start pointer-events-none">
                <img src="https://media.tenor.com/fYOO8YHxJsUAAAAi/genshin-impact-furina.gif" class="w-20 h-20 object-cover border-r border-b border-white/10 rounded-br-2xl">
                <div class="mt-4 ml-1 bg-white text-black text-[10px] font-black px-3 py-1.5 rounded-xl rounded-tl-none shadow-[0_0_15px_rgba(255,255,255,0.4)] transform -rotate-2">
                    Please login! ✨
                </div>
            </div>

            <button onclick="window.app.closeAuthModal()" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20">
                <i class="fas fa-times text-xl"></i>
            </button>

            <div class="text-right pt-6 pb-2 pr-6 border-b border-white/5">
                <h2 class="text-2xl font-black text-white tracking-tight">Blaze-X</h2>
                <p class="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Sync Your Universe</p>
            </div>

            <div class="flex border-b border-white/10 text-xs font-bold uppercase tracking-widest px-6 pt-2">
                <button onclick="window.app.switchAuthTab('login')" id="tab-login" class="flex-1 pb-3 text-white border-b-2 border-[#F47521] transition-colors relative z-30">Sign In</button>
                <button onclick="window.app.switchAuthTab('register')" id="tab-register" class="flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors relative z-30">Sign Up</button>
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
                        <button type="button" onclick="window.app.showForgotPasswordModal()" class="text-[10px] text-gray-400 hover:text-[#F47521] font-bold uppercase tracking-wider transition-colors">Forgot Password?</button>
                    </div>
                    <button type="submit" id="btn-login" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-md mt-2">Sign In</button>
                </form>

                <form id="form-register" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleRegister(event)">
                    <div class="flex justify-center mb-1">
                        <div class="relative cursor-pointer group" onclick="document.getElementById('pfp-upload-input').click()">
                            <img id="register-pfp-preview" src="${window.app.state.authSelectedPfp}" class="w-14 h-14 rounded-full object-cover border border-white/20 group-hover:border-[#F47521] transition-colors shadow-lg">
                            <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-camera text-white text-xs"></i>
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
                    <button type="submit" id="btn-register" class="w-full bg-[#F47521] text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-white hover:text-black transition-colors shadow-md mt-2">Create Account</button>
                </form>

                <form id="form-guest" class="flex flex-col gap-4 hidden" onsubmit="window.app.handleGuestLogin(event)">
                    <div class="text-center mb-2">
                        <h3 class="text-white font-bold text-lg">Guest Setup</h3>
                        <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Saved Locally Only</p>
                    </div>
                    <div class="flex justify-center mb-2">
                        <div class="relative cursor-pointer group" onclick="document.getElementById('guest-pfp-upload-input').click()">
                            <img id="guest-pfp-preview" src="${window.app.state.authSelectedPfp}" class="w-16 h-16 rounded-full object-cover border border-white/20 group-hover:border-[#F47521] transition-colors shadow-lg">
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
                    <button type="submit" id="btn-guest" class="w-full bg-white text-black font-black text-sm uppercase tracking-wider py-3.5 rounded-lg hover:bg-[#F47521] hover:text-white transition-colors mt-2">Enter Universe</button>
                    
                    <button type="button" onclick="window.app.switchAuthTab('login')" class="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold mt-2">← Back to Login</button>
                </form>

                <div id="social-login-container" class="mt-6 pt-6 border-t border-white/10 flex flex-col gap-3">
                    <button onclick="window.app.handleGoogleLogin()" class="w-full bg-white/5 border border-white/10 text-white font-bold text-xs md:text-sm py-3 rounded-lg hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-3">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-4 h-4">
                        Continue with Google
                    </button>
                    
                    <button onclick="window.app.openGuestSetup()" class="w-full bg-transparent border border-white/10 text-gray-400 font-bold text-xs md:text-sm py-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-3">
                        <i class="fas fa-user-ninja"></i>
                        Continue as Guest
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

// --- CUSTOM CSS ALERTS & MODALS ---

window.app.showAuthAlert = (title, message, actionHtml = '') => {
    const existing = document.getElementById('auth-custom-alert');
    if(existing) existing.remove();
    
    const alertBox = document.createElement('div');
    alertBox.id = 'auth-custom-alert';
    alertBox.className = 'absolute inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-300 px-6 rounded-2xl';
    
    alertBox.innerHTML = `
        <div class="bg-[#111] border border-white/10 p-6 rounded-xl shadow-2xl w-full transform scale-95 transition-transform duration-300" id="auth-alert-inner">
            <h3 class="text-[#F47521] font-black text-lg mb-2 uppercase tracking-wide flex items-center gap-2">
                <i class="fas fa-exclamation-circle text-sm"></i> ${title}
            </h3>
            <div class="text-gray-300 text-sm mb-6 leading-relaxed">${message}</div>
            <div class="flex justify-end gap-3 items-center">
                <button onclick="window.app.closeAuthAlert()" class="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors mr-auto">Close</button>
                ${actionHtml}
            </div>
        </div>
    `;
    
    document.getElementById('auth-modal-box').appendChild(alertBox);
    
    setTimeout(() => {
        alertBox.classList.remove('opacity-0');
        document.getElementById('auth-alert-inner').classList.remove('scale-95');
    }, 10);
};

window.app.closeAuthAlert = () => {
    const box = document.getElementById('auth-custom-alert');
    if(box) {
        box.classList.add('opacity-0');
        document.getElementById('auth-alert-inner').classList.add('scale-95');
        setTimeout(() => box.remove(), 300);
    }
};

window.app.showForgotPasswordModal = () => {
    window.app.showAuthAlert(
        'Reset Password',
        `<p class="text-xs text-gray-400 mb-4">Enter your email address and we'll send you a link to securely reset your password.</p>
         <input type="email" id="reset-email-input" placeholder="Your Email Address" class="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm py-3 px-4 rounded-lg outline-none focus:border-[#F47521] transition-colors">`,
        `<button onclick="window.app.executePasswordReset()" class="bg-[#F47521] text-white px-5 py-2.5 rounded shadow-md text-xs font-black uppercase tracking-wider hover:bg-white hover:text-black transition-colors">Send Link</button>`
    );
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
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-guest').classList.add('hidden');
    document.getElementById('social-login-container').classList.remove('hidden'); // Show social buttons for standard tabs
    
    // Style tabs
    document.getElementById('tab-login').className = `flex-1 pb-3 transition-colors relative z-30 ${tab === 'login' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;
    document.getElementById('tab-register').className = `flex-1 pb-3 transition-colors relative z-30 ${tab === 'register' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white border-b-2 border-transparent'}`;

    document.getElementById(`form-${tab}`).classList.remove('hidden');
};

window.app.openGuestSetup = () => {
    // Hide standard forms and social buttons
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('social-login-container').classList.add('hidden');
    
    // Deselect all tabs visually
    document.getElementById('tab-login').className = "flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors relative z-30";
    document.getElementById('tab-register').className = "flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent transition-colors relative z-30";

    // Show guest form
    document.getElementById('form-guest').classList.remove('hidden');
};


// --- PFP UPLOAD ---
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
        
        if(data.success) {
            window.app.state.authSelectedPfp = data.data.url;
            imgPreview.src = data.data.url;
        } else {
            throw new Error("Upload failed");
        }
    } catch(e) {
        window.app.showAuthAlert('Upload Failed', 'We could not upload your image. Please try again or use the default avatar.');
        imgPreview.src = originalSrc;
    }
};


// --- FIREBASE LOGIC ---

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
        window.location.reload(); 
        
    } catch (error) {
        const errCode = error.code;
        btn.innerText = originalText;
        btn.disabled = false;

        // Custom Error Routing for non-existent users
        if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') {
            window.app.showAuthAlert(
                'User Not Found', 
                'This account does not exist or the credentials are incorrect. Please try signing up!', 
                `<button onclick="window.app.closeAuthAlert(); window.app.switchAuthTab('register')" class="bg-[#F47521] text-white px-5 py-2.5 rounded shadow-md text-xs font-black uppercase tracking-wider hover:bg-white hover:text-black transition-colors">Sign Up</button>`
            );
        } else {
            window.app.showAuthAlert('Login Error', error.message.replace('Firebase:', '').trim());
        }
    }
};

window.app.handleRegister = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-register');
    const originalText = btn.innerText;
    btn.innerText = "Checking...";
    btn.disabled = true;

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const pfp = window.app.state.authSelectedPfp;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const usersRef = firestore.collection(window.app.db, "users");
        
        const q = firestore.query(usersRef, firestore.where("name", "==", name));
        const querySnapshot = await firestore.getDocs(q);
        
        if (!querySnapshot.empty) {
            window.app.showAuthAlert("Name Taken", "This Username is already in use by another warrior! Please choose a different one.");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        btn.innerText = "Creating...";

        const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

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

        window.app.state.activeProfile = newProfile;
        localStorage.setItem('blazex_user_profile', JSON.stringify(newProfile));
        
        window.app.closeAuthModal();
        window.location.reload();

    } catch (error) {
        window.app.showAuthAlert('Registration Error', error.message.replace('Firebase:', '').trim());
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.app.executePasswordReset = async () => {
    const emailInput = document.getElementById('reset-email-input');
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) {
        alert("Please type your email."); // Fallback if input is somehow missing
        return;
    }
    
    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth(window.app.firebaseApp);
        await sendPasswordResetEmail(auth, email);
        
        window.app.showAuthAlert('Success', `A secure password reset link has been sent to <b>${email}</b>. Check your inbox and spam folders!`);
    } catch (error) {
        window.app.showAuthAlert('Error', error.message.replace('Firebase:', '').trim());
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

// --- GUEST LOGIC ---
window.app.handleGuestLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guest');
    btn.innerText = "Entering Universe...";
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
        console.log("Saving Guest locally only.");
    }

    window.app.closeAuthModal();
    window.location.reload(); 
};

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
