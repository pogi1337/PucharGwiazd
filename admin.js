// admin.js - WERSJA SUBCOLLECTION (Dla struktury /teams/ID/players)

// --- KONFIGURACJA ---
const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:75e8df76127397b913612d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- ADMINI ---
const ALLOWED_ADMINS = ["kacpernwm77@gmail.com", "krzysztof.lodzinski@interia.pl"];

// --- LOGOWANIE ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const err = document.getElementById('login-error');
        
        if(!email || !pass) return err.innerText = "Podaj dane!";
        err.innerText = "Logowanie...";

        auth.signInWithEmailAndPassword(email, pass)
            .catch(error => err.innerText = "Błąd: " + error.message);
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut(); window.location.reload();
});

// START
auth.onAuthStateChanged(user => {
    if (user && ALLOWED_ADMINS.includes(user.email)) {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('admin-wrapper').style.display = 'block';
        document.getElementById('user-info').innerText = `Zalogowano: ${user.email}`;
        
        loadTeams();
        loadMatches();
        loadPlayers(); // To teraz zadziała!
        loadNewsAdmin();
    } else if (user) {
        alert("Brak uprawnień!"); auth.signOut();
    }
});


// =========================================================
// 1. ZAWODNICY (SUBCOLLECTIONS FIX)
// =========================================================

function savePlayer() {
    const id = document.getElementById('player-id-edit').value;
    const name = document.getElementById('player-name').value;
    const teamId = document.getElementById('player-team').value;
    // Ważne: przy edycji musimy wiedzieć, w jakiej STAREJ drużynie był gracz, 
    // ale dla uproszczenia zakładamy edycję w ramach tej samej drużyny lub dodanie nowego.
    
    // Jeśli to edycja, pobieramy teamId z ukrytego pola (jeśli zablokowaliśmy zmianę drużyny)
    // lub z selecta.
    
    if(!name || !teamId) return alert("Podaj imię i wybierz drużynę!");

    // Pobierz nazwę drużyny (dla wyświetlania)
    const teamSelect = document.getElementById('player-team');
    const teamName = teamSelect.options[teamSelect.selectedIndex].text;

    const data = { 
        name: name, 
        teamName: teamName, // Zapisujemy też nazwę, żeby łatwiej wyświetlać
        goals: parseInt(document.getElementById('player-goals').value) || 0
    };

    let promise;
    if (id) {
        // EDYCJA: Musimy wiedzieć dokładnie gdzie jest gracz.
        // W tricku loadPlayers zapisaliśmy ID drużyny w atrybucie przycisku
        // Ale tutaj prościej: przy edycji nadpisujemy w wybranej drużynie.
        promise = db.collection("teams").doc(teamId).collection("players").doc(id).update(data);
    } else {
        // NOWY
        promise = db.collection("teams").doc(teamId).collection("players").add(data);
    }
    
    promise.then(() => { 
        if(!id) alert("Zawodnik dodany!"); 
        resetPlayerForm(); 
    }).catch(e => alert("Błąd: " + e.message));
}

