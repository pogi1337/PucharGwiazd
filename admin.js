/* admin.js - Pełna obsługa Piłki Nożnej i Siatkówki */

const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:75e8df76127397b913612d"
};

// Inicjalizacja Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// KONFIGURACJA
const ADMINS = ["kacpernwm77@gmail.com", "krzysztof.lodzinski@interia.pl"];
let currentSport = 'football'; // Domyślny sport
let allMatches = [];

// --- LOGOWANIE ---
auth.onAuthStateChanged(user => {
    if (user && ADMINS.includes(user.email.toLowerCase())) {
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        initApp();
    } else {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        if (user) {
            alert("Brak uprawnień administratora.");
            auth.signOut();
        }
    }
});

window.login = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    if(!e || !p) return alert("Wpisz dane logowania");
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("Błąd: " + err.message));
};

window.logout = () => auth.signOut();

// --- ZMIANA SPORTU ---
window.changeSport = () => {
    currentSport = document.getElementById('activeSport').value;
    
    // Aktualizacja tekstów w UI
    const isFB = currentSport === 'football';
    document.getElementById('matchTitle').innerText = isFB ? "Mecze: Piłka Nożna" : "Mecze: Siatkówka";
    document.getElementById('tableTitle').innerText = isFB ? "Tabela: Piłka Nożna" : "Tabela: Siatkówka";
    document.getElementById('scoreLabelH').innerText = isFB ? "Gole Gospodarz" : "Sety Gospodarz";
    document.getElementById('scoreLabelA').innerText = isFB ? "Gole Gość" : "Sety Gość";

    initApp(); // Przeładowanie danych pod nowy sport
};

function initApp() {
    listenMatches();
    listenTeams();
    listenNews();
    loadSettings();
}

