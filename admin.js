// ==========================================
// admin.js - Panel Administratora
// ==========================================

// 1. KONFIGURACJA FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:4868b8bbf66c4bc7dfe53e"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. LOGOWANIE ADMINA
// ==========================================
const loginBox = document.getElementById('login-box');
const adminPanel = document.getElementById('admin-wrapper');
const loginMsg = document.getElementById('login-msg');

// Obsługa przycisku logowania
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!email || !pass) return;

    loginMsg.textContent = "Logowanie...";
    
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        // onAuthStateChanged zajmie się resztą
    } catch (err) {
        loginMsg.textContent = "Błąd: " + err.message;
        loginMsg.className = "message error"; // Zakładając, że masz klasę .error w CSS
    }
});

// Sprawdzanie uprawnień po zalogowaniu
auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            // Sprawdzamy czy user ma pole admin: true LUB role: 'admin'
            if (doc.exists && (doc.data().admin === true || doc.data().role === 'admin')) {
                loginBox.style.display = 'none';
                adminPanel.style.display = 'block';
                initAdminPanel();
            } else {
                throw new Error("Brak uprawnień administratora.");
            }
        } catch (e) {
            loginMsg.textContent = e.message;
            auth.signOut();
            loginBox.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    } else {
        loginBox.style.display = 'block';
        adminPanel.style.display = 'none';
    }
});

// ==========================================
// 3. INICJALIZACJA PANELU
// ==========================================
function initAdminPanel() {
    loadTeamsSelect();
    loadMatches(); // Nasłuchiwanie meczów
}

// --- A. ŁADOWANIE DRUŻYN DO SELECTÓW ---
async function loadTeamsSelect() {
    const selectA = document.getElementById('teamA');
    const selectB = document.getElementById('teamB');
    const selectScorerTeam = document.getElementById('scorer-team');
    
    if(!selectA || !selectB) return;

    selectA.innerHTML = '<option value="">Wybierz drużynę A</option>';
    selectB.innerHTML = '<option value="">Wybierz drużynę B</option>';
    if(selectScorerTeam) selectScorerTeam.innerHTML = '<option value="">Wybierz drużynę</option>';

    const snapshot = await db.collection('teams').get();
    
    snapshot.forEach(doc => {
        const t = doc.data();
        const teamName = t.name || doc.id;
        const option = `<option value="${teamName}">${teamName}</option>`;
        
        selectA.innerHTML += option;
        selectB.innerHTML += option;
        if(selectScorerTeam) selectScorerTeam.innerHTML += option;
    });
}

// --- B. DODAWANIE MECZU ---
document.getElementById('add-match-btn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const group = document.getElementById('group').value;
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;

    if (!teamA || !teamB || !group) {
        alert("Wybierz obie drużyny i wpisz grupę.");
        return;
    }

    try {
        await db.collection('matches').add({
            teamA: teamA,
            teamB: teamB,
            goalsA: 0,
            goalsB: 0,
            group: group,
            date: date,
            time: time,
            status: 'scheduled', // WAŻNE: To musi być 'scheduled', 'live' lub 'finished'
            scorers: [] // Pusta tablica na start (a nie string!)
        });
        alert("Mecz dodany pomyślnie!");
    } catch (e) {
        console.error(e);
        alert("Błąd dodawania meczu.");
    }
});

