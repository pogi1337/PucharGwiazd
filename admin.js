// admin.js

// -------------------------------------------------------------------
// 1. KONFIGURACJA FIREBASE
// -------------------------------------------------------------------
// Wklej tutaj swoją konfigurację z konsoli Firebase (to samo co w index.html)
const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  databaseURL: "https://puchargwiazd-bdaa4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "puchargwiazd-bdaa4",
  storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
  messagingSenderId: "890734185883",
  appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};
};

// Inicjalizacja (sprawdzamy czy już nie jest zainicjowana)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Zmienne globalne do edycji meczu
let currentMatchId = null;

// -------------------------------------------------------------------
// 2. LOGOWANIE I AUTORYZACJA
// -------------------------------------------------------------------

// Nasłuchiwanie stanu zalogowania
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Zalogowano:", user.email);
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('admin-wrapper').style.display = 'block';
        
        // Załaduj dane po zalogowaniu
        loadTeamsForSelects();
        loadMatches();
        loadScorersTable(); // Ładujemy tabelę strzelców na starcie
    } else {
        document.getElementById('login-box').style.display = 'block';
        document.getElementById('admin-wrapper').style.display = 'none';
    }
});

// Przycisk logowania
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-msg');

    auth.signInWithEmailAndPassword(email, pass)
        .catch(error => {
            msg.textContent = "Błąd: " + error.message;
            msg.className = "message error";
        });
});

window.logout = () => {
    auth.signOut();
    window.location.reload();
};

// -------------------------------------------------------------------
// 3. ZARZĄDZANIE DRUŻYNAMI
// -------------------------------------------------------------------

window.addTeam = async () => {
    const name = document.getElementById('new-team-name').value;
    const manager = document.getElementById('new-team-manager').value;

    if (!name) return alert("Podaj nazwę drużyny");

    try {
        await db.collection('teams').add({
            name: name,
            manager: manager,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Dodano drużynę!");
        document.getElementById('new-team-name').value = '';
        loadTeamsForSelects(); // Odśwież listy
    } catch (e) {
        console.error(e);
        alert("Błąd dodawania drużyny");
    }
};

// Pobieranie drużyn do wszystkich selectów w panelu
async function loadTeamsForSelects() {
    const snapshot = await db.collection('teams').orderBy('name').get();
    
    // Lista selectów do uzupełnienia
    const ids = ['edit-team-select', 'players-team-select', 'new-match-team1', 'new-match-team2'];
    
    // Wyczyść selecty
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if(sel) sel.innerHTML = '<option value="">-- Wybierz --</option>';
    });

    const teamsListDiv = document.getElementById('teams-list');
    if(teamsListDiv) teamsListDiv.innerHTML = '';

    snapshot.forEach(doc => {
        const team = doc.data();
        const optionHTML = `<option value="${doc.id}">${team.name}</option>`;

        // Dodaj do każdego selecta
        ids.forEach(id => {
            const sel = document.getElementById(id);
            if(sel) sel.innerHTML += optionHTML;
        });

        // Dodaj do listy tekstowej (w zakładce Drużyny)
        if(teamsListDiv) {
            teamsListDiv.innerHTML += `<div style="padding:5px; border-bottom:1px solid #333;">${team.name} <small>(${team.manager || '-'})</small></div>`;
        }
    });
}

window.updateTeamName = async () => {
    const teamId = document.getElementById('edit-team-select').value;
    const newName = document.getElementById('edit-team-name').value;

    if (!teamId || !newName) return alert("Wybierz drużynę i wpisz nową nazwę.");

    await db.collection('teams').doc(teamId).update({ name: newName });
    alert("Zaktualizowano nazwę!");
    loadTeamsForSelects();
};

// -------------------------------------------------------------------
// 4. ZARZĄDZANIE ZAWODNIKAMI
// -------------------------------------------------------------------

// Wywołuje się po wybraniu drużyny z listy w zakładce "Zawodnicy"
window.selectTeamInDropdown = async () => {
    const teamId = document.getElementById('players-team-select').value;
    const managerArea = document.getElementById('players-manager-area');
    
    if (!teamId) {
        managerArea.style.display = 'none';
        return;
    }
    
    managerArea.style.display = 'block';
    loadTeamPlayers(teamId);
};

