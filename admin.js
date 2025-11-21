import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, query, onSnapshot, getDoc, doc, 
    addDoc, updateDoc, deleteDoc, getDocs, where, orderBy, FieldValue 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcja zastępująca alert() i confirm()
function showMessage(message, type = 'info', isConfirm = false, callback = null) {
    const loginMsgEl = document.getElementById('login-msg');
    
    if (loginMsgEl) {
        loginMsgEl.textContent = message;
        loginMsgEl.className = `message ${type}`;
        if (!isConfirm && type !== 'error') {
             setTimeout(() => loginMsgEl.textContent = '', 3000);
        }
        return; 
    }
    console.warn(`[Wiadomość]: ${message}`);
}


// ==========================================
// 1. KONFIGURACJA FIREBASE
// ==========================================

const HARDCODED_CONFIG = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargugwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};

// Pobieranie konfiguracji z Canvas lub użycie zapasowej
let firebaseConfig = HARDCODED_CONFIG;
try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
    }
} catch (e) {
    console.warn("Użyto hardkodowanej konfiguracji.");
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Globalne obiekty Firebase
let app, auth, db;

// 🔥🔥🔥 KLUCZOWA POPRAWKA ŚCIEŻEK 🔥🔥🔥
// Teraz kod będzie szukał tam, gdzie stworzyłeś dokumenty (w głównym katalogu)
const PATH_USERS = 'users';     
const PATH_TEAMS = 'teams';     
const PATH_MATCHES = 'matches'; 
const PATH_SCORERS = 'scorers'; 


// ==========================================
// 2. LOGOWANIE I ZABEZPIECZENIA
// ==========================================
const loginBox = document.getElementById('login-box');
const adminPanel = document.getElementById('admin-wrapper');

// Inicjalizacja Firebase
function initializeFirebaseClients() {
    try {
        if (!app) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            console.log("Firebase zainicjowane poprawnie.");
        }
    } catch (e) {
         console.error("KRYTYCZNY BŁĄD FIREBASE:", e);
         showMessage("Nie można zainicjować Firebase.", 'error', false);
         return false;
    }
    return true;
}

// Logowanie tokenem
async function authenticateWithToken() {
    if (initialAuthToken && auth) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Zalogowano tokenem.");
        } catch (error) {
            console.error("Błąd tokena:", error);
        }
    }
}

// Logowanie e-mail/hasło
document.getElementById('login-btn').addEventListener('click', async () => {
    if (!initializeFirebaseClients()) return;
    
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!email || !pass) return;
    showMessage("Weryfikacja...", 'info', false);
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        showMessage(`Błąd: ${err.message}`, 'error', false);
    }
});

// Główny strażnik dostępu
function setupAuthStateListener() {
    if (!auth) return;

    onAuthStateChanged(auth, async user => {
        if (!db && user) {
            if (!initializeFirebaseClients()) {
                signOut(auth);
                return;
            }
        }
        
        if (user) {
            try {
                console.log(`Szukam uprawnień dla UID: ${user.uid} w kolekcji: ${PATH_USERS}`);
                
                // Szukamy w kolekcji 'users' dokumentu o nazwie równej UID
                const docRef = doc(db, PATH_USERS, user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("Znaleziono dokument użytkownika:", data);
                    
                    // Sprawdzenie uprawnień
                    if (data.admin === true || data.role === 'admin') {
                        // SUKCES!
                        loginBox.style.display = 'none';
                        adminPanel.style.display = 'block';
                        initAdminPanel(); 
                    } else {
                        // Dokument jest, ale brak flagi admina
                        console.error("Brak flagi admin:true lub role:admin");
                        showMessage(`Konto istnieje, ale nie ma uprawnień admina. UID: ${user.uid}`, 'error', false);
                        signOut(auth); 
                    }
                } else {
                    // Dokumentu w ogóle nie ma
                    console.error("Dokument użytkownika nie istnieje w Firestore!");
                    showMessage(`Brak dokumentu w bazie dla UID: ${user.uid}. Upewnij się, że stworzyłeś go w kolekcji 'users'.`, 'error', false);
                    signOut(auth); 
                }
            } catch (e) {
                console.error("Błąd odczytu:", e);
                showMessage(`Błąd systemu: ${e.message}`, 'error', false);
                signOut(auth); 
            }
        } else {
            loginBox.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    });

    authenticateWithToken();
}


// ==========================================
// 3. FUNKCJE PANELU
// ==========================================

function initAdminPanel() {
    if (!initializeFirebaseClients()) return;
    loadTeamsSelect();
    loadMatches();
    loadGlobalScorers();
}

// --- A. ŁADOWANIE DRUŻYN ---
async function loadTeamsSelect() {
    const selectA = document.getElementById('teamA');
    const selectB = document.getElementById('teamB');
    const selectScorerTeam = document.getElementById('scorer-team');
    
    if(!selectA || !db) return;

    const defaultOpt = '<option value="">-- Wybierz --</option>';
    selectA.innerHTML = defaultOpt;
    selectB.innerHTML = defaultOpt;
    if(selectScorerTeam) selectScorerTeam.innerHTML = defaultOpt;

    try {
        const teamsCol = collection(db, PATH_TEAMS);
        const q = query(teamsCol, orderBy('name'));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const t = doc.data();
            const teamName = t.name || doc.id;
            const option = `<option value="${teamName}">${teamName}</option>`;
            selectA.innerHTML += option;
            selectB.innerHTML += option;
            if(selectScorerTeam) selectScorerTeam.innerHTML += option;
        });
    } catch (e) {
        console.error("Błąd ładowania drużyn:", e);
    }
}