// --- C. LISTA MECZÓW (Real-time) ---
function loadMatches() {
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;

    // Używamy onSnapshot dla podglądu na żywo
    db.collection('matches').orderBy('date', 'desc').onSnapshot(snapshot => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p>Brak meczów.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const m = doc.data();
            
            // Filtr statusu (client-side dla uproszczenia)
            if (statusFilter !== 'wszyscy') {
                // Mapowanie polskich nazw z filtra na angielskie w bazie
                const mapStatus = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                if (m.status !== mapStatus[statusFilter]) return; 
            }

            const matchEl = document.createElement('div');
            matchEl.className = 'match-card';
            // Dodajmy trochę styli inline, jeśli nie masz w CSS
            matchEl.style.background = "#222";
            matchEl.style.color = "#fff";
            matchEl.style.padding = "15px";
            matchEl.style.marginBottom = "15px";
            matchEl.style.borderRadius = "8px";
            matchEl.style.border = m.status === 'live' ? "2px solid #e53935" : "1px solid #444";

            // Status selection Logic
            const statusOptions = `
                <option value="scheduled" ${m.status === 'scheduled' ? 'selected' : ''}>📅 Planowany</option>
                <option value="live" ${m.status === 'live' ? 'selected' : ''}>🔴 NA ŻYWO</option>
                <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>🏁 Zakończony</option>
            `;

            // Strzelcy - wyświetlanie
            let scorersHtml = '';
            if (Array.isArray(m.scorers)) {
                scorersHtml = m.scorers.map((s, idx) => 
                    `<span style="font-size:0.8em; color:#bbb;">⚽ ${s.name} (${s.team}) <span style="cursor:pointer;color:red;" onclick="removeScorer('${doc.id}', ${idx})">[x]</span></span><br>`
                ).join('');
            }

            matchEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong>${m.teamA} vs ${m.teamB}</strong>
                    <span style="color:#aaa;">Gr. ${m.group}</span>
                </div>
                
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                    <input type="number" id="gA-${doc.id}" value="${m.goalsA}" style="width:50px; text-align:center;">
                    <span>:</span>
                    <input type="number" id="gB-${doc.id}" value="${m.goalsB}" style="width:50px; text-align:center;">
                    
                    <select id="st-${doc.id}" onchange="updateStatus('${doc.id}', this.value)">
                        ${statusOptions}
                    </select>
                    
                    <button onclick="updateScore('${doc.id}')" style="background:#2196f3;color:white;border:none;padding:5px 10px;cursor:pointer;">Zapisz Wynik</button>
                    <button onclick="deleteMatch('${doc.id}')" style="background:#d32f2f;color:white;border:none;padding:5px 10px;cursor:pointer;">Usuń</button>
                </div>

                <div style="border-top:1px solid #444; padding-top:10px;">
                    <small>Strzelcy:</small><br>
                    ${scorersHtml}
                    <div style="margin-top:5px;">
                        <input type="text" id="sc-name-${doc.id}" placeholder="Nazwisko strzelca" style="width:120px;">
                        <select id="sc-team-${doc.id}">
                            <option value="${m.teamA}">${m.teamA}</option>
                            <option value="${m.teamB}">${m.teamB}</option>
                        </select>
                        <button onclick="addMatchScorer('${doc.id}')" style="font-size:0.8em;">+ Dodaj Gola</button>
                    </div>
                </div>
            `;
            container.appendChild(matchEl);
        });
    });
}

// --- D. AKCJE NA MECZACH ---

// 1. Aktualizacja wyniku i statusu
window.updateScore = async (id) => {
    const gA = parseInt(document.getElementById(`gA-${id}`).value);
    const gB = parseInt(document.getElementById(`gB-${id}`).value);
    
    await db.collection('matches').doc(id).update({
        goalsA: gA,
        goalsB: gB
    });
    // Status aktualizuje się osobnym eventem onchange, ale wynik zapisujemy guzikiem
    alert("Wynik zapisany!");
};

window.updateStatus = async (id, newStatus) => {
    await db.collection('matches').doc(id).update({ status: newStatus });
};

window.deleteMatch = async (id) => {
    if(confirm("Czy na pewno usunąć ten mecz?")) {
        await db.collection('matches').doc(id).delete();
    }
};

// 2. Zarządzanie strzelcami wewnątrz meczu
window.addMatchScorer = async (matchId) => {
    const nameInput = document.getElementById(`sc-name-${matchId}`);
    const teamSelect = document.getElementById(`sc-team-${matchId}`);
    
    const name = nameInput.value.trim();
    const team = teamSelect.value;

    if (!name) return alert("Wpisz nazwisko strzelca");

    const matchRef = db.collection('matches').doc(matchId);
    
    // Używamy arrayUnion żeby dodać obiekt do tablicy
    await matchRef.update({
        scorers: firebase.firestore.FieldValue.arrayUnion({
            name: name,
            team: team
        })
    });

    nameInput.value = ''; // Wyczyść pole
};

window.removeScorer = async (matchId, index) => {
    // Firestore nie pozwala łatwo usunąć elementu po indeksie przez update()
    // Musimy pobrać dokument, zmodyfikować tablicę i zapisać całość.
    const matchRef = db.collection('matches').doc(matchId);
    const doc = await matchRef.get();
    
    if (doc.exists) {
        let scorers = doc.data().scorers || [];
        scorers.splice(index, 1); // Usuń element z tablicy
        await matchRef.update({ scorers: scorers });
    }
};


// --- E. TWORZENIE DRUŻYNY (Baza) ---
document.getElementById('create-team-btn').addEventListener('click', async () => {
    const name = document.getElementById('team-id').value;
    const email = document.getElementById('team-email').value;

    if(!name) return alert("Podaj nazwę");

    await db.collection('teams').add({
        name: name,
        email: email,
        group: 'A', // Domyślna
        points: 0
    });
    
    alert(`Dodano drużynę ${name}. Pamiętaj utworzyć konto w Authentication ręcznie!`);
    loadTeamsSelect(); // Odśwież selecty
});

// --- F. NADAWANIE ADMINA ---
document.getElementById('grant-admin-btn').addEventListener('click', async () => {
   const email = document.getElementById('new-admin-email').value;
   // To wymagałoby Cloud Functions, bo z poziomu klienta nie wylistujesz wszystkich userów po emailu 
   // w łatwy sposób bez odpowiednich indeksów i uprawnień.
   // Ale spróbujmy prostej metody szukania w kolekcji 'users' jeśli tam trzymasz dane:
   
   try {
       const snapshot = await db.collection('users').where('email', '==', email).get();
       if (snapshot.empty) {
           alert("Nie znaleziono użytkownika w bazie 'users' z tym emailem.");
           return;
       }
       snapshot.forEach(async doc => {
           await db.collection('users').doc(doc.id).update({ role: 'admin', admin: true });
       });
       alert("Nadano uprawnienia!");
   } catch(e) {
       console.error(e);
       alert("Błąd. Upewnij się, że masz kolekcję 'users' z polami email.");
   }
});

// Obsługa filtra w HTML
document.getElementById('match-status-filter').addEventListener('change', loadMatches);
