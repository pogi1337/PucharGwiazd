// ==========================================
// admin.js - kompletny plik
// (ZACHOWANO TWÓJ BLOK LOGOWANIA BEZ ZMIAN)
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
// 🔹 LOGOWANIE ADMINA  (NIE ZMIENIANA CZĘŚĆ)
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

    // po zalogowaniu ładujemy dane
    await loadTeams();       // populacja selectów drużyn + rosterów
    await loadMatches();     // wyświetlenie meczów
    await loadTables();      // tabele grup i strzelcy
    await loadScorersEditable(); // tabela strzelców edytowalna

  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});


// ==========================================
// 🔹 GLOBALNY CACHE DRUŻYN I ZAWODNIKÓW
// ==========================================
const TEAMS_CACHE = {}; // { teamId: { name, email, group, points, goalsFor, goalsAgainst, players: [...] } }

// helper: bezpiecznie pobierz listę graczy drużyny
async function loadTeamPlayers(teamId) {
  // Zakładamy, że roster może być przechowywany w kolekcji teams/{teamId}/players
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
// 🔹 ŁADOWANIE DRUŻYN -> populacja selectów
// ==========================================
async function loadTeams() {
  try {
    const snap = await db.collection("teams").orderBy("name").get();
    const teamASelect = document.getElementById("teamA");
    const teamBSelect = document.getElementById("teamB");
    const scorerTeamSelects = document.querySelectorAll("[id^='scorer-team-']"); // dynamiczne
    const scorerGlobalSelect = document.getElementById("scorer-team"); // jeśli istnieje globalnie
    const scorerSelectSingle = document.getElementById("scorer-team-select"); // fallback

    teamASelect.innerHTML = "<option value=''>Wybierz drużynę A</option>";
    teamBSelect.innerHTML = "<option value=''>Wybierz drużynę B</option>";

    TEAMS_CACHE_CLEAR:
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
        players: [], // uzupełnimy poniżej
      };
      const optA = document.createElement("option");
      optA.value = id;
      optA.textContent = TEAMS_CACHE[id].name;
      teamASelect.appendChild(optA);

      const optB = optA.cloneNode(true);
      teamBSelect.appendChild(optB);
    }

    // wczytaj rostery asynchronicznie i uzupełnij cache
    await Promise.all(Object.keys(TEAMS_CACHE).map(async (teamId) => {
      TEAMS_CACHE[teamId].players = await loadTeamPlayers(teamId);
    }));

    // po załadowaniu cache odśwież widoki meczów, bo selecty strzelców w listach meczów mogą wymagać aktualizacji
    await loadMatches();

  } catch (err) {
    console.error("Błąd podczas ładowania drużyn:", err);
  }
}


