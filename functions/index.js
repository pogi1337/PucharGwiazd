// ================================================
// 🔥 Firebase Cloud Functions - Panel Admina
// ================================================

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