window.addPlayerAdmin = async () => {
    const teamId = document.getElementById('players-team-select').value;
    const name = document.getElementById('new-p-name').value;
    const surname = document.getElementById('new-p-surname').value;
    const number = document.getElementById('new-p-number').value;
    const position = document.getElementById('new-p-position').value;

    if (!teamId || !name || !surname) return alert("Uzupełnij imię i nazwisko.");

    try {
        await db.collection('teams').doc(teamId).collection('players').add({
            name, surname, number, position
        });
        // Wyczyść pola
        document.getElementById('new-p-name').value = '';
        document.getElementById('new-p-surname').value = '';
        document.getElementById('new-p-number').value = '';
        
        loadTeamPlayers(teamId); // Odśwież listę
    } catch (e) {
        alert("Błąd: " + e.message);
    }
};

async function loadTeamPlayers(teamId) {
    const listDiv = document.getElementById('team-players-list');
    listDiv.innerHTML = "Ładowanie...";
    
    const snapshot = await db.collection('teams').doc(teamId).collection('players').orderBy('surname').get();
    
    listDiv.innerHTML = "";
    if (snapshot.empty) listDiv.innerHTML = "Brak zawodników.";

    snapshot.forEach(doc => {
        const p = doc.data();
        listDiv.innerHTML += `
            <div style="padding: 8px; border-bottom: 1px solid #333; display:flex; justify-content:space-between;">
                <span><b>${p.number || '-'}</b> ${p.surname} ${p.name} (${p.position || '?'})</span>
                <button onclick="window.deletePlayer('${teamId}', '${doc.id}')" style="background:#d32f2f; font-size:0.8em; padding:2px 8px;">Usuń</button>
            </div>
        `;
    });
}

window.deletePlayer = async (teamId, playerId) => {
    if(!confirm("Usunąć zawodnika?")) return;
    await db.collection('teams').doc(teamId).collection('players').doc(playerId).delete();
    loadTeamPlayers(teamId);
};

// -------------------------------------------------------------------
// 5. ZARZĄDZANIE MECZAMI
// -------------------------------------------------------------------

window.addMatch = async () => {
    const t1 = document.getElementById('new-match-team1').value;
    const t2 = document.getElementById('new-match-team2').value;
    const group = document.getElementById('group').value;
    const date = document.getElementById('new-match-date').value;
    const time = document.getElementById('new-match-time').value;

    const t1Name = document.getElementById('new-match-team1').options[document.getElementById('new-match-team1').selectedIndex].text;
    const t2Name = document.getElementById('new-match-team2').options[document.getElementById('new-match-team2').selectedIndex].text;

    if (!t1 || !t2 || !date || !time) return alert("Wybierz drużyny i datę.");
    if (t1 === t2) return alert("Drużyny muszą być różne.");

    try {
        await db.collection('matches').add({
            team1Id: t1, team1Name: t1Name,
            team2Id: t2, team2Name: t2Name,
            score1: 0, score2: 0,
            group: group,
            date: date,
            time: time,
            status: "planowany", // planowany, trwa, zakończony
            timestamp: new Date(date + 'T' + time).getTime()
        });
        alert("Utworzono mecz.");
        loadMatches();
    } catch (e) {
        console.error(e);
        alert("Błąd tworzenia meczu");
    }
};

