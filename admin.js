// ==========================
// 🔥 KONFIGURACJA FIREBASE
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  projectId: "puchargwiazd-bdaa4",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// ==========================
// 🔐 LOGOWANIE ADMINA
// ==========================
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value.trim();
  const msg = document.getElementById("login-msg");

  msg.textContent = "Logowanie...";

  try {
    const userCred = await auth.signInWithEmailAndPassword(email, pass);
    const uid = userCred.user.uid;
    const doc = await db.collection("users").doc(uid).get();

    if (!doc.exists || !doc.data().admin) {
      msg.textContent = "Brak uprawnień administratora!";
      msg.className = "message error";
      await auth.signOut();
      return;
    }

    msg.textContent = "Zalogowano!";
    msg.className = "message success";

    document.getElementById("login-box").style.display = "none";
    document.getElementById("admin-wrapper").style.display = "block";

    loadMatches();
    loadTables();
    loadScorers();

  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});


// ==========================
// 🏗️ TWORZENIE DRUŻYNY
// ==========================
document.getElementById("create-team-btn").addEventListener("click", async () => {
  const teamId = document.getElementById("team-id").value.trim();
  const email = document.getElementById("team-email").value.trim();
  const pass = document.getElementById("team-pass").value.trim();
  const msg = document.getElementById("team-msg");

  if (!teamId || !email || !pass) {
    msg.textContent = "Wypełnij wszystkie pola!";
    msg.className = "message error";
    return;
  }

  msg.textContent = "Tworzę drużynę...";

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection("users").doc(cred.user.uid).set({
      role: "teamManager",
      teamId: teamId
    });

    await db.collection("teams").doc(teamId).set({
      name: teamId,
      email: email,
      managerUid: cred.user.uid,
      group: "A",
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      createdAt: new Date()
    });

    msg.textContent = "✅ Drużyna została utworzona!";
    msg.className = "message success";
  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ==========================
// 👑 NADAWANIE ADMINA
// ==========================
document.getElementById("grant-admin-btn").addEventListener("click", async () => {
  const email = document.getElementById("new-admin-email").value.trim();
  const msg = document.getElementById("admin-msg");

  msg.textContent = "Szukam użytkownika...";

  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      msg.textContent = "Nie znaleziono użytkownika o tym emailu!";
      msg.className = "message error";
      return;
    }

    const userDoc = snapshot.docs[0];
    await usersRef.doc(userDoc.id).set({ admin: true }, { merge: true });

    msg.textContent = "✅ Nadano uprawnienia administratora!";
    msg.className = "message success";

  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ==========================
// ⚽ DODAWANIE MECZU
// ==========================
document.getElementById("add-match-btn").addEventListener("click", async () => {
  const group = document.getElementById("match-group").value.trim();
  const teamA = document.getElementById("match-teamA").value.trim();
  const teamB = document.getElementById("match-teamB").value.trim();
  const date = document.getElementById("match-date").value;
  const time = document.getElementById("match-time").value;
  const scoreA = Number(document.getElementById("match-scoreA").value) || 0;
  const scoreB = Number(document.getElementById("match-scoreB").value) || 0;
  const status = document.getElementById("match-status").value;
  const msg = document.getElementById("match-msg");

  if (!group || !teamA || !teamB) {
    msg.textContent = "Wypełnij wszystkie pola!";
    msg.className = "message error";
    return;
  }

  try {
    await db.collection("matches").add({
      group, teamA, teamB, date, time,
      scoreA, scoreB, status,
      createdAt: new Date()
    });

    msg.textContent = "✅ Mecz zapisany!";
    msg.className = "message success";
    loadMatches();
    loadTables();
  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ==========================
// 🥅 DODAWANIE STRZELCÓW
// ==========================
document.getElementById("add-scorer-btn").addEventListener("click", async () => {
  const name = document.getElementById("scorer-name").value.trim();
  const team = document.getElementById("scorer-team").value.trim();
  const goals = Number(document.getElementById("scorer-goals").value) || 0;

  if (!name || !team || !goals) return alert("Uzupełnij wszystkie pola!");

  await db.collection("scorers").add({
    name, team, goals,
    createdAt: new Date()
  });

  loadScorers();
  document.getElementById("scorer-name").value = "";
  document.getElementById("scorer-team").value = "";
  document.getElementById("scorer-goals").value = "";
});


// ==========================
// 📅 WCZYTYWANIE MECZÓW
// ==========================
async function loadMatches() {
  const list = document.getElementById("matches-list");
  list.innerHTML = "";

  const snapshot = await db.collection("matches").orderBy("createdAt", "desc").get();

  snapshot.forEach(doc => {
    const m = doc.data();
    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `
      <strong>${m.teamA}</strong> vs <strong>${m.teamB}</strong><br>
      Grupa: ${m.group} | ${m.date || ""} ${m.time || ""}<br>
      Wynik: ${m.scoreA} : ${m.scoreB}<br>
      Status: ${m.status}<br>
      <div class="match-actions">
        <button onclick="deleteMatch('${doc.id}')">🗑 Usuń</button>
      </div>
    `;
    list.appendChild(div);
  });
}

async function deleteMatch(id) {
  if (confirm("Na pewno chcesz usunąć ten mecz?")) {
    await db.collection("matches").doc(id).delete();
    loadMatches();
    loadTables();
  }
}


// ==========================
// 🧮 GENEROWANIE TABEL GRUP
// ==========================
async function loadTables() {
  const container = document.getElementById("groups-tables");
  container.innerHTML = "";

  const teamsSnap = await db.collection("teams").get();
  const matchesSnap = await db.collection("matches").where("status", "==", "zakonczony").get();

  const teams = {};
  teamsSnap.forEach(doc => {
    const t = doc.data();
    teams[t.name] = {
      name: t.name,
      group: t.group,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0
    };
  });

  matchesSnap.forEach(doc => {
    const m = doc.data();
    const A = teams[m.teamA];
    const B = teams[m.teamB];
    if (!A || !B) return;

    A.goalsFor += m.scoreA;
    A.goalsAgainst += m.scoreB;
    B.goalsFor += m.scoreB;
    B.goalsAgainst += m.scoreA;

    if (m.scoreA > m.scoreB) A.points += 3;
    else if (m.scoreB > m.scoreA) B.points += 3;
    else { A.points += 1; B.points += 1; }
  });

  const groups = {};
  Object.values(teams).forEach(t => {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  });

  for (const [group, list] of Object.entries(groups)) {
    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr><th colspan="5">Grupa ${group}</th></tr>
        <tr><th>Drużyna</th><th>Punkty</th><th>G+</th><th>G-</th><th>Bilans</th></tr>
      </thead>
      <tbody>
        ${list.sort((a,b)=>b.points-a.points).map(t=>`
          <tr>
            <td>${t.name}</td>
            <td>${t.points}</td>
            <td>${t.goalsFor}</td>
            <td>${t.goalsAgainst}</td>
            <td>${t.goalsFor - t.goalsAgainst}</td>
          </tr>`).join("")}
      </tbody>
    `;
    container.appendChild(table);
  }
}


// ==========================
// ⚽ TABELA STRZELCÓW
// ==========================
async function loadScorers() {
  const tbody = document.querySelector("#scorers-table tbody");
  tbody.innerHTML = "";

  const snap = await db.collection("scorers").get();
  const scorers = {};

  snap.forEach(doc => {
    const s = doc.data();
    if (!scorers[s.name]) scorers[s.name] = { name: s.name, team: s.team, goals: 0 };
    scorers[s.name].goals += s.goals;
  });

  const sorted = Object.values(scorers).sort((a,b) => b.goals - a.goals);
  sorted.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${s.name}</td>
      <td>${s.team}</td>
      <td>${s.goals}</td>
    `;
    tbody.appendChild(tr);
  });
}
