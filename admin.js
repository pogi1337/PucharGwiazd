import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, query, onSnapshot, getDoc, doc, 
    addDoc, updateDoc, deleteDoc, getDocs, where, orderBy, FieldValue 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcja zastępująca alert() i confirm()
function showMessage(message, type = 'info', isConfirm = false, callback = null) {
    // UWAGA: Ta funkcja wymaga, aby w pliku admin.html istniał dedykowany modal/div
    const msgEl = document.getElementById('custom-message-box');
    const loginMsgEl = document.getElementById('login-msg'); // Używamy też dla komunikatów logowania
    
    if (loginMsgEl) {
        loginMsgEl.textContent = message;
        loginMsgEl.className = `message ${type}`;
        // Jeśli to nie jest błąd, ukrywamy po czasie
        if (!isConfirm && type !== 'error') {
             setTimeout(() => loginMsgEl.textContent = '', 3000);
        }
        // W pełnej implementacji powinna być obsługa modala custom-message-box
        return; 
    }
    console.warn(`[Wiadomość]: ${message}`);
}


// ==========================================
// 1. KONFIGURACJA FIREBASE (MODULARNA I DYNAMICZNA)
// ==========================================

// Zapasowa, hardkodowana konfiguracja (Twoja)
const HARDCODED_CONFIG = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let firebaseConfig;

try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        // Jeśli zmienna Canvas istnieje, użyj jej
        firebaseConfig = JSON.parse(__firebase_config);
    } else {
        // Jeśli zmienna Canvas jest pusta, użyj hardkodowanej konfiguracji
        firebaseConfig = HARDCODED_CONFIG;
        console.warn("Użyto hardkodowanej konfiguracji Firebase w admin.js.");
    }
} catch (e) {
    console.error("Błąd parsowania __firebase_config, użyto hardkodowanej konfiguracji.");
    firebaseConfig = HARDCODED_CONFIG;
}

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


// 🔥 KRYTYCZNE INICJALIZOWANIE APLIKACJI
// Ten kod zostanie wykonany na starcie pliku admin.js:
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Ścieżki do kolekcji (wymagane w Canvas)
const PATH_USERS = `artifacts/${appId}/users`;
const PATH_TEAMS = `artifacts/${appId}/public/data/teams`;
const PATH_MATCHES = `artifacts/${appId}/public/data/matches`;
const PATH_SCORERS = `artifacts/${appId}/public/data/scorers`;


// ==========================================
// 2. LOGOWANIE I ZABEZPIECZENIA
// ==========================================
const loginBox = document.getElementById('login-box');
const adminPanel = document.getElementById('admin-wrapper');
// const loginMsg = document.getElementById('login-msg'); // Używamy showMessage, które używa tego elementu

// Logowanie tokenem (główna metoda autoryzacji w Canvas)
async function authenticateWithToken() {
    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Autentykacja tokenem Canvas udana.");
            // onAuthStateChanged obsłuży przekierowanie do panelu
        } catch (error) {
            console.error("Błąd autentykacji tokenem:", error);
            // Nadal czekamy na logowanie e-mail/hasło
        }
    } else {
        console.log("Brak tokena Canvas, użyj formularza logowania.");
    }
}

