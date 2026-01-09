/* admin.js - Logic for Premium Dark Panel */

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

const ADMINS = ["kacpernwm77@gmail.com", "krzysztof.lodzinski@interia.pl"];
const DEFAULT_DATE = '2026-01-18';

// --- INIT & AUTH ---
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        const ui = document.getElementById('app-container');
        const login = document.getElementById('login-screen');
        
        if (user && ADMINS.includes(user.email.toLowerCase())) {
            ui.style.display = 'flex';
            login.style.display = 'none';
            document.getElementById('userEmail').innerText = user.email;
            initApp();
        } else {
            ui.style.display = 'none';
            login.style.display = 'flex';
            if(user) auth.signOut();
        }
    });
});

window.login = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    if(!ADMINS.includes(e.toLowerCase())) return document.getElementById('login-msg').innerText = "Brak uprawnień admina.";
    auth.signInWithEmailAndPassword(e, p).catch(err => document.getElementById('login-msg').innerText = err.message);
};
window.logout = () => auth.signOut();

function initApp() {
    loadTeamsToSelect();
    listenMatches();
    listenTeams();
    listenNews();
    loadSettings();
    calculateStandings();   // Tabela Ligowa
    calculateTopScorers();  // <--- NOWOŚĆ: Tabela Strzelców
    document.getElementById('matchDate').value = DEFAULT_DATE;
}

// --- 1. MATCHES ---
window.toggleScoreInputs = () => {
    const status = document.getElementById('matchStatus').value;
    document.getElementById('scoreInputs').style.display = (status === 'live' || status === 'finished') ? 'grid' : 'none';
};

window.saveMatch = () => {
    const id = document.getElementById('matchId').value;
    const home = document.getElementById('homeTeamSelect').value;
    const away = document.getElementById('awayTeamSelect').value;
    const date = document.getElementById('matchDate').value;
    const status = document.getElementById('matchStatus').value;
    const hScore = parseInt(document.getElementById('homeScore').value) || 0;
    const aScore = parseInt(document.getElementById('awayScore').value) || 0;

    if(!home || !away || home === away) return alert("Wybierz poprawne drużyny.");

    const data = { 
        home, away, date, status, 
        homeScore: hScore, awayScore: aScore,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    };

    const promise = id ? db.collection('matches').doc(id).update(data) : db.collection('matches').add(data);
    promise.then(resetMatchForm).catch(err => alert(err.message));
};

window.editMatch = (id, h, a, d, s, hs, as) => {
    document.getElementById('matchId').value = id;
    document.getElementById('homeTeamSelect').value = h;
    document.getElementById('awayTeamSelect').value = a;
    document.getElementById('matchDate').value = d;
    document.getElementById('matchStatus').value = s;
    document.getElementById('homeScore').value = hs;
    document.getElementById('awayScore').value = as;
    toggleScoreInputs();
    
    const btn = document.getElementById('saveMatchBtn');
    btn.innerText = "Aktualizuj Mecz";
    btn.className = "btn btn-primary"; // Reset klasy
    document.getElementById('cancelMatchBtn').style.display = 'inline-block';
    document.querySelector('.card').scrollIntoView({behavior:'smooth'});
};

window.resetMatchForm = () => {
    document.getElementById('matchId').value = '';
    document.getElementById('matchStatus').value = 'planned';
    document.getElementById('homeScore').value = 0;
    document.getElementById('awayScore').value = 0;
    toggleScoreInputs();
    document.getElementById('saveMatchBtn').innerText = "Zapisz Mecz";
    document.getElementById('cancelMatchBtn').style.display = 'none';
};

window.deleteMatch = (id) => { if(confirm("Usunąć mecz?")) db.collection('matches').doc(id).delete(); };

