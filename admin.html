<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Panel Administratora</title>

    <!-- !!! KROK 1: Upewniamy się, że plik CSS jest poprawnie zaimportowany !!! -->
    <link rel="stylesheet" href="admin.css" />

    <!-- Firebase SDK (Starsza wersja jest potrzebna do niektórych kompatybilności, ale JS używa V11) -->
    <script src="https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore-compat.js"></script>
    
    <!-- Do ikon Font Awesome (dla lepszej estetyki) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

    <style>
        /* Styl bezpieczeństwa: ukrywa panel, dopóki JS nie potwierdzi, że to admin */
        #admin-wrapper {
            display: none;
        }
    </style>
</head>

<body>

    <!-- ============================= -->
    <!-- 1. OKNO LOGOWANIA -->
    <!-- ============================= -->
    <div class="container" id="login-box">
        <h2>🔐 Logowanie Admina</h2>
        <input id="login-email" type="email" placeholder="Email">
        <input id="login-pass" type="password" placeholder="Hasło">
        <button id="login-btn">Zaloguj</button>
        <!-- Element komunikatu do funkcji showMessage() (ID: login-msg jest kluczowe dla admin.js) -->
        <div id="login-msg" class="message"></div>
    </div>

    <!-- ============================= -->
    <!-- 2. PANEL WŁAŚCIWY (UKRYTY DOMYŚLNIE) -->
    <!-- ============================= -->
    <div class="panel" id="admin-wrapper">
        
        <div style="text-align: right; padding: 10px;">
            <button onclick="firebase.auth().signOut()">🚪 Wyloguj</button>
        </div>

        <!-- A. TWORZENIE DRUŻYNY -->
        <section>
            <h3>➕ Tworzenie drużyny</h3>
            <div class="form-row">
                <input id="team-id" placeholder="Nazwa drużyny">
                <input id="team-email" type="email" placeholder="Email kapitana">
                <button id="create-team-btn">Utwórz drużynę</button>
            </div>
            <!-- ID: team-msg nie jest używane bezpośrednio przez admin.js, ale jest dobrym zwyczajem -->
            <div id="team-msg" class="message"></div> 
        </section>

        <!-- B. ZARZĄDZANIE MECZAMI -->
        <section>
            <h3>⚽ Zarządzanie meczami</h3>
            
            <!-- Dodawanie nowego meczu -->
            <div class="form-row match-creation-row">
                <select id="teamA"></select>
                <span>VS</span>
                <select id="teamB"></select>
                <input id="group" placeholder="Grupa (np. A)" style="width: 80px;">
                <input id="match-date" type="date">
                <input id="match-time" type="time">
                <button id="add-match-btn" style="background-color: #00bfff;">Dodaj Mecz</button>
            </div>

            <!-- Filtr i Lista -->
            <hr style="border-color: #1e3a5f; margin: 20px 0;">
            <div style="margin-bottom: 20px;">
                <label style="color: #00bfff;">Filtruj status:</label>
                <select id="match-status-filter" style="width: auto;">
                    <option value="wszyscy">Wszystkie mecze</option>
                    <option value="planowany">Planowane</option>
                    <option value="trwa">Na Żywo</option>
                    <option value="zakończony">Zakończone</option>
                </select>
            </div>
            
            <!-- Lista meczów będzie ładowana tutaj przez loadMatches() -->
            <div id="matches-list"></div>
        </section>

        <!-- C. KLASYFIKACJA STRZELCÓW -->
        <section>
            <h3>🏆 Król Strzelców (Globalna Tabela)</h3>
            
            <div class="form-row" style="margin-bottom: 20px;">
                <input id="scorer-name" placeholder="Nazwisko">
                <select id="scorer-team"></select>
                <input id="scorer-goals" type="number" placeholder="Gole" style="width: 80px;">
                <button id="add-scorer-btn" style="background-color: #007bff;">Dodaj ręcznie</button>
            </div>

            <div class="table-wrapper">
                <table id="scorers-table">
                    <thead>
                        <tr>
                            <th>Zawodnik</th>
                            <th>Drużyna</th>
                            <th>Bramki</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <!-- Tabela będzie ładowana przez loadGlobalScorers() -->
                    <tbody></tbody>
                </table>
            </div>
            <!-- ID: scorer-msg nie jest używane bezpośrednio przez admin.js, ale jest dobrym zwyczajem -->
            <div id="scorer-msg" class="message"></div>
        </section>

        <!-- D. NADAWANIE ADMINA -->
        <section>
            <h3>🛡 Nadaj Admina</h3>
            <div class="form-row">
                <input id="new-admin-email" type="email" placeholder="Email użytkownika">
                <button id="grant-admin-btn" style="background-color: #00bfff;">Nadaj uprawnienia</button>
            </div>
            <div id="admin-msg" class="message"></div>
        </section>

    </div>

    <!-- KLUCZOWE: Skrypt jest ładowany na końcu i musi mieć type="module" -->
    <script src="admin.js" type="module"></script> 

</body>
</html>