// Logowanie e-mail/hasło
document.getElementById('login-btn').addEventListener('click', async () => {
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


// Główny strażnik dostępu - sprawdza uprawnienia przy każdym odświeżeniu
onAuthStateChanged(auth, async user => {
    if (user) {
        try {
            // Sprawdzamy w bazie czy ten user to admin
            const docRef = doc(db, PATH_USERS, user.uid);
            const docSnap = await getDoc(docRef);
            
            // Warunek: dokument musi istnieć ORAZ (mieć admin:true LUB role:'admin')
            if (docSnap.exists() && (docSnap.data().admin === true || docSnap.data().role === 'admin')) {
                // JEST ADMINEM -> POKAŻ PANEL
                loginBox.style.display = 'none';
                adminPanel.style.display = 'block';
                initAdminPanel(); // Załaduj dane
            } else {
                // NIE JEST ADMINEM -> Wyrzuć
                throw new Error("To konto nie ma uprawnień administratora.");
            }
        } catch (e) {
            showMessage(e.message, 'error', false);
            signOut(auth); // Wyloguj natychmiast
            loginBox.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    } else {
        // Nikt nie jest zalogowany
        loginBox.style.display = 'block';
        adminPanel.style.display = 'none';
    }
});

// Uruchomienie autentykacji tokenem przy starcie
authenticateWithToken();


// ==========================================
// 3. FUNKCJE PANELU
// ==========================================
function initAdminPanel() {
    loadTeamsSelect();
    loadMatches();
    loadGlobalScorers();
}

// --- A. ŁADOWANIE DRUŻYN DO LIST WYBORU ---
async function loadTeamsSelect() {
    const selectA = document.getElementById('teamA');
    const selectB = document.getElementById('teamB');
    const selectScorerTeam = document.getElementById('scorer-team');
    
    if(!selectA) return;

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
        showMessage("Błąd ładowania drużyn.", 'error', false);
    }
}

// --- B. DODAWANIE MECZU ---
document.getElementById('add-match-btn').addEventListener('click', async () => {
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
        const matchesCol = collection(db, PATH_MATCHES);
        await addDoc(matchesCol, {
            teamA: teamA,
            teamB: teamB,
            goalsA: 0,
            goalsB: 0,
            group: group,
            date: date,
            time: time,
            status: 'scheduled', // statusy: 'scheduled', 'live', 'finished'
            scorers: []
        });
        showMessage("Mecz dodany!", 'success', false);
    } catch (e) {
        showMessage("Błąd dodawania meczu.", 'error', false);
        console.error(e);
    }
});

// --- C. LISTA MECZÓW I ZARZĄDZANIE ---
function loadMatches() {
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;

    const matchesCol = collection(db, PATH_MATCHES);
    // UWAGA: Nie używamy orderBy w onSnapshot, aby uniknąć błędów z indeksami, sortowanie wykonujemy w pamięci
    onSnapshot(matchesCol, (snapshot) => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding:10px;">Brak meczów.</p>';
            return;
        }
        
        let matches = [];
        snapshot.forEach(doc => {
            matches.push({ id: doc.id, ...doc.data() });
        });

        // Sortowanie w pamięci (od najnowszej daty i czasu)
        matches.sort((a, b) => {
            const dateA = a.date + a.time;
            const dateB = b.date + b.time;
            return dateB.localeCompare(dateA); 
        });

        matches.forEach(m => {
            // Filtr statusu (mapowanie nazw polskich na angielskie w bazie)
            if (statusFilter !== 'wszyscy') {
                const mapStatus = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                if (m.status !== mapStatus[statusFilter]) return;    
            }

            const div = document.createElement('div');
            // Styl karty meczu
            div.style.cssText = "background: #0a0a1f; border: 1px solid #1e3a5f; padding: 20px; margin-bottom: 15px; border-radius: 12px; color: white;";
            if(m.status === 'live') div.style.border = "2px solid #ff4d4d"; // Użycie koloru z CSS

            // Opcje statusu
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
                    
                    <select onchange="updateStatus('${m.id}', this.value)" style="width:auto; padding:8px; background:#1e3a5f; color:white;">
                        ${statusOptions}
                    </select>
                    
                    <button onclick="updateScore('${m.id}')" style="background:#007bff;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">Zapisz Wynik</button>
                    <button onclick="deleteMatchPrompt('${m.id}')" style="background:#dc3545;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;margin-left:auto;">🗑 Usuń</button>
                </div>

                <div style="border-top:1px solid #1e3a5f; padding-top:10px;">
                    <small style="color:#00bfff; display:block; margin-bottom:5px;">Dodaj strzelca (Aktualizuje wynik i tabelę króla strzelców):</small>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="sc-name-${m.id}" placeholder="Nazwisko" style="width:120px; background:#0a0a1f;">
                        <select id="sc-team-${m.id}" style="width:auto; background:#0a0a1f;">
                            <option value="${m.teamA}">${m.teamA}</option>
                            <option value="${m.teamB}">${m.teamB}</option>
                        </select>
                        <button onclick="addGoalAndGlobalScorer('${m.id}', '${m.teamA}', '${m.teamB}')" style="background:#28a745;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">⚽ GOL +1</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }, (error) => {
        console.error("Błąd nasłuchiwania meczów:", error);
        showMessage("Błąd ładowania listy meczów.", 'error', false);
    });
}

// Globalne funkcje dołączone do window dla onchange/onclick
window.updateStatus = async (id, newStatus) => {
    const matchRef = doc(db, PATH_MATCHES, id);
    try {
        await updateDoc(matchRef, { status: newStatus });
        showMessage("Status zaktualizowany!", 'success', false);
    } catch(e) {
        showMessage("Błąd aktualizacji statusu.", 'error', false);
    }
};

window.updateScore = async (id) => {
    const gA = parseInt(document.getElementById(`gA-${id}`).value) || 0;
    const gB = parseInt(document.getElementById(`gB-${id}`).value) || 0;
    const matchRef = doc(db, PATH_MATCHES, id);
    try {
        await updateDoc(matchRef, { goalsA: gA, goalsB: gB });
        showMessage("Wynik zapisany!", 'success', false);
    } catch(e) {
        showMessage("Błąd zapisu wyniku.", 'error', false);
    }
};

window.deleteMatchPrompt = (id) => {
    showMessage("Czy na pewno usunąć ten mecz?", 'warning', true, async (confirmed) => {
        if (confirmed) {
            await deleteMatch(id);
        }
    });
};

async function deleteMatch(id) {
    const matchRef = doc(db, PATH_MATCHES, id);
    try {
        await deleteDoc(matchRef);
        showMessage("Mecz usunięty!", 'success', false);
    } catch(e) {
        showMessage("Błąd usuwania meczu.", 'error', false);
    }
}


// --- D. LOGIKA "DUAL WRITE" (Aktualizacja Mecz + Scorers) ---
window.addGoalAndGlobalScorer = async (matchId, teamAName, teamBName) => {
    const nameInput = document.getElementById(`sc-name-${matchId}`);
    const teamSelect = document.getElementById(`sc-team-${matchId}`);
    
    const playerName = nameInput.value.trim();
    const teamName = teamSelect.value;

    if (!playerName) return showMessage("Wpisz nazwisko strzelca!", 'warning', false);

    try {
        // 1. Aktualizacja wyniku w meczu
        const matchRef = doc(db, PATH_MATCHES, matchId);
        
        const updateData = {};
        
        if (teamName === teamAName) {
            updateData.goalsA = FieldValue.increment(1);
        } else {
            updateData.goalsB = FieldValue.increment(1);
        }
        
        // Dodatkowo zapisujemy strzelca w tablicy meczu (opcjonalnie)
        updateData.scorers = FieldValue.arrayUnion({
            name: playerName,
            team: teamName
        });

        await updateDoc(matchRef, updateData);

        // 2. Aktualizacja globalnej tabeli strzelców
        const scorersCol = collection(db, PATH_SCORERS);
        const q = query(scorersCol, where('name', '==', playerName), where('team', '==', teamName));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            await addDoc(scorersCol, { name: playerName, team: teamName, goals: 1 });
        } else {
            const docId = snapshot.docs[0].id;
            const scorerRef = doc(db, PATH_SCORERS, docId);
            await updateDoc(scorerRef, { goals: FieldValue.increment(1) });
        }

        showMessage(`Gol dodany dla: ${playerName}!`, 'success', false);
        nameInput.value = '';  
    } catch (e) {
        showMessage("Błąd dodawania gola.", 'error', false);
        console.error(e);
    }
};


