import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, query, onSnapshot, getDoc, doc, 
    addDoc, updateDoc, deleteDoc, getDocs, where, orderBy, FieldValue, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1. KONFIGURACJA FIREBASE (Twoja)
const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargugwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};

// Zmienne globalne
let app, auth, db;

// Ścieżki (Główne kolekcje)
const PATH_USERS = 'users';     
const PATH_TEAMS = 'teams';
const PATH_MATCHES = 'matches';
const PATH_SCORERS = 'scorers';

// ==========================================
// FUNKCJA INICJALIZUJĄCA (Bezpieczna)
// ==========================================
function initializeFirebaseClients() {
    try {
        if (!app) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            console.log("Firebase zainicjowane.");
        }
        return true;
    } catch (e) {
        console.error("Błąd inicjalizacji:", e);
        showMessage("Krytyczny błąd Firebase.", 'error');
        return false;
    }
}

// ==========================================
// FUNKCJE UI I POMOCNICZE
// ==========================================
function showMessage(text, type = 'success') {
    const el = document.getElementById('login-msg');
    // Próbujemy znaleźć element wiadomości w różnych miejscach
    const msgBox = el || document.getElementById('team-msg') || document.getElementById('admin-msg');
    
    if (msgBox) {
        msgBox.textContent = text;
        msgBox.className = `message ${type}`;
        // Wyczyść po 3 sek
        setTimeout(() => msgBox.textContent = '', 3000);
    } else {
        console.log(`[${type.toUpperCase()}]: ${text}`);
    }
}

// Eksport funkcji do globalnego scope (dla przycisków w HTML)
window.logout = async () => {
    if(auth) await signOut(auth);
    window.location.reload();
};

// ==========================================
// LOGOWANIE I WERYFIKACJA
// ==========================================

// Obsługa przycisku logowania
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (!initializeFirebaseClients()) return;

        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!email || !pass) return;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            showMessage("Błąd logowania: " + e.message, 'error');
        }
    });
}

function setupAuthStateListener() {
    if (!auth) return;

    onAuthStateChanged(auth, async user => {
        const loginBox = document.getElementById('login-box');
        const adminPanel = document.getElementById('admin-wrapper');

        if (user) {
            try {
                // Sprawdź uprawnienia w bazie
                const docRef = doc(db, PATH_USERS, user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists() && (docSnap.data().admin === true || docSnap.data().role === 'admin')) {
                    // SUKCES - POKAŻ PANEL
                    if(loginBox) loginBox.style.display = 'none';
                    if(adminPanel) adminPanel.style.display = 'block';
                    
                    // Załaduj dane
                    initAdminFunctions();
                } else {
                    showMessage("Brak uprawnień administratora.", 'error');
                    await signOut(auth);
                }
            } catch (e) {
                console.error(e);
                showMessage("Błąd weryfikacji uprawnień.", 'error');
                await signOut(auth);
            }
        } else {
            // Wylogowany
            if(loginBox) loginBox.style.display = 'block';
            if(adminPanel) adminPanel.style.display = 'none';
        }
    });
}

function initAdminFunctions() {
    loadTeamsSelects();
    loadMatches();
    loadScorersTable();
    loadTeamsList(); // Nowe: Ładowanie listy drużyn
}

// ==========================================
// ZARZĄDZANIE DRUŻYNAMI
// ==========================================

// 1. Dodawanie drużyny
window.addTeam = async () => {
    const name = document.getElementById('new-team-name').value;
    const email = document.getElementById('new-team-manager').value; // Opcjonalne
    
    if (!name) return showMessage("Podaj nazwę drużyny!", 'error');

    try {
        await addDoc(collection(db, PATH_TEAMS), { 
            name, 
            managerEmail: email, 
            group: 'A', 
            points: 0, 
            createdAt: serverTimestamp() 
        });
        showMessage(`Dodano drużynę: ${name}`, 'success');
        document.getElementById('new-team-name').value = '';
        loadTeamsSelects(); // Odśwież selecty
    } catch(e) {
        showMessage("Błąd dodawania.", 'error');
    }
};

// 2. Wyświetlanie listy drużyn do edycji
function loadTeamsList() {
    const list = document.getElementById('teams-list');
    if(!list) return;

    onSnapshot(query(collection(db, PATH_TEAMS), orderBy('name')), snap => {
        const selectEdit = document.getElementById('edit-team-select');
        if(selectEdit) selectEdit.innerHTML = '<option value="">Wybierz drużynę</option>';
        
        let html = '<ul style="list-style:none; padding:0;">';
        
        snap.forEach(d => {
            const t = d.data();
            // Dodaj do listy HTML
            html += `<li style="background:#222; margin:5px 0; padding:10px; display:flex; justify-content:space-between;">
                        <span><b>${t.name}</b></span>
                        <button onclick="window.deleteTeam('${d.id}', '${t.name}')" style="color:red;">Usuń</button>
                     </li>`;
            
            // Dodaj do selecta edycji
            if(selectEdit) selectEdit.innerHTML += `<option value="${d.id}">${t.name}</option>`;
        });
        html += '</ul>';
        list.innerHTML = html;
    });
}