function listenMatches() {
    db.collection('matches').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const div = document.getElementById('matchesContainer');
        div.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const statusClass = m.status === 'live' ? 'st-live' : (m.status === 'finished' ? 'st-finished' : 'st-planned');
            const statusText = m.status === 'live' ? 'NA ŻYWO' : (m.status === 'finished' ? 'KONIEC' : 'PLAN');
            
            div.innerHTML += `
                <div class="match-card" style="border-left: 4px solid ${m.status === 'live' ? '#ff4d4d' : '#00d4ff'};">
                    <div style="flex:1">
                        <div style="font-size:1.1rem; font-weight:700; color:white;">
                            ${m.home} <span class="score-box">${m.homeScore} : ${m.awayScore}</span> ${m.away}
                        </div>
                        <div style="margin-top:8px; font-size:0.85rem; color: #a0aec0;">
                            <span class="status-pill ${statusClass}">${statusText}</span>
                            <span style="margin-left:10px;"><i class="far fa-calendar"></i> ${m.date}</span>
                        </div>
                    </div>
                    <div>
                        <button class="btn-warning" style="padding:8px 12px; margin-right:5px;" onclick="editMatch('${doc.id}','${m.home}','${m.away}','${m.date}','${m.status}',${m.homeScore},${m.awayScore})"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger" style="padding:8px 12px;" onclick="deleteMatch('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        calculateStandings();
    });
}

// --- 2. TABLES (STANDINGS & SCORERS) ---
function calculateStandings() {
    // Prosta logika tabeli ligowej
    Promise.all([db.collection('teams').get(), db.collection('matches').get()]).then(([tSnap, mSnap]) => {
        let stats = {};
        tSnap.forEach(d => stats[d.data().name] = { m:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 });
        
        mSnap.forEach(d => {
            const m = d.data();
            if(m.status === 'finished' && stats[m.home] && stats[m.away]) {
                stats[m.home].m++; stats[m.away].m++;
                stats[m.home].gf += m.homeScore; stats[m.home].ga += m.awayScore;
                stats[m.away].gf += m.awayScore; stats[m.away].ga += m.homeScore;
                
                if(m.homeScore > m.awayScore) { stats[m.home].w++; stats[m.home].pts += 3; stats[m.away].l++; }
                else if(m.homeScore < m.awayScore) { stats[m.away].w++; stats[m.away].pts += 3; stats[m.home].l++; }
                else { stats[m.home].d++; stats[m.home].pts += 1; stats[m.away].d++; stats[m.away].pts += 1; }
            }
        });

        const sorted = Object.keys(stats).sort((a,b) => stats[b].pts - stats[a].pts || (stats[b].gf-stats[b].ga) - (stats[a].gf-stats[a].ga));
        const tbody = document.getElementById('standingsBody');
        tbody.innerHTML = '';
        
        sorted.forEach((team, i) => {
            const s = stats[team];
            const posClass = i === 0 ? 'pos-1' : (i === 1 ? 'pos-2' : (i === 2 ? 'pos-3' : ''));
            tbody.innerHTML += `
                <tr>
                    <td><div class="pos-badge ${posClass}">${i+1}</div></td>
                    <td style="font-weight:600; color:white;">${team}</td>
                    <td class="text-center">${s.m}</td>
                    <td class="text-center" style="color:#00ff88">${s.w}</td>
                    <td class="text-center" style="color:#f59e0b">${s.d}</td>
                    <td class="text-center" style="color:#ff4d4d">${s.l}</td>
                    <td class="text-center">${s.gf - s.ga}</td>
                    <td class="text-center" style="font-weight:bold; color:var(--accent); font-size:1.1em;">${s.pts}</td>
                </tr>`;
        });
    });
}

function calculateTopScorers() {
    // Używamy collectionGroup aby pobrać wszystkich graczy ze wszystkich podkolekcji 'players'
    // UWAGA: Może wymagać utworzenia indeksu w konsoli Firebase (link pojawi się w konsoli przeglądarki jeśli błąd)
    db.collectionGroup('players').orderBy('goals', 'desc').limit(20).onSnapshot(snap => {
        const tbody = document.getElementById('topScorersBody');
        tbody.innerHTML = '';
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Brak strzelców</td></tr>';
            return;
        }

        let index = 1;
        snap.forEach(doc => {
            const p = doc.data();
            // Musimy pobrać nazwę drużyny z rodzica (trochę trikowe w collectionGroup bez dodatkowego pola)
            // Dla prostoty, jeśli nie zapisujesz teamName w dokumencie gracza, tu może być pusto.
            // ZALECENIE: Przy dodawaniu gracza (addPlayer) zapisuj też pole 'teamName'.
            // Poniżej zakładam, że dodamy to pole w funkcji addPlayer.
            
            // Kolor dla top 3
            let rowColor = index === 1 ? 'color:#FFD700' : (index === 2 ? 'color:#C0C0C0' : (index === 3 ? 'color:#CD7F32' : ''));
            
            tbody.innerHTML += `
                <tr>
                    <td><b style="${rowColor}">${index++}.</b></td>
                    <td style="font-weight:bold;">${p.name}</td>
                    <td style="color:#a0aec0;">${p.teamName || '---'}</td> 
                    <td style="text-align:right; font-weight:bold; color:var(--accent);">${p.goals}</td>
                </tr>
            `;
        });
    }, error => {
        console.error("Błąd strzelców (może brak indeksu):", error);
        document.getElementById('topScorersBody').innerHTML = '<tr><td colspan="4" style="color:red; text-align:center">Wymagany indeks Firestore (sprawdź konsolę)</td></tr>';
    });
}

// --- 3. TEAMS & SQUAD ---
function loadTeamsToSelect() {
    db.collection('teams').orderBy('name').onSnapshot(s => {
        let opts = '<option value="">-- Wybierz --</option>';
        s.forEach(d => opts += `<option value="${d.data().name}">${d.data().name}</option>`);
        document.getElementById('homeTeamSelect').innerHTML = opts;
        document.getElementById('awayTeamSelect').innerHTML = opts;
    });
}

function listenTeams() {
    db.collection('teams').orderBy('name').onSnapshot(s => {
        const list = document.getElementById('teamsList');
        list.innerHTML = '';
        s.forEach(doc => {
            const t = doc.data();
            list.innerHTML += `
                <div class="card" style="text-align:center; padding:20px; margin:0;">
                    ${t.logo ? `<img src="${t.logo}" style="width:60px; height:60px; object-fit:contain; border-radius:50%; margin-bottom:15px; border:2px solid var(--border);">` : ''}
                    <div style="font-size:1.1rem; font-weight:bold; color:white; margin-bottom:15px;">${t.name}</div>
                    <button class="btn btn-primary" style="width:100%; font-size:0.8rem;" onclick="openSquad('${doc.id}', '${t.name}')">Zarządzaj Kadrą</button>
                    <button class="btn btn-danger" style="width:100%; margin-top:10px; font-size:0.8rem;" onclick="delTeam('${doc.id}')">Usuń</button>
                </div>
            `;
        });
    });
}

window.addTeam = () => {
    const n = document.getElementById('teamNameInput').value;
    const l = document.getElementById('teamLogoInput').value;
    if(n) db.collection('teams').add({name:n, logo:l}).then(()=>{ 
        document.getElementById('teamNameInput').value=''; 
        document.getElementById('teamLogoInput').value=''; 
    });
};
window.delTeam = (id) => { if(confirm("Usunąć?")) db.collection('teams').doc(id).delete(); };

// --- PLAYERS ---
let squadUnsub = null;
let currentTeamId = null;
let currentTeamName = null;

window.openSquad = (tid, tname) => {
    currentTeamId = tid;
    currentTeamName = tname;
    document.getElementById('squadTeamName').innerText = tname;
    document.getElementById('squad-editor').style.display = 'block';
    document.getElementById('squad-editor').scrollIntoView({behavior:'smooth'});
    
    if(squadUnsub) squadUnsub();
    squadUnsub = db.collection('teams').doc(tid).collection('players').orderBy('number').onSnapshot(renderSquad);
};

function renderSquad(snap) {
    const div = document.getElementById('playersList');
    div.innerHTML = '';
    snap.forEach(d => {
        const p = d.data();
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.02);">
                <div style="display:flex; gap:10px; align-items:center;">
                    <span style="background:var(--primary); width:25px; height:25px; display:flex; justify-content:center; align-items:center; border-radius:50%; font-size:0.8rem; font-weight:bold;">${p.number}</span>
                    <span>${p.name}</span>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span style="color:var(--text-muted); font-size:0.8rem;">Gole:</span>
                    <input type="number" value="${p.goals||0}" style="width:60px; padding:5px; text-align:center;" onchange="updateGoal('${d.id}', this.value)">
                    <button class="btn-danger" style="padding:5px 10px;" onclick="delPlayer('${d.id}')"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `;
    });
}

