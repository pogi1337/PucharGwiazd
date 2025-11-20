// ==========================================
// admin.js - Panel Administratora (Wersja z osobną kolekcją Scorers)
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

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!email || !pass) return;
    loginMsg.textContent = "Logowanie...";
    
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
        loginMsg.textContent = "Błąd: " + err.message;
    }
});

auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
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
    loadMatches();        // Ładuje mecze
    loadGlobalScorers();  // Ładuje tabelę strzelców z kolekcji 'scorers'
}

// --- A. ŁADOWANIE DRUŻYN DO SELECTÓW ---
async function loadTeamsSelect() {
    const selectA = document.getElementById('teamA');
    const selectB = document.getElementById('teamB');
    const selectScorerTeam = document.getElementById('scorer-team');
    
    if(!selectA) return;

    selectA.innerHTML = '<option value="">Wybierz drużynę A</option>';
    selectB.innerHTML = '<option value="">Wybierz drużynę B</option>';
    if(selectScorerTeam) selectScorerTeam.innerHTML = '<option value="">Wybierz drużynę</option>';

    const snapshot = await db.collection('teams').orderBy('name').get();
    
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
        alert("Wybierz drużyny i grupę.");
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
            status: 'scheduled'
        });
        alert("Mecz dodany!");
    } catch (e) {
        alert("Błąd dodawania meczu.");
    }
});