// 3. Edycja nazwy drużyny
window.updateTeamName = async () => {
    const id = document.getElementById('edit-team-select').value;
    const newName = document.getElementById('edit-team-name').value;
    
    if(!id || !newName) return;
    
    await updateDoc(doc(db, PATH_TEAMS, id), { name: newName });
    showMessage("Nazwa zmieniona!", 'success');
    document.getElementById('edit-team-name').value = '';
};

// 4. Usuwanie drużyny
window.deleteTeam = async (id, name) => {
    if(!confirm(`Usunąć drużynę ${name}?`)) return;
    await deleteDoc(doc(db, PATH_TEAMS, id));
};


// ==========================================
// ZARZĄDZANIE ZAWODNIKAMI
// ==========================================

// Ładowanie selectów (do meczów i zawodników)
function loadTeamsSelects() {
    const q = query(collection(db, PATH_TEAMS), orderBy('name'));
    // To jest jednorazowe pobranie lub snapshot, tutaj snapshot dla aktualności
    onSnapshot(q, snap => {
        const selects = [
            document.getElementById('new-match-team1'),
            document.getElementById('new-match-team2'),
            document.getElementById('players-team-select')
        ];
        
        const opts = ['<option value="">-- Wybierz --</option>'];
        snap.forEach(d => opts.push(`<option value="${d.id}">${d.data().name}</option>`));
        
        selects.forEach(s => { if(s) s.innerHTML = opts.join(''); });
    });
}

// Wybór drużyny do zarządzania składem
window.selectTeamInDropdown = () => {
    const teamId = document.getElementById('players-team-select').value;
    const area = document.getElementById('players-manager-area');
    const list = document.getElementById('team-players-list');
    
    if(!teamId) {
        area.style.display = 'none';
        return;
    }
    
    area.style.display = 'block';
    
    // Nasłuchuj graczy tej drużyny
    const q = query(collection(db, PATH_TEAMS, teamId, 'players'), orderBy('number'));
    onSnapshot(q, snap => {
        list.innerHTML = '';
        if(snap.empty) list.innerHTML = '<p>Brak zawodników.</p>';
        
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `
                <div style="background:#333; padding:5px; margin:5px 0; display:flex; justify-content:space-between;">
                    <span>#${p.number} ${p.name} ${p.surname} (${p.position})</span>
                    <button onclick="window.delPlayer('${teamId}', '${d.id}')" style="color:red;">X</button>
                </div>
            `;
        });
    });
};

window.addPlayerAdmin = async () => {
    const teamId = document.getElementById('players-team-select').value;
    const name = document.getElementById('new-p-name').value;
    const surname = document.getElementById('new-p-surname').value;
    const number = parseInt(document.getElementById('new-p-number').value);
    const position = document.getElementById('new-p-position').value;

    if(!teamId || !name) return;

    await addDoc(collection(db, PATH_TEAMS, teamId, 'players'), {
        name, surname, number, position
    });
    showMessage("Dodano zawodnika", 'success');
};

window.delPlayer = async (tid, pid) => {
    if(confirm("Usunąć?")) await deleteDoc(doc(db, PATH_TEAMS, tid, 'players', pid));
};


// ==========================================
// ZARZĄDZANIE MECZAMI
// ==========================================

window.addMatch = async () => {
    const t1Select = document.getElementById('new-match-team1');
    const t2Select = document.getElementById('new-match-team2');
    
    const team1Id = t1Select.value;
    const team2Id = t2Select.value;
    
    // Pobieramy nazwy tekstowe dla łatwiejszego wyświetlania
    const teamA = t1Select.options[t1Select.selectedIndex].text;
    const teamB = t2Select.options[t2Select.selectedIndex].text;
    
    const group = document.getElementById('group').value;
    const date = document.getElementById('new-match-date').value;
    const time = document.getElementById('new-match-time').value;

    if(!team1Id || !team2Id) return showMessage("Wybierz drużyny", 'error');

    await addDoc(collection(db, PATH_MATCHES), {
        teamA, teamB, 
        team1Id, team2Id,
        group, date, time,
        goalsA: 0, goalsB: 0, status: 'scheduled', scorers: []
    });
    showMessage("Mecz dodany!", 'success');
};