// ==========================================
// 🔹 TWORZENIE DRUŻYNY (dostępne w HTML)
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

    // przeładuj selecty
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
// 🔹 DODAWANIE MECZU (teraz wybieramy drużyny z selectów)
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
    scorers: [], // zawsze pusta tablica
    createdAt: new Date()
  });

  alert("✅ Mecz dodany!");
  await loadMatches();
  await loadTables(); // od razu przelicz / odśwież tabele
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

    // przygotuj select z zawodnikami obu drużyn (jeśli rostery są w cache)
    const playersA = TEAMS_CACHE[m.teamA] ? TEAMS_CACHE[m.teamA].players : [];
    const playersB = TEAMS_CACHE[m.teamB] ? TEAMS_CACHE[m.teamB].players : [];

    // stwórz select dla strzelców (z id zależnym od meczu)
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

    // fallback: jeśli brak rosterów, pokaż pole do ręcznego wpisu + przycisk do dodania zawodnika do drużyny
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
// 🔹 ZMIANA STATUSU
// ==========================================
async function changeStatus(id) {
  const status = document.getElementById(`status-${id}`).value;
  await db.collection("matches").doc(id).update({ status });
  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 AKTUALIZACJA WYNIKU
// ==========================================
async function updateScore(id) {
  const ga = parseInt(document.getElementById(`ga-${id}`).value) || 0;
  const gb = parseInt(document.getElementById(`gb-${id}`).value) || 0;
  await db.collection("matches").doc(id).update({ goalsA: ga, goalsB: gb });
  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 DODAWANIE STRZELCA Z SELECTA (wybieramy z rosteru)
// ==========================================
async function addScorerFromSelect(id) {
  const sel = document.getElementById(`scorer-select-${id}`);
  if (!sel) return alert("Brak wyboru zawodnika.");
  const val = sel.value;
  if (!val) return alert("Wybierz zawodnika.");
  const [encName, team] = val.split("|");
  const name = decodeURIComponent(encName);
  const matchRef = db.collection("matches").doc(id);

  await matchRef.update({
    scorers: firebase.firestore.FieldValue.arrayUnion({ name, team })
  });

  await loadMatches();
  await loadTables();
}

// ==========================================
// 🔹 DODAWANIE STRZELCA RĘCZNIE + opcja dodania do rosteru drużyny
// ==========================================
async function addScorerManual(id) {
  const name = document.getElementById(`scorer-input-${id}`).value.trim();
  let teamVal = document.getElementById(`scorer-team-${id}`).value.trim();

  if (!name || !teamVal) return alert("Podaj imię/nazwisko i drużynę.");

  // jeśli teamVal odpowiada id drużyny w cache, użyj id; jeśli nie, spróbuj znaleźć po nazwie
  let teamId = null;
  if (TEAMS_CACHE[teamVal]) teamId = teamVal;
  else {
    // spróbuj dopasować po nazwie (często nazwa = id)
    for (const t in TEAMS_CACHE) {
      if ((TEAMS_CACHE[t].name || "").toLowerCase() === teamVal.toLowerCase()) {
        teamId = t;
        break;
      }
    }
  }

  // jeśli nie znaleziono id, użyj przekazanej wartości jako nazwy drużyny (nie idealne, ale działa)
  const teamForMatch = teamId || teamVal;

  const matchRef = db.collection("matches").doc(id);
  await matchRef.update({
    scorers: firebase.firestore.FieldValue.arrayUnion({ name, team: teamForMatch })
  });

  // jeśli teamId istnieje i chcesz dodać zawodnika do rosteru - dodajemy go do podkolekcji teams/{teamId}/players
  if (teamId) {
    const playersColl = db.collection("teams").doc(teamId).collection("players");
    // unikaj dublowania: sprawdź czy istnieje gracz o tej samej nazwie
    const existing = await playersColl.where("name", "==", name).get();
    if (existing.empty) {
      await playersColl.add({ name });
      // odśwież cache dla tej drużyny
      TEAMS_CACHE[teamId].players = await loadTeamPlayers(teamId);
    }
  }

  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 USUWANIE STRZELCA Z KONKRETNEGO MECZU PO INDEXIE
// ==========================================
async function removeScorerFromMatch(matchId, idx) {
  const matchRef = db.collection("matches").doc(matchId);
  const doc = await matchRef.get();
  if (!doc.exists) return;
  const m = doc.data();
  if (!Array.isArray(m.scorers)) return;
  // usuń na podstawie indexu: zbuduj nową tablicę bez tego indexu
  const newScorers = m.scorers.slice(0, idx).concat(m.scorers.slice(idx+1));
  await matchRef.update({ scorers: newScorers });
  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 DODAWANIE STRZELCA (oryginalna funkcja - jeśli używana gdzie indziej)
// ==========================================
async function addScorer(id) {
  const nameInput = document.getElementById(`scorer-${id}`);
  const teamSelect = document.getElementById(`team-${id}`);
  if (!nameInput || !teamSelect) return alert("Brak pól strzelca.");

  const name = nameInput.value.trim();
  const team = teamSelect.value;
  if (!name) return alert("Podaj nazwisko strzelca!");

  const matchRef = db.collection("matches").doc(id);
  await matchRef.update({
    scorers: firebase.firestore.FieldValue.arrayUnion({ name, team })
  });

  document.getElementById(`scorer-${id}`).value = "";
  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 USUWANIE MECZU
// ==========================================
async function deleteMatch(id) {
  if (!confirm("Czy na pewno chcesz usunąć mecz?")) return;
  await db.collection("matches").doc(id).delete();
  await loadMatches();
  await loadTables();
}


// ==========================================
// 🔹 TABELA GRUPOWA + KLASYFIKACJA STRZELCÓW
//    (recalculation z opcją zapisu do teams)
// ==========================================
async function loadTables() {
  try {
    const snapshot = await db.collection("matches").get();

    // tymczasowe obiekty do obliczeń
    const teamsFromMatches = {}; // { group: { teamNameOrId: { pts, gf, ga } } }
    const scorersMap = {};

    snapshot.forEach(doc => {
      const m = doc.data();
      if (!m.group) m.group = "Bez grupy";
      if (!teamsFromMatches[m.group]) teamsFromMatches[m.group] = {};

      [m.teamA, m.teamB].forEach(t => {
        if (!teamsFromMatches[m.group][t]) teamsFromMatches[m.group][t] = { pts: 0, gf: 0, ga: 0 };
      });

      if (m.status === "zakończony") {
        teamsFromMatches[m.group][m.teamA].gf += (m.goalsA || 0);
        teamsFromMatches[m.group][m.teamA].ga += (m.goalsB || 0);
        teamsFromMatches[m.group][m.teamB].gf += (m.goalsB || 0);
        teamsFromMatches[m.group][m.teamB].ga += (m.goalsA || 0);

        if ((m.goalsA || 0) > (m.goalsB || 0)) teamsFromMatches[m.group][m.teamA].pts += 3;
        else if ((m.goalsA || 0) < (m.goalsB || 0)) teamsFromMatches[m.group][m.teamB].pts += 3;
        else {
          teamsFromMatches[m.group][m.teamA].pts += 1;
          teamsFromMatches[m.group][m.teamB].pts += 1;
        }
      }

      // bezpieczne przetwarzanie strzelców
      if (Array.isArray(m.scorers)) {
        m.scorers.forEach(s => {
          if (!s || !s.name) return;
          const key = s.name + " | " + s.team;
          scorersMap[key] = (scorersMap[key] || 0) + 1;
        });
      } else if (m.scorers && typeof m.scorers === "object") {
        Object.values(m.scorers).forEach(s => {
          if (s && s.name && s.team) {
            const key = s.name + " | " + s.team;
            scorersMap[key] = (scorersMap[key] || 0) + 1;
          }
        });
      }
    });

    // render grup (tabela) - pokaż w formie edytowalnej (inputs + zapisz)
    const groupDiv = document.getElementById("group-tables");
    groupDiv.innerHTML = "";

    // jeśli mamy teams w kolekcji teams, preferuj pobranie ich by móc edytować
    const teamsSnap = await db.collection("teams").orderBy("name").get();
    if (!teamsSnap.empty) {
      // render listy drużyn jako edytowalnej tabeli
      const tbl = document.createElement("table");
      tbl.innerHTML = `<tr><th>Drużyna (ID)</th><th>Nazwa</th><th>Grupa</th><th>PKT</th><th>GF</th><th>GA</th><th>Akcje</th></tr>`;
      for (const doc of teamsSnap.docs) {
        const d = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${doc.id}</td>
          <td><input id="team-name-${doc.id}" value="${d.name || ""}"></td>
          <td><input id="team-group-${doc.id}" value="${d.group || ""}" style="width:60px"></td>
          <td><input id="team-pts-${doc.id}" type="number" value="${d.points || 0}" style="width:60px"></td>
          <td><input id="team-gf-${doc.id}" type="number" value="${d.goalsFor || 0}" style="width:60px"></td>
          <td><input id="team-ga-${doc.id}" type="number" value="${d.goalsAgainst || 0}" style="width:60px"></td>
          <td>
            <button onclick="saveTeamEdits('${doc.id}')">💾 Zapisz</button>
            <button onclick="deleteTeam('${doc.id}')">🗑 Usuń</button>
          </td>
        `;
        tbl.appendChild(tr);
      }
      // dodaj przyciski globalne
      const controlRow = document.createElement("div");
      controlRow.style.marginTop = "10px";
      controlRow.innerHTML = `
        <button id="recalc-from-results">Przelicz tabele z wyników</button>
      `;
      groupDiv.appendChild(tbl);
      groupDiv.appendChild(controlRow);

      document.getElementById("recalc-from-results").addEventListener("click", async () => {
        if (!confirm("Przeliczyć tabele na podstawie zakończonych meczów i nadpisać wartości w kolekcji teams?")) return;
        await recalcAndSaveTeamsFromMatches();
        await loadTeams();
        await loadTables();
        alert("✅ Przeliczone i zapisane.");
      });

    } else {
      // Brak kolekcji teams - wyświetl obliczone tabele tylko na podstawie meczów
      for (const g in teamsFromMatches) {
        const table = document.createElement("table");
        table.innerHTML = `<tr><th>Grupa ${g}</th><th>PKT</th><th>GF</th><th>GA</th></tr>`;
        const sorted = Object.entries(teamsFromMatches[g]).sort((a,b)=>b[1].pts-a[1].pts);
        sorted.forEach(([t,v])=>{
          const row = document.createElement("tr");
          row.innerHTML = `<td>${t}</td><td>${v.pts}</td><td>${v.gf}</td><td>${v.ga}</td>`;
          table.appendChild(row);
        });
        groupDiv.appendChild(table);
      }
    }

    // render klasyfikacji strzelców do tabeli (tylko odczyt, edycja poniżej)
    const scorersTable = document.querySelector("#scorers-table tbody");
    scorersTable.innerHTML = "";
    const sortedScorers = Object.entries(scorersMap).sort((a,b)=>b[1]-a[1]);
    sortedScorers.forEach(([key, goals])=>{
      const [name, team] = key.split(" | ");
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${name}</td><td>${team}</td><td>${goals}</td>`;
      scorersTable.appendChild(tr);
    });

  } catch (err) {
    console.error("Błąd podczas ładowania tabel:", err);
  }
}


// ==========================================
// 🔹 ZAPIS EDYCJI TEAM (z edytowalnej tabeli)
// ==========================================
async function saveTeamEdits(teamId) {
  try {
    const name = document.getElementById(`team-name-${teamId}`).value.trim();
    const group = document.getElementById(`team-group-${teamId}`).value.trim();
    const points = parseInt(document.getElementById(`team-pts-${teamId}`).value) || 0;
    const gf = parseInt(document.getElementById(`team-gf-${teamId}`).value) || 0;
    const ga = parseInt(document.getElementById(`team-ga-${teamId}`).value) || 0;

    await db.collection("teams").doc(teamId).set({
      name,
      group,
      points,
      goalsFor: gf,
      goalsAgainst: ga
    }, { merge: true });

    alert("✅ Zapisano zmiany dla drużyny " + teamId);
    await loadTeams();
    await loadTables();
  } catch (err) {
    console.error("Błąd zapisu drużyny:", err);
    alert("Błąd zapisu: " + err.message);
  }
}

// ==========================================
// 🔹 USUNIĘCIE TEAM (OSTRZEŻENIE)
// ==========================================
async function deleteTeam(teamId) {
  if (!confirm(`Usunąć drużynę ${teamId}? To usunie też podkolekcję players (jeśli istnieje).`)) return;
  try {
    // usuwamy dokument team
    await db.collection("teams").doc(teamId).delete();
    alert("✅ Usunięto drużynę.");
    await loadTeams();
    await loadTables();
  } catch (err) {
    console.error("Błąd usuwania drużyny:", err);
    alert("Błąd: " + err.message);
  }
}


// ==========================================
// 🔹 PRZELICZ I ZAPISZ DO TEAMS NA PODSTAWIE MATCHES
// ==========================================
async function recalcAndSaveTeamsFromMatches() {
  const snapshot = await db.collection("matches").get();
  const teamsCalc = {}; // { teamIdOrName: { name, group, pts, gf, ga } }

  snapshot.forEach(doc => {
    const m = doc.data();
    if (!m.group) m.group = "";
    [m.teamA, m.teamB].forEach(t => {
      if (!teamsCalc[t]) teamsCalc[t] = { name: t, group: m.group || "", pts: 0, gf: 0, ga: 0 };
    });

    if (m.status === "zakończony") {
      teamsCalc[m.teamA].gf += (m.goalsA || 0);
      teamsCalc[m.teamA].ga += (m.goalsB || 0);
      teamsCalc[m.teamB].gf += (m.goalsB || 0);
      teamsCalc[m.teamB].ga += (m.goalsA || 0);

      if ((m.goalsA || 0) > (m.goalsB || 0)) teamsCalc[m.teamA].pts += 3;
      else if ((m.goalsA || 0) < (m.goalsB || 0)) teamsCalc[m.teamB].pts += 3;
      else { teamsCalc[m.teamA].pts += 1; teamsCalc[m.teamB].pts += 1; }
    }
  });

  // zapisujemy do kolekcji teams: jeśli team istnieje - merge update; jeśli nie, tworzymy
  const batch = db.batch();
  for (const t in teamsCalc) {
    const ref = db.collection("teams").doc(t);
    batch.set(ref, {
      name: teamsCalc[t].name,
      group: teamsCalc[t].group,
      points: teamsCalc[t].pts,
      goalsFor: teamsCalc[t].gf,
      goalsAgainst: teamsCalc[t].ga
    }, { merge: true });
  }
  await batch.commit();
}


// ==========================================
// 🔹 KLASYFIKACJA STRZELCÓW - EDYCJA & USUWANIE
//    (budujemy dynamiczną tabelę edytowalną)
// ==========================================
async function loadScorersEditable() {
  // zbudujemy listę strzelców ze wszystkich meczów
  const snap = await db.collection("matches").get();
  const scorersMap = {}; // key -> count, key = name + '|' + team

  snap.forEach(d => {
    const m = d.data();
    if (!Array.isArray(m.scorers)) return;
    m.scorers.forEach(s => {
      if (!s || !s.name) return;
      const key = s.name + "|" + s.team;
      scorersMap[key] = (scorersMap[key] || 0) + 1;
    });
  });

  // render do osobnej sekcji z opcjami edycji
  // utwórz lub wykorzystaj istniejącą tabelę z id scorers-editable jeśli nie ma
  let container = document.getElementById("scorers-editable-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "scorers-editable-container";
    container.style.marginTop = "15px";
    const section = document.querySelector("#scorers-table").parentElement;
    section.appendChild(container);
  }
  container.innerHTML = "<h3>Edytowalna lista strzelców</h3>";

  const table = document.createElement("table");
  table.innerHTML = `<tr><th>Zawodnik</th><th>Drużyna</th><th>Bramki</th><th>Akcje</th></tr>`;

  Object.entries(scorersMap).sort((a,b)=>b[1]-a[1]).forEach(([key, count])=>{
    const [name, team] = key.split("|");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input id="sc-name-${encodeURIComponent(key)}" value="${name}"></td>
      <td>
        <select id="sc-team-${encodeURIComponent(key)}">
          ${Object.keys(TEAMS_CACHE).map(tid => `<option value="${tid}" ${TEAMS_CACHE[tid].name === team || tid === team ? "selected" : ""}>${TEAMS_CACHE[tid].name || tid}</option>`).join("")}
          <option value="__raw__" ${(!Object.keys(TEAMS_CACHE).some(tid => TEAMS_CACHE[tid].name === team) && !Object.keys(TEAMS_CACHE).includes(team)) ? "selected" : ""}>Inna: ${team}</option>
        </select>
        <input id="sc-team-raw-${encodeURIComponent(key)}" style="display:none;width:120px" value="${(!Object.keys(TEAMS_CACHE).some(tid => TEAMS_CACHE[tid].name === team) && !Object.keys(TEAMS_CACHE).includes(team)) ? team : ""}" placeholder="nazwa drużyny">
      </td>
      <td>${count}</td>
      <td>
        <button onclick="applyScorerEdit('${encodeURIComponent(key)}')">💾 Zmień</button>
        <button onclick="deleteScorerGlobally('${encodeURIComponent(key)}')">🗑 Usuń</button>
      </td>
    `;
    table.appendChild(tr);
  });

  // instrukcja
  const info = document.createElement("p");
  info.textContent = "Edycja zmieni wszystkie wystąpienia danego strzelca we wszystkich meczach (przeniesie go do nowej drużyny jeśli wybrano).";

  container.appendChild(info);
  container.appendChild(table);

  // obsługa pokazywania pola raw dla selectów
  container.querySelectorAll("select[id^='sc-team-']").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const id = sel.id.replace("sc-team-","");
      const raw = document.getElementById(`sc-team-raw-${id}`);
      if (sel.value === "__raw__") raw.style.display = "inline-block";
      else raw.style.display = "none";
    });
    // trigger initial display
    sel.dispatchEvent(new Event('change'));
  });
}

// apply edit: zamień wszystkie wystąpienia starego klucza (starego name|team) we wszystkich meczach na nowe wartości
async function applyScorerEdit(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  const inputName = document.getElementById(`sc-name-${encodedKey}`);
  const selectTeam = document.getElementById(`sc-team-${encodedKey}`);
  const rawTeamInput = document.getElementById(`sc-team-raw-${encodedKey}`);

  if (!inputName || !selectTeam) return;

  const newName = inputName.value.trim();
  let newTeam = selectTeam.value;
  if (newTeam === "__raw__") {
    newTeam = rawTeamInput.value.trim() || "__unknown__";
  }

  const [oldName, oldTeam] = key.split("|");

  // przeszukaj wszystkie mecze i zastąp
  const snap = await db.collection("matches").get();
  const batch = db.batch();
  snap.docs.forEach(doc => {
    const m = doc.data();
    if (!Array.isArray(m.scorers)) return;
    let changed = false;
    const newScorers = m.scorers.map(s => {
      if (!s || !s.name) return s;
      if (s.name === oldName && (s.team === oldTeam || s.team === decodeURIComponent(oldTeam))) {
        changed = true;
        return { name: newName, team: newTeam };
      }
      return s;
    });
    if (changed) {
      batch.update(db.collection("matches").doc(doc.id), { scorers: newScorers });
    }
  });

  await batch.commit();
  alert("✅ Zmieniono strzelca we wszystkich meczach.");
  await loadMatches();
  await loadTables();
  await loadScorersEditable();
}

// global delete: usuń wszystkie wystąpienia strzelca we wszystkich meczach
async function deleteScorerGlobally(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  const [oldName, oldTeam] = key.split("|");
  if (!confirm(`Usunąć wszystkie wpisy strzelca ${oldName} (${oldTeam}) z wszystkich meczów?`)) return;

  const snap = await db.collection("matches").get();
  const batch = db.batch();
  snap.docs.forEach(doc => {
    const m = doc.data();
    if (!Array.isArray(m.scorers)) return;
    const newScorers = m.scorers.filter(s => !(s && s.name === oldName && s.team === oldTeam));
    if (newScorers.length !== m.scorers.length) {
      batch.update(db.collection("matches").doc(doc.id), { scorers: newScorers });
    }
  });
  await batch.commit();
  alert("✅ Usunięto wszystkie wystąpienia.");
  await loadMatches();
  await loadTables();
  await loadScorersEditable();
}


// ==========================================
// 🔹 POMOCNICZE: szczegóły meczu (wyświetli dokument, edycja surowa)
// ==========================================
async function openMatchDetails(id) {
  const doc = await db.collection("matches").doc(id).get();
  if (!doc.exists) return alert("Nie znaleziono meczu.");
  const m = doc.data();
  const pretty = JSON.stringify(m, null, 2);
  // prosty modal alert (można rozwinąć)
  prompt("Surowe dane meczu (możesz je skopiować):", pretty);
}


// ==========================================
// 🔹 AUTOMATYCZNE ODŚWIEŻANIE I EVENTY
// ==========================================
setInterval(async ()=> {
  await loadTeams();
  await loadMatches();
  await loadTables();
  await loadScorersEditable();
}, 15000);

// Zmiana filtra statusu -> przeładowanie
document.getElementById("match-status-filter").addEventListener("change", async () => {
  await loadMatches();
});

// Załaduj od razu jeśli użytkownik jest już zalogowany
auth.onAuthStateChanged(async user => {
  if (user) {
    // sprawdź uprawnienia
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists && userDoc.data().admin === true) {
      document.getElementById("login-box").style.display = "none";
      document.getElementById("admin-wrapper").style.display = "block";
      await loadTeams();
      await loadMatches();
      await loadTables();
      await loadScorersEditable();
    } else {
      // jeśli brak admina, wyloguj
      await auth.signOut();
    }
  }
});