function loadPlayers() {
    const list = document.getElementById('players-list');
    
    // UŻYWAMY COLLECTION GROUP - to pobiera graczy ze wszystkich drużyn naraz!
    db.collectionGroup("players").onSnapshot(snap => {
        list.innerHTML = '';
        if(snap.empty) { list.innerHTML = '<p>Brak zawodników. Dodaj kogoś do drużyny.</p>'; return; }

        snap.forEach(doc => {
            const p = doc.data();
            // Musimy wyciągnąć ID drużyny z "ścieżki" dokumentu
            // Ścieżka to: teams/TEAM_ID/players/PLAYER_ID
            const teamId = doc.ref.parent.parent.id; 

            list.innerHTML += `
                <div class="list-item">
                    <div style="flex-grow:1;">
                        <b>${p.name}</b> <span style="color:#00d4ff">(${p.teamName || 'Drużyna'})</span>
                    </div>
                    
                    <div class="goal-controls">
                        <button class="btn-goal minus" onclick="quickUpdateGoals('${teamId}', '${doc.id}', -1)">-</button>
                        <span style="font-size:1.2rem; font-weight:bold; min-width:30px; text-align:center;">${p.goals || 0}</span>
                        <button class="btn-goal plus" onclick="quickUpdateGoals('${teamId}', '${doc.id}', 1)">+</button>
                    </div>

                    <div style="margin-left:15px;">
                        <button class="btn-edit" onclick="editPlayer('${doc.id}', '${teamId}', '${p.name}', '${p.goals}')">Edytuj</button>
                        <button class="btn-delete" onclick="deleteSubPlayer('${teamId}', '${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}

// Szybka zmiana goli
window.quickUpdateGoals = (teamId, playerId, change) => {
    db.collection("teams").doc(teamId).collection("players").doc(playerId).update({
        goals: firebase.firestore.FieldValue.increment(change)
    }).catch(console.error);
};

// Edycja zawodnika
window.editPlayer = (id, teamId, name, goals) => {
    document.getElementById('player-id-edit').value = id;
    document.getElementById('player-name').value = name;
    document.getElementById('player-goals').value = goals;
    
    // Ustawiamy selecta na odpowiednią drużynę
    document.getElementById('player-team').value = teamId;
    // Blokujemy zmianę drużyny przy edycji (bo to by wymagało skomplikowanego przenoszenia)
    // document.getElementById('player-team').disabled = true; 

    document.getElementById('player-form-title').innerText = "EDYTUJESZ: " + name;
    document.getElementById('btn-save-player').innerText = "ZAKTUALIZUJ";
    document.getElementById('player-form-box').scrollIntoView({behavior: "smooth"});
};

// Usuwanie zawodnika z podkolekcji
window.deleteSubPlayer = (teamId, playerId) => {
    if(confirm("Usunąć zawodnika?")) {
        db.collection("teams").doc(teamId).collection("players").doc(playerId).delete();
    }
};

window.resetPlayerForm = () => {
    document.getElementById('player-id-edit').value = '';
    document.getElementById('player-name').value = '';
    document.getElementById('player-goals').value = '0';
    document.getElementById('player-team').value = '';
    document.getElementById('player-team').disabled = false;
    
    document.getElementById('player-form-title').innerText = "Dodaj Zawodnika";
    document.getElementById('btn-save-player').innerText = "ZAPISZ ZAWODNIKA";
};


// =========================================================
// 2. DRUŻYNY
// =========================================================

function saveTeam() {
    const id = document.getElementById('team-id-edit').value;
    const name = document.getElementById('team-name').value;
    const logo = document.getElementById('team-logo').value || 'logo.png';
    const group = document.getElementById('team-group').value;

    if(!name) return alert("Podaj nazwę!");

    const data = { name, logo, group };
    if(!id) {
        data.points = 0; data.matches = 0; data.wins = 0; 
        data.draws = 0; data.losses = 0; data.goals_scored = 0; data.goals_lost = 0;
    }

    const promise = id ? db.collection("teams").doc(id).update(data) : db.collection("teams").add(data);

    promise.then(() => {
        alert(id ? "Zaktualizowano!" : "Dodano!");
        resetTeamForm();
    }).catch(e => alert(e.message));
}

function loadTeams() {
    const list = document.getElementById('teams-list');
    const select1 = document.getElementById('m-team1');
    const select2 = document.getElementById('m-team2');
    const selectPlayer = document.getElementById('player-team');

    db.collection("teams").onSnapshot(snap => {
        list.innerHTML = '';
        let opts = '<option value="">Wybierz...</option>';
        
        snap.forEach(doc => {
            const t = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${t.logo}" style="width:30px; height:30px; border-radius:50%">
                        <b>${t.name}</b>
                    </div>
                    <div>
                        <button class="btn-edit" onclick="editTeam('${doc.id}', '${t.name}', '${t.logo}', '${t.group}')">Edytuj</button>
                        <button class="btn-delete" onclick="deleteDoc('teams', '${doc.id}')">Usuń</button>
                    </div>
                </div>`;
            // Zapisujemy ID jako value dla selecta graczy
            opts += `<option value="${doc.id}">${t.name}</option>`;
        });

        if(select1) { // Dla meczów potrzebujemy nazwy
             // Tutaj mała zmiana - do meczów lepiej używać nazw, do graczy ID.
             // Zrobię oddzielną pętlę dla meczów w locie albo prościej:
             // Zostawmy value jako name dla meczów (bo tak masz w bazie meczów)
        }
        
        // Specjalna pętla dla selecta meczów (Value = Name)
        let matchOpts = '<option value="">Wybierz...</option>';
        snap.forEach(doc => { matchOpts += `<option value="${doc.data().name}">${doc.data().name}</option>`; });
        
        if(select1) { select1.innerHTML = matchOpts; select2.innerHTML = matchOpts; }

        // Pętla dla selecta graczy (Value = ID) - BO MUSIMY WIEDZIEĆ GDZIE DODAĆ GRACZA
        let playerOpts = '<option value="">Wybierz drużynę...</option>';
        snap.forEach(doc => { playerOpts += `<option value="${doc.id}">${doc.data().name}</option>`; });
        if(selectPlayer) selectPlayer.innerHTML = playerOpts;
    });
}

window.editTeam = (id, name, logo, group) => {
    document.getElementById('team-id-edit').value = id;
    document.getElementById('team-name').value = name;
    document.getElementById('team-logo').value = logo;
    document.getElementById('team-group').value = group;
    document.getElementById('team-form-title').innerText = "Edytuj Drużynę";
    document.getElementById('team-form-box').scrollIntoView({behavior: "smooth"});
};

window.resetTeamForm = () => {
    document.getElementById('team-id-edit').value = '';
    document.getElementById('team-name').value = '';
    document.getElementById('team-logo').value = '';
    document.getElementById('team-form-title').innerText = "Dodaj Drużynę";
};


// =========================================================
// 3. MECZE
// =========================================================

function saveMatch() {
    const id = document.getElementById('match-id-edit').value;
    const t1 = document.getElementById('m-team1').value;
    const t2 = document.getElementById('m-team2').value;
    const date = document.getElementById('m-date').value;
    const time = document.getElementById('m-time').value;
    const s1 = document.getElementById('m-score1').value;
    const s2 = document.getElementById('m-score2').value;
    const status = document.getElementById('m-status').value;

    if(!t1 || !t2) return alert("Wybierz drużyny!");

    const data = {
        team1: t1, team2: t2, date, time, status,
        score1: s1 === '' ? null : parseInt(s1),
        score2: s2 === '' ? null : parseInt(s2)
    };

    const promise = id ? db.collection("matches").doc(id).update(data) : db.collection("matches").add(data);
    promise.then(() => { 
        alert(id ? "Mecz zaktualizowany!" : "Mecz dodany!");
        resetMatchForm(); 
    }).catch(e => alert("Błąd: " + e.message));
}

function loadMatches() {
    const list = document.getElementById('matches-list');
    db.collection("matches").onSnapshot(snap => {
        list.innerHTML = '';
        if(snap.empty) { list.innerHTML = '<p>Brak meczów.</p>'; return; }

        snap.forEach(doc => {
            const m = doc.data();
            const score = m.status !== 'upcoming' ? `${m.score1}:${m.score2}` : '-:-';
            const color = m.status === 'live' ? '#00d4ff' : (m.status === 'finished' ? '#28a745' : '#888');
            
            list.innerHTML += `
                <div class="list-item" style="border-left: 4px solid ${color}">
                    <div>
                        <small>${m.date} ${m.time}</small><br>
                        <b>${m.team1} vs ${m.team2}</b> [${score}]
                    </div>
                    <div>
                        <button class="btn-edit" onclick="editMatch('${doc.id}', '${m.team1}', '${m.team2}', '${m.date}', '${m.time}', '${m.score1}', '${m.score2}', '${m.status}')">Edytuj</button>
                        <button class="btn-delete" onclick="deleteDoc('matches', '${doc.id}')">Usuń</button>
                    </div>
                </div>`;
        });
    });
}

window.editMatch = (id, t1, t2, date, time, s1, s2, status) => {
    document.getElementById('match-id-edit').value = id;
    document.getElementById('m-team1').value = t1;
    document.getElementById('m-team2').value = t2;
    document.getElementById('m-date').value = date;
    document.getElementById('m-time').value = time;
    document.getElementById('m-score1').value = s1 === 'null' ? '' : s1;
    document.getElementById('m-score2').value = s2 === 'null' ? '' : s2;
    document.getElementById('m-status').value = status;
    
    document.getElementById('match-form-title').innerText = "EDYTUSZ MECZ";
    document.getElementById('btn-save-match').innerText = "ZAKTUALIZUJ";
    document.getElementById('match-form-box').scrollIntoView({behavior: "smooth"});
};

window.resetMatchForm = () => {
    document.getElementById('match-id-edit').value = '';
    document.getElementById('m-score1').value = '';
    document.getElementById('m-score2').value = '';
    document.getElementById('match-form-title').innerText = "Dodaj Mecz";
    document.getElementById('btn-save-match').innerText = "ZAPISZ MECZ";
};


// =========================================================
// 4. NEWSY
// =========================================================

function addNews() {
    const title = document.getElementById('news-title').value;
    const content = document.getElementById('news-content').value;

    if(!title) return alert("Podaj tytuł!");

    db.collection("news").add({
        title, content,
        date: new Date().toLocaleDateString('pl-PL'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Opublikowano!");
        document.getElementById('news-title').value = '';
        document.getElementById('news-content').value = '';
    });
}

function loadNewsAdmin() {
    const list = document.getElementById('news-list');
    db.collection("news").orderBy('timestamp', 'desc').onSnapshot(snap => {
        list.innerHTML = '';
        snap.forEach(doc => {
            const n = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div><b>${n.title}</b><br><small>${n.date}</small></div>
                    <button class="btn-delete" onclick="deleteDoc('news', '${doc.id}')">Usuń</button>
                </div>`;
        });
    });
}

// =========================================================
// HELPER
// =========================================================
window.deleteDoc = (collection, id) => {
    if(confirm("Czy na pewno usunąć?")) {
        db.collection(collection).doc(id).delete();
    }
};