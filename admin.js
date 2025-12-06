// admin.js - WERSJA NAPRAWIONA POD TWOJĄ BAZĘ DANYCH

// ===================================================================
// 1. KONFIGURACJA FIREBASE
// ===================================================================

const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  databaseURL: "https://puchargwiazd-bdaa4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "puchargwiazd-bdaa4",
  storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
  messagingSenderId: "890734185883",
  appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};

// Inicjalizacja
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Zmienne globalne
let currentMatchId = null;

// ===================================================================
// 2. LOGOWANIE
// ===================================================================

auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Zalogowano:", user.email);
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('admin-wrapper').style.display = 'block';
        
        loadTeamsForSelects();
        loadMatches();
        loadScorersTable();
    } else {
        document.getElementById('login-box').style.display = 'block';
        document.getElementById('admin-wrapper').style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass)
        .catch(error => alert("Błąd logowania: " + error.message));
});

window.logout = () => {
    auth.signOut();
    window.location.reload();
};

// ===================================================================
// 3. DRUŻYNY
// ===================================================================

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
        loadTeamsForSelects();
    } catch (e) { console.error(e); alert("Błąd: " + e.message); }
};

async function loadTeamsForSelects() {
    const snapshot = await db.collection('teams').orderBy('name').get();
    const ids = ['edit-team-select', 'players-team-select', 'new-match-team1', 'new-match-team2'];
    
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '<option value="">-- Wybierz --</option>';
    });

    const listDiv = document.getElementById('teams-list');
    if(listDiv) listDiv.innerHTML = '';

    snapshot.forEach(doc => {
        const t = doc.data();
        const opt = `<option value="${doc.id}">${t.name}</option>`;
        ids.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML += opt;
        });
        if(listDiv) listDiv.innerHTML += `<div>${t.name}</div>`;
    });
}

window.updateTeamName = async () => {
    const id = document.getElementById('edit-team-select').value;
    const name = document.getElementById('edit-team-name').value;
    if (!id || !name) return alert("Wybierz drużynę i wpisz nazwę");
    await db.collection('teams').doc(id).update({ name: name });
    alert("Zmieniono nazwę.");
    loadTeamsForSelects();
};

// ===================================================================
// 4. ZAWODNICY
// ===================================================================

window.selectTeamInDropdown = async () => {
    const teamId = document.getElementById('players-team-select').value;
    const area = document.getElementById('players-manager-area');
    if (!teamId) { area.style.display = 'none'; return; }
    area.style.display = 'block';
    loadTeamPlayers(teamId);
};

window.addPlayerAdmin = async () => {
    const teamId = document.getElementById('players-team-select').value;
    const name = document.getElementById('new-p-name').value;
    const surname = document.getElementById('new-p-surname').value;
    const number = document.getElementById('new-p-number').value;
    const position = document.getElementById('new-p-position').value;

    if (!teamId || !name || !surname) return alert("Podaj imię i nazwisko");

    await db.collection('teams').doc(teamId).collection('players').add({
        name, surname, number, position
    });
    loadTeamPlayers(teamId);
    document.getElementById('new-p-surname').value = '';
};

async function loadTeamPlayers(teamId) {
    const list = document.getElementById('team-players-list');
    list.innerHTML = "Ładowanie...";
    const snap = await db.collection('teams').doc(teamId).collection('players').orderBy('surname').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const p = doc.data();
        list.innerHTML += `<div style="border-bottom:1px solid #333; padding:5px; display:flex; justify-content:space-between;">
            <span>${p.number||''} ${p.surname} ${p.name}</span>
            <button onclick="window.deletePlayer('${teamId}','${doc.id}')" style="background:#d32f2f; font-size:0.8em;">Usuń</button>
        </div>`;
    });
}

window.deletePlayer = async (tid, pid) => {
    if(confirm("Usunąć?")) {
        await db.collection('teams').doc(tid).collection('players').doc(pid).delete();
        loadTeamPlayers(tid);
    }
};

// ===================================================================
// 5. MECZE (TUTAJ JEST GŁÓWNA NAPRAWA)
// ===================================================================

window.addMatch = async () => {
    const t1 = document.getElementById('new-match-team1').value;
    const t2 = document.getElementById('new-match-team2').value;
    const date = document.getElementById('new-match-date').value;
    const time = document.getElementById('new-match-time').value;
    const group = document.getElementById('group').value;

    const t1Name = document.getElementById('new-match-team1').options[document.getElementById('new-match-team1').selectedIndex].text;
    const t2Name = document.getElementById('new-match-team2').options[document.getElementById('new-match-team2').selectedIndex].text;

    if(!t1 || !t2 || !date) return alert("Wypełnij pola");

    // Zapisujemy w formacie zgodnym z Twoją bazą (teamA/teamB)
    await db.collection('matches').add({
        team1Id: t1, team2Id: t2,
        teamA: t1Name, teamB: t2Name, // Używamy teamA/teamB bo tak masz w bazie
        goalsA: 0, goalsB: 0,
        group: group,
        date: date, time: time,
        status: "scheduled", // Używamy scheduled bo tak masz w bazie
        timestamp: new Date(date + 'T' + time).getTime()
    });
    alert("Mecz dodany!");
    loadMatches();
};

window.loadMatches = async () => {
    const container = document.getElementById('matches-list');
    const filter = document.getElementById('match-status-filter').value;
    
    container.innerHTML = "Ładowanie meczów z bazy...";

    // Pobieramy wszystko bez filtrowania w bazie (unika błędu indeksu i nazw statusów)
    let query = db.collection('matches');
    
    // Próbujemy sortować, ale jak błąd to pobieramy bez
    try { query = query.orderBy('date', 'asc'); } catch(e) {}

    const snapshot = await query.get();
    container.innerHTML = "";

    if (snapshot.empty) {
        container.innerHTML = "Brak meczów.";
        return;
    }

    let matches = [];

    snapshot.forEach(doc => {
        const m = doc.data();
        
        // --- LOGIKA "TŁUMACZA" DANYCH ---
        // Sprawdzamy czy w bazie jest teamA CZY team1Name
        const name1 = m.teamA || m.team1Name || "Drużyna A";
        const name2 = m.teamB || m.team2Name || "Drużyna B";
        
        // Sprawdzamy czy goalsA CZY score1 (zabezpieczenie na 0)
        let s1 = (m.goalsA !== undefined) ? m.goalsA : (m.score1 || 0);
        let s2 = (m.goalsB !== undefined) ? m.goalsB : (m.score2 || 0);

        // Tłumaczenie statusu (scheduled -> planowany)
        let statusDB = m.status || 'planowany';
        let statusPL = 'planowany';
        if(statusDB === 'scheduled' || statusDB === 'planowany') statusPL = 'planowany';
        if(statusDB === 'live' || statusDB === 'trwa') statusPL = 'trwa';
        if(statusDB === 'finished' || statusDB === 'zakończony') statusPL = 'zakończony';

        matches.push({
            id: doc.id,
            t1: name1, t2: name2,
            s1: s1, s2: s2,
            status: statusPL,
            rawStatus: statusDB,
            date: m.date || '---',
            time: m.time || '--:--',
            group: m.group || '-'
        });
    });

    // Filtrowanie w JS
    if (filter !== 'wszyscy') {
        matches = matches.filter(m => m.status === filter);
    }

    if(matches.length === 0) {
        container.innerHTML = "Brak meczów o statusie: " + filter;
        return;
    }

    matches.forEach(m => {
        let color = '#888';
        if(m.status === 'trwa') color = '#4caf50';
        if(m.status === 'zakończony') color = '#d32f2f';

        container.innerHTML += `
            <div style="background:#152036; margin:10px 0; padding:15px; border-radius:8px; border-left:5px solid ${color}; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:1.1em; font-weight:bold;">${m.t1} vs ${m.t2}</div>
                    <div style="color:#aaa; font-size:0.9em;">
                        ${m.date} ${m.time} | Gr: ${m.group} | <span style="color:${color}">${m.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size:1.3em; font-weight:bold; margin-top:5px;">${m.s1} : ${m.s2}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.openEditModal('${m.id}')" style="background:#2196f3; padding:5px 10px; font-size:0.8em;">Edytuj</button>
                    <button onclick="window.toggleStatus('${m.id}', '${m.rawStatus}')" style="background:#ff9800; padding:5px 10px; font-size:0.8em;">Status</button>
                    <button onclick="window.deleteMatch('${m.id}')" style="background:#d32f2f; padding:5px 10px; font-size:0.8em;">Usuń</button>
                </div>
            </div>
        `;
    });
};

document.getElementById('match-status-filter').addEventListener('change', window.loadMatches);

window.toggleStatus = async (id, currentRaw) => {
    let next = 'scheduled';
    if(currentRaw === 'scheduled' || currentRaw === 'planowany') next = 'live';
    else if(currentRaw === 'live' || currentRaw === 'trwa') next = 'finished';
    
    await db.collection('matches').doc(id).update({ status: next });
    loadMatches();
};

window.deleteMatch = async (id) => {
    if(confirm("Usunąć mecz?")) {
        await db.collection('matches').doc(id).delete();
        loadMatches();
    }
};

// ===================================================================
// 6. EDYCJA I GOLE
// ===================================================================

window.openEditModal = async (mid) => {
    currentMatchId = mid;
    document.getElementById('editModal').style.display = 'flex';
    
    const doc = await db.collection('matches').doc(mid).get();
    const m = doc.data();

    // Wyświetlanie nazw
    const t1 = m.teamA || m.team1Name || "A";
    const t2 = m.teamB || m.team2Name || "B";
    const s1 = (m.goalsA !== undefined) ? m.goalsA : (m.score1 || 0);
    const s2 = (m.goalsB !== undefined) ? m.goalsB : (m.score2 || 0);

    document.getElementById('edit-match-team1-name').innerText = t1;
    document.getElementById('edit-match-team2-name').innerText = t2;
    document.getElementById('edit-score1').value = s1;
    document.getElementById('edit-score2').value = s2;

    // Ładowanie listy graczy
    if(m.team1Id && m.team2Id) {
        loadScorerSelects(m.team1Id, m.team2Id, t1, t2);
    }

    loadMatchGoals(mid);
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    currentMatchId = null;
    loadMatches();
};

window.saveMatchResult = async () => {
    if(!currentMatchId) return;
    const s1 = parseInt(document.getElementById('edit-score1').value);
    const s2 = parseInt(document.getElementById('edit-score2').value);
    
    // Aktualizujemy OBA formaty, żeby było spójnie
    await db.collection('matches').doc(currentMatchId).update({
        goalsA: s1, goalsB: s2,
        score1: s1, score2: s2
    });
    alert("Wynik zapisany.");
};

async function loadScorerSelects(id1, id2, name1, name2) {
    const ts = document.getElementById('scorer-team-select');
    ts.innerHTML = `<option value="${id1}" data-name="${name1}">${name1}</option>
                    <option value="${id2}" data-name="${name2}">${name2}</option>`;
    
    const ps = document.getElementById('scorer-player-select');
    
    const loadP = async (tid) => {
        ps.innerHTML = '<option>Ładowanie...</option>';
        const snap = await db.collection('teams').doc(tid).collection('players').orderBy('surname').get();
        ps.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            ps.innerHTML += `<option value="${d.id}" data-full="${p.surname} ${p.name}">${p.number||''} ${p.surname} ${p.name}</option>`;
        });
    };
    
    loadP(id1);
    ts.onchange = () => loadP(ts.value);
}

window.addScorer = async () => {
    if(!currentMatchId) return;
    const ts = document.getElementById('scorer-team-select');
    const ps = document.getElementById('scorer-player-select');
    const min = document.getElementById('scorer-minute').value;

    const tid = ts.value;
    const tname = ts.options[ts.selectedIndex].getAttribute('data-name');
    const pid = ps.value;
    const pname = ps.options[ps.selectedIndex].getAttribute('data-full');

    if(!pid) return alert("Wybierz gracza");

    // Dodaj do historii meczu
    await db.collection('matches').doc(currentMatchId).collection('goals').add({
        teamId: tid, teamName: tname, playerId: pid, playerName: pname, minute: min,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Zwiększ wynik w bazie
    const doc = await db.collection('matches').doc(currentMatchId).get();
    const m = doc.data();
    
    // Sprawdzamy czy to drużyna 1 (po ID)
    if(tid === m.team1Id) {
        await db.collection('matches').doc(currentMatchId).update({ 
            goalsA: firebase.firestore.FieldValue.increment(1),
            score1: firebase.firestore.FieldValue.increment(1) 
        });
        document.getElementById('edit-score1').value++;
    } else {
        await db.collection('matches').doc(currentMatchId).update({ 
            goalsB: firebase.firestore.FieldValue.increment(1),
            score2: firebase.firestore.FieldValue.increment(1) 
        });
        document.getElementById('edit-score2').value++;
    }

    // Tabela strzelców globalna
    const sRef = db.collection('scorers');
    const q = await sRef.where('playerId','==',pid).get();
    if(q.empty) {
        await sRef.add({ playerId: pid, playerName: pname, teamName: tname, goals: 1 });
    } else {
        await sRef.doc(q.docs[0].id).update({ goals: firebase.firestore.FieldValue.increment(1) });
    }

    alert("Gol dodany!");
    loadMatchGoals(currentMatchId);
};

async function loadMatchGoals(mid) {
    const div = document.getElementById('scorers-edit-list');
    div.innerHTML = "Ładowanie...";
    const snap = await db.collection('matches').doc(mid).collection('goals').orderBy('createdAt').get();
    div.innerHTML = "";
    snap.forEach(d => {
        const g = d.data();
        div.innerHTML += `<div>${g.minute}' ${g.playerName} (${g.teamName})</div>`;
    });
}

// ===================================================================
// 7. TABELA STRZELCÓW (ZAKŁADKA USTAWIENIA)
// ===================================================================

window.loadScorersTable = async () => {
    const tbody = document.querySelector("#scorers-table tbody");
    if(!tbody) return;
    tbody.innerHTML = "<tr><td>Ładowanie...</td></tr>";
    
    const snap = await db.collection("scorers").orderBy("goals", "desc").get();
    tbody.innerHTML = "";
    
    snap.forEach(doc => {
        const d = doc.data();
        tbody.innerHTML += `<tr>
            <td>${d.playerName}</td>
            <td>${d.teamName}</td>
            <td><b>${d.goals}</b></td>
            <td><button class="btn-delete" onclick="window.deleteScorer('${doc.id}')">Usuń</button></td>
        </tr>`;
    });
};

window.deleteScorer = async (id) => {
    if(confirm("Usunąć?")) {
        await db.collection('scorers').doc(id).delete();
        loadScorersTable();
    }
};

document.getElementById('grant-admin-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    if(email) {
        await db.collection('admins').add({email});
        alert("Admin dodany");
    }
});
