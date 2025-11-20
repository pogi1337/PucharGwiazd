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
// 2. LOGOWANIE I ZABEZPIECZENIA
// ==========================================
const loginBox = document.getElementById('login-box');
const adminPanel = document.getElementById('admin-wrapper');
const loginMsg = document.getElementById('login-msg');

// Kliknięcie przycisku logowania
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!email || !pass) return;
    loginMsg.textContent = "Weryfikacja...";
    loginMsg.className = "message";
    
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        // onAuthStateChanged zajmie się resztą
    } catch (err) {
        loginMsg.textContent = "Błąd: " + err.message;
        loginMsg.className = "message error";
    }
});

// Główny strażnik dostępu - sprawdza uprawnienia przy każdym odświeżeniu
auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            // Sprawdzamy w bazie czy ten user to admin
            const doc = await db.collection('users').doc(user.uid).get();
            
            // Warunek: dokument musi istnieć ORAZ (mieć admin:true LUB role:'admin')
            if (doc.exists && (doc.data().admin === true || doc.data().role === 'admin')) {
                // JEST ADMINEM -> Pokaż panel
                loginBox.style.display = 'none';
                adminPanel.style.display = 'block';
                initAdminPanel(); // Załaduj dane
            } else {
                // NIE JEST ADMINEM -> Wyrzuć
                throw new Error("To konto nie ma uprawnień administratora.");
            }
        } catch (e) {
            loginMsg.textContent = e.message;
            loginMsg.className = "message error";
            auth.signOut(); // Wyloguj natychmiast
            loginBox.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    } else {
        // Nikt nie jest zalogowany
        loginBox.style.display = 'block';
        adminPanel.style.display = 'none';
    }
});

// ==========================================
// 3. FUNKCJE PANELU (Uruchamiane tylko dla admina)
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
        alert("Wybierz drużyny i wpisz grupę.");
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
            status: 'scheduled', // statusy: 'scheduled', 'live', 'finished'
            scorers: [] // Ważne: pusta tablica na start
        });
        alert("Mecz dodany!");
    } catch (e) {
        alert("Błąd dodawania meczu.");
        console.error(e);
    }
});

