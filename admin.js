// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  projectId: "puchargwiazd-bdaa4",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ✅ LOGOWANIE ADMINA
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;
  const msg = document.getElementById("login-msg");

  msg.textContent = "Logowanie...";

  try {
    const userCred = await auth.signInWithEmailAndPassword(email, pass);
    const uid = userCred.user.uid;

    const doc = await db.collection("users").doc(uid).get();

    if (!doc.exists || doc.data().admin !== true) {
      msg.textContent = "Brak uprawnień admina.";
      msg.className = "message error";
      await auth.signOut();
      return;
    }

    msg.textContent = "Zalogowano!";
    msg.className = "message success";

    document.getElementById("login-box").style.display = "none";
    document.getElementById("admin-wrapper").style.display = "block";

    loadMatches(); // ✅ Załaduj mecze po zalogowaniu
  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});

// ✅ TWORZENIE DRUŻYNY
document.getElementById("create-team-btn").addEventListener("click", async () => {
  const teamId = document.getElementById("team-id").value.trim();
  const email = document.getElementById("team-email").value.trim();
  const pass = document.getElementById("team-pass").value.trim();
  const msg = document.getElementById("team-msg");

  msg.textContent = "Tworzę drużynę...";

  if (!teamId || !email || !pass) {
    msg.textContent = "Wypełnij wszystkie pola!";
    msg.className = "message error";
    return;
  }

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

// ✅ NADAWANIE ADMINA
document.getElementById("grant-admin-btn").addEventListener("click", async () => {
  const email = document.getElementById("new-admin-email").value;
  const msg = document.getElementById("admin-msg");

  msg.textContent = "Szukam użytkownika...";

  try {
    const list = await auth.fetchSignInMethodsForEmail(email);

    if (list.length === 0) {
      msg.textContent = "Ten email nie ma jeszcze konta!";
      msg.className = "message error";
      return;
    }

    msg.textContent = "Użytkownik istnieje. Nadaję admina...";

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      await db.collection("users").doc(user.uid).set({ admin: true }, { merge: true });

      msg.textContent = "Dodano admina!";
      msg.className = "message success";
    });

    msg.textContent = "Kolega musi teraz zalogować się raz na panelu.";

  } catch (err) {
    msg.textContent = "Błąd: " + err.message;
    msg.className = "message error";
  }
});


// ✅🆕 SEKCJA: MECZE — DODAWANIE, EDYCJA, USUWANIE

// 🔹 Pobranie referencji HTML (jeśli dodałeś w panelu sekcję meczów)
const matchesContainer = document.createElement("section");
matchesContainer.innerHTML = `
  <h2>Zarządzanie meczami</h2>
  <div id="matches-form">
    <input id="match-group" placeholder="Grupa (np. A)">
    <input id="match-teamA" placeholder="Drużyna A (ID)">
    <input id="match-teamB" placeholder="Drużyna B (ID)">
    <input id="match-date" type="date">
    <input id="match-time" type="time">
    <button id="add-match-btn">➕ Dodaj mecz</button>
  </div>
  <div id="matches-list" class="info-box">Ładowanie meczów...</div>
`;
document.getElementById("admin-wrapper").appendChild(matchesContainer);

// 🔹 Dodanie nowego meczu
document.getElementById("add-match-btn").addEventListener("click", async () => {
  const group = document.getElementById("match-group").value.trim();
  const teamA = document.getElementById("match-teamA").value.trim();
  const teamB = document.getElementById("match-teamB").value.trim();
  const date = document.getElementById("match-date").value;
  const time = document.getElementById("match-time").value;

  if (!group || !teamA || !teamB || !date || !time) {
    alert("Uzupełnij wszystkie pola!");
    return;
  }

  await db.collection("matches").add({
    group, teamA, teamB, date, time,
    scoreA: 0,
    scoreB: 0,
    createdAt: new Date()
  });

  alert("✅ Mecz dodany!");
  loadMatches();
});

// 🔹 Wczytanie listy meczów
async function loadMatches() {
  const list = document.getElementById("matches-list");
  list.innerHTML = "Ładowanie meczów...";

  const snapshot = await db.collection("matches").orderBy("group").get();

  if (snapshot.empty) {
    list.innerHTML = "<p>Brak meczów.</p>";
    return;
  }

  list.innerHTML = "";

  snapshot.forEach(docSnap => {
    const m = docSnap.data();
    const matchDiv = document.createElement("div");
    matchDiv.className = "match-card";
    matchDiv.style = `
      border:1px solid #1e1e1e;
      border-radius:8px;
      padding:10px;
      margin:10px 0;
      background:#111;
    `;

    matchDiv.innerHTML = `
      <strong>Grupa ${m.group}</strong><br>
      ${m.teamA} vs ${m.teamB}<br>
      ${m.date} ${m.time}<br>
      <input type="number" id="scoreA-${docSnap.id}" value="${m.scoreA}" style="width:60px"> :
      <input type="number" id="scoreB-${docSnap.id}" value="${m.scoreB}" style="width:60px">
      <button onclick="saveMatch('${docSnap.id}')">💾 Zapisz</button>
      <button onclick="deleteMatch('${docSnap.id}')">🗑 Usuń</button>
    `;

    list.appendChild(matchDiv);
  });
}

// 🔹 Zapis wyniku meczu
async function saveMatch(id) {
  const scoreA = parseInt(document.getElementById(`scoreA-${id}`).value);
  const scoreB = parseInt(document.getElementById(`scoreB-${id}`).value);

  await db.collection("matches").doc(id).update({
    scoreA, scoreB
  });

  alert("✅ Wynik zapisany!");
}

// 🔹 Usuwanie meczu
async function deleteMatch(id) {
  if (confirm("Na pewno chcesz usunąć ten mecz?")) {
    await db.collection("matches").doc(id).delete();
    loadMatches();
  }
}
