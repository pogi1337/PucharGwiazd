/* =========================================
   SCRIPT.JS - GŁÓWNA LOGIKA UI
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. INICJALIZACJA ANIMACJI (AOS)
    // Sprawdza, czy biblioteka jest załadowana, żeby nie było błędów
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800, // Czas trwania animacji w ms
            once: true,    // Animacja odtwarza się tylko raz
            offset: 50     // Start animacji, gdy element jest 50px od dołu
        });
    }

    // 2. ODLICZANIE (Twoja stara funkcja - zachowana)
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        // Data docelowa (możesz ją tu zmienić)
        const countDownDate = new Date("Jul 14, 2026 10:00:00").getTime(); 

        const x = setInterval(function() {
            const now = new Date().getTime();
            const distance = countDownDate - now;

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            countdownElement.innerHTML = 
                `<div>${days}<span>Dni</span></div>` +
                `<div>${hours}<span>Godz</span></div>` +
                `<div>${minutes}<span>Min</span></div>` +
                `<div>${seconds}<span>Sek</span></div>`;

            if (distance < 0) {
                clearInterval(x);
                countdownElement.innerHTML = "<div style='font-size:1.2rem; color:var(--accent)'>Turniej rozpoczęty!</div>";
            }
        }, 1000);
    }

    // 3. AKTUALNY CZAS (Twoja stara funkcja - zachowana)
    const currentTimeElement = document.getElementById('current-time');
    if (currentTimeElement) {
        function updateTime() {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            currentTimeElement.innerHTML = `<i class="fa-solid fa-clock"></i> ${now.toLocaleDateString('pl-PL', options)}`;
        }
        updateTime();
        setInterval(updateTime, 1000);
    }
    
    // 4. OBSŁUGA MENU MOBILNEGO (Hamburger)
    // Jeśli dodasz w HTML przycisk o klasie .menu-toggle, to zadziała
    const mobileMenuBtn = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });
    }
});

/* =========================================
   FUNKCJE GLOBALNE (Dostępne w onclick HTML)
   ========================================= */

// --- MODALE (Dla strony "O Nas") ---
window.openModal = function(name, role, img, bio, fb, ig) {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    // Wstawianie danych do modala
    const elName = document.getElementById('m-name');
    const elRole = document.getElementById('m-role');
    const elImg = document.getElementById('m-img');
    const elBio = document.getElementById('m-bio');
    const btnFb = document.getElementById('m-fb');
    const btnIg = document.getElementById('m-ig');

    if (elName) elName.innerText = name;
    if (elRole) elRole.innerText = role;
    if (elImg) elImg.src = img;
    if (elBio) elBio.innerText = bio;
    
    // Obsługa linków social media
    if (btnFb) {
        if(fb && fb !== '#' && fb !== '') { 
            btnFb.href = fb; 
            btnFb.style.display = 'flex'; 
        } else { 
            btnFb.style.display = 'none'; 
        }
    }
    
    if (btnIg) {
        if(ig && ig !== '#' && ig !== '') { 
            btnIg.href = ig; 
            btnIg.style.display = 'flex'; 
        } else { 
            btnIg.style.display = 'none'; 
        }
    }

    // Pokazywanie modala
    overlay.style.display = 'flex';
    // Małe opóźnienie dla animacji CSS
    setTimeout(() => { overlay.classList.add('active'); }, 10);
    document.body.style.overflow = 'hidden'; // Blokada przewijania tła
}

window.closeModal = function() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto'; // Odblokowanie przewijania
    }, 500); // Czas musi pasować do transition w CSS (0.5s)
}

// Zamykanie klawiszem ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeModal();
});

// --- TOGGLE DLA DRUŻYN / TERMINARZA (Accordion) ---
window.toggleGroup = function(elementId, iconElement) {
    const content = document.getElementById(elementId);
    if (!content) return;

    // Przełącz klasę 'expanded' na kontenerze nadrzędnym (jeśli używasz kart)
    // LUB po prostu przełącz display/max-height
    
    const isVisible = content.style.display === 'block' || content.style.maxHeight !== '0px';
    
    if (content.classList.contains('match-list-container')) {
        // Logika dla Terminarza
        if (content.style.display === 'block') {
            content.style.display = 'none';
            if(iconElement) iconElement.classList.remove('active');
        } else {
            content.style.display = 'block';
            if(iconElement) iconElement.classList.add('active');
        }
    } else {
        // Logika dla Kart Drużyn (CSS transition)
        const card = document.getElementById(elementId.replace('details-', 'card-')); // np. card-team1
        if (card) {
            card.classList.toggle('expanded');
        }
    }
}