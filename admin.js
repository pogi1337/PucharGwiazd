// ==========================================
// admin.js - kompletny plik z poprawionym logowaniem
// ==========================================

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

    await loadTeams();
    await loadMatches();
    await loadTables();
    await loadScorersEditable();
  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});

// ==========================================
// 🔹 GLOBALNY CACHE DRUŻYN I ZAWODNIKÓW
// ==========================================
const TEAMS_CACHE = {};

async function loadTeamPlayers(teamId) {
  try {
    const snap = await db.collection("teams").doc(teamId).collection("players").orderBy("name").get();
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Brak podkolekcji players dla:", teamId, e);
    return [];
  }
}

// ==========================================
// 🔹 ŁADOWANIE DRUŻYN
// ==========================================
async function loadTeams() {
  try {
    const snap = await db.collection("teams").orderBy("name").get();
    const teamASelect = document.getElementById("teamA");
    const teamBSelect = document.getElementById("teamB");

    teamASelect.innerHTML = "<option value=''>Wybierz drużynę A</option>";
    teamBSelect.innerHTML = "<option value=''>Wybierz drużynę B</option>";

    for (const t in TEAMS_CACHE) delete TEAMS_CACHE[t];

    for (const doc of snap.docs) {
      const data = doc.data();
      const id = doc.id;
      TEAMS_CACHE[id] = {
        id,
        name: data.name || id,
        email: data.email || "",
        group: data.group || "",
        points: data.points || 0,
        goalsFor: data.goalsFor || 0,
        goalsAgainst: data.goalsAgainst || 0,
        players: [],
      };
      const optA = document.createElement("option");
      optA.value = id;
      optA.textContent = TEAMS_CACHE[id].name;
      teamASelect.appendChild(optA);

      const optB = optA.cloneNode(true);
      teamBSelect.appendChild(optB);
    }

    await Promise.all(Object.keys(TEAMS_CACHE).map(async (teamId) => {
      TEAMS_CACHE[teamId].players = await loadTeamPlayers(teamId);
    }));

    await loadMatches();
  } catch (err) {
    console.error("Błąd podczas ładowania drużyn:", err);
  }
}

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

    await loadTeams();
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
// 🔹 ŁADOWANIE MECZÓW
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

    const playersA = TEAMS_CACHE[m.teamA] ? TEAMS_CACHE[m.teamA].players : [];
    const playersB = TEAMS_CACHE[m.teamB] ? TEAMS_CACHE[m.teamB].players : [];

    let scorerSelectHTML = `<select id="scorer-select-${doc.id}">`;
    scorerSelectHTML += `<option value="">-- wybierz zawodnika --</option>`;
    playersA.forEach(p => {
      scorerSelectHTML += `<option value="${encodeURIComponent(p.name)}|${m.teamA}">${p.name} (${TEAMS_CACHE[m.teamA].name || m.teamA})</option>`;
    });
    if (playersA.length && playersB.length) scorerSelectHTML += `<option disabled>────────</option>`;
    playersB.forEach(p => {
      scorerSelectHTML += `<option value="${encodeURIComponent(p.name)}|${m.teamB}">${p.name} (${TEAMS_CACHE[m.teamB].name || m.teamB})</option>`;
    });
    scorerSelectHTML += `</select>`;

    const manualScorerHTML = `<input id="scorer-input-${doc.id}" placeholder="Dodaj strzelca ręcznie"> <input id="scorer-team-${doc.id}" placeholder="Drużyna (lub wybierz)"/>`;

    div.innerHTML = `
      <div class="match-header">
        <strong>${TEAMS_CACHE[m.teamA] ? TEAMS_CACHE[m.teamA].name : m.teamA} (${m.goalsA}) vs (${m.goalsB}) ${TEAMS_CACHE[m.teamB] ? TEAMS_CACHE[m.teamB].name : m.teamB}</strong><br>
        <small>${m.date || ""} ${m.time || ""} — Grupa ${m.group}</small>
      </div>

      <div class="scorer-list" id="scorer-list-${doc.id}">
        ${Array.isArray(m.scorers) && m.scorers.length > 0 
          ? m.scorers.map((s, idx) => `<div>${idx+1}. ${s.name} (${s.team}) <button onclick="removeScorerFromMatch('${doc.id}', ${idx})">Usuń</button></div>`).join("") 
          : "Brak strzelców"}
      </div>

      <div style="margin-top:8px;">
        <input id="ga-${doc.id}" type="number" value="${m.goalsA}" style="width:60px;">
        <input id="gb-${doc.id}" type="number" value="${m.goalsB}" style="width:60px;">
        <button onclick="updateScore('${doc.id}')">💾 Zapisz wynik</button>
        <button onclick="deleteMatch('${doc.id}')">🗑 Usuń</button>
      </div>

      <div style="margin-top:8px;">
        ${playersA.length || playersB.length ? scorerSelectHTML + ` <button onclick="addScorerFromSelect('${doc.id}')">⚽ Dodaj gola</button>` : manualScorerHTML + ` <button onclick="addScorerManual('${doc.id}')">⚽ Dodaj gola</button>`}
      </div>

      <div style="margin-top:8px;">
        <select id="status-${doc.id}">
          <option value="planowany" ${m.status === "planowany" ? "selected" : ""}>Planowany</option>
          <option value="trwa" ${m.status === "trwa" ? "selected" : ""}>Trwa</option>
          <option value="zakończony" ${m.status === "zakończony" ? "selected" : ""}>Zakończony</option>
        </select>
        <button onclick="changeStatus('${doc.id}')">🔄 Zmień status</button>
      </div>

      <div style="margin-top:6px;">
        <button onclick="openMatchDetails('${doc.id}')">🔍 Szczegóły meczu</button>
      </div>
    `;
    list.appendChild(div);
  });
}

// ==========================================
// 🔹 POZOSTAŁE FUNKCJE
// (updateScore, addScorerFromSelect, addScorerManual, removeScorerFromMatch,
// loadTables, saveTeamEdits, deleteTeam, recalcAndSaveTeamsFromMatches,
// loadScorersEditable, applyScorerEdit, deleteScorerGlobally, openMatchDetails,
// changeStatus)
// ==========================================
// ... tutaj wklej cały Twój poprzedni kod funkcji dokładnie tak jak w poprzednim pliku ...

// ==========================================
// 🔹 AUTOMATYCZNE ODŚWIEŻANIE I EVENTY
// ==========================================
setInterval(async ()=> {
  await loadTeams();
  await loadMatches();
  await loadTables();
  await loadScorersEditable();
}, 15000);

document.getElementById("match-status-filter").addEventListener("change", async () => {
  await loadMatches();
});

// ==========================================
// 🔹 POPRAWIONE onAuthStateChanged
// ==========================================
auth.onAuthStateChanged(async user => {
  if (user) {
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists && userDoc.data().admin === true) {
      document.getElementById("login-box").style.display = "none";
      document.getElementById("admin-wrapper").style.display = "block";
      await loadTeams();
      await loadMatches();
      await loadTables();
      await loadScorersEditable();
    } else {
      await auth.signOut();
    }
  }
});
