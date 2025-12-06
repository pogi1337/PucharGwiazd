import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, query, onSnapshot, getDoc, doc, 
    addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, getDocs, where, FieldValue 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1. KONFIGURACJA
const HARDCODED_CONFIG = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargugwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:33e7f6e45b2a7095dfe53e"
};

// Inicjalizacja zmiennych globalnych
let app, auth, db;
let currentMatch = {}; // Przechowuje dane edytowanego meczu

// Ścieżki (Główne kolekcje)
const PATH_USERS = 'users';      
const PATH_TEAMS = 'teams';
const PATH_MATCHES = 'matches';
const PATH_SCORERS = 'scorers';

// ==========================================
// FUNKCJA INICJALIZUJĄCA
// ==========================================
function initializeFirebaseClients() {
    try {
        if (!app) {
            app = initializeApp(HARDCODED_CONFIG);
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
    const msgBox = el || document.getElementById('team-msg') || document.getElementById('admin-msg');
    
    if (msgBox) {
        msgBox.textContent = text;
        msgBox.className = `message ${type}`;
        setTimeout(() => msgBox.textContent = '', 3000);
    } else {
        console.log(`[${type.toUpperCase()}]: ${text}`);
    }
}

window.logout = async () => {
    if(auth) await signOut(auth);
    window.location.reload();
};

// ==========================================
// LOGOWANIE I WERYFIKACJA
// ==========================================

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
                const docRef = doc(db, PATH_USERS, user.uid);
                const docSnap = await getDoc(docRef);
                
                // Sprawdzamy czy to admin (flaga admin:true lub role:'admin')
                if (docSnap.exists() && (docSnap.data().admin === true || docSnap.data().role === 'admin')) {
                    if(loginBox) loginBox.style.display = 'none';
                    if(adminPanel) adminPanel.style.display = 'block';
                    initAdminFunctions();
                } else {
                    showMessage("Brak uprawnień administratora.", 'error');
                    await signOut(auth);
                }
            } catch (e) {
                // Fallback dla szybkiego testu (jeśli nie masz kolekcji users)
                // W produkcji usuń ten blok i wymuś kolekcję users!
                console.warn("Nie udało się pobrać profilu, ale wpuszczam (tryb dev)", e);
                if(loginBox) loginBox.style.display = 'none';
                if(adminPanel) adminPanel.style.display = 'block';
                initAdminFunctions();
            }
        } else {
            if(loginBox) loginBox.style.display = 'block';
            if(adminPanel) adminPanel.style.display = 'none';
        }
    });
}

function initAdminFunctions() {
    loadTeamsSelects(); 
    loadMatches();
    loadScorersTable();
    loadTeamsList(); 
}

// ==========================================
// A. ZARZĄDZANIE DRUŻYNAMI
// ==========================================

window.addTeam = async () => {
    const name = document.getElementById('new-team-name').value;
    const email = document.getElementById('new-team-manager').value;
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
    } catch(e) {
        showMessage("Błąd dodawania.", 'error');
    }
};

function loadTeamsList() {
    const list = document.getElementById('teams-list');
    if(!list) return;

    onSnapshot(query(collection(db, PATH_TEAMS), orderBy('name')), snap => {
        const selectEdit = document.getElementById('edit-team-select');
        if(selectEdit) selectEdit.innerHTML = '<option value="">Wybierz drużynę</option>';
        
        let html = '<ul style="list-style:none; padding:0;">';
        snap.forEach(d => {
            const t = d.data();
            html += `<li style="background:#222; margin:5px 0; padding:10px; display:flex; justify-content:space-between; border-radius:5px;">
                        <span><b>${t.name}</b></span>
                        <button onclick="window.deleteTeam('${d.id}', '${t.name}')" style="background:red; border:none; color:white; border-radius:3px; cursor:pointer;">Usuń</button>
                     </li>`;
            if(selectEdit) selectEdit.innerHTML += `<option value="${d.id}">${t.name}</option>`;
        });
        html += '</ul>';
        list.innerHTML = html;
    });
}

window.updateTeamName = async () => {
    const id = document.getElementById('edit-team-select').value;
    const newName = document.getElementById('edit-team-name').value;
    if(!id || !newName) return;
    await updateDoc(doc(db, PATH_TEAMS, id), { name: newName });
    showMessage("Nazwa zmieniona!", 'success');
    document.getElementById('edit-team-name').value = '';
};

window.deleteTeam = async (id, name) => {
    if(!confirm(`Usunąć drużynę ${name}?`)) return;
    await deleteDoc(doc(db, PATH_TEAMS, id));
};

// ==========================================
// B. ZARZĄDZANIE ZAWODNIKAMI
// ==========================================

function loadTeamsSelects() {
    const q = query(collection(db, PATH_TEAMS), orderBy('name'));
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

window.selectTeamInDropdown = () => {
    const teamId = document.getElementById('players-team-select').value;
    const area = document.getElementById('players-manager-area');
    const list = document.getElementById('team-players-list');
    
    if(!teamId) { area.style.display = 'none'; return; }
    area.style.display = 'block';
    
    const q = query(collection(db, PATH_TEAMS, teamId, 'players'), orderBy('number'));
    onSnapshot(q, snap => {
        list.innerHTML = '';
        if(snap.empty) list.innerHTML = '<p>Brak zawodników.</p>';
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `
                <div style="background:#333; padding:8px; margin:5px 0; display:flex; justify-content:space-between; align-items:center; border-radius:5px;">
                    <span>#${p.number} ${p.name} ${p.surname} (${p.position})</span>
                    <button onclick="window.delPlayer('${teamId}', '${d.id}')" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer;">X</button>
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
    await addDoc(collection(db, PATH_TEAMS, teamId, 'players'), { name, surname, number, position });
    showMessage("Dodano zawodnika", 'success');
    document.getElementById('new-p-name').value = '';
    document.getElementById('new-p-surname').value = '';
};

window.delPlayer = async (tid, pid) => {
    if(confirm("Usunąć?")) await deleteDoc(doc(db, PATH_TEAMS, tid, 'players', pid));
};

// ==========================================
// C. ZARZĄDZANIE MECZAMI (Z GRUPOWANIEM)
// ==========================================

window.addMatch = async () => {
    const t1Select = document.getElementById('new-match-team1');
    const t2Select = document.getElementById('new-match-team2');
    const teamA = t1Select.options[t1Select.selectedIndex].text;
    const teamB = t2Select.options[t2Select.selectedIndex].text;
    const team1Id = t1Select.value;
    const team2Id = t2Select.value;
    const group = document.getElementById('group').value.trim().toUpperCase() || 'A';
    const date = document.getElementById('new-match-date').value;
    const time = document.getElementById('new-match-time').value;

    if(!team1Id || !team2Id) return showMessage("Wybierz drużyny", 'error');

    await addDoc(collection(db, PATH_MATCHES), {
        teamA, teamB, team1Id, team2Id,
        group, date, time,
        goalsA: 0, goalsB: 0, status: 'scheduled', scorers: []
    });
    showMessage("Mecz dodany!", 'success');
};

function loadMatches() {
    const list = document.getElementById('matches-list');
    const filter = document.getElementById('match-status-filter');
    filter.onchange = () => loadMatches();

    // 1. Pobieramy wszystkie mecze
    onSnapshot(query(collection(db, PATH_MATCHES)), snap => {
        list.innerHTML = '';
        
        // 2. Kontener na grupy: { "A": [mecz1, mecz2], "B": [mecz3] }
        const groups = {};

        snap.forEach(d => {
            const m = d.data();
            m.id = d.id; // Dodajemy ID dokumentu do obiektu danych

            // Filtrowanie (Status)
            if (filter.value !== 'wszyscy') {
                 const map = { 'planowany': 'scheduled', 'trwa': 'live', 'zakończony': 'finished' };
                 if (m.status !== map[filter.value]) return;
            }

            // Grupujemy
            const groupName = m.group || 'Inne';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(m);
        });

        // 3. Sortujemy nazwy grup (A, B, C...)
        const sortedGroupKeys = Object.keys(groups).sort();

        if (sortedGroupKeys.length === 0) {
            list.innerHTML = '<p>Brak meczów spełniających kryteria.</p>';
            return;
        }

        // 4. Generujemy HTML dla każdej grupy
        sortedGroupKeys.forEach(groupKey => {
            // Nagłówek grupy
            const groupHeader = document.createElement('h3');
            groupHeader.textContent = `Grupa ${groupKey}`;
            groupHeader.style.cssText = "border-bottom: 2px solid #2196f3; color: #2196f3; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px;";
            list.appendChild(groupHeader);

            // Sortowanie meczów wewnątrz grupy po dacie i godzinie
            const matchesInGroup = groups[groupKey].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

            matchesInGroup.forEach(m => {
                const div = document.createElement('div');
                div.className = 'match-card';
                // Kolor lewej krawędzi zależny od statusu
                let statusColor = '#444'; // default planowany
                if(m.status === 'live') statusColor = 'red';
                if(m.status === 'finished') statusColor = '#2196f3';

                div.style.cssText = `background:#1e1e1e; padding:15px; margin-bottom:10px; border:1px solid #333; border-left: 4px solid ${statusColor}; border-radius:8px;`;
                
                const statusSel = `
                    <select onchange="window.updStatus('${m.id}', this.value)" style="width:auto; padding:5px; background: #333; color: white; border: 1px solid #555;">
                        <option value="scheduled" ${m.status==='scheduled'?'selected':''}>Plan</option>
                        <option value="live" ${m.status==='live'?'selected':''}>LIVE</option>
                        <option value="finished" ${m.status==='finished'?'selected':''}>Koniec</option>
                    </select>
                `;

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; color:white; font-weight:bold; margin-bottom:10px;">
                        <span style="font-size: 1.1em;">${m.teamA} vs ${m.teamB}</span>
                        <span style="color: #aaa; font-weight: normal;">${m.date} ${m.time}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                        <div style="display:flex; align-items:center;">
                            <input type="number" value="${m.goalsA}" style="width:50px; text-align:center; padding: 5px;" onchange="window.updScore('${m.id}', 'A', this.value)">
                            <span style="padding: 0 10px; font-weight: bold;">:</span>
                            <input type="number" value="${m.goalsB}" style="width:50px; text-align:center; padding: 5px;" onchange="window.updScore('${m.id}', 'B', this.value)">
                        </div>
                        ${statusSel}
                        <div style="margin-left:auto; display: flex; gap: 5px;">
                            <button onclick="window.openEditModal('${m.id}', '${m.team1Id}', '${m.team2Id}', '${m.teamA}', '${m.teamB}')" style="background:#ff9800; color:white; border:none; padding:8px 12px; cursor:pointer; border-radius: 4px;"><i class="fas fa-futbol"></i> Gole</button>
                            <button onclick="window.delMatch('${m.id}')" style="background:#d32f2f; color:white; border:none; padding:8px 12px; cursor:pointer; border-radius: 4px;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
                list.appendChild(div);
            });
        });
    });
}

window.updStatus = async (mid, status) => updateDoc(doc(db, PATH_MATCHES, mid), { status });
window.updScore = async (mid, team, val) => {
    const update = {};
    if (team === 'A') update.goalsA = parseInt(val);
    else update.goalsB = parseInt(val);
    await updateDoc(doc(db, PATH_MATCHES, mid), update);
    showMessage("Wynik zapisany.");
};
window.delMatch = async (mid) => { if(confirm("Usunąć mecz?")) await deleteDoc(doc(db, PATH_MATCHES, mid)); };

// ============================================
// D. MODAL EDYCJI (STRZELCY I WYNIKI)
// ============================================

window.openEditModal = (matchId, t1Id, t2Id, t1Name, t2Name) => {
    currentMatch = { id: matchId, t1Id, t2Id, t1Name, t2Name };
    
    document.getElementById('edit-match-team1-name').textContent = t1Name;
    document.getElementById('edit-match-team2-name').textContent = t2Name;
    
    // Select drużyn w modalu
    const teamSelect = document.getElementById('scorer-team-select');
    teamSelect.innerHTML = `
        <option value="">-- Wybierz Drużynę --</option>
        <option value="${t1Id}">${t1Name}</option>
        <option value="${t2Id}">${t2Name}</option>
    `;
    
    document.getElementById('scorer-player-select').innerHTML = '<option value="">Najpierw wybierz drużynę</option>';

    teamSelect.onchange = () => {
        window.updateScorerPlayers(teamSelect.value); 
    };

    // Wczytaj AKTUALNE wyniki i listę strzelców
    window.refreshModalScore(matchId);
    loadMatchScorersList(matchId);
    
    document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
};

window.updateScorerPlayers = async (teamId) => {
    const playerSelect = document.getElementById('scorer-player-select');
    if (!teamId) {
        playerSelect.innerHTML = '<option value="">Wybierz Drużynę</option>';
        return;
    }
    playerSelect.innerHTML = '<option>Ładowanie...</option>';

    try {
        const q = query(collection(db, PATH_TEAMS, teamId, 'players'), orderBy('number'));
        const snap = await getDocs(q);
        
        playerSelect.innerHTML = '<option value="">-- Wybierz Zawodnika --</option>';
        snap.forEach(d => {
            const p = d.data();
            playerSelect.innerHTML += `<option value="${p.surname} ${p.name}">#${p.number} ${p.surname} ${p.name}</option>`;
        });
    } catch (e) {
        console.error(e);
        playerSelect.innerHTML = '<option>Błąd ładowania</option>';
    }
};

window.addScorer = async () => {
    if (!currentMatch.id) return;

    const teamSelect = document.getElementById('scorer-team-select');
    const teamId = teamSelect.value;
    const teamName = teamSelect.options[teamSelect.selectedIndex].text;
    const playerName = document.getElementById('scorer-player-select').value;
    const minute = document.getElementById('scorer-minute').value;

    if (!teamId || !playerName) return showMessage("Wybierz drużynę i zawodnika", 'error');

    const matchRef = doc(db, PATH_MATCHES, currentMatch.id);

    try {
        const updates = {
            scorers: FieldValue.arrayUnion({ name: playerName, team: teamName, minute: minute, teamId: teamId })
        };
        
        if (teamId === currentMatch.t1Id) {
            updates.goalsA = FieldValue.increment(1);
        } else {
            updates.goalsB = FieldValue.increment(1);
        }
        
        await updateDoc(matchRef, updates);

        // Aktualizacja tabeli Króla Strzelców
        const q = query(collection(db, PATH_SCORERS), where('name', '==', playerName), where('team', '==', teamName));
        const snap = await getDocs(q);

        if (snap.empty) {
            await addDoc(collection(db, PATH_SCORERS), { 
                name: playerName, 
                team: teamName, 
                teamId: teamId, 
                goals: 1 
            });
        } else {
            await updateDoc(doc(db, PATH_SCORERS, snap.docs[0].id), { 
                goals: FieldValue.increment(1) 
            });
        }
        
        showMessage(`Gol dodany! (${playerName})`, 'success');
        
        // Odśwież widok w modalu natychmiast
        loadMatchScorersList(currentMatch.id);
        window.refreshModalScore(currentMatch.id);

    } catch (e) {
        console.error(e);
        showMessage("Błąd dodawania gola", 'error');
    }
};

window.refreshModalScore = async (matchId) => {
    const snap = await getDoc(doc(db, PATH_MATCHES, matchId));
    if(snap.exists()) {
        const m = snap.data();
        document.getElementById('edit-score1').value = m.goalsA;
        document.getElementById('edit-score2').value = m.goalsB;
    }
};

async function loadMatchScorersList(matchId) {
    const div = document.getElementById('scorers-edit-list');
    div.innerHTML = 'Ładowanie...';
    
    const docSnap = await getDoc(doc(db, PATH_MATCHES, matchId));
    if (docSnap.exists()) {
        const m = docSnap.data();
        const scorers = m.scorers || [];
        
        div.innerHTML = '';
        if (scorers.length === 0) div.innerHTML = '<p style="color:#888; text-align:center;">Brak strzelców.</p>';
        
        scorers.forEach((s) => {
            div.innerHTML += `
                <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #444; background:#222; margin-bottom:2px; border-radius: 4px;">
                    <span>${s.minute ? s.minute + "'" : ''} <b>${s.name}</b> <small style="color: #aaa;">(${s.team})</small></span>
                </div>
            `;
        });
    }
}

window.saveMatchResult = async () => {
    if (!currentMatch.id) return;
    const gA = parseInt(document.getElementById('edit-score1').value) || 0;
    const gB = parseInt(document.getElementById('edit-score2').value) || 0;
    
    try {
        await updateDoc(doc(db, PATH_MATCHES, currentMatch.id), { goalsA: gA, goalsB: gB });
        showMessage("Wynik zaktualizowany ręcznie.", 'success');
    } catch(e) {
        showMessage("Błąd zapisu.", 'error');
    }
};

// --- E. TABELA STRZELCÓW (GLÓWNA) ---
function loadScorersTable() {
    onSnapshot(query(collection(db, PATH_SCORERS), orderBy('goals', 'desc')), snap => {
        const tbody = document.querySelector('#scorers-table tbody');
        if(!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(d => {
            const s = d.data();
            tbody.innerHTML += `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.team}</td>
                    <td>${s.goals}</td>
                    <td><button onclick="window.delScorer('${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">X</button></td>
                </tr>`;
        });
    });
}

window.delScorer = async (id) => { if(confirm("Usunąć strzelca z tabeli?")) await deleteDoc(doc(db, PATH_SCORERS, id)); };

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