window.loadMatches = async () => {
    const container = document.getElementById('matches-list');
    const filter = document.getElementById('match-status-filter').value;
    
    container.innerHTML = "Ładowanie...";

    let query = db.collection('matches').orderBy('timestamp', 'asc');
    
    if (filter !== "wszyscy") {
        query = query.where('status', '==', filter);
    }

    const snapshot = await query.get();
    container.innerHTML = "";

    if (snapshot.empty) {
        container.innerHTML = "Brak meczów.";
        return;
    }

    snapshot.forEach(doc => {
        const m = doc.data();
        // Kolorowanie statusu
        let statusColor = '#888';
        if (m.status === 'trwa') statusColor = '#4caf50'; // zielony
        if (m.status === 'zakończony') statusColor = '#f44336'; // czerwony

        const div = document.createElement('div');
        div.style.background = "#152036";
        div.style.margin = "10px 0";
        div.style.padding = "15px";
        div.style.borderRadius = "8px";
        div.style.borderLeft = `5px solid ${statusColor}`;
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; font-size:1.1em;">${m.team1Name} vs ${m.team2Name}</div>
                    <div style="color:#aaa; font-size:0.9em;">
                        ${m.date} ${m.time} | Gr: ${m.group || '-'} | 
                        <span style="color:${statusColor}; font-weight:bold; text-transform:uppercase;">${m.status}</span>
                    </div>
                    <div style="font-size:1.2em; margin-top:5px;">Wynik: ${m.score1} : ${m.score2}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.openEditModal('${doc.id}')" style="background:#2196f3; font-size:0.9em;">Edytuj / Gole</button>
                    <button onclick="window.toggleMatchStatus('${doc.id}', '${m.status}')" style="background:#ff9800; font-size:0.9em;">Zmień Status</button>
                    <button onclick="window.deleteMatch('${doc.id}')" style="background:#d32f2f; font-size:0.9em;">Usuń</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
};

document.getElementById('match-status-filter').addEventListener('change', window.loadMatches);

window.deleteMatch = async (id) => {
    if(!confirm("Usunąć ten mecz?")) return;
    await db.collection('matches').doc(id).delete();
    loadMatches();
};

window.toggleMatchStatus = async (id, currentStatus) => {
    let newStatus = 'planowany';
    if (currentStatus === 'planowany') newStatus = 'trwa';
    else if (currentStatus === 'trwa') newStatus = 'zakończony';
    else if (currentStatus === 'zakończony') newStatus = 'planowany';

    await db.collection('matches').doc(id).update({ status: newStatus });
    loadMatches();
};

// -------------------------------------------------------------------
// 6. MODAL EDYCJI I OBSŁUGA STRZELCÓW (AKTUALIZOWANA)
// -------------------------------------------------------------------

window.openEditModal = async (matchId) => {
    currentMatchId = matchId;
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';

    // Pobierz dane meczu
    const doc = await db.collection('matches').doc(matchId).get();
    const m = doc.data();

    document.getElementById('edit-match-team1-name').innerText = m.team1Name;
    document.getElementById('edit-match-team2-name').innerText = m.team2Name;
    document.getElementById('edit-score1').value = m.score1;
    document.getElementById('edit-score2').value = m.score2;

    // Załaduj listy zawodników do selecta "Strzelca"
    loadScorerSelects(m.team1Id, m.team2Id, m.team1Name, m.team2Name);
    
    // Załaduj listę goli w tym meczu
    loadMatchScorersList(matchId);
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    currentMatchId = null;
    loadMatches(); // Odśwież listę meczów na głównej
    loadScorersTable(); // Odśwież tabelę w ustawieniach
};

window.saveMatchResult = async () => {
    if (!currentMatchId) return;
    const s1 = parseInt(document.getElementById('edit-score1').value);
    const s2 = parseInt(document.getElementById('edit-score2').value);

    await db.collection('matches').doc(currentMatchId).update({
        score1: s1, score2: s2
    });
    alert("Zapisano wynik ręcznie.");
};

async function loadScorerSelects(t1Id, t2Id, t1Name, t2Name) {
    const teamSelect = document.getElementById('scorer-team-select');
    const playerSelect = document.getElementById('scorer-player-select');
    
    // Ustaw drużyny
    teamSelect.innerHTML = `
        <option value="${t1Id}" data-name="${t1Name}">${t1Name}</option>
        <option value="${t2Id}" data-name="${t2Name}">${t2Name}</option>
    `;

    // Funkcja ładująca graczy zależnie od wybranej drużyny
    const loadPlayers = async (teamId) => {
        playerSelect.innerHTML = '<option>Ładowanie...</option>';
        const sn = await db.collection('teams').doc(teamId).collection('players').orderBy('surname').get();
        playerSelect.innerHTML = '';
        sn.forEach(p => {
            const pd = p.data();
            playerSelect.innerHTML += `<option value="${p.id}" data-fullname="${pd.surname} ${pd.name}">${pd.number || ''} ${pd.surname} ${pd.name}</option>`;
        });
    };

    // Załaduj dla pierwszej domyślnie
    loadPlayers(teamSelect.value);

    // Zmiana drużyny przeładowuje graczy
    teamSelect.onchange = () => loadPlayers(teamSelect.value);
}

// --- KLUCZOWA FUNKCJA: DODAWANIE GOLA ---
window.addScorer = async () => {
    if (!currentMatchId) return;

    const teamSelect = document.getElementById('scorer-team-select');
    const playerSelect = document.getElementById('scorer-player-select');
    const minute = document.getElementById('scorer-minute').value;

    const teamId = teamSelect.value;
    const teamName = teamSelect.options[teamSelect.selectedIndex].getAttribute('data-name');
    const playerId = playerSelect.value;
    const playerName = playerSelect.options[playerSelect.selectedIndex].getAttribute('data-fullname');

    if (!playerId) return alert("Wybierz zawodnika");

    try {
        // 1. Dodaj wpis do subkolekcji 'goals' w meczu (do wyświetlania detali meczu)
        await db.collection('matches').doc(currentMatchId).collection('goals').add({
            teamId, teamName, playerId, playerName, minute,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Automatyczna aktualizacja wyniku w meczu
        // Sprawdzamy która to drużyna (team1 czy team2 w meczu) i robimy increment
        const matchDoc = await db.collection('matches').doc(currentMatchId).get();
        const mData = matchDoc.data();
        
        if (teamId === mData.team1Id) {
            await db.collection('matches').doc(currentMatchId).update({ score1: firebase.firestore.FieldValue.increment(1) });
            document.getElementById('edit-score1').value = parseInt(document.getElementById('edit-score1').value) + 1;
        } else {
            await db.collection('matches').doc(currentMatchId).update({ score2: firebase.firestore.FieldValue.increment(1) });
            document.getElementById('edit-score2').value = parseInt(document.getElementById('edit-score2').value) + 1;
        }

        // 3. AKTUALIZACJA GLOBALNEJ TABELI STRZELCÓW (scorers)
        // Sprawdzamy, czy ten zawodnik już jest w kolekcji 'scorers'
        const scorersRef = db.collection('scorers');
        const q = await scorersRef.where('playerId', '==', playerId).get();

        if (q.empty) {
            // Tworzymy nowego strzelca
            await scorersRef.add({
                playerId: playerId,
                playerName: playerName,
                teamName: teamName,
                teamId: teamId,
                goals: 1
            });
        } else {
            // Aktualizujemy istniejącego (dodajemy 1 gol)
            const docId = q.docs[0].id;
            await scorersRef.doc(docId).update({
                goals: firebase.firestore.FieldValue.increment(1)
            });
        }

        alert("Dodano gola!");
        loadMatchScorersList(currentMatchId); // Odśwież listę w modalu

    } catch (e) {
        console.error(e);
        alert("Błąd dodawania gola: " + e.message);
    }
};

async function loadMatchScorersList(matchId) {
    const div = document.getElementById('scorers-edit-list');
    div.innerHTML = "Ładowanie...";
    const snap = await db.collection('matches').doc(matchId).collection('goals').orderBy('createdAt').get();
    
    div.innerHTML = "";
    snap.forEach(d => {
        const g = d.data();
        div.innerHTML += `<div style="border-bottom:1px solid #333; padding:5px;">${g.minute}' <b>${g.playerName}</b> (${g.teamName})</div>`;
    });
}

// -------------------------------------------------------------------
// 7. GLOBALNA TABELA STRZELCÓW (NOWOŚĆ)
// -------------------------------------------------------------------

window.loadScorersTable = async () => {
    const tableBody = document.querySelector("#scorers-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Ładowanie tabeli...</td></tr>";

    try {
        // Pobieramy kolekcję 'scorers' posortowaną po golach malejąco
        const snapshot = await db.collection("scorers").orderBy("goals", "desc").get();

        tableBody.innerHTML = ""; // Czyścimy loader

        if (snapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Brak strzelców.</td></tr>";
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = `
                <tr>
                    <td>${data.playerName}</td>
                    <td>${data.teamName}</td>
                    <td style="font-weight:bold; color:#4caf50;">${data.goals}</td>
                    <td style="text-align: center;">
                        <button class="btn-delete" onclick="window.deleteScorer('${doc.id}')">
                            <i class="fas fa-trash"></i> Usuń
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) {
        console.error("Błąd pobierania strzelców:", error);
        tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>Błąd pobierania danych.</td></tr>";
    }
};

// Funkcja usuwająca strzelca z globalnej tabeli (O TO PROSIŁEŚ)
window.deleteScorer = async (docId) => {
    if(!confirm("Czy na pewno chcesz usunąć tego zawodnika z listy strzelców?\n(Uwaga: To nie usunie goli z historii meczów, tylko z tej tabeli)")) return;

    try {
        await db.collection("scorers").doc(docId).delete();
        // Odświeżamy tabelę po usunięciu
        window.loadScorersTable();
    } catch (e) {
        console.error(e);
        alert("Błąd usuwania: " + e.message);
    }
};

// -------------------------------------------------------------------
// 8. ADMIN UPRAWNIENIA
// -------------------------------------------------------------------

document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    if(!email) return alert("Podaj email");
    
    // Tutaj normalnie byłaby funkcja Cloud Functions.
    // W prostej wersji Firestore, dodajemy wpis do kolekcji 'admins'
    await db.collection('admins').add({ email: email });
    alert("Dodano uprawnienia (wymaga konfiguracji reguł Firestore).");
});

