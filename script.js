// Dark mode toggle
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

function setTheme(isDarkMode) {
    if (isDarkMode) {
        body.classList.add('dark-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.remove('dark-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
}

// Apply saved theme on load or default to system preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme === 'dark');
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme(true);
} else {
    setTheme(false);
}

themeToggleBtn.addEventListener('click', () => {
    setTheme(!body.classList.contains('dark-mode'));
});

// Current Time Display (for pages that need it)
const currentTimeElement = document.getElementById('current-time');
if (currentTimeElement) {
    function updateTime() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        currentTimeElement.innerHTML = `<i class="fa-solid fa-clock"></i> ${now.toLocaleDateString('pl-PL', options)}`;
    }
    updateTime();
    setInterval(updateTime, 1000);
}

// Countdown (for pages that need it, e.g., index.html, druzyny.html)
const countdownElement = document.getElementById('countdown');
if (countdownElement) {
    // Set the date we're counting down to (July 14, 2026, 00:00:00 CEST)
    const countDownDate = new Date("Jul 14, 2026 00:00:00 GMT+0200").getTime(); // Adjust for Poland's timezone (CEST)

    const x = setInterval(function() {
        const now = new Date().getTime();
        const distance = countDownDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.innerHTML = `<div>${days}<span>Dni</span></div>` +
                                     `<div>${hours}<span>Godzin</span></div>` +
                                     `<div>${minutes}<span>Minut</span></div>` +
                                     `<div>${seconds}<span>Sekund</span></div>`;

        if (distance < 0) {
            clearInterval(x);
            countdownElement.innerHTML = "Następny Turniej Już Trwa!";
        }
    }, 1000);
}

// Team Roster Toggle (specific to druzyny.html)
document.addEventListener('DOMContentLoaded', () => {
    const teamNames = document.querySelectorAll('.team-name');

    teamNames.forEach(teamName => {
        teamName.addEventListener('click', () => {
            const teamCard = teamName.closest('.team-card');
            const teamRoster = teamCard.querySelector('.team-roster');
            const expandIcon = teamName.querySelector('.expand-icon');

            teamRoster.classList.toggle('active');
            expandIcon.classList.toggle('fa-chevron-down');
            expandIcon.classList.toggle('fa-chevron-up');
        });
    });
});