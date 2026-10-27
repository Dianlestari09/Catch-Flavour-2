/* =========================================
   1. KONFIGURASI & VARIABEL
   ========================================= */
const TOTAL_TIME = 15;
const PREVIEW_TIME = 2000;

const FLAVOURS = [
    'nanas.png', 'kopi.png', 'apel.png', 'mangga.png',
    'madu.png', 'kayu_manis.png', 'cengkeh.png', 'cengkeh.png'
];
const ITEM_COLORS = {
    'nanas.png': '#AE85C6',      // Ungu Medium
    'kopi.png': '#FB84AC',       // Pink
    'madu.png': '#F06354',       // Merah Coral
    'cengkeh.png': '#FDE161',    // Kuning Emas
    'apel.png': '#A7D054',       // Hijau Muda
    'kayu_manis.png': '#8FA13A', // Hijau Olive
    'tembakau.png': '#D09EE1',   // Ungu Muda (Lavender)
    'mangga.png': '#FDCFA4'      // Persik (Peach)
};

const gameChannel = new BroadcastChannel('flavour_game_channel');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let currentScore = 0;
let timerInterval;
let timeLeft = TOTAL_TIME;
let isLocked = false;
let audioInitialized = false;
let currentPlayerName = "";

// Auto-load leaderboard saat page load jika user sedang viewing leaderboard
window.addEventListener('load', function() {
    if (localStorage.getItem('viewingLeaderboard') === 'true') {
        displayLeaderboard();
        showScreen('finish-screen');
    }
});

// =========================================
// 2. SISTEM AUDIO
// =========================================
const audio = {
    bgmMenu: document.getElementById('bgm-menu'),
    bgmGame: document.getElementById('bgm-game'),
    click: document.getElementById('sfx-click'),
    flip: document.getElementById('sfx-flip'),
    sparkle: document.getElementById('sfx-sparkle'), // Audio Benar
    boom: document.getElementById('sfx-boom'),       // Audio Salah
    win: document.getElementById('sfx-win'),
    over: document.getElementById('sfx-over'),
    countdown: document.getElementById('sfx-countdown')
};

if (audio.bgmMenu) audio.bgmMenu.volume = 0.5;
if (audio.bgmGame) audio.bgmGame.volume = 0.3;

window.addEventListener('load', initAudio);
document.addEventListener('click', () => {
    if (!audioInitialized) initAudio();
}, { once: true });

function initAudio() {
    if (!audioInitialized && audio.bgmMenu) {
        var promise = audio.bgmMenu.play();
        if (promise !== undefined) {
            promise.then(_ => { audioInitialized = true; }).catch(error => { });
        }
    }
}

function playBGM(type) {
    if (!audio.bgmMenu) return;
    audio.bgmMenu.pause(); audio.bgmMenu.currentTime = 0;
    audio.bgmGame.pause(); audio.bgmGame.currentTime = 0;
    if (type === 'menu') audio.bgmMenu.play().catch(e => { });
    if (type === 'game') audio.bgmGame.play().catch(e => { });
}

function playSFX(type) {
    if (audio[type]) {
        audio[type].currentTime = 0;
        audio[type].play().catch(e => { });
    }
}

// =========================================
// 3. NAVIGASI LAYAR
// =========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
    }
}

function toMainMenu() {
    playSFX('click');
    playBGM('menu');
    document.getElementById('player-name-input').value = "";
    localStorage.removeItem('viewingLeaderboard');
    showScreen('menu-screen');
}

function viewLeaderboard() {
    playSFX('click');
    localStorage.setItem('viewingLeaderboard', 'true');
    displayLeaderboard();
    showScreen('finish-screen');
}

function startGame() {
    initAudio();
    const inputField = document.getElementById('player-name-input');
    const name = inputField.value.trim();

    if (!name) {
        alert("Silakan masukkan nama dulu!");
        inputField.focus();
        return;
    }

    currentPlayerName = name;
    playSFX('click');
    playBGM('game');

    // Reset Game
    matchedPairs = 0;
    currentScore = 0;
    timeLeft = TOTAL_TIME;
    flippedCards = [];
    isLocked = true;

    document.getElementById('timer-display').innerText = timeLeft + "s";
    document.getElementById('timer-display').classList.remove('timer-danger');
    document.getElementById('score-display').innerText = "0";
    document.getElementById('status-msg').innerText = "Hafalkan Posisi!";

    createBoard();
    showScreen('game-screen');
    revealBoard();
}

