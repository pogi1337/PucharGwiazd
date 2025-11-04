import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

async function login(email, password) {
  const auth = getAuth();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 🔹 Wymuś odświeżenie tokena
    const idTokenResult = await user.getIdTokenResult(true);

    console.log("✅ Zalogowano jako:", user.email);
    console.log("📦 Custom claims:", idTokenResult.claims);

    if (idTokenResult.claims.admin) {
      alert("Jesteś ADMINEM 🧑‍💼");
    } else if (idTokenResult.claims.role === "teamManager") {
      alert(`Zalogowano jako drużyna: ${idTokenResult.claims.teamId}`);
    } else {
      alert("❌ Nie masz uprawnień — brak claimów");
    }

  } catch (error) {
    console.error("Błąd logowania:", error);
  }
}


// Funkcja logowania użytkownika (np. drużyny)
async function login(email, password) {
  const auth = getAuth();

  try {
    // 🔹 Logowanie użytkownika
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("Zalogowano jako:", user.email);

    // 🔹 Wymuszenie odświeżenia tokena (żeby pobrać aktualne uprawnienia)
    await user.getIdToken(true);

    console.log("✅ Token odświeżony — użytkownik ma aktualne uprawnienia!");

    // 🔹 Pobranie claimów (opcjonalne)
    const idTokenResult = await user.getIdTokenResult();
    console.log("Custom claims:", idTokenResult.claims);

    // 🔹 Przekierowanie po zalogowaniu
    if (idTokenResult.claims.role === "teamManager") {
      console.log("Witaj, menedżerze drużyny!");
      // np. window.location.href = "/panel-druzyny";
    } else if (idTokenResult.claims.admin === true) {
      console.log("Witaj, adminie!");
      // np. window.location.href = "/admin";
    } else {
      alert("Nie masz uprawnień do tego panelu.");
    }

  } catch (error) {
    console.error("❌ Błąd logowania:", error.code, error.message);
    alert("Błąd logowania: " + error.message);
  }
}

// 🔸 Przykład użycia (np. po kliknięciu przycisku „Zaloguj”)
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await login(email, password);
});
// Funkcja do ustawiania uprawnień admina (wywoływana przez Ciebie raz)
exports.setAdmin = functions.https.onCall(async (data, context) => {
  // Zabezpieczenie — tylko inny admin może ustawić admina
  if (!context.auth || context.auth.token.admin !== true) {
    return { success: false, error: 'Brak uprawnień (musisz być adminem)' };
  }

  const { email } = data;
  if (!email) {
    return { success: false, error: 'Nie podano adresu e-mail' };
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    return { success: true, message: `Użytkownik ${email} został ustawiony jako admin.` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