// --- MECZE (LOGIKA I FILTROWANIE) ---
function listenMatches() {
    // Pobieramy mecze tylko dla aktywnego sportu
    db.collection('matches')
      .where('sport', '==', currentSport)
      .orderBy('date', 'desc')
      .onSnapshot(snap => {
        const con = document.getElementById('matchesContainer');
        con.innerHTML = '';
        allMatches = [];
        
        snap.forEach(doc => {
            const m = { id: doc.id, ...doc.data() };
            allMatches.push(m);
            
            const color = m.status === 'live' ? '#ef4444' : (m.status === 'finished' ? '#9ca3af' : '#38bdf8');
            const statusTxt = m.status === 'live' ? 'NA ŻYWO' : (m.status === 'finished' ? 'ZAKOŃCZONY' : 'PLANOWANY');

            con.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 5px solid ${color}; padding: 15px; margin-bottom: 10px;">
                    <div>
                        <div style="font-size:0.75rem; color:#888;">${m.date} ${m.time}</div>
                        <div style="font-size:1.1rem; margin:5px 0;">
                            <strong>${m.home}</strong> 
                            <span style="color:${color}; font-weight:800; margin:0 10px;">${m.homeScore}:${m.awayScore}</span> 
                            <strong>${m.away}</strong>
                        </div>
                        <div style="font-size:0.7rem; font-weight:bold; color:${color}">${statusTxt}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn btn-primary btn-sm" onclick="openMatchModal('${m.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
        calculateTable();
    });
}

// --- SYSTEM PUNKTOWY (TABELA) ---
function calculateTable() {
    let stats = {};

    allMatches.forEach(m => {
        if (m.status !== 'finished') return;
        
        if (!stats[m.home]) stats[m.home] = { name: m.home, m: 0, pts: 0, goalsW: 0, goalsL: 0, wins: 0 };
        if (!stats[m.away]) stats[m.away] = { name: m.away, m: 0, pts: 0, goalsW: 0, goalsL: 0, wins: 0 };
        
        const h = stats[m.home];
        const a = stats[m.away];
        
        h.m++; a.m++;
        h.goalsW += m.homeScore; h.goalsL += m.awayScore;
        a.goalsW += m.awayScore; a.goalsL += m.homeScore;

        if (currentSport === 'football') {
            // Punktacja Piłka Nożna
            if (m.homeScore > m.awayScore) { h.pts += 3; h.wins++; }
            else if (m.homeScore < m.awayScore) { a.pts += 3; a.wins++; }
            else { h.pts += 1; a.pts += 1; }
        } else {
            // Punktacja Siatkówka (Sety)
            // 3:0 lub 3:1 (lub 2:0) -> 3 pkt dla zwycięzcy, 0 dla przegranego
            // 3:2 (lub 2:1) -> 2 pkt dla zwycięzcy, 1 pkt dla przegranego
            const diff = Math.abs(m.homeScore - m.awayScore);
            if (m.homeScore > m.awayScore) {
                h.wins++;
                if (diff >= 2) h.pts += 3; 
                else { h.pts += 2; a.pts += 1; }
            } else {
                a.wins++;
                if (diff >= 2) a.pts += 3;
                else { a.pts += 2; h.pts += 1; }
            }
        }
    });

    const sorted = Object.values(stats).sort((a,b) => b.pts - a.pts || (b.goalsW - b.goalsL) - (a.goalsW - a.goalsL));
    
    let html = `
        <div class="table-responsive">
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th style="text-align:left;">Drużyna</th>
                        <th>M</th>
                        <th>PKT</th>
                        <th>${currentSport==='football'?'Bramki':'Sety'}</th>
                    </tr>
                </thead>
                <tbody>`;
    
    sorted.forEach((t, i) => {
        html += `
            <tr>
                <td>${i+1}</td>
                <td style="text-align:left; font-weight:bold;">${t.name}</td>
                <td>${t.m}</td>
                <td style="color:var(--accent); font-weight:800;">${t.pts}</td>
                <td>${t.goalsW}:${t.goalsL}</td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    document.getElementById('groupsContainer').innerHTML = html;
}

// --- MODAL MECZU ---
window.openMatchModal = (id = null) => {
    document.getElementById('matchModal').classList.add('open');
    const hSelect = document.getElementById('mHome');
    const aSelect = document.getElementById('mAway');
    
    // Pobieramy tylko drużyny przypisane do aktualnego sportu
    db.collection('teams').where('sport', '==', currentSport).get().then(snap => {
        let opts = '<option value="">-- Wybierz --</option>';
        snap.forEach(d => opts += `<option value="${d.data().name}">${d.data().name}</option>`);
        hSelect.innerHTML = opts;
        aSelect.innerHTML = opts;

        if (id) {
            const m = allMatches.find(x => x.id === id);
            document.getElementById('editMatchId').value = id;
            document.getElementById('mHome').value = m.home;
            document.getElementById('mAway').value = m.away;
            document.getElementById('mHomeScore').value = m.homeScore;
            document.getElementById('mAwayScore').value = m.awayScore;
            document.getElementById('mStatus').value = m.status;
            document.getElementById('mDate').value = m.date;
            document.getElementById('mTime').value = m.time;
            document.getElementById('modalHeading').innerText = "Edytuj Mecz";
        } else {
            document.getElementById('editMatchId').value = '';
            document.getElementById('mHomeScore').value = 0;
            document.getElementById('mAwayScore').value = 0;
            document.getElementById('mStatus').value = 'planned';
            document.getElementById('modalHeading').innerText = "Dodaj Nowy Mecz";
        }
    });
};

window.closeMatchModal = () => document.getElementById('matchModal').classList.remove('open');

window.saveMatch = () => {
    const id = document.getElementById('editMatchId').value;
    const data = {
        sport: currentSport, // Ważne: zapisujemy sport
        home: document.getElementById('mHome').value,
        away: document.getElementById('mAway').value,
        homeScore: parseInt(document.getElementById('mHomeScore').value) || 0,
        awayScore: parseInt(document.getElementById('mAwayScore').value) || 0,
        status: document.getElementById('mStatus').value,
        date: document.getElementById('mDate').value,
        time: document.getElementById('mTime').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(!data.home || !data.away) return alert("Wybierz obie drużyny!");

    const action = id ? db.collection('matches').doc(id).update(data) : db.collection('matches').add(data);
    action.then(() => {
        closeMatchModal();
        console.log("Mecz zapisany dla: " + currentSport);
    }).catch(e => alert(e.message));
};

// --- USUWANIE MECZÓW ---
window.deleteMatch = (id) => { if(confirm("Usunąć ten mecz?")) db.collection('matches').doc(id).delete(); };

window.deleteAllMatches = async () => {
    if (!confirm(`CZY NA PEWNO CHCESZ USUNĄĆ WSZYSTKIE MECZE (${currentSport.toUpperCase()})?`)) return;
    try {
        const snap = await db.collection('matches').where('sport', '==', currentSport).get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Mecze usunięte.");
    } catch (e) { alert(e.message); }
};

// --- DRUŻYNY ---
function listenTeams() {
    db.collection('teams').where('sport', '==', currentSport).onSnapshot(snap => {
        const con = document.getElementById('teamsListContainer');
        con.innerHTML = '';
        if(snap.empty) con.innerHTML = '<p style="text-align:center; padding:20px;">Brak drużyn dla tego sportu.</p>';
        
        snap.forEach(doc => {
            const t = doc.data();
            con.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #333;">
                    <span style="font-weight:bold;">${t.name}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteTeam('${doc.id}')"><i class="fas fa-trash"></i></button>
                </div>`;
        });
    });
}

window.deleteTeam = (id) => { if(confirm("Usunąć tę drużynę?")) db.collection('teams').doc(id).delete(); };

window.deleteAllTeams = async () => {
    if (!confirm(`CZY NA PEWNO CHCESZ USUNĄĆ WSZYSTKIE DRUŻYNY (${currentSport.toUpperCase()})?`)) return;
    try {
        const snap = await db.collection('teams').where('sport', '==', currentSport).get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Drużyny usunięte.");
    } catch (e) { alert(e.message); }
};

// --- KREATOR KONT DRUŻYN ---
window.createAccountAndTeam = async () => {
    const email = document.getElementById('accEmail').value;
    const pass = document.getElementById('accPass').value;
    const tName = document.getElementById('accTeamName').value;
    const sport = document.getElementById('accSport').value;

    if(!email || !pass || !tName) return alert("Wypełnij wszystkie pola kreatora!");

    try {
        // Logika "Secondary App" aby nie wylogować admina przy tworzeniu konta
        const tempApp = firebase.initializeApp(firebaseConfig, "TempApp");
        const userCredential = await tempApp.auth().createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;
        await tempApp.auth().signOut();
        await tempApp.delete();

        const batch = db.batch();
        // 1. Zapisujemy dane usera
        batch.set(db.collection('users').doc(uid), { 
            email, 
            role: 'TeamManager', 
            sport: sport, 
            teamName: tName 
        });
        // 2. Tworzymy dokument drużyny
        batch.set(db.collection('teams').doc(), { 
            name: tName, 
            sport: sport, 
            managerUid: uid 
        });
        
        await batch.commit();
        alert(`Sukces! Utworzono konto dla drużyny ${tName} (${sport})`);
        
        // Czyścimy formularz
        document.getElementById('accEmail').value = '';
        document.getElementById('accPass').value = '';
        document.getElementById('accTeamName').value = '';
    } catch (e) { 
        alert("Błąd: " + e.message); 
    }
};

// --- NEWSY ---
function listenNews() {
    db.collection('news').orderBy('createdAt', 'desc').limit(5).onSnapshot(snap => {
        const con = document.getElementById('newsContainer');
        con.innerHTML = '';
        snap.forEach(doc => {
            const n = doc.data();
            con.innerHTML += `
                <div class="card" style="margin-top:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${n.title}</strong>
                        <button class="btn btn-danger btn-sm" onclick="deleteNews('${doc.id}')">X</button>
                    </div>
                    <p style="font-size:0.9rem; margin:10px 0;">${n.content}</p>
                </div>`;
        });
    });
}

window.addNews = () => {
    const title = document.getElementById('newsTitle').value;
    const content = document.getElementById('newsContent').value;
    if(!title || !content) return alert("Wypełnij newsa");
    
    db.collection('news').add({
        title, content,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
    });
};

window.deleteNews = (id) => { if(confirm("Usunąć newsa?")) db.collection('news').doc(id).delete(); };

// --- USTAWIENIA ---
function loadSettings() {
    db.collection('settings').doc('config').onSnapshot(d => {
        if(d.exists) {
            // Tutaj możesz dodać obsługę globalnych ustawień (np. blokada składów)
        }
    });
}