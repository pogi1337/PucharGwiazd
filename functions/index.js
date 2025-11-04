// Kod w pliku functions/index.js

exports.setAdmin = functions.https.onCall(async (data, context) => {
  // (opcjonalnie) zabezpieczenie: tylko admin może nadawać innym admina
  // jeśli to Twój pierwszy admin, możesz tymczasowo to wyłączyć
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musisz być zalogowany.");
  }

  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Podaj email użytkownika, któremu chcesz nadać admina.");
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    return { success: true, message: `Użytkownik ${email} jest teraz administratorem.` };
  } catch (error) {
    console.error("Błąd ustawiania admina:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});


const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicjalizacja Admin SDK (upewnij się, że jest włączona w Twoim projekcie)
admin.initializeApp(); 

// Funkcja wywoływana z panelu admina do tworzenia konta drużyny
exports.createTeamUser = functions.https.onCall(async (data, context) => {
    // 1. Sprawdzenie, czy funkcja jest wywoływana przez administratora
    // To wymaga, by Admin miał w tokenie 'admin: true' (ustawiane przez admina w jego tokenie)
    if (!context.auth || context.auth.token.admin !== true) {
        return { success: false, error: 'Błąd: Brak uprawnień administracyjnych do tworzenia kont.' };
    }

    const { teamId, email, password } = data;

    if (!teamId || !email || !password || password.length < 6) {
        return { success: false, error: 'Nieprawidłowe dane wejściowe (wymagane ID, email i hasło min. 6 znaków).' };
    }

    try {
        // 2. Utworzenie Użytkownika w Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: teamId, // Nazwa wyświetlana to ID drużyny
            emailVerified: true,
        });

        // 3. Ustawienie niestandardowego Claim'u (przypisanie roli/drużyny)
        // Dzięki temu będziemy wiedzieć, która drużyna się zalogowała
        await admin.auth().setCustomUserClaims(userRecord.uid, { 
            teamId: teamId, 
            role: 'teamManager' 
        });

        return { 
            success: true, 
            message: `Konto dla ${teamId} utworzone pomyślnie.` 
        };

    } catch (error) {
        console.error("Błąd tworzenia użytkownika:", error);
        return { success: false, error: error.message || 'Nieznany błąd serwera.' };
    }

});