// --- B. DODAWANIE MECZU ---
document.getElementById('add-match-btn').addEventListener('click', async () => {
    if (!db) return;
    
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const group = document.getElementById('group').value;
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;

    if (!teamA || !teamB || !group) {
        showMessage("Wybierz drużyny i wpisz grupę.", 'warning', false);
        return;
    }

    try {
        await addDoc(collection(db, PATH_MATCHES), {
            teamA, teamB, goalsA: 0, goalsB: 0, group, date, time,
            status: 'scheduled', scorers: []
        });
        showMessage("Mecz dodany!", 'success', false);
    } catch (e) {
        showMessage("Błąd dodawania meczu.", 'error', false);
    }
});

// --- C. LISTA MECZÓW ---
function loadMatches() {
    if (!db) return;
    
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;

    onSnapshot(collection(db, PATH_MATCHES), (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding:10px;">Brak meczów.</p>';
            return;
        }
        
        let matches = [];
        snapshot.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));

        matches.sort((a, b) => {
            const dateA = a.date + a.time;
            const dateB = b.date + b.time;
            return dateB.localeCompare(dateA); 
        });

        matches.forEach(m => {
            if (statusFilter !== 'wszyscy') {
                const mapStatus = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                if (m.status !== mapStatus[statusFilter]) return;    
            }

            const div = document.createElement('div');
            div.style.cssText = "background: #0a0a1f; border: 1px solid #1e3a5f; padding: 20px; margin-bottom: 15px; border-radius: 12px; color: white;";
            if(m.status === 'live') div.style.border = "2px solid #ff4d4d";

            const statusOptions = `
                <option value="scheduled" ${m.status === 'scheduled' ? 'selected' : ''}>📅 Planowany</option>
                <option value="live" ${m.status === 'live' ? 'selected' : ''}>🔴 NA ŻYWO</option>
                <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>🏁 Zakończony</option>
            `;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:bold; font-size: 1.1em;">
                    <span>${m.teamA} vs ${m.teamB}</span>
                    <span style="color:#00bfff;">Gr. ${m.group} (${m.date} ${m.time})</span>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px; background:#101a2e; padding:10px; border-radius:5px;">
                    <input type="number" id="gA-${m.id}" value="${m.goalsA}" style="width:50px; text-align:center; font-weight:bold; color:white; background:#0a0a1f; border:1px solid #1e3a5f;">
                    <span style="font-weight:bold;">:</span>
                    <input type="number" id="gB-${m.id}" value="${m.goalsB}" style="width:50px; text-align:center; font-weight:bold; color:white; background:#0a0a1f; border:1px solid #1e3a5f;">
                    <select onchange="updateStatus('${m.id}', this.value)" style="width:auto; padding:8px; background:#1e3a5f; color:white;">${statusOptions}</select>
                    <button onclick="updateScore('${m.id}')" style="background:#007bff;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">Zapisz</button>
                    <button onclick="deleteMatchPrompt('${m.id}')" style="background:#dc3545;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;margin-left:auto;">🗑</button>
                </div>
                <div style="border-top:1px solid #1e3a5f; padding-top:10px;">
                    <small style="color:#00bfff; display:block; margin-bottom:5px;">Dodaj strzelca:</small>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="sc-name-${m.id}" placeholder="Nazwisko" style="width:120px; background:#0a0a1f;">
                        <select id="sc-team-${m.id}" style="width:auto; background:#0a0a1f;">
                            <option value="${m.teamA}">${m.teamA}</option>
                            <option value="${m.teamB}">${m.teamB}</option>
                        </select>
                        <button onclick="addGoalAndGlobalScorer('${m.id}', '${m.teamA}', '${m.teamB}')" style="background:#28a745;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">+1 Gol</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// --- FUNKCJE POMOCNICZE ---
window.updateStatus = async (id, newStatus) => {
    try { await updateDoc(doc(db, PATH_MATCHES, id), { status: newStatus }); showMessage("Status OK!", 'success'); } catch(e) {}
};
window.updateScore = async (id) => {
    const gA = parseInt(document.getElementById(`gA-${id}`).value) || 0;
    const gB = parseInt(document.getElementById(`gB-${id}`).value) || 0;
    try { await updateDoc(doc(db, PATH_MATCHES, id), { goalsA: gA, goalsB: gB }); showMessage("Wynik OK!", 'success'); } catch(e) {}
};
window.deleteMatchPrompt = (id) => {
    showMessage("Usunąć mecz?", 'warning', true, async (ok) => { if(ok) await deleteDoc(doc(db, PATH_MATCHES, id)); });
};

// --- D. DUAL WRITE ---
window.addGoalAndGlobalScorer = async (matchId, teamAName, teamBName) => {
    const name = document.getElementById(`sc-name-${matchId}`).value.trim();
    const team = document.getElementById(`sc-team-${matchId}`).value;
    if (!name) return;

    try {
        const updateData = {};
        if (team === teamAName) updateData.goalsA = FieldValue.increment(1);
        else updateData.goalsB = FieldValue.increment(1);
        updateData.scorers = FieldValue.arrayUnion({ name, team });
        await updateDoc(doc(db, PATH_MATCHES, matchId), updateData);

        const q = query(collection(db, PATH_SCORERS), where('name', '==', name), where('team', '==', team));
        const snap = await getDocs(q);
        if (snap.empty) {
            await addDoc(collection(db, PATH_SCORERS), { name, team, goals: 1 });
        } else {
            await updateDoc(doc(db, PATH_SCORERS, snap.docs[0].id), { goals: FieldValue.increment(1) });
        }
        showMessage(`Gol dla: ${name}!`, 'success');
        document.getElementById(`sc-name-${matchId}`).value = '';
    } catch (e) { console.error(e); }
};

// --- E. TABELA STRZELCÓW ---
function loadGlobalScorers() {
    if (!db) return;
    const tbody = document.querySelector('#scorers-table tbody');
    onSnapshot(query(collection(db, PATH_SCORERS), orderBy('goals', 'desc')), (snap) => {
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const s = doc.data();
            tbody.innerHTML += `
                <tr style="border-bottom:1px solid #eee;">
                    <td>${s.name}</td><td>${s.team}</td><td><strong>${s.goals}</strong></td>
                    <td><button onclick="deleteScorer('${doc.id}')" style="color:red;">X</button></td>
                </tr>`;
        });
    });
}
window.deleteScorer = async (id) => { if(confirm("Usunąć?")) await deleteDoc(doc(db, PATH_SCORERS, id)); };

// --- F. INNE ---
document.getElementById('create-team-btn').addEventListener('click', async () => {
    const name = document.getElementById('team-id').value;
    const email = document.getElementById('team-email').value;
    if(!name) return;
    await addDoc(collection(db, PATH_TEAMS), { name, email, group:'A', points:0 });
    showMessage(`Dodano drużynę ${name}`, 'success');
});

document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    const q = query(collection(db, PATH_USERS), where('email', '==', email));
    const snap = await getDocs(q);
    if(snap.empty) return showMessage("Brak usera w bazie", 'warning');
    snap.forEach(async d => await updateDoc(doc(db, PATH_USERS, d.id), { role: 'admin', admin: true }));
    showMessage("Nadano admina", 'success');
});

// START
document.getElementById('match-status-filter').addEventListener('change', loadMatches);
document.addEventListener('DOMContentLoaded', () => {
    if (initializeFirebaseClients()) setupAuthStateListener();
});