// --- C. LISTA MECZÓW I ZARZĄDZANIE ---
function loadMatches() {
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;

    db.collection('matches').orderBy('date', 'desc').onSnapshot(snapshot => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding:10px;">Brak meczów.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const m = doc.data();
            
            // Filtr statusu (mapowanie nazw polskich na angielskie w bazie)
            if (statusFilter !== 'wszyscy') {
                const mapStatus = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                if (m.status !== mapStatus[statusFilter]) return; 
            }

            const div = document.createElement('div');
            // Styl karty meczu
            div.style.cssText = "background: #fff; border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);";
            if(m.status === 'live') div.style.border = "2px solid #e53935";

            // Opcje statusu
            const statusOptions = `
                <option value="scheduled" ${m.status === 'scheduled' ? 'selected' : ''}>📅 Planowany</option>
                <option value="live" ${m.status === 'live' ? 'selected' : ''}>🔴 NA ŻYWO</option>
                <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>🏁 Zakończony</option>
            `;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:bold; font-size: 1.1em;">
                    <span>${m.teamA} vs ${m.teamB}</span>
                    <span style="color:#888;">Gr. ${m.group}</span>
                </div>
                
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px; background:#f1f1f1; padding:10px; border-radius:5px;">
                    <input type="number" id="gA-${doc.id}" value="${m.goalsA}" style="width:50px; text-align:center; font-weight:bold;">
                    <span>:</span>
                    <input type="number" id="gB-${doc.id}" value="${m.goalsB}" style="width:50px; text-align:center; font-weight:bold;">
                    
                    <select onchange="updateStatus('${doc.id}', this.value)">
                        ${statusOptions}
                    </select>
                    
                    <button onclick="updateScore('${doc.id}')" style="background:#007bff;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">Zapisz Wynik</button>
                    <button onclick="deleteMatch('${doc.id}')" style="background:#dc3545;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;margin-left:auto;">Usuń Mecz</button>
                </div>

                <div style="border-top:1px solid #eee; padding-top:10px;">
                    <small style="color:#666; display:block; margin-bottom:5px;">Dodaj strzelca (Aktualizuje wynik i tabelę króla strzelców):</small>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="sc-name-${doc.id}" placeholder="Nazwisko" style="width:120px;">
                        <select id="sc-team-${doc.id}">
                            <option value="${m.teamA}">${m.teamA}</option>
                            <option value="${m.teamB}">${m.teamB}</option>
                        </select>
                        <button onclick="addGoalAndGlobalScorer('${doc.id}', '${m.teamA}', '${m.teamB}')" style="background:#28a745;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">⚽ GOL +1</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// --- D. LOGIKA "DUAL WRITE" (Aktualizacja Mecz + Scorers) ---
window.addGoalAndGlobalScorer = async (matchId, teamAName, teamBName) => {
    const nameInput = document.getElementById(`sc-name-${matchId}`);
    const teamSelect = document.getElementById(`sc-team-${matchId}`);
    
    const playerName = nameInput.value.trim();
    const teamName = teamSelect.value;

    if (!playerName) return alert("Wpisz nazwisko strzelca!");

    // 1. Aktualizacja wyniku w meczu
    const matchRef = db.collection('matches').doc(matchId);
    const updateData = {};
    
    if (teamName === teamAName) {
        updateData.goalsA = firebase.firestore.FieldValue.increment(1);
    } else {
        updateData.goalsB = firebase.firestore.FieldValue.increment(1);
    }
    
    // Dodatkowo zapisujemy strzelca w tablicy meczu (opcjonalnie, dla historii w meczu)
    updateData.scorers = firebase.firestore.FieldValue.arrayUnion({
        name: playerName,
        team: teamName
    });

    await matchRef.update(updateData);

    // 2. Aktualizacja globalnej tabeli strzelców
    const scorersRef = db.collection('scorers');
    const snapshot = await scorersRef.where('name', '==', playerName).where('team', '==', teamName).get();

    if (snapshot.empty) {
        await scorersRef.add({ name: playerName, team: teamName, goals: 1 });
    } else {
        const docId = snapshot.docs[0].id;
        await scorersRef.doc(docId).update({ goals: firebase.firestore.FieldValue.increment(1) });
    }

    alert(`Gol dodany dla: ${playerName}!`);
    nameInput.value = ''; 
};

window.updateScore = async (id) => {
    const gA = parseInt(document.getElementById(`gA-${id}`).value);
    const gB = parseInt(document.getElementById(`gB-${id}`).value);
    await db.collection('matches').doc(id).update({ goalsA: gA, goalsB: gB });
    alert("Wynik zapisany!");
};

window.updateStatus = async (id, newStatus) => {
    await db.collection('matches').doc(id).update({ status: newStatus });
};

window.deleteMatch = async (id) => {
    if(confirm("Usunąć mecz?")) {
        await db.collection('matches').doc(id).delete();
    }
};

// --- E. TABELA STRZELCÓW (Wyświetlanie kolekcji 'scorers') ---
function loadGlobalScorers() {
    const tbody = document.querySelector('#scorers-table tbody');
    if(!tbody) return;

    db.collection('scorers').orderBy('goals', 'desc').onSnapshot(snapshot => {
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Brak danych.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const s = doc.data();
            const row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td>${s.name}</td>
                    <td>${s.team}</td>
                    <td style="font-weight:bold; font-size:1.2em;">${s.goals}</td>
                    <td>
                        <button onclick="editGlobalScorer('${doc.id}', 1)" style="background:#ccc;border:none;padding:2px 5px;cursor:pointer;">+1</button>
                        <button onclick="editGlobalScorer('${doc.id}', -1)" style="background:#ccc;border:none;padding:2px 5px;cursor:pointer;">-1</button>
                        <button onclick="deleteGlobalScorer('${doc.id}')" style="background:red;color:white;border:none;padding:2px 5px;cursor:pointer;margin-left:5px;">X</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

window.editGlobalScorer = async (id, val) => {
    await db.collection('scorers').doc(id).update({ goals: firebase.firestore.FieldValue.increment(val) });
}

window.deleteGlobalScorer = async (id) => {
    if(confirm("Usunąć zawodnika z listy?")) await db.collection('scorers').doc(id).delete();
}

document.getElementById('add-scorer-btn').addEventListener('click', async () => {
    const name = document.getElementById('scorer-name').value;
    const team = document.getElementById('scorer-team').value;
    const goals = parseInt(document.getElementById('scorer-goals').value);

    if(!name || !team) return alert("Uzupełnij dane");
    await db.collection('scorers').add({ name, team, goals: goals || 0 });
    
    document.getElementById('scorer-name').value = '';
    document.getElementById('scorer-goals').value = '';
});

// --- F. TWORZENIE DRUŻYNY (Tylko baza danych) ---
document.getElementById('create-team-btn').addEventListener('click', async () => {
    const name = document.getElementById('team-id').value;
    const email = document.getElementById('team-email').value;

    if(!name) return alert("Podaj nazwę");

    await db.collection('teams').add({ name, email, group: 'A', points: 0 });
    alert(`Dodano drużynę ${name}.`);
    loadTeamsSelect();
});

// --- G. NADAWANIE ADMINA (Po emailu) ---
document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (snapshot.empty) {
            alert("Nie znaleziono użytkownika w bazie 'users' z tym emailem. Użytkownik musi się najpierw zalogować (stworzyć konto).");
            return;
        }
        snapshot.forEach(async doc => {
            await db.collection('users').doc(doc.id).update({ role: 'admin', admin: true });
        });
        alert("Nadano uprawnienia!");
    } catch(e) {
        alert("Błąd. Sprawdź konsolę.");
        console.error(e);
    }
 });

// Obsługa filtra statusu
document.getElementById('match-status-filter').addEventListener('change', loadMatches);
