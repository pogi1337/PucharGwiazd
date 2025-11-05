// ================================================
// ✅ Frontend Firebase - Logowanie + Role + Routing
// ================================================

// Konfiguracja Firebase (WSTAW TU SWOJE DANE Z KONSOLI FIREBASE)
const firebaseConfig = {
  apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
  authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
  databaseURL: "https://puchargwiazd-bdaa4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "puchargwiazd-bdaa4",
  storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
  messagingSenderId: "890734185883",
  appId: "1:890734185883:web:4868b8bbf66c4bc7dfe53e"
};

// Start Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================================================
// ✅ LOGOWANIE UŻYTKOWNIKA
// ================================================

async function loginUser() {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    try {
        const userCred = await auth.signInWithEmailAndPassword(email, pass);
        const user = userCred.user;

        console.log("✅ Zalogowano:", user.uid);

        // Teraz pobieramy role z Firestore
        const doc = await db.collection("users").doc(user.uid).get();

        if (!doc.exists) {
            alert("❌ Twoje konto nie ma przypisanej roli.");
            return;
        }

        const data = doc.data();

        // ============================================
        // ✅ ROUTING NA PODSTAWIE ROLI
        // ============================================

        if (data.admin === true) {
            window.location.href = "admin.html";
        } else if (data.teamId && data.teamId !== "") {
            // przekazujemy teamId do adresu
            window.location.href = `team.html?team=${data.teamId}`;
        } else {
            alert("❌ Nie masz dostępu do panelu.");
        }

    } catch (error) {
        alert("❌ Błąd logowania: " + error.message);
    }
}

window.loginUser = loginUser; // umożliwia wywołanie z HTML

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicjalizacja Firebase Admin SDK
admin.initializeApp();

// ======================================================
// 1️⃣ Funkcja: Tworzenie użytkownika drużyny (team manager)
// ======================================================

exports.createTeamUser = functions.https.onCall(async (data, context) => {
  // Sprawdzenie, czy wywołujący ma uprawnienia admina
  if (!context.auth || context.auth.token.admin !== true) {
    return {
      success: false,
      error: "Brak uprawnień administracyjnych do tworzenia kont.",
    };
  }

  const { teamId, email, password } = data;

  if (!teamId || !email || !password || password.length < 6) {
    return {
      success: false,
      error:
        "Nieprawidłowe dane wejściowe (wymagane ID drużyny, email i hasło min. 6 znaków).",
    };
  }

  try {
    // Utworzenie użytkownika w Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: teamId,
      emailVerified: true,
    });

    // Ustawienie niestandardowych claimów (rola drużyny)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      teamId: teamId,
      role: "teamManager",
    });

    return {
      success: true,
      message: `Konto dla drużyny ${teamId} zostało utworzone pomyślnie.`,
    };
  } catch (error) {
    console.error("Błąd tworzenia użytkownika:", error);
    return {
      success: false,
      error: error.message || "Nieznany błąd serwera.",
    };
  }
});

// ======================================================
// 2️⃣ Funkcja: Nadawanie uprawnień administratora
// ======================================================

exports.setAdminRole = functions.https.onCall(async (data, context) => {
  // Sprawdź, czy użytkownik wywołujący ma rolę admina
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Tylko administrator może nadawać role."
    );
  }

  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Adres e-mail jest wymagany."
    );
  }

  try {
    // Pobranie użytkownika po adresie e-mail
    const user = await admin.auth().getUserByEmail(email);

    // Nadanie roli administratora
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return { message: `Użytkownik ${email} został administratorem.` };
  } catch (error) {
    console.error("Błąd nadawania uprawnień:", error);
    throw new functions.https.HttpsError("unknown", error.message);
  }
});
// ======================================================
// 3️⃣ Tymczasowa funkcja: jednorazowe nadanie roli admina
// ======================================================

exports.makeMeAdmin = functions.https.onRequest(async (req, res) => {
  const email = "kacpernwm77@gmail.com"; // <<< WAŻNE !!!

  try {
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return res.send(`✅ Użytkownik ${email} został administratorem.`);
  } catch (err) {
    console.error(err);
    return res.send("❌ Błąd: " + err.message);
  }
});

