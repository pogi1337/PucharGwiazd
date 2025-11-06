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
  // ============================
// ✅ MECZE: Dodawanie + Strzelcy
// ============================
const matchesList = document.getElementById("matches-list");
const addMatchBtn = document.getElementById("add-match-btn");

// 🔸 Dodawanie meczu
addMatchBtn.addEventListener("click", async () => {
  const teamA = document.getElementById("match-teamA").value.trim();
  const teamB = document.getElementById("match-teamB").value.trim();
  const group = document.getElementById("match-group").value;
  if (!teamA || !teamB) return alert("Wpisz obie drużyny!");

  await db.collection("matches").add({
    teamA, teamB, goalsA: 0, goalsB: 0,
    status: "planowany", group,
    scorers: [], createdAt: new Date()
  });

  alert("✅ Mecz dodany!");
  loadMatches();
});

// 🔸 Wczytywanie meczów
async function loadMatches() {
  const snap = await db.collection("matches").orderBy("createdAt", "desc").get();
  matchesList.innerHTML = "";

  snap.forEach(doc => {
    const match = doc.data();
    const div = document.createElement("div");
    div.className = "match-card";

    div.innerHTML = `
      <h3>${match.teamA} (${match.goalsA}) vs (${match.goalsB}) ${match.teamB}</h3>
      <p>Status: ${match.status} | Grupa: ${match.group}</p>

      <input id="scorer-${doc.id}" placeholder="Dodaj strzelca">
      <select id="team-${doc.id}">
        <option value="${match.teamA}">${match.teamA}</option>
        <option value="${match.teamB}">${match.teamB}</option>
      </select>
      <button onclick="addScorer('${doc.id}')">⚽ Dodaj gola</button>

      <div class="scorers">
        ${match.scorers.map(s => `<p>${s.name} (${s.team})</p>`).join("")}
      </div>

      <button onclick="toggleMatchStatus('${doc.id}', '${match.status}')">🔁 Zmień status</button>
      <button onclick="deleteMatch('${doc.id}')">🗑 Usuń</button>
    `;
    matchesList.appendChild(div);
  });
}
loadMatches();

// 🔸 Dodawanie strzelca
window.addScorer = async (matchId) => {
  const nameInput = document.getElementById(`scorer-${matchId}`);
  const teamSelect = document.getElementById(`team-${matchId}`);
  const name = nameInput.value.trim();
  const team = teamSelect.value;

  if (!name) return alert("Podaj nazwisko strzelca!");

  const matchRef = db.collection("matches").doc(matchId);
  const matchDoc = await matchRef.get();
  const match = matchDoc.data();

  // ✅ Dodaj strzelca do meczu
  const newScorers = [...match.scorers, { name, team }];
  let goalsA = match.goalsA;
  let goalsB = match.goalsB;
  if (team === match.teamA) goalsA++;
  if (team === match.teamB) goalsB++;

  await matchRef.update({ scorers: newScorers, goalsA, goalsB });

  // ✅ Zaktualizuj tabelę strzelców
  const scorerRef = db.collection("scorers").doc(name);
  const scorerDoc = await scorerRef.get();
  if (scorerDoc.exists) {
    await scorerRef.update({ goals: scorerDoc.data().goals + 1 });
  } else {
    await scorerRef.set({ name, goals: 1, team });
  }

  loadMatches();
};

// 🔸 Zmiana statusu meczu
window.toggleMatchStatus = async (id, currentStatus) => {
  const statuses = ["planowany", "trwa", "zakończony"];
  const next = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];
  await db.collection("matches").doc(id).update({ status: next });
  loadMatches();
};

// 🔸 Usuwanie meczu
window.deleteMatch = async (id) => {
  if (confirm("Na pewno usunąć mecz?")) {
    await db.collection("matches").doc(id).delete();
    loadMatches();
  }
};

}

