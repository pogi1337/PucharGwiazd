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

  } catch (err) {
    msg.textContent = "Błąd logowania: " + err.message;
    msg.className = "message error";
  }
});

// ✅ TWORZENIE DRUŻYNY
document.getElementById("create-team-btn").addEventListener("click", async () => {
  const teamId = document.getElementById("team-id").value;
  const email = document.getElementById("team-email").value;
  const pass = document.getElementById("team-pass").value;
  const msg = document.getElementById("team-msg");

  msg.textContent = "Tworzę konto...";

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);

    await db.collection("users").doc(cred.user.uid).set({
      role: "teamManager",
      teamId: teamId
    });

    msg.textContent = "Drużyna utworzona!";
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
        // ✅ 1) Tworzymy konto użytkownika
        const cred = await auth.createUserWithEmailAndPassword(email, pass);

        // ✅ 2) Dodajemy użytkownika jako manager drużyny
        await db.collection("users").doc(cred.user.uid).set({
            role: "teamManager",
            teamId: teamId
        });

        // ✅ 3) ZAPISUJEMY DRUŻYNĘ W KOLEKCJI
        await db.collection("teams").doc(teamId).set({
            name: teamId,           // ⭐ tu ustawiasz nazwę drużyny
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


