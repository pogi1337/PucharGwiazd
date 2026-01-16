/* admin.js - WERSJA Z 4 GRUPAMI, TABELAMI I PEŁNĄ EDYCJĄ */

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

// --- DEFINICJA GRUP (NAZWY DRUŻYN MUSZĄ BYĆ IDENTYCZNE W EDYTORZE) ---
const GROUPS_DEF = {
    "A": ["Boys", "Down The Road", "Łobuzy", "SławBud"],
    "B": ["Nam strzelać nie kazano", "Fc Hetman", "Coco Jumbos", "Valentino Royal"],
    "C": ["Łobuzy 2", "Dżołki Fc", "Pasjonaci Footballu", "PGR Team"],
    "D": ["Piłkarskie Koty", "Czarne Perły Mozambiku", "Goon FC", "PKS Mięsne"]
};

let allMatches = {};
let currentHomeId = null; 
let currentAwayId = null;

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if (user && ADMINS.includes(user.email.toLowerCase())) {
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        initApp();
    } else {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        if(user) { alert("Brak uprawnień admina"); auth.signOut(); }
    }
});

window.login = () => {
    auth.signInWithEmailAndPassword(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value
    ).catch(e => alert(e.message));
};
window.logout = () => auth.signOut();

function initApp() {
    loadTeamsToSelect();
    listenMatches();
    listenNews();
    listenTeamsList();
    loadSettings();
    document.getElementById('mDate').value = new Date().toISOString().slice(0,10);
}

