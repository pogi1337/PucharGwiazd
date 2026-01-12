/* admin.js - Logic for Premium Dark Panel */

const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:75e8df76127397b913612d"
};

// Inicjalizacja głównej aplikacji (Admina)
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const ADMINS = ["kacpernwm77@gmail.com", "krzysztof.lodzinski@interia.pl"];

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
            if(user) {
                console.log("Zalogowany user nie jest adminem:", user.email);
                auth.signOut();
            }
        }
    });
});

window.login = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    // Lokalne sprawdzenie (dla UX), właściwe zabezpieczenie jest w Rules
    if(!ADMINS.includes(e.toLowerCase())) return document.getElementById('login-msg').innerText = "Brak uprawnień admina (sprawdź listę ADMINS w js).";
    
    auth.signInWithEmailAndPassword(e, p)
        .catch(err => document.getElementById('login-msg').innerText = err.message);
};

window.logout = () => auth.signOut();

function initApp() {
    console.log("Inicjalizacja aplikacji...");
    loadTeamsToSelect();
    listenMatches();
    listenTeams();
    listenNews();
    loadSettings();
    calculateStandings();
    calculateTopScorers();
    document.getElementById('matchDate').value = new Date().toISOString().slice(0,10);
}

// --- FUNKCJA TWORZENIA KONTA I DRUŻYNY ---
window.createAccountAndTeam = async () => {
    const email = document.getElementById('accEmail').value;
    const pass = document.getElementById('accPass').value;
    const teamName = document.getElementById('accTeamName').value;
    let teamId = document.getElementById('accTeamId').value;
    
    // Auto-ID: usuń spacje, zrób wielkie litery
    if (!teamId && teamName) {
        teamId = teamName.replace(/\s+/g, '').toUpperCase();
    }

    if (!email || !pass || !teamName || !teamId) {
        alert("BŁĄD: Wypełnij wszystkie pola!");
        return;
    }

    if (!confirm(`Potwierdź utworzenie:\nUser: ${email}\nDrużyna: ${teamName} (ID: ${teamId})`)) return;

    // Używamy tymczasowej "drugiej aplikacji", żeby stworzyć usera bez wylogowywania admina
    let secondaryApp = null;
    const tempAppName = "SecondaryApp" + new Date().getTime();

    try {
        console.log("1. Tworzenie drugiej instancji Firebase...");
        secondaryApp = firebase.initializeApp(firebaseConfig, tempAppName);
        
        console.log("2. Tworzenie użytkownika w Auth...");
        const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
        const uid = userCred.user.uid;
        console.log("   -> Sukces! UID:", uid);

        // Wyloguj z drugiej apki, żeby nie mieszało w sesji
        await secondaryApp.auth().signOut();

        console.log("3. Przygotowanie zapisu do Firestore (jako Admin)...");
        const batch = db.batch();

        // A. Dokument Usera
        const userRef = db.collection('users').doc(uid);
        batch.set(userRef, {
            email: email,
            role: 'captain',
            teamId: teamId,
            teamName: teamName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // B. Dokument Drużyny
        const teamRef = db.collection('teams').doc(teamId);
        batch.set(teamRef, {
            name: teamName,
            logo: "",
            captainId: uid, // Ważne dla reguł
            wins: 0, draws: 0, losses: 0, 
            goals_scored: 0, goals_lost: 0, points: 0
        });

        // C. Kolekcja players (musi mieć dokument, żeby istnieć)
        const playerRef = teamRef.collection('players').doc();
        batch.set(playerRef, {
            name: "Kapitan (Edytuj)",
            number: 10,
            goals: 0,
            teamName: teamName
        });

        console.log("4. Wysyłanie batch.commit()...");
        await batch.commit();
        
        alert("SUKCES! \nKonto i drużyna utworzone.\nSprawdź bazę danych.");
        window.location.reload();

    } catch (error) {
        console.error("Błąd krytyczny:", error);
        alert("BŁĄD: " + error.message + "\n(Sprawdź konsolę F12 i Reguły Firestore)");
    } finally {
        // Sprzątanie
        if (secondaryApp) secondaryApp.delete();
    }
};

// --- POZOSTAŁE FUNKCJE ---

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
    promise.then(resetMatchForm).catch(err => alert("Błąd zapisu meczu: " + err.message));
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

window.editMatch = (id, h, a, d, s, hs, as) => {
    document.getElementById('matchId').value = id;
    document.getElementById('homeTeamSelect').value = h;
    document.getElementById('awayTeamSelect').value = a;
    document.getElementById('matchDate').value = d;
    document.getElementById('matchStatus').value = s;
    document.getElementById('homeScore').value = hs;
    document.getElementById('awayScore').value = as;
    toggleScoreInputs();
    document.getElementById('saveMatchBtn').innerText = "Aktualizuj";
    document.getElementById('cancelMatchBtn').style.display = 'inline-block';
    document.querySelector('.card').scrollIntoView({behavior:'smooth'});
};

window.deleteMatch = (id) => { if(confirm("Usunąć mecz?")) db.collection('matches').doc(id).delete(); };

function listenMatches() {
    db.collection('matches').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const div = document.getElementById('matchesContainer');
        div.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const color = m.status === 'live' ? '#ff4d4d' : (m.status === 'finished' ? '#a0aec0' : '#00d4ff');
            div.innerHTML += `
                <div class="match-card" style="border-left: 4px solid ${color};">
                    <div>
                        <strong style="color:white; font-size:1.1rem;">${m.home} ${m.homeScore}:${m.awayScore} ${m.away}</strong>
                        <div style="font-size:0.8rem; color:${color}; text-transform:uppercase; font-weight:bold; margin-top:5px;">${m.status}</div>
                    </div>
                    <div>
                        <button class="btn-warning" style="padding:5px 10px;" onclick="editMatch('${doc.id}','${m.home}','${m.away}','${m.date}','${m.status}',${m.homeScore},${m.awayScore})">✎</button>
                        <button class="btn-danger" style="padding:5px 10px;" onclick="deleteMatch('${doc.id}')">🗑</button>
                    </div>
                </div>`;
        });
    });
}