function loadMatches() {
    const list = document.getElementById('matches-list');
    const filter = document.getElementById('match-status-filter');
    
    // Obsługa zmiany filtra
    filter.onchange = () => loadMatches(); // Przeładowanie przy zmianie (uproszczone, lepiej filtrować w pamięci, ale to zadziała)

    // Pobieramy wszystkie mecze
    onSnapshot(query(collection(db, PATH_MATCHES), orderBy('date', 'desc')), snap => {
        list.innerHTML = '';
        
        snap.forEach(d => {
            const m = d.data();
            // Prosty filtr w JS
            if (filter.value !== 'wszyscy') {
                 const map = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                 if (m.status !== map[filter.value]) return;
            }

            const div = document.createElement('div');
            div.className = 'match-card';
            div.style.cssText = `background:#1e1e1e; padding:10px; margin-bottom:10px; border:1px solid #333; border-left: 4px solid ${m.status==='live'?'red':'#444'}`;
            
            const statusSel = `
                <select onchange="window.updStatus('${d.id}', this.value)" style="width:auto; padding:2px;">
                    <option value="scheduled" ${m.status==='scheduled'?'selected':''}>Plan</option>
                    <option value="live" ${m.status==='live'?'selected':''}>LIVE</option>
                    <option value="finished" ${m.status==='finished'?'selected':''}>Koniec</option>
                </select>
            `;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; color:white; font-weight:bold;">
                    <span>${m.teamA} vs ${m.teamB}</span>
                    <span>${m.date} ${m.time}</span>
                </div>
                <div style="margin-top:10px; display:flex; align-items:center; gap:5px;">
                    <input type="number" id="ga-${d.id}" value="${m.goalsA}" style="width:40px;"> : 
                    <input type="number" id="gb-${d.id}" value="${m.goalsB}" style="width:40px;">
                    ${statusSel}
                    <button onclick="window.updScore('${d.id}')" style="background:#2196f3; color:white;">OK</button>
                    <button onclick="window.delMatch('${d.id}')" style="background:red; color:white;">X</button>
                </div>
                
                <!-- Szybkie dodawanie gola -->
                <div style="margin-top:5px; border-top:1px solid #333; padding-top:5px;">
                    <small style="color:#aaa;">+ Gol:</small>
                    <input id="sc-name-${d.id}" placeholder="Nazwisko" style="width:80px;">
                    <select id="sc-team-${d.id}">
                        <option value="${m.teamA}">${m.teamA}</option>
                        <option value="${m.teamB}">${m.teamB}</option>
                    </select>
                    <button onclick="window.addGoal('${d.id}', '${m.teamA}', '${m.teamB}')">+</button>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

window.updStatus = async (id, status) => updateDoc(doc(db, PATH_MATCHES, id), { status });
window.updScore = async (id) => {
    const gA = parseInt(document.getElementById(`ga-${id}`).value);
    const gB = parseInt(document.getElementById(`gb-${id}`).value);
    await updateDoc(doc(db, PATH_MATCHES, id), { goalsA: gA, goalsB: gB });
    showMessage("Wynik zapisany.");
};
window.delMatch = async (id) => { if(confirm("Usunąć mecz?")) await deleteDoc(doc(db, PATH_MATCHES, id)); };

window.addGoal = async (matchId, tA, tB) => {
    const name = document.getElementById(`sc-name-${matchId}`).value;
    const team = document.getElementById(`sc-team-${matchId}`).value;
    if(!name) return;

    const matchRef = doc(db, PATH_MATCHES, matchId);
    
    // 1. Update meczu
    const updates = { scorers: FieldValue.arrayUnion({ name, team }) };
    if(team === tA) updates.goalsA = FieldValue.increment(1);
    else updates.goalsB = FieldValue.increment(1);
    await updateDoc(matchRef, updates);

    // 2. Update tabeli strzelców
    const q = query(collection(db, PATH_SCORERS), where('name', '==', name));
    const snap = await getDocs(q);
    if(snap.empty) {
        await addDoc(collection(db, PATH_SCORERS), { name, team, goals: 1 });
    } else {
        await updateDoc(doc(db, PATH_SCORERS, snap.docs[0].id), { goals: FieldValue.increment(1) });
    }
    showMessage("Gol dodany!", 'success');
};

// --- INNE ---
function loadScorersTable() {
    onSnapshot(query(collection(db, PATH_SCORERS), orderBy('goals', 'desc')), snap => {
        const tbody = document.querySelector('#scorers-table tbody');
        tbody.innerHTML = '';
        snap.forEach(d => {
            const s = d.data();
            tbody.innerHTML += `<tr><td>${s.name}</td><td>${s.team}</td><td>${s.goals}</td><td><button onclick="window.delScorer('${d.id}')" style="color:red">X</button></td></tr>`;
        });
    });
}
window.delScorer = async (id) => { if(confirm("Usunąć?")) await deleteDoc(doc(db, PATH_SCORERS, id)); };

document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    const q = query(collection(db, PATH_USERS), where('email', '==', email));
    const snap = await getDocs(q);
    if(snap.empty) return showMessage("Nie znaleziono użytkownika.", 'error');
    snap.forEach(async d => await updateDoc(d.ref, { role: 'admin', admin: true }));
    showMessage("Nadano uprawnienia admina.", 'success');
});


// --- URUCHOMIENIE ---
document.addEventListener('DOMContentLoaded', () => {
    if (initializeFirebaseClients()) {
        setupAuthStateListener();
    }
});