// --- MECZE ---
function listenMatches() {
    db.collection('matches').orderBy('date', 'desc').onSnapshot(snap => {
        const con = document.getElementById('matchesContainer');
        con.innerHTML = '';
        allMatches = {};
        let list = [];
        
        snap.forEach(d => {
            list.push({id:d.id, ...d.data()});
            allMatches[d.id] = d.data();
        });
        list.sort((a,b) => (a.date===b.date) ? (a.time||'').localeCompare(b.time||'') : 0);

        list.forEach(m => {
            let color = '#38bdf8'; 
            let txt = 'PLANOWANY';
            if(m.status === 'live') { color = '#ef4444'; txt = 'NA ŻYWO'; }
            if(m.status === 'finished') { color = '#9ca3af'; txt = 'KONIEC'; }

            con.innerHTML += `
            <div class="match-card" style="border-left:4px solid ${color}">
                <div>
                    <div style="font-size:0.8rem; color:#888;">${m.date} | ${m.time} | Gr. ${m.group}</div>
                    <div style="font-size:1.1rem; margin:5px 0;">
                        <strong>${m.home}</strong> 
                        <span style="color:${color}; font-weight:bold; margin:0 8px; font-size:1.3rem;">
                            ${m.homeScore}:${m.awayScore}
                        </span> 
                        <strong>${m.away}</strong>
                    </div>
                    <div style="font-size:0.7rem; color:${color}; font-weight:800;">${txt}</div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="openMatchModal('${m.id}')"><i class="fas fa-edit"></i> Edytuj</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        });
        calculateGroupTables(list); // Przelicz tabele
    });
}

// --- TABELE GRUPOWE (LOGIKA) ---
function calculateGroupTables(matchesList) {
    const container = document.getElementById('groupsContainer');
    container.innerHTML = ''; // Czyść

    // 1. Inicjalizacja pustych statystyk dla wszystkich drużyn z GROUPS_DEF
    let stats = {};
    Object.keys(GROUPS_DEF).forEach(groupName => {
        GROUPS_DEF[groupName].forEach(teamName => {
            stats[teamName] = { 
                group: groupName, 
                m:0, w:0, d:0, l:0, goals:0, pts:0 
            };
        });
    });

    // 2. Przeliczanie statystyk z meczów ZAKOŃCZONYCH
    matchesList.forEach(m => {
        if(m.status !== 'finished') return;

        // Jeśli drużyny nie ma w definicji (np. inna pisownia), dodaj ją dynamicznie
        if(!stats[m.home]) stats[m.home] = { group: m.group || '?', m:0, w:0, d:0, l:0, goals:0, pts:0 };
        if(!stats[m.away]) stats[m.away] = { group: m.group || '?', m:0, w:0, d:0, l:0, goals:0, pts:0 };

        const h = stats[m.home];
        const a = stats[m.away];

        h.m++; a.m++;
        h.goals += m.homeScore;
        a.goals += m.awayScore;

        if(m.homeScore > m.awayScore) {
            h.pts += 3; h.w++; a.l++;
        } else if (m.homeScore < m.awayScore) {
            a.pts += 3; a.w++; h.l++;
        } else {
            h.pts += 1; a.pts += 1; h.d++; a.d++;
        }
    });

    // 3. Generowanie HTML dla każdej grupy (A, B, C, D)
    Object.keys(GROUPS_DEF).forEach(groupName => {
        const teamsInGroup = GROUPS_DEF[groupName];
        
        // Sortowanie: Punkty > Bramki
        teamsInGroup.sort((t1, t2) => {
            const s1 = stats[t1];
            const s2 = stats[t2];
            if (s2.pts !== s1.pts) return s2.pts - s1.pts;
            return s2.goals - s1.goals;
        });

        let rows = '';
        teamsInGroup.forEach((team, idx) => {
            const s = stats[team];
            rows += `
                <tr>
                    <td>${idx+1}</td>
                    <td>${team}</td>
                    <td>${s.m}</td>
                    <td>${s.w}</td>
                    <td>${s.d}</td>
                    <td>${s.l}</td>
                    <td>${s.goals}</td>
                    <td><strong>${s.pts}</strong></td>
                </tr>
            `;
        });

        container.innerHTML += `
            <div class="card" style="margin-bottom:0;">
                <h3 style="color:var(--accent); text-align:center;">GRUPA ${groupName}</h3>
                <table class="styled-table">
                    <thead>
                        <tr><th>#</th><th>Drużyna</th><th>M</th><th>W</th><th>R</th><th>P</th><th>B</th><th>PKT</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    });

    // Top Strzelcy (niezależnie)
    db.collectionGroup('players').orderBy('goals', 'desc').limit(15).onSnapshot(snap => {
        const ts = document.getElementById('topScorersBody');
        ts.innerHTML = '';
        let i = 1;
        snap.forEach(d => {
            const p = d.data();
            if(p.goals > 0) ts.innerHTML += `<tr><td>${i++}</td><td>${p.name}</td><td>${p.teamName||'-'}</td><td>${p.goals}</td></tr>`;
        });
    });
}

// --- MODAL EDYCJI MECZU ---
window.openMatchModal = (id = null) => {
    document.getElementById('matchModal').classList.add('open');
    document.getElementById('editMatchId').value = '';
    document.getElementById('mStatus').value = 'planned';
    document.getElementById('mHomeScore').value = 0;
    document.getElementById('mAwayScore').value = 0;
    document.getElementById('matchModalTitle').innerText = "Dodaj Mecz";

    if(id && allMatches[id]) {
        const m = allMatches[id];
        document.getElementById('editMatchId').value = id;
        document.getElementById('mHome').value = m.home;
        document.getElementById('mAway').value = m.away;
        document.getElementById('mDate').value = m.date;
        document.getElementById('mTime').value = m.time;
        document.getElementById('mGroup').value = m.group;
        document.getElementById('mStatus').value = m.status;
        document.getElementById('mHomeScore').value = m.homeScore;
        document.getElementById('mAwayScore').value = m.awayScore;
        document.getElementById('matchModalTitle').innerText = "Edytuj Mecz";
        loadPlayersForModal(m.home, m.away);
    }
};
window.closeMatchModal = () => document.getElementById('matchModal').classList.remove('open');

window.saveMatch = () => {
    const id = document.getElementById('editMatchId').value;
    const data = {
        home: document.getElementById('mHome').value,
        away: document.getElementById('mAway').value,
        date: document.getElementById('mDate').value,
        time: document.getElementById('mTime').value,
        group: document.getElementById('mGroup').value,
        status: document.getElementById('mStatus').value,
        homeScore: parseInt(document.getElementById('mHomeScore').value)||0,
        awayScore: parseInt(document.getElementById('mAwayScore').value)||0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    let p = id ? db.collection('matches').doc(id).update(data) : db.collection('matches').add(data);
    p.then(() => closeMatchModal()).catch(e => alert(e.message));
};
window.deleteMatch = (id) => { if(confirm("Usunąć?")) db.collection('matches').doc(id).delete(); };

// --- NEWSY ---
function listenNews() {
    db.collection('news').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const div = document.getElementById('newsContainer');
        div.innerHTML = '';
        snap.forEach(doc => {
            const n = doc.data();
            div.innerHTML += `
                <div class="card" style="margin-top:15px; border-left:3px solid var(--accent);">
                    <div style="display:flex; justify-content:space-between;"><h4>${n.title}</h4><button class="btn-danger btn-sm" onclick="deleteNews('${doc.id}')">Usuń</button></div>
                    <p>${n.content}</p><small style="color:gray;">${n.date}</small>
                </div>`;
        });
    });
}
window.addNews = () => {
    const title = document.getElementById('newsTitle').value;
    const content = document.getElementById('newsContent').value;
    if(!title) return alert("Podaj tytuł!");
    db.collection('news').add({title, content, date: new Date().toLocaleDateString(), createdAt: firebase.firestore.FieldValue.serverTimestamp()})
      .then(() => { document.getElementById('newsTitle').value=''; document.getElementById('newsContent').value=''; alert("News dodany!"); });
};
window.deleteNews = (id) => { if(confirm("Usunąć?")) db.collection('news').doc(id).delete(); };

// --- DRUŻYNY ---
function listenTeamsList() {
    db.collection('teams').orderBy('name').onSnapshot(snap => {
        const con = document.getElementById('teamsListContainer');
        con.innerHTML = '';
        snap.forEach(doc => {
            const t = doc.data();
            con.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #333;"><span style="font-weight:bold; font-size:1.1rem;">${t.name}</span><button class="btn btn-primary btn-sm" onclick="openTeamModal('${doc.id}', '${t.name}')">Edytuj Skład</button></div>`;
        });
    });
}
window.openTeamModal = (id, name) => {
    document.getElementById('teamModal').classList.add('open');
    document.getElementById('editTeamId').value = id;
    document.getElementById('editTeamName').value = name;
    loadTeamPlayers(id);
};
window.closeTeamModal = () => document.getElementById('teamModal').classList.remove('open');
window.saveTeamName = () => {
    db.collection('teams').doc(document.getElementById('editTeamId').value).update({ name: document.getElementById('editTeamName').value }).then(() => alert("Nazwa zmieniona!"));
};
function loadTeamPlayers(teamId) {
    db.collection('teams').doc(teamId).collection('players').orderBy('number').onSnapshot(snap => {
        const tbody = document.getElementById('teamPlayersList');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `<tr><td>${p.number}</td><td>${p.name}</td><td><button class="btn-danger btn-sm" onclick="deletePlayer('${teamId}','${doc.id}')">X</button></td></tr>`;
        });
    });
}
window.addNewPlayer = () => {
    const tid = document.getElementById('editTeamId').value;
    const num = parseInt(document.getElementById('newPlayerNum').value);
    const name = document.getElementById('newPlayerName').value;
    if(!name || !num) return alert("Dane!");
    db.collection('teams').doc(tid).collection('players').add({name, number: num, goals: 0, teamName: document.getElementById('editTeamName').value})
      .then(() => { document.getElementById('newPlayerNum').value=''; document.getElementById('newPlayerName').value=''; });
};
window.deletePlayer = (tid, pid) => { if(confirm("Usunąć?")) db.collection('teams').doc(tid).collection('players').doc(pid).delete(); };

// --- POMOCNICZE ---
function loadTeamsToSelect() {
    db.collection('teams').orderBy('name').onSnapshot(snap => {
        let opts = '<option value="">-- Wybierz --</option>';
        snap.forEach(d => opts += `<option value="${d.data().name}">${d.data().name}</option>`);
        document.getElementById('mHome').innerHTML = opts;
        document.getElementById('mAway').innerHTML = opts;
    });
}
function loadPlayersForModal(h, a) {
    const fill = (name, el) => {
        db.collection('teams').where('name','==',name).limit(1).get().then(s => {
            if(!s.empty) {
                const id = s.docs[0].id;
                if(name===h) currentHomeId=id; else currentAwayId=id;
                db.collection('teams').doc(id).collection('players').orderBy('number').get().then(sp => {
                    let o = '<option value="">--</option>';
                    sp.forEach(d => o += `<option value="${d.id}">${d.data().number}. ${d.data().name}</option>`);
                    document.getElementById(el).innerHTML = o;
                });
            }
        });
    };
    fill(h, 'mHomePlayer');
    fill(a, 'mAwayPlayer');
}
window.addGoal = (side) => {
    const tid = (side==='home') ? currentHomeId : currentAwayId;
    const pid = document.getElementById(side==='home'?'mHomePlayer':'mAwayPlayer').value;
    const inp = document.getElementById(side==='home'?'mHomeScore':'mAwayScore');
    if(!tid || !pid) return alert("Wybierz gracza");
    const ref = db.collection('teams').doc(tid).collection('players').doc(pid);
    db.runTransaction(t => t.get(ref).then(d => t.update(ref, {goals:(d.data().goals||0)+1})))
      .then(() => inp.value = parseInt(inp.value)+1);
};
window.createAccountAndTeam = async () => {
    const email = document.getElementById('accEmail').value;
    const pass = document.getElementById('accPass').value;
    const tName = document.getElementById('accTeamName').value;
    const tId = document.getElementById('accTeamId').value;
    if(!email || !pass || !tName) return alert("Dane!");
    try {
        const app2 = firebase.initializeApp(firebaseConfig, "App2");
        const c = await app2.auth().createUserWithEmailAndPassword(email, pass);
        await app2.auth().signOut();
        app2.delete();
        const batch = db.batch();
        batch.set(db.collection('users').doc(c.user.uid), { email, role:'TeamManager', teamId:tId, teamName:tName });
        batch.set(db.collection('teams').doc(tId), { name:tName, captainId:c.user.uid });
        batch.set(db.collection('teams').doc(tId).collection('players').doc(), { name:"Manager", number:0, goals:0, teamName:tName });
        await batch.commit();
        alert("Utworzono!");
    } catch(e) { alert(e.message); }
};
function loadSettings() {
    db.collection('settings').doc('config').onSnapshot(d => { if(d.exists) document.getElementById('lockSquads').checked = d.data().squadsLocked; });
}
window.toggleLock = () => db.collection('settings').doc('config').set({squadsLocked:document.getElementById('lockSquads').checked}, {merge:true});