// firebase_matches.js

// 1. KONFIGURACJA FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC6r04aG6T5EYqJ4OClraYU5Jr34ffONwo",
    authDomain: "puchargwiazd-bdaa4.firebaseapp.com",
    databaseURL: "https://puchargwiazd-bdaa4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "puchargwiazd-bdaa4",
    storageBucket: "puchargwiazd-bdaa4.firebasestorage.app",
    messagingSenderId: "890734185883",
    appId: "1:890734185883:web:4868b8bbf66c4bc7dfe53e"
};

// Inicjalizacja (sprawdzenie czy już nie istnieje)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const TEAMS_BASE_PATH = "teams/teams";
const MATCHES_PATH = "matches";

let teamsMap = {};

// 2. FUNKCJE POMOCNICZE

// Pobieranie nazw drużyn
function loadTeamNames() {
    return db.ref(TEAMS_BASE_PATH).once('value').then(snapshot => {
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([id, team]) => {
                teamsMap[id] = team.name || id;
            });
        }
    });
}

// Renderowanie listy meczów
function renderMatches(matches) {
    const upcomingContainer = document.getElementById('upcoming-matches');
    const recentContainer = document.getElementById('recent-results');

    if (!upcomingContainer || !recentContainer) return;

    upcomingContainer.innerHTML = '<h3><i class="fas fa-calendar-alt"></i> Nadchodzące Mecze</h3>';
    recentContainer.innerHTML = '<h3><i class="fas fa-trophy"></i> Ostatnie Wyniki</h3>';

    const upcoming = [];
    const recent = [];
    const live = [];

    Object.values(matches).forEach(match => {
        match.teamAName = teamsMap[match.teamA] || match.teamA;
        match.teamBName = teamsMap[match.teamB] || match.teamB;

        if (match.status === 'scheduled') {
            upcoming.push(match);
        } else if (match.status === 'finished') {
            recent.push(match);
        } else if (match.status === 'live') {
            live.push(match);
        }
    });

    const displayRecent = [...live, ...recent.slice(-5)].reverse();
    const displayUpcoming = [...live, ...upcoming.slice(0, 5)];

    if (displayUpcoming.length > 0) {
        displayUpcoming.forEach(match => {
            upcomingContainer.innerHTML += createMatchHtml(match);
        });
    } else {
        upcomingContainer.innerHTML += '<p style="text-align: center; color: #888;">Brak zaplanowanych meczów.</p>';
    }

    if (displayRecent.length > 0) {
        displayRecent.forEach(match => {
            recentContainer.innerHTML += createMatchHtml(match);
        });
    } else {
        recentContainer.innerHTML += '<p style="text-align: center; color: #888;">Brak ostatnich wyników.</p>';
    }
}

// Generowanie HTML dla pojedynczego meczu
function createMatchHtml(match) {
    const statusClass = match.status;
    let scoreContent;

    if (match.status === 'finished' || match.status === 'live') {
        scoreContent = `${match.scoreA} - ${match.scoreB}`;
    } else {
        scoreContent = `vs`;
    }

    const statusText = {
        'scheduled': 'Zaplanowany',
        'live': 'NA ŻYWO',
        'finished': 'ZAKOŃCZONY'
    }[match.status] || match.status;

    return `
        <div class="match-item">
            <span class="team-name" style="text-align: right;">${match.teamAName}</span>
            
            <div class="score-box-container">
                ${scoreContent}
            </div>

            <span class="team-name" style="text-align: left;">${match.teamBName}</span>
            
            <span class="status-tag ${statusClass}">${statusText} (Gr. ${match.group})</span>
        </div>
    `;
}

// 3. START APLIKACJI (Uruchomienie po załadowaniu nazw drużyn)
loadTeamNames().then(() => {
    db.ref(MATCHES_PATH).on('value', snapshot => {
        const matchesData = snapshot.val();
        if (matchesData) {
            renderMatches(matchesData);
        } else {
            const upEl = document.getElementById('upcoming-matches');
            const reEl = document.getElementById('recent-results');
            if(upEl) upEl.innerHTML = '<h3><i class="fas fa-calendar-alt"></i> Nadchodzące Mecze</h3><p style="text-align: center;">Brak danych meczowych.</p>';
            if(reEl) reEl.innerHTML = '<h3><i class="fas fa-trophy"></i> Ostatnie Wyniki</h3><p style="text-align: center;">Brak danych meczowych.</p>';
        }
    });
}).catch(error => {
    console.error("Błąd ładowania danych początkowych: ", error);
    const upEl = document.getElementById('upcoming-matches');
    const reEl = document.getElementById('recent-results');
    if(upEl) upEl.innerHTML = '<p style="color: red; text-align: center;">Błąd ładowania danych.</p>';
    if(reEl) reEl.innerHTML = '<p style="color: red; text-align: center;">Błąd ładowania danych.</p>';
});