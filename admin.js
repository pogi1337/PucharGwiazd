// admin.js - WERSJA FINALNA (ZABEZPIECZONA + FIX PODWÓJNYCH GOLI)

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

// Inicjalizacja (sprawdzamy czy już nie jest zainicjowana)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Zmienne globalne
let currentMatchId = null;

// ===================================================================
// 2. LOGOWANIE I AUTORYZACJA (WHITELIST)
// ===================================================================

// LISTA DOZWOLONYCH ADMINÓW
const ALLOWED_ADMINS = [
    "kacpernwm77@gmail.com",
    "krzysztof.lodzinski@interia.pl"
];

// Czekamy na załadowanie HTML
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-pass').value;
            const msg = document.getElementById('login-msg');

            msg.textContent = "Logowanie...";
            msg.className = "message";

            auth.signInWithEmailAndPassword(email, pass)
                .catch(error => {
                    msg.textContent = "Błąd: " + error.message;
                    msg.className = "message error";
                });
        });
    }
});

// Główna funkcja sprawdzająca uprawnienia
auth.onAuthStateChanged(user => {
    const loginBox = document.getElementById('login-box');
    const adminWrapper = document.getElementById('admin-wrapper');

    if (user) {
        // SPRAWDZENIE CZY EMAIL JEST NA LIŚCIE
        if (ALLOWED_ADMINS.includes(user.email)) {
            console.log("Zalogowano Admina:", user.email);
            
            if(loginBox) loginBox.style.display = 'none';
            if(adminWrapper) adminWrapper.style.display = 'block';
            
            // Ładowanie danych z opóźnieniem dla pewności
            setTimeout(() => {
                if(window.loadTeamsForSelects) loadTeamsForSelects();
                if(window.loadMatches) loadMatches();
                if(window.loadScorersTable) loadScorersTable();
            }, 200);

        } else {
            // Zalogowany, ale brak uprawnień
            console.warn("Próba nieautoryzowanego wejścia:", user.email);
            alert("Brak uprawnień administratora dla konta: " + user.email);
            auth.signOut();
            
            if(loginBox) loginBox.style.display = 'block';
            if(adminWrapper) adminWrapper.style.display = 'none';
        }
    } else {
        // Nikt nie jest zalogowany
        if(loginBox) loginBox.style.display = 'block';
        if(adminWrapper) adminWrapper.style.display = 'none';
    }
});

window.logout = () => {
    auth.signOut();
    window.location.reload();
};

// ===================================================================
// 3. ZARZĄDZANIE DRUŻYNAMI
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
    } catch (e) {
        console.error(e);
        alert("Błąd dodawania drużyny: " + e.message);
    }
};

window.loadTeamsForSelects = async () => {
    const snapshot = await db.collection('teams').orderBy('name').get();
    
    const ids = ['edit-team-select', 'players-team-select', 'new-match-team1', 'new-match-team2'];
    
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if(sel) sel.innerHTML = '<option value="">-- Wybierz --</option>';
    });

    const teamsListDiv = document.getElementById('teams-list');
    if(teamsListDiv) teamsListDiv.innerHTML = '';

    snapshot.forEach(doc => {
        const team = doc.data();
        const optionHTML = `<option value="${doc.id}">${team.name}</option>`;

        ids.forEach(id => {
            const sel = document.getElementById(id);
            if(sel) sel.innerHTML += optionHTML;
        });

        if(teamsListDiv) {
            teamsListDiv.innerHTML += `<div style="padding:5px; border-bottom:1px solid #333;">${team.name} <small>(${team.manager || '-'})</small></div>`;
        }
    });
};

window.updateTeamName = async () => {
    const teamId = document.getElementById('edit-team-select').value;
    const newName = document.getElementById('edit-team-name').value;

    if (!teamId || !newName) return alert("Wybierz drużynę i wpisz nową nazwę.");

    await db.collection('teams').doc(teamId).update({ name: newName });
    alert("Zaktualizowano nazwę!");
    loadTeamsForSelects();
};

// ===================================================================
// 4. ZARZĄDZANIE ZAWODNIKAMI
// ===================================================================

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
        document.getElementById('new-p-name').value = '';
        document.getElementById('new-p-surname').value = '';
        document.getElementById('new-p-number').value = '';
        loadTeamPlayers(teamId);
    } catch (e) {
        alert("Błąd: " + e.message);
    }
};

window.loadTeamPlayers = async (teamId) => {
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
};

window.deletePlayer = async (teamId, playerId) => {
    if(!confirm("Usunąć zawodnika?")) return;
    await db.collection('teams').doc(teamId).collection('players').doc(playerId).delete();
    window.loadTeamPlayers(teamId);
};

