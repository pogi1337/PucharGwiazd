import admin from "firebase-admin";
import serviceAccount from "./puchargwiazd-bdaa4-firebase-adminsdk-XXXX.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://puchargwiazd-bdaa4-default-rtdb.europe-west1.firebasedatabase.app"
});

const email = process.argv[2];  // np. node setCaptain.js email@wp.pl TEAM01
const teamId = process.argv[3];

if (!email || !teamId) {
    console.log("Użycie: node setCaptain.js email teamId");
    process.exit();
}

async function setCaptain() {
    try {
        const user = await admin.auth().getUserByEmail(email);

        await admin.auth().setCustomUserClaims(user.uid, {
            role: "captain",
            teamId: teamId
        });

        console.log(`✅ Kapitan ustawiony!`);
        console.log(`Email: ${email}`);
        console.log(`TeamID: ${teamId}`);
    } catch (err) {
        console.error("❌ Błąd:", err);
    }
}

setCaptain();