// --- C. LISTA MECZÓW (Z funkcją dodawania gola do Globalnej Tabeli) ---
function loadMatches() {
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;

    db.collection('matches').orderBy('date', 'desc').onSnapshot(snapshot => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p>Brak meczów.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const m = doc.data();
            
            // Filtr statusu
            if (statusFilter !== 'wszyscy') {
                const mapStatus = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                if (m.status !== mapStatus[statusFilter]) return; 
            }

            const matchEl = document.createElement('div');
            matchEl.className = 'match-card';
            matchEl.style.background = "#222";
            matchEl.style.color = "#fff";
            matchEl.style.padding = "15px";
            matchEl.style.marginBottom = "15px";
            matchEl.style.borderRadius = "8px";
            matchEl.style.border = m.status === 'live' ? "2px solid #e53935" : "1px solid #444";

            matchEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong>${m.teamA} vs ${m.teamB}</strong>
                    <span style="color:#aaa;">Gr. ${m.group}</span>
                </div>
                
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                    <h2 style="margin:0 10px;">${m.goalsA} : ${m.goalsB}</h2>
                    
                    <select id="st-${doc.id}" onchange="updateStatus('${doc.id}', this.value)" style="padding:5px;">
                        <option value="scheduled" ${m.status === 'scheduled' ? 'selected' : ''}>Planowany</option>
                        <option value="live" ${m.status === 'live' ? 'selected' : ''}>🔴 NA ŻYWO</option>
                        <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>🏁 Zakończony</option>
                    </select>
                    
                    <button onclick="deleteMatch('${doc.id}')" style="background:#d32f2f;color:white;border:none;padding:5px 10px;">Usuń</button>
                </div>

                <div style="background:#333; padding:10px; border-radius:5px;">
                    <small>Dodaj Gola (Aktualizuje wynik meczu + Tabelę Strzelców)</small><br>
                    <div style="margin-top:5px; display:flex; gap:5px;">
                        <input type="text" id="sc-name-${doc.id}" placeholder="Nazwisko" style="width:100px;">
                        <select id="sc-team-${doc.id}">
                            <option value="${m.teamA}">${m.teamA}</option>
                            <option value="${m.teamB}">${m.teamB}</option>
                        </select>
                        <button onclick="addGoalAndGlobalScorer('${doc.id}', '${m.teamA}', '${m.teamB}')" style="background:#28a745;color:white;border:none;padding:5px 10px;">⚽ GOL!</button>
                    </div>
                </div>
            `;
            container.appendChild(matchEl);
        });
    });
}

// --- D. LOGIKA "DUAL WRITE" (Mecz + Tabela Strzelców) ---
window.addGoalAndGlobalScorer = async (matchId, teamAName, teamBName) => {
    const nameInput = document.getElementById(`sc-name-${matchId}`);
    const teamSelect = document.getElementById(`sc-team-${matchId}`);
    
    const playerName = nameInput.value.trim();
    const teamName = teamSelect.value; // To będzie teamA lub teamB

    if (!playerName) return alert("Wpisz nazwisko strzelca!");

    // 1. Zaktualizuj wynik meczu w kolekcji 'matches'
    const matchRef = db.collection('matches').doc(matchId);
    const updateData = {};
    
    if (teamName === teamAName) {
        updateData.goalsA = firebase.firestore.FieldValue.increment(1);
    } else {
        updateData.goalsB = firebase.firestore.FieldValue.increment(1);
    }
    
    await matchRef.update(updateData);

    // 2. Zaktualizuj globalną kolekcję 'scorers'
    // Najpierw sprawdzamy, czy ten zawodnik już istnieje
    const scorersRef = db.collection('scorers');
    const snapshot = await scorersRef.where('name', '==', playerName).where('team', '==', teamName).get();

    if (snapshot.empty) {
        // Jeśli nie ma - tworzymy nowego
        await scorersRef.add({
            name: playerName,
            team: teamName,
            goals: 1
        });
    } else {
        // Jeśli jest - inkrementujemy gole
        const docId = snapshot.docs[0].id;
        await scorersRef.doc(docId).update({
            goals: firebase.firestore.FieldValue.increment(1)
        });
    }

    alert(`Gol dodany dla: ${playerName}!`);
    nameInput.value = ''; // Wyczyść pole
    loadGlobalScorers(); // Odśwież tabelę na dole
};

// --- E. INNE FUNKCJE MECZOWE ---
window.updateStatus = async (id, newStatus) => {
    await db.collection('matches').doc(id).update({ status: newStatus });
};

window.deleteMatch = async (id) => {
    if(confirm("Usunąć mecz?")) {
        await db.collection('matches').doc(id).delete();
    }
};

// --- F. TABELA STRZELCÓW (Globalna) ---
// Ta funkcja wyświetla zawartość kolekcji 'scorers' w tabeli na dole panelu admina
function loadGlobalScorers() {
    const tbody = document.querySelector('#scorers-table tbody');
    if(!tbody) return;

    // Nasłuchujemy zmian w kolekcji scorers
    db.collection('scorers').orderBy('goals', 'desc').onSnapshot(snapshot => {
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4">Brak strzelców w bazie.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const s = doc.data();
            const row = `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.team}</td>
                    <td><strong>${s.goals}</strong></td>
                    <td>
                        <button onclick="deleteGlobalScorer('${doc.id}')" style="background:red;color:white;border:none;">X</button>
                        <button onclick="editGlobalScorer('${doc.id}', ${s.goals})" style="background:#444;color:white;border:none;">+1</button>
                        <button onclick="editGlobalScorer('${doc.id}', -1)" style="background:#444;color:white;border:none;">-1</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

// Funkcje pomocnicze do edycji tabeli ręcznie
window.deleteGlobalScorer = async (id) => {
    if(confirm("Usunąć zawodnika z listy króla strzelców?")) {
        await db.collection('scorers').doc(id).delete();
    }
}

window.editGlobalScorer = async (id, change) => {
    // Jeśli change to konkretna liczba (np. -1), to dodajemy ją
    // Ale w argumencie przekazałem aktualne gole dla +1 (błąd logiczny w przycisku wyżej poprawiony poniżej)
    // Poprawa logiki:
    const val = change === -1 ? -1 : 1; 
    
    await db.collection('scorers').doc(id).update({
        goals: firebase.firestore.FieldValue.increment(val)
    });
}

// --- G. TWORZENIE DRUŻYNY ---
document.getElementById('create-team-btn').addEventListener('click', async () => {
    const name = document.getElementById('team-id').value;
    const email = document.getElementById('team-email').value;

    if(!name) return alert("Podaj nazwę");

    await db.collection('teams').add({
        name: name,
        email: email,
        group: 'A', 
        points: 0
    });
    
    alert(`Dodano drużynę ${name}.`);
    loadTeamsSelect();
});

// --- H. RĘCZNE DODAWANIE DO TABELI STRZELCÓW (Bez meczu) ---
document.getElementById('add-scorer-btn').addEventListener('click', async () => {
    const name = document.getElementById('scorer-name').value;
    const team = document.getElementById('scorer-team').value;
    const goals = parseInt(document.getElementById('scorer-goals').value);

    if(!name || !team) return alert("Uzupełnij dane");

    await db.collection('scorers').add({
        name: name,
        team: team,
        goals: goals || 0
    });
    
    // Czyść pola
    document.getElementById('scorer-name').value = '';
    document.getElementById('scorer-goals').value = '';
});

// Obsługa filtra
document.getElementById('match-status-filter').addEventListener('change', loadMatches);