// --- E. TABELA STRZELCÓW (Wyświetlanie kolekcji 'scorers') ---
function loadGlobalScorers() {
    const tbody = document.querySelector('#scorers-table tbody');
    if(!tbody) return;

    const scorersCol = collection(db, PATH_SCORERS);
    const q = query(scorersCol, orderBy('goals', 'desc'));

    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Brak danych.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap, index) => {
            const s = docSnap.data();
            const row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td>${s.name}</td>
                    <td>${s.team}</td>
                    <td style="font-weight:bold; font-size:1.2em;">${s.goals}</td>
                    <td>
                        <button onclick="editGlobalScorer('${docSnap.id}', 1)" style="background:#ccc;border:none;padding:2px 5px;cursor:pointer;">+1</button>
                        <button onclick="editGlobalScorer('${docSnap.id}', -1)" style="background:#ccc;border:none;padding:2px 5px;cursor:pointer;">-1</button>
                        <button onclick="deleteGlobalScorerPrompt('${docSnap.id}')" style="background:#dc3545;color:white;border:none;padding:2px 5px;cursor:pointer;margin-left:5px;">X</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }, (error) => {
        console.error("Błąd ładowania strzelców:", error);
    });
}

window.editGlobalScorer = async (id, val) => {
    const scorerRef = doc(db, PATH_SCORERS, id);
    try {
        await updateDoc(scorerRef, { goals: FieldValue.increment(val) });
    } catch(e) {
        showMessage("Błąd edycji strzelca.", 'error', false);
    }
}

