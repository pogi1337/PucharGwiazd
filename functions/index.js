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