// =========================================
// 4. GAMEPLAY LOGIC
// =========================================
function createBoard() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    let gameItems = [...FLAVOURS, ...FLAVOURS];
    gameItems.sort(() => Math.random() - 0.5);

    gameItems.forEach(item => {
        const bgColor = ITEM_COLORS[item] || '#fff';
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.value = item;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="assets/images/25th.png" class="card-cover-img" alt="25th">
                </div>
                <div class="card-back" style="background-color: ${bgColor};">
                    <img src="assets/images/${item}" alt="Img" class="card-img" onerror="this.style.display='none'">
                </div>
            </div>`;
        card.addEventListener('click', flipCard);
        grid.appendChild(card);
    });
}

function revealBoard() {
    const allCards = document.querySelectorAll('.card');
    setTimeout(() => { allCards.forEach(card => card.classList.add('flipped')); playSFX('flip'); }, 500);
    setTimeout(() => {
        allCards.forEach(card => card.classList.remove('flipped'));
        isLocked = false;
        document.getElementById('status-msg').innerText = "";
        playSFX('flip');
        startTimer();
    }, PREVIEW_TIME + 500);
}

function flipCard() {
    if (isLocked) return;
    if (this.classList.contains('flipped')) return;

    playSFX('flip');
    this.classList.add('flipped');
    flippedCards.push(this);
    if (flippedCards.length === 2) checkMatch();
}

// --- CHECK MATCH DENGAN VISUAL BARU ---
function checkMatch() {
    isLocked = true;
    const [card1, card2] = flippedCards;

    if (card1.dataset.value === card2.dataset.value) {
        // === JIKA BENAR (Sparkling + Cring) ===
        setTimeout(() => {
            playSFX('sparkle');

            spawnSparkles(card1);
            spawnSparkles(card2);

            card1.classList.add('matched');
            card2.classList.add('matched');

            matchedPairs++;
            currentScore += 1000;
            updateScoreUI();

            flippedCards = [];
            isLocked = false;

            if (matchedPairs === FLAVOURS.length) endGame(true);
        }, 300);

    } else {
        // === JIKA SALAH (Fire + Boom + Hangus) ===
        setTimeout(() => {
            playSFX('boom');

            spawnFire(card1);
            spawnFire(card2);

            card1.classList.add('burnt');
            card2.classList.add('burnt');

            currentScore -= 500;
            updateScoreUI();
        }, 300);

        setTimeout(() => {
            card1.classList.remove('flipped', 'burnt');
            card2.classList.remove('flipped', 'burnt');
            flippedCards = [];
            isLocked = false;
        }, 1200);
    }
}

// --- FUNGSI 1: BINTANG (MENYEBAR KE SEGALA ARAH) ---
function spawnSparkles(targetElement) {
    const container = document.getElementById('particles-container');
    const gameRect = document.getElementById('game-container').getBoundingClientRect();
    const cardRect = targetElement.getBoundingClientRect();

    // Perbaikan Koordinat: Hitung posisi relatif terhadap container game
    const centerX = (cardRect.left - gameRect.left) + (cardRect.width / 2);
    const centerY = (cardRect.top - gameRect.top) + (cardRect.height / 2);

    for (let i = 0; i < 20; i++) {
        const sparkle = document.createElement('div');
        sparkle.classList.add('sparkle');
        sparkle.style.left = centerX + 'px';
        sparkle.style.top = centerY + 'px';

        // Arah menyebar melingkar
        const angle = Math.random() * Math.PI * 2;
        const velocity = 80 + Math.random() * 80; // Jarak ledakan
        const tx = Math.cos(angle) * velocity + 'px';
        const ty = Math.sin(angle) * velocity + 'px';

        sparkle.style.setProperty('--tx', tx);
        sparkle.style.setProperty('--ty', ty);
        sparkle.style.filter = `hue-rotate(${Math.random() * 60}deg)`;
        sparkle.style.animation = `sparkle-anim 0.6s ease-out forwards`;

        container.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 600);
    }
}

// --- FUNGSI 2: API (BERGERAK KE ATAS) ---
function spawnFire(targetElement) {
    const container = document.getElementById('particles-container');
    const gameRect = document.getElementById('game-container').getBoundingClientRect();
    const cardRect = targetElement.getBoundingClientRect();

    const centerX = (cardRect.left - gameRect.left) + (cardRect.width / 2);
    const centerY = (cardRect.top - gameRect.top) + (cardRect.height / 2);

    for (let i = 0; i < 15; i++) {
        const ember = document.createElement('div');
        ember.classList.add('ember');

        // Random offset horizontal dikit
        const offsetX = (Math.random() - 0.5) * 40;
        ember.style.left = (centerX + offsetX) + 'px';
        ember.style.top = (centerY + 20) + 'px';

        // Gerak ke atas
        const tx = (Math.random() - 0.5) * 50 + 'px';
        ember.style.setProperty('--tx', tx);

        const duration = 0.5 + Math.random() * 0.5;
        ember.style.animation = `fire-anim ${duration}s ease-out forwards`;

        container.appendChild(ember);
        setTimeout(() => ember.remove(), duration * 1000);
    }
}

function updateScoreUI() {
    const scoreDisplay = document.getElementById('score-display');
    scoreDisplay.innerText = currentScore;
    scoreDisplay.style.color = currentScore < 0 ? '#ff4444' : '#fff';
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        const display = document.getElementById('timer-display');
        const gameContainer = document.getElementById('game-container');

        display.innerText = timeLeft + "s";

        if (timeLeft <= 3 && timeLeft > 0) {
            display.classList.add('timer-danger');
            gameContainer.classList.add('panic-mode');
            if (audio.countdown) {
                audio.countdown.currentTime = 0;
                audio.countdown.volume = 1.0;
                audio.countdown.play().catch(e => { });
                setTimeout(() => { audio.countdown.pause(); }, 800);
            }
        }
        if (timeLeft <= 0) endGame(false);
    }, 1000);
}

function endGame(isWin) {
    clearInterval(timerInterval);
    audio.bgmGame.pause();
    if (audio.countdown) {
        audio.countdown.pause();
        audio.countdown.currentTime = 0;
    }

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.classList.remove('panic-mode');
    document.getElementById('timer-display').classList.remove('timer-danger');

    let finalTotalScore = isWin ? (currentScore + (timeLeft * 100)) : currentScore;

    if (isWin) {
        playSFX('win');
    } else {
        playSFX('over');
    }

    autoSaveScore(finalTotalScore);
    displayLeaderboard();
    setTimeout(() => { showScreen('finish-screen'); }, 1000);
}

function displayLeaderboard() {
    const db = JSON.parse(localStorage.getItem('flavourGameLeaderboard')) || [];
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';

    if (db.length === 0) {
        return;
    }

    // Urutkan dari tertinggi ke terendah dan ambil top 10
    const sorted = db.sort((a, b) => b.score - a.score).slice(0, 10);
    
    sorted.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        
        row.innerHTML = `
            <span class="leaderboard-name">${entry.name}</span>
            <span class="leaderboard-score">${entry.score}</span>
        `;
        leaderboardList.appendChild(row);
    });
}

function autoSaveScore(score) {
    const name = currentPlayerName || "Anonim";
    let db = JSON.parse(localStorage.getItem('flavourGameLeaderboard')) || [];
    db.push({ name, score });
    db.sort((a, b) => b.score - a.score);
    db = db.slice(0, 10);
    localStorage.setItem('flavourGameLeaderboard', JSON.stringify(db));
    gameChannel.postMessage('update_leaderboard');
}

function resetLeaderboard() {
    if (confirm('Yakin hapus semua data leaderboard?')) {
        localStorage.removeItem('flavourGameLeaderboard');
        displayLeaderboard();
    }
}