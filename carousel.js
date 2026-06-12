window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};

window.app.state.carouselLibrarySet = new Set();
let app, auth, db;
let firebaseInitialized = false;

const initFirebase = async () => {
    if (firebaseInitialized) return;
    try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        const firebaseConfig = {
            apiKey: "AIzaSyChgVcbDPzc6AMeoac1hCOx39YK_1mEKvU",
            authDomain: "blaze-x-db2f5.firebaseapp.com",
            projectId: "blaze-x-db2f5",
            storageBucket: "blaze-x-db2f5.firebasestorage.app",
            messagingSenderId: "770812306638",
            appId: "1:770812306638:web:eaf5ded647861f32c25c9f"
        };

        if (!getApps().length) app = initializeApp(firebaseConfig);
        else app = getApps()[0];
        
        auth = getAuth(app);
        db = getFirestore(app);
        window.app.db = db; 
        firebaseInitialized = true;
    } catch (err) { console.error("Firebase Init Error:", err); }
};

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    container.innerHTML = `<div class="w-full aspect-[4/5] md:aspect-[21/9] bg-black flex items-center justify-center">Loading...</div>`;

    await initFirebase();
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
            const libRef = collection(db, "users", user.uid, "library");
            const snapshot = await getDocs(libRef);
            window.app.state.carouselLibrarySet.clear();
            snapshot.forEach(doc => window.app.state.carouselLibrarySet.add(String(doc.id)));
            if (document.getElementById('carousel-ui-layer')) window.app.updateCarouselUI(window.app.state.carouselCurrentIndex);
        }
    });

    const response = await fetch('https://anikoto-api-xi.vercel.app/api/latest-episodes').then(r => r.json());
    window.app.state.carouselItems = (response.data || []).slice(0, 5);
    window.app.state.carouselCurrentIndex = 0;

    container.innerHTML = `
        <div class="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-black">
            <div id="hero-slides"></div>
            <div id="carousel-ui-layer" class="absolute bottom-8 left-4 md:left-12 z-40 transition-opacity"></div>
            <button onclick="window.app.changeSlide(-1)" class="absolute left-2 top-1/2 z-50 text-white bg-black/50 p-3 rounded-full hover:bg-[#F47521]"><i class="fas fa-chevron-left"></i></button>
            <button onclick="window.app.changeSlide(1)" class="absolute right-2 top-1/2 z-50 text-white bg-black/50 p-3 rounded-full hover:bg-[#F47521]"><i class="fas fa-chevron-right"></i></button>
            <div id="carousel-indicators" class="absolute bottom-8 right-8 flex gap-2 z-50"></div>
        </div>
    `;
    renderSlides();
    window.app.updateCarouselUI(0);
};

function renderSlides() {
    const slides = window.app.state.carouselItems;
    document.getElementById('hero-slides').innerHTML = slides.map((s, i) => `
        <div class="absolute inset-0 transition-opacity duration-700 ${i === 0 ? 'opacity-100 z-20' : 'opacity-0 z-10'}" id="slide-bg-${i}">
            <img src="${s.image}" class="w-full h-full object-cover">
        </div>`).join('');
    document.getElementById('carousel-indicators').innerHTML = slides.map((_, i) => `<div onclick="window.app.goToCarouselSlide(${i})" class="w-3 h-3 rounded-full bg-white/50 cursor-pointer" id="dot-${i}"></div>`).join('');
}

window.app.changeSlide = (direction) => {
    const total = window.app.state.carouselItems.length;
    let next = (window.app.state.carouselCurrentIndex + direction) % total;
    if (next < 0) next = total - 1;
    window.app.goToCarouselSlide(next);
};

window.app.goToCarouselSlide = (index) => {
    document.getElementById(`slide-bg-${window.app.state.carouselCurrentIndex}`).style.opacity = '0';
    document.getElementById(`slide-bg-${index}`).style.opacity = '1';
    window.app.state.carouselCurrentIndex = index;
    window.app.updateCarouselUI(index);
};

window.app.updateCarouselUI = (index) => {
    const ui = document.getElementById('carousel-ui-layer');
    const data = window.app.state.carouselItems[index];
    const isAdded = window.app.state.carouselLibrarySet.has(String(data.id));
    
    ui.innerHTML = `
        <h2 class="text-4xl font-bold text-white mb-4">${data.title}</h2>
        <button id="lib-btn" onclick="window.app.handleCarouselLibraryClick(event, ${index})" 
            class="${isAdded ? 'bg-green-600' : 'bg-[#F47521]'} text-white px-6 py-2 rounded">
            ${isAdded ? 'Added' : 'Add to Library'}
        </button>
    `;
};

window.app.handleCarouselLibraryClick = async (e, index) => {
    e.stopPropagation();
    const item = window.app.state.carouselItems[index];
    const { doc, setDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
    const docRef = doc(db, "users", auth.currentUser.uid, "library", String(item.id));
    
    if (window.app.state.carouselLibrarySet.has(String(item.id))) {
        await deleteDoc(docRef);
        window.app.state.carouselLibrarySet.delete(String(item.id));
    } else {
        await setDoc(docRef, { id: item.id, title: item.title, timestamp: Date.now() });
        window.app.state.carouselLibrarySet.add(String(item.id));
    }
    window.app.updateCarouselUI(index); // Refresh UI state
};
