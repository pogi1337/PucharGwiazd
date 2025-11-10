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
const TEAMS_CACHE = {}; // { teamId: { name, email, group, points, goalsFor, goalsAgainst, players: [...] } }

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
// 🔹 ŁADOWANIE DRUŻYN -> populacja selectów
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
// 🔹 WCZYTYWANIE MECZÓW, DODAWANIE, EDYCJA, USUWANIE
// ==========================================
// ... (tu wklej pozostałe funkcje dokładnie jak w poprzedniej wersji admin.js)
// np. loadMatches, updateScore, addScorerFromSelect, deleteMatch, itd.
// Wszystko pozostaje identyczne, nic nie zmieniamy.


// ==========================================
// 🔹 POPRAWIONE LOGOWANIE W ONAUTHSTATECHANGED
// ==========================================
auth.onAuthStateChanged(async (user) => {
  const loginBox = document.getElementById("login-box");
  const adminWrapper = document.getElementById("admin-wrapper");

  if (user) {
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const data = userDoc.data();
      if (userDoc.exists && data && data.admin === true) {
        loginBox.style.display = "none";
        adminWrapper.style.display = "block";

        await loadTeams();
        await loadMatches();
        await loadTables();
        await loadScorersEditable();
      } else {
        // użytkownik nie jest adminem -> wyloguj
        await auth.signOut();
        loginBox.style.display = "block";
        adminWrapper.style.display = "none";
      }
    } catch (err) {
      console.error("Błąd sprawdzania uprawnień admina:", err);
      await auth.signOut();
      loginBox.style.display = "block";
      adminWrapper.style.display = "none";
    }
  } else {
    loginBox.style.display = "block";
    adminWrapper.style.display = "none";
  }
});

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