function calculateStandings() {
    Promise.all([db.collection('teams').get(), db.collection('matches').get()]).then(([tSnap, mSnap]) => {
        let stats = {};
        tSnap.forEach(d => stats[d.data().name] = { m:0, pts:0 });
        
        mSnap.forEach(d => {
            const m = d.data();
            if(m.status === 'finished' && stats[m.home] && stats[m.away]) {
                stats[m.home].m++; stats[m.away].m++;
                if(m.homeScore > m.awayScore) stats[m.home].pts += 3;
                else if(m.homeScore < m.awayScore) stats[m.away].pts += 3;
                else { stats[m.home].pts++; stats[m.away].pts++; }
            }
        });

        const sorted = Object.keys(stats).sort((a,b) => stats[b].pts - stats[a].pts);
        const tbody = document.getElementById('standingsBody');
        tbody.innerHTML = '';
        sorted.forEach((team, i) => {
            tbody.innerHTML += `<tr><td>${i+1}</td><td style="color:white; font-weight:bold;">${team}</td><td>${stats[team].m}</td><td style="color:var(--accent); font-weight:bold;">${stats[team].pts}</td></tr>`;
        });
    });
}

function calculateTopScorers() {
    db.collectionGroup('players').orderBy('goals', 'desc').limit(10).onSnapshot(snap => {
        const tbody = document.getElementById('topScorersBody');
        tbody.innerHTML = '';
        let i = 1;
        snap.forEach(doc => {
            const p = doc.data();
            if(p.goals > 0) tbody.innerHTML += `<tr><td>${i++}</td><td>${p.name} <small style="color:gray">(${p.teamName})</small></td><td style="text-align:right; font-weight:bold; color:var(--success);">${p.goals}</td></tr>`;
        });
    });
}

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
                <div class="card" style="padding:15px; text-align:center;">
                    <strong style="color:white; font-size:1.1rem;">${t.name}</strong><br>
                    <small style="color:gray;">ID: ${doc.id}</small>
                    <div style="margin-top:10px;">
                        <button class="btn-primary" style="font-size:0.8rem; width:100%;" onclick="openSquad('${doc.id}', '${t.name}')">KADRA</button>
                        <button class="btn-danger" style="font-size:0.8rem; width:100%; margin-top:5px;" onclick="if(confirm('Usunąć?')) db.collection('teams').doc('${doc.id}').delete()">USUŃ</button>
                    </div>
                </div>`;
        });
    });
}

window.addTeam = () => {
    const n = document.getElementById('teamNameInput').value;
    const l = document.getElementById('teamLogoInput').value;
    if(n) db.collection('teams').add({name:n, logo:l, captainId: null}); 
};

// --- SQUAD LOGIC ---
let squadUnsub = null;
let currentTeamId = null;
let currentTeamName = null;

window.openSquad = (tid, tname) => {
    currentTeamId = tid;
    currentTeamName = tname;
    document.getElementById('squadTeamName').innerText = tname;
    document.getElementById('squad-editor').style.display = 'block';
    
    if(squadUnsub) squadUnsub();
    squadUnsub = db.collection('teams').doc(tid).collection('players').orderBy('number').onSnapshot(snap => {
        const div = document.getElementById('playersList');
        div.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            div.innerHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid #333; padding:5px;">
                    <span><b>${p.number}.</b> ${p.name}</span>
                    <button class="btn-danger" style="padding:2px 8px;" onclick="db.collection('teams').doc('${tid}').collection('players').doc('${d.id}').delete()">X</button>
                </div>`;
        });
    });
};

window.addPlayer = () => {
    const n = document.getElementById('plName').value;
    const num = document.getElementById('plNum').value;
    if(n && num && currentTeamId) {
        db.collection('teams').doc(currentTeamId).collection('players').add({
            name: n, number: parseInt(num), goals: 0, teamName: currentTeamName
        });
        document.getElementById('plName').value = '';
        document.getElementById('plNum').value = '';
    }
};

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
    });
};

function listenNews() {
    db.collection('news').orderBy('timestamp','desc').onSnapshot(s => {
        const d = document.getElementById('newsList'); d.innerHTML = '';
        s.forEach(doc => d.innerHTML += `<div style="border-bottom:1px solid #333; padding:10px; margin-bottom:10px;"><b>${doc.data().title}</b> <button onclick="db.collection('news').doc('${doc.id}').delete()" style="color:red; background:none; border:none;">X</button></div>`);
    });
}

function loadSettings() {
    db.collection('settings').doc('config').onSnapshot(d => { if(d.exists) document.getElementById('lockSquads').checked = d.data().squadsLocked; });
}
window.toggleLock = () => db.collection('settings').doc('config').set({squadsLocked: document.getElementById('lockSquads').checked}, {merge:true});