// ===================================================================
// 5. ZARZĄDZANIE MECZAMI
// ===================================================================

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
            team1Id: t1, team2Id: t2,
            teamA: t1Name, teamB: t2Name,
            goalsA: 0, goalsB: 0,
            group: group,
            date: date,
            time: time,
            status: "scheduled",
            timestamp: new Date(date + 'T' + time).getTime()
        });
        alert("Utworzono mecz.");
        loadMatches();
    } catch (e) {
        console.error(e);
        alert("Błąd tworzenia meczu: " + e.message);
    }
};

window.loadMatches = async () => {
    const container = document.getElementById('matches-list');
    const filter = document.getElementById('match-status-filter').value;
    
    container.innerHTML = "Ładowanie i sortowanie...";

    let query = db.collection('matches');
    try { query = query.orderBy('date', 'asc'); } catch (e) {}

    try {
        const snapshot = await query.get();
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = '<div style="padding:20px;">Brak meczów w bazie. Dodaj nowy mecz.</div>';
            return;
        }

        let matchesData = [];

        snapshot.forEach(doc => {
            const m = doc.data();
            const t1Name = m.teamA || m.team1Name || "Drużyna A";
            const t2Name = m.teamB || m.team2Name || "Drużyna B";
            let s1 = (m.goalsA !== undefined) ? m.goalsA : (m.score1 || 0);
            let s2 = (m.goalsB !== undefined) ? m.goalsB : (m.score2 || 0);

            let rawStatus = m.status || 'planowany';
            let displayStatus = 'planowany';
            
            if (rawStatus === 'scheduled' || rawStatus === 'planowany') displayStatus = 'planowany';
            else if (rawStatus === 'live' || rawStatus === 'trwa') displayStatus = 'trwa';
            else if (rawStatus === 'finished' || rawStatus === 'zakończony') displayStatus = 'zakończony';

            const dateStr = m.date || '---';
            const timeStr = m.time || '--:--';
            const groupName = m.group ? m.group.toString().toUpperCase() : 'INNE';

            matchesData.push({
                id: doc.id,
                t1Name, t2Name, s1, s2,
                displayStatus, rawStatus,
                dateStr, timeStr, group: groupName
            });
        });

        if (filter !== "wszyscy") {
            matchesData = matchesData.filter(m => m.displayStatus === filter);
        }

        if (matchesData.length === 0) {
            container.innerHTML = '<div style="padding:20px;">Brak meczów o statusie: ' + filter + '</div>';
            return;
        }

        matchesData.sort((a, b) => {
            if (a.group < b.group) return -1;
            if (a.group > b.group) return 1;
            if (a.dateStr < b.dateStr) return -1;
            if (a.dateStr > b.dateStr) return 1;
            return 0;
        });

        let lastGroup = null;

        matchesData.forEach(match => {
            if (match.group !== lastGroup) {
                container.innerHTML += `<h3 style="border-bottom: 2px solid #2196f3; padding-bottom: 5px; margin-top: 25px; color: #2196f3;">GRUPA ${match.group}</h3>`;
                lastGroup = match.group;
            }

            let statusColor = '#888'; 
            if (match.displayStatus === 'trwa') statusColor = '#4caf50'; 
            if (match.displayStatus === 'zakończony') statusColor = '#f44336'; 

            const div = document.createElement('div');
            div.style.background = "#152036";
            div.style.margin = "10px 0";
            div.style.padding = "15px";
            div.style.borderRadius = "8px";
            div.style.borderLeft = `5px solid ${statusColor}`;
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">
                            ${match.t1Name} <span style="color:#2196f3">vs</span> ${match.t2Name}
                        </div>
                        <div style="color:#aaa; font-size:0.9em;">
                            <i class="far fa-calendar-alt"></i> ${match.dateStr} &nbsp; 
                            <i class="far fa-clock"></i> ${match.timeStr} &nbsp; 
                            | <span style="color:${statusColor}; font-weight:bold; text-transform:uppercase;">${match.displayStatus}</span>
                        </div>
                        <div style="font-size:1.4em; margin-top:8px; font-weight:bold;">
                            ${match.s1} : ${match.s2}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button onclick="window.openEditModal('${match.id}')" style="background:#2196f3; font-size:0.9em;">Edytuj / Gole</button>
                        <button onclick="window.toggleMatchStatus('${match.id}', '${match.rawStatus}')" style="background:#ff9800; font-size:0.9em;">Status</button>
                        <button onclick="window.deleteMatch('${match.id}')" style="background:#d32f2f; font-size:0.9em;">Usuń</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (e) {
        console.error("Błąd wyświetlania meczów: ", e);
        container.innerHTML = '<div class="message error">Błąd: ' + e.message + '</div>';
    }
};

document.getElementById('match-status-filter').addEventListener('change', window.loadMatches);

window.deleteMatch = async (id) => {
    if(!confirm("Usunąć ten mecz?")) return;
    await db.collection('matches').doc(id).delete();
    loadMatches();
};

window.toggleMatchStatus = async (id, currentRaw) => {
    let newStatus = 'scheduled';
    if (currentRaw === 'scheduled' || currentRaw === 'planowany') newStatus = 'live';
    else if (currentRaw === 'live' || currentRaw === 'trwa') newStatus = 'finished';
    else if (currentRaw === 'finished' || currentRaw === 'zakończony') newStatus = 'scheduled';

    await db.collection('matches').doc(id).update({ status: newStatus });
    loadMatches();
};

// ===================================================================
// 6. EDYCJA I STRZELCY (GOLE) - Z POPRAWKĄ DUPLIKOWANIA
// ===================================================================

window.openEditModal = async (matchId) => {
    currentMatchId = matchId;
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';

    const doc = await db.collection('matches').doc(matchId).get();
    const m = doc.data();

    const t1Name = m.teamA || m.team1Name || "Drużyna A";
    const t2Name = m.teamB || m.team2Name || "Drużyna B";
    let s1 = (m.goalsA !== undefined) ? m.goalsA : (m.score1 || 0);
    let s2 = (m.goalsB !== undefined) ? m.goalsB : (m.score2 || 0);

    const t1Id = m.team1Id;
    const t2Id = m.team2Id;

    document.getElementById('edit-match-team1-name').innerText = t1Name;
    document.getElementById('edit-match-team2-name').innerText = t2Name;
    document.getElementById('edit-score1').value = s1;
    document.getElementById('edit-score2').value = s2;

    if(t1Id && t2Id) {
        loadScorerSelects(t1Id, t2Id, t1Name, t2Name);
    } else {
        document.getElementById('scorer-team-select').innerHTML = "<option>Błąd: Brak ID drużyn w bazie</option>";
    }
    
    loadMatchScorersList(matchId);
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    currentMatchId = null;
    loadMatches(); 
    loadScorersTable(); 
};

window.saveMatchResult = async () => {
    if (!currentMatchId) return;
    const s1 = parseInt(document.getElementById('edit-score1').value);
    const s2 = parseInt(document.getElementById('edit-score2').value);

    await db.collection('matches').doc(currentMatchId).update({
        goalsA: s1, goalsB: s2,
        score1: s1, score2: s2
    });
    alert("Zapisano wynik.");
};

window.loadScorerSelects = async (t1Id, t2Id, t1Name, t2Name) => {
    const teamSelect = document.getElementById('scorer-team-select');
    const playerSelect = document.getElementById('scorer-player-select');
    
    teamSelect.innerHTML = `
        <option value="${t1Id}" data-name="${t1Name}">${t1Name}</option>
        <option value="${t2Id}" data-name="${t2Name}">${t2Name}</option>
    `;

    const loadPlayers = async (teamId) => {
        playerSelect.innerHTML = '<option>Ładowanie...</option>';
        try {
            const sn = await db.collection('teams').doc(teamId).collection('players').orderBy('surname').get();
            playerSelect.innerHTML = '';
            
            if(sn.empty) {
                playerSelect.innerHTML = '<option value="">Brak graczy w tej drużynie</option>';
            }

            sn.forEach(p => {
                const pd = p.data();
                playerSelect.innerHTML += `<option value="${p.id}" data-fullname="${pd.surname} ${pd.name}">${pd.number || ''} ${pd.surname} ${pd.name}</option>`;
            });
        } catch(e) {
            console.log("Błąd ładowania graczy: " + e.message);
            playerSelect.innerHTML = '<option>Błąd ładowania</option>';
        }
    };

    loadPlayers(teamSelect.value);
    teamSelect.onchange = () => loadPlayers(teamSelect.value);
};

// NOWA FUNKCJA - Z BLOKADĄ PRZYCISKU
window.addScorer = async () => {
    if (!currentMatchId) return;

    const btn = document.getElementById('btn-add-goal'); // Pobieramy przycisk (wymaga id="btn-add-goal" w HTML)
    
    // 1. BLOKUJEMY PRZYCISK
    if (btn) {
        btn.disabled = true; 
        btn.innerText = "..."; 
        btn.style.opacity = "0.5";
    }

    const teamSelect = document.getElementById('scorer-team-select');
    const playerSelect = document.getElementById('scorer-player-select');
    const minute = document.getElementById('scorer-minute').value;

    const teamId = teamSelect.value;
    const teamOption = teamSelect.options[teamSelect.selectedIndex];
    const teamName = teamOption ? teamOption.getAttribute('data-name') : "Nieznana";
    
    const playerId = playerSelect.value;
    
    if (!playerId) {
        alert("Wybierz zawodnika!");
        // Odblokuj w razie błędu walidacji
        if (btn) {
            btn.disabled = false;
            btn.innerText = "+";
            btn.style.opacity = "1";
        }
        return;
    }
    
    const playerOption = playerSelect.options[playerSelect.selectedIndex];
    const playerName = playerOption ? playerOption.getAttribute('data-fullname') : "Nieznany";

    try {
        // 2. Zapis gola w historii meczu
        await db.collection('matches').doc(currentMatchId).collection('goals').add({
            teamId, teamName, playerId, playerName, minute,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Aktualizacja wyniku meczu
        const matchDoc = await db.collection('matches').doc(currentMatchId).get();
        const mData = matchDoc.data();
        
        const isTeam1 = (teamId === mData.team1Id); 

        if (isTeam1) {
            await db.collection('matches').doc(currentMatchId).update({ 
                goalsA: firebase.firestore.FieldValue.increment(1),
                score1: firebase.firestore.FieldValue.increment(1) 
            });
            let currentVal = parseInt(document.getElementById('edit-score1').value) || 0;
            document.getElementById('edit-score1').value = currentVal + 1;
        } else {
            await db.collection('matches').doc(currentMatchId).update({ 
                goalsB: firebase.firestore.FieldValue.increment(1),
                score2: firebase.firestore.FieldValue.increment(1) 
            });
            let currentVal = parseInt(document.getElementById('edit-score2').value) || 0;
            document.getElementById('edit-score2').value = currentVal + 1;
        }

        // 4. AKTUALIZACJA GLOBALNEJ TABELI STRZELCÓW
        const scorersRef = db.collection('scorers');
        const q = await scorersRef.where('playerId', '==', playerId).get();

        if (q.empty) {
            // Jeśli strzelec nie istnieje, utwórz go
            await scorersRef.add({
                playerId: playerId,
                playerName: playerName,
                teamName: teamName,
                teamId: teamId,
                goals: 1
            });
        } else {
            // Jeśli istnieje, zaktualizuj
            const docId = q.docs[0].id;
            await scorersRef.doc(docId).update({
                goals: firebase.firestore.FieldValue.increment(1)
            });
        }

        loadMatchScorersList(currentMatchId);

    } catch (e) {
        console.error(e);
        alert("Błąd: " + e.message);
    } finally {
        // 5. ODBLOKUJEMY PRZYCISK (zawsze)
        if (btn) {
            btn.disabled = false;
            btn.innerText = "+";
            btn.style.opacity = "1";
        }
    }
};

window.loadMatchScorersList = async (matchId) => {
    const div = document.getElementById('scorers-edit-list');
    div.innerHTML = "Ładowanie...";
    const snap = await db.collection('matches').doc(matchId).collection('goals').orderBy('createdAt').get();
    
    div.innerHTML = "";
    snap.forEach(d => {
        const g = d.data();
        div.innerHTML += `<div style="border-bottom:1px solid #333; padding:5px;">${g.minute}' <b>${g.playerName}</b> (${g.teamName})</div>`;
    });
};

// ===================================================================
// 7. GLOBALNA TABELA STRZELCÓW
// ===================================================================

window.loadScorersTable = async () => {
    const tableBody = document.querySelector("#scorers-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Ładowanie tabeli...</td></tr>";

    try {
        const snapshot = await db.collection("scorers").orderBy("goals", "desc").get();
        tableBody.innerHTML = ""; 

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

window.deleteScorer = async (docId) => {
    if(!confirm("Usunąć tego strzelca z tabeli?")) return;
    try {
        await db.collection("scorers").doc(docId).delete();
        window.loadScorersTable();
    } catch (e) {
        alert("Błąd: " + e.message);
    }
};

// ===================================================================
// 8. ADMIN UPRAWNIENIA
// ===================================================================

const grantBtn = document.getElementById('grant-admin-btn');
if(grantBtn) {
    grantBtn.addEventListener('click', async () => {
        const email = document.getElementById('new-admin-email').value;
        if(!email) return alert("Podaj email");
        
        // Zapis tylko informacyjny, bo uprawnienia są w ALLOWED_ADMINS na górze
        await db.collection('admins').add({ email: email });
        alert("Zapisano admina. Pamiętaj, aby dodać go również do listy ALLOWED_ADMINS w kodzie JS!");
    });
}