window.deleteGlobalScorerPrompt = (id) => {
    showMessage("Czy na pewno usunąć tego zawodnika z listy strzelców?", 'warning', true, async (confirmed) => {
        if (confirmed) {
            await deleteGlobalScorer(id);
        }
    });
};

async function deleteGlobalScorer(id) {
    const scorerRef = doc(db, PATH_SCORERS, id);
    try {
        await deleteDoc(scorerRef);
        showMessage("Strzelec usunięty.", 'success', false);
    } catch(e) {
        showMessage("Błąd usuwania strzelca.", 'error', false);
    }
}

document.getElementById('add-scorer-btn').addEventListener('click', async () => {
    const name = document.getElementById('scorer-name').value;
    const team = document.getElementById('scorer-team').value;
    const goals = parseInt(document.getElementById('scorer-goals').value) || 0;

    if(!name || !team) return showMessage("Uzupełnij dane strzelca", 'warning', false);
    
    const scorersCol = collection(db, PATH_SCORERS);
    try {
        await addDoc(scorersCol, { name, team, goals });
        showMessage("Strzelec dodany ręcznie.", 'success', false);
        document.getElementById('scorer-name').value = '';
        document.getElementById('scorer-goals').value = '';
    } catch(e) {
        showMessage("Błąd dodawania strzelca.", 'error', false);
    }
});

// --- F. TWORZENIE DRUŻYNY ---
document.getElementById('create-team-btn').addEventListener('click', async () => {
    const name = document.getElementById('team-id').value;
    const email = document.getElementById('team-email').value;

    if(!name) return showMessage("Podaj nazwę drużyny!", 'warning', false);

    const teamsCol = collection(db, PATH_TEAMS);
    try {
        await addDoc(teamsCol, { 
            name, 
            email, 
            group: 'A', // Domyślna grupa
            points: 0, 
            wins: 0, 
            draws: 0, 
            losses: 0, 
            goalsFor: 0, 
            goalsAgainst: 0 
        });
        showMessage(`Dodano drużynę ${name}.`, 'success', false);
        loadTeamsSelect(); // Odśwież listy wyboru
        document.getElementById('team-id').value = '';
        document.getElementById('team-email').value = '';
    } catch(e) {
        showMessage("Błąd tworzenia drużyny.", 'error', false);
        console.error(e);
    }
});

// --- G. NADAWANIE ADMINA ---
document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    if (!email) return showMessage("Wpisz email!", 'warning', false);

    try {
        const usersCol = collection(db, PATH_USERS);
        const q = query(usersCol, where('email', '==', email));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showMessage("Nie znaleziono użytkownika w bazie 'users'. Musi się najpierw zalogować.", 'warning', false);
            return;
        }
        
        snapshot.forEach(async docSnap => {
            const userRef = doc(db, PATH_USERS, docSnap.id);
            await updateDoc(userRef, { role: 'admin', admin: true });
        });
        showMessage("Nadano uprawnienia administratora!", 'success', false);
    } catch(e) {
        showMessage("Błąd nadawania uprawnień.", 'error', false);
        console.error(e);
    }
});

// Obsługa filtra statusu
document.getElementById('match-status-filter').addEventListener('change', loadMatches);
