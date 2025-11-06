// ==========================================
// 🔥 FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  projectId: "puchargwiazd-bdaa4",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// ==========================================
// 🔹 LOGOWANIE ADMINA
// ==========================================
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value.trim();
  const msg = document.getElementById("login-msg");

  msg.textContent = "Logowanie...";

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists || userDoc.data().admin !== true) {
      msg.textContent = "Brak uprawnień administratora.";
      msg.className = "message error";
      await auth.signOut();
      return;
    }

    msg.textContent = "✅ Zalogowano pomyślnie!";
    msg.className = "message success";

    document.getElementById("login-box").style.display = "none";
    document.getElementById("admin-wrapper").style.display = "block";

    loadMatches();
    loadTables();

  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});


// ==========================================
// 🔹 TWORZENIE DRUŻYNY
// ==========================================
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
      teamId: teamId,
      email: email
    });

    await db.collection("teams").doc(teamId).set({
      name: teamId,
      email: email,
      managerUid: cred.user.uid,
      group: "A",
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      createdAt: new Date(),
    });

    msg.textContent = "✅ Drużyna utworzona!";
    msg.className = "message success";
  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ==========================================
// 🔹 NADAWANIE UPRAWNIEŃ ADMINA
// ==========================================
document.getElementById("grant-admin-btn").addEventListener("click", async () => {
  const email = document.getElementById("new-admin-email").value.trim();
  const msg = document.getElementById("admin-msg");

  if (!email) {
    msg.textContent = "Podaj email!";
    msg.className = "message error";
    return;
  }

  msg.textContent = "Nadawanie uprawnień...";

  try {
    const users = await db.collection("users").where("email", "==", email).get();

    if (users.empty) {
      msg.textContent = "Nie znaleziono użytkownika.";
      msg.className = "message error";
      return;
    }

    for (const u of users.docs) {
      await db.collection("users").doc(u.id).set({ admin: true }, { merge: true });
    }

    msg.textContent = "✅ Nadano uprawnienia administratora!";
    msg.className = "message success";
  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ==========================================
// 🔹 DODAWANIE MECZU
// ==========================================
document.getElementById("add-match-btn").addEventListener("click", async () => {
  const teamA = document.getElementById("teamA").value.trim();
  const teamB = document.getElementById("teamB").value.trim();
  const group = document.getElementById("group").value.trim();
  const date = document.getElementById("match-date").value;
  const time = document.getElementById("match-time").value;

  if (!teamA || !teamB || !group || !date || !time) {
    alert("Uzupełnij wszystkie pola!");
    return;
  }

  await db.collection("matches").add({
    teamA,
    teamB,
    group,
    date,
    time,
    goalsA: 0,
    goalsB: 0,
    status: "planowany",
    scorers: [],
    createdAt: new Date()
  });

  alert("✅ Mecz dodany!");
  loadMatches();
});


// ==========================================
// 🔹 WCZYTYWANIE MECZÓW
// ==========================================
async function loadMatches() {
  const statusFilter = document.getElementById("match-status-filter").value;
  const list = document.getElementById("matches-list");
  list.innerHTML = "<p>Ładowanie...</p>";

  let query = db.collection("matches").orderBy("date");
  if (statusFilter && statusFilter !== "wszyscy") {
    query = query.where("status", "==", statusFilter);
  }

  const snapshot = await query.get();
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p>Brak meczów do wyświetlenia.</p>";
    return;
  }

  snapshot.forEach(doc => {
    const m = doc.data();
    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `
      <div class="match-header">
        <strong>${m.teamA} (${m.goalsA}) vs (${m.goalsB}) ${m.teamB}</strong><br>
        <small>${m.date || ""} ${m.time || ""} — Grupa ${m.group}</small>
      </div>

      <div class="scorer-list">
        ${m.scorers && m.scorers.length > 0 
          ? m.scorers.map(s => `${s.name} (${s.team})`).join(", ") 
          : "Brak strzelców"}
      </div>

      <div style="margin-top:8px;">
        <input id="ga-${doc.id}" type="number" value="${m.goalsA}" style="width:60px;">
        <input id="gb-${doc.id}" type="number" value="${m.goalsB}" style="width:60px;">
        <button onclick="updateScore('${doc.id}')">💾 Zapisz wynik</button>
        <button onclick="deleteMatch('${doc.id}')">🗑 Usuń</button>
      </div>

      <div style="margin-top:8px;">
        <input id="scorer-${doc.id}" placeholder="Dodaj strzelca">
        <select id="team-${doc.id}">
          <option value="${m.teamA}">${m.teamA}</option>
          <option value="${m.teamB}">${m.teamB}</option>
        </select>
        <button onclick="addScorer('${doc.id}')">⚽ Dodaj gola</button>
      </div>

      <div style="margin-top:8px;">
        <select id="status-${doc.id}">
          <option value="planowany" ${m.status === "planowany" ? "selected" : ""}>Planowany</option>
          <option value="trwa" ${m.status === "trwa" ? "selected" : ""}>Trwa</option>
          <option value="zakończony" ${m.status === "zakończony" ? "selected" : ""}>Zakończony</option>
        </select>
        <button onclick="changeStatus('${doc.id}')">🔄 Zmień status</button>
      </div>
    `;
    list.appendChild(div);
  });
}


// ==========================================
// 🔹 ZMIANA STATUSU
// ==========================================
async function changeStatus(id) {
  const status = document.getElementById(`status-${id}`).value;
  await db.collection("matches").doc(id).update({ status });
  loadMatches();
  loadTables();
}


// ==========================================
// 🔹 AKTUALIZACJA WYNIKU
// ==========================================
async function updateScore(id) {
  const ga = parseInt(document.getElementById(`ga-${id}`).value);
  const gb = parseInt(document.getElementById(`gb-${id}`).value);
  await db.collection("matches").doc(id).update({ goalsA: ga, goalsB: gb });
  loadMatches();
  loadTables();
}


// ==========================================
// 🔹 DODAWANIE STRZELCA
// ==========================================
async function addScorer(id) {
  const name = document.getElementById(`scorer-${id}`).value.trim();
  const team = document.getElementById(`team-${id}`).value;
  if (!name) return alert("Podaj nazwisko strzelca!");

  const matchRef = db.collection("matches").doc(id);
  await matchRef.update({
    scorers: firebase.firestore.FieldValue.arrayUnion({ name, team })
  });

  document.getElementById(`scorer-${id}`).value = "";
  loadMatches();
  loadTables();
}


// ==========================================
// 🔹 USUWANIE MECZU
// ==========================================
async function deleteMatch(id) {
  if (!confirm("Czy na pewno chcesz usunąć mecz?")) return;
  await db.collection("matches").doc(id).delete();
  loadMatches();
  loadTables();
}


// ==========================================
// 🔹 TABELA GRUPOWA + KLASYFIKACJA STRZELCÓW
// ==========================================
async function loadTables() {
  const snapshot = await db.collection("matches").get();

  const teams = {};
  const scorersMap = {};

  snapshot.forEach(doc => {
    const m = doc.data();
    if (!teams[m.group]) teams[m.group] = {};

    [m.teamA, m.teamB].forEach(t => {
      if (!teams[m.group][t]) teams[m.group][t] = { pts: 0, gf: 0, ga: 0 };
    });

    if (m.status === "zakończony") {
      teams[m.group][m.teamA].gf += m.goalsA;
      teams[m.group][m.teamA].ga += m.goalsB;
      teams[m.group][m.teamB].gf += m.goalsB;
      teams[m.group][m.teamB].ga += m.goalsA;

      if (m.goalsA > m.goalsB) teams[m.group][m.teamA].pts += 3;
      else if (m.goalsA < m.goalsB) teams[m.group][m.teamB].pts += 3;
      else {
        teams[m.group][m.teamA].pts += 1;
        teams[m.group][m.teamB].pts += 1;
      }
    }

    if (m.scorers) {
      m.scorers.forEach(s => {
        const key = s.name + " | " + s.team;
        scorersMap[key] = (scorersMap[key] || 0) + 1;
      });
    }
  });

  const groupDiv = document.getElementById("group-tables");
  groupDiv.innerHTML = "";
  for (const g in teams) {
    const tbl = document.createElement("table");
    tbl.innerHTML = `<tr><th>Grupa ${g}</th><th>PKT</th><th>GF</th><th>GA</th></tr>`;
    const sorted = Object.entries(teams[g]).sort((a,b)=>b[1].pts-a[1].pts);
    sorted.forEach(([t,v])=>{
      const row = document.createElement("tr");
      row.innerHTML = `<td>${t}</td><td>${v.pts}</td><td>${v.gf}</td><td>${v.ga}</td>`;
      tbl.appendChild(row);
    });
    groupDiv.appendChild(tbl);
  }

  const scorersTable = document.querySelector("#scorers-table tbody");
  scorersTable.innerHTML = "";
  const sortedScorers = Object.entries(scorersMap).sort((a,b)=>b[1]-a[1]);
  sortedScorers.forEach(([key, goals])=>{
    const [name, team] = key.split(" | ");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td><td>${team}</td><td>${goals}</td>`;
    scorersTable.appendChild(tr);
  });
}

// 🔁 Automatyczne odświeżanie tabel co 10 sek.
setInterval(loadTables, 10000);

// Zmiana filtra statusu -> przeładowanie
document.getElementById("match-status-filter").addEventListener("change", loadMatches);