window.addPlayer = () => {
    const n = document.getElementById('plName').value;
    const num = document.getElementById('plNum').value;
    if(n && num && currentTeamId) {
        db.collection('teams').doc(currentTeamId).collection('players').add({
            name: n, 
            number: parseInt(num), 
            goals: 0,
            teamName: currentTeamName // Ważne dla Tabeli Strzelców
        });
        document.getElementById('plName').value = '';
        document.getElementById('plNum').value = '';
    }
};

window.updateGoal = (pid, val) => db.collection('teams').doc(currentTeamId).collection('players').doc(pid).update({goals: parseInt(val)});
window.delPlayer = (pid) => db.collection('teams').doc(currentTeamId).collection('players').doc(pid).delete();
window.closeSquadEditor = () => document.getElementById('squad-editor').style.display = 'none';

// --- NEWS & SETTINGS ---
window.saveNews = () => {
    const t = document.getElementById('newsTitle').value;
    const c = document.getElementById('newsContent').value;
    const i = document.getElementById('newsImg').value;
    if(t) db.collection('news').add({
        title:t, content:c, image:i, 
        date: new Date().toISOString().slice(0,10), 
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
        document.getElementById('newsImg').value = '';
    });
};

function listenNews() {
    db.collection('news').orderBy('timestamp','desc').onSnapshot(s => {
        const d = document.getElementById('newsList'); d.innerHTML = '';
        s.forEach(doc => {
            d.innerHTML += `
            <div class="card" style="padding:20px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="font-size:1.1rem; color:var(--text-main);">${doc.data().title}</strong>
                    <button class="btn-danger" style="padding:5px 10px;" onclick="db.collection('news').doc('${doc.id}').delete()"><i class="fas fa-trash"></i></button>
                </div>
                <div style="color:var(--accent); font-size:0.8rem; margin:5px 0;">${doc.data().date}</div>
                <p style="color:var(--text-muted);">${doc.data().content}</p>
            </div>`;
        });
    });
}

function loadSettings() {
    db.collection('settings').doc('config').onSnapshot(d => { if(d.exists) document.getElementById('lockSquads').checked = d.data().squadsLocked; });
}
window.toggleLock = () => db.collection('settings').doc('config').set({squadsLocked: document.getElementById('lockSquads').checked}, {merge:true});

window.createAccount = () => {
    const e = document.getElementById('accEmail').value;
    const p = document.getElementById('accPass').value;
    if(e && p && confirm("To wyloguje admina. OK?")) auth.createUserWithEmailAndPassword(e,p).then(()=>window.location.reload());
};