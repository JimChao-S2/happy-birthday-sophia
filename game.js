const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreDisplay = document.getElementById('score-display');
const currentScoreDisplay = document.getElementById('current-score');
const highScoreDisplay = document.getElementById('high-score');
const deathReasonDisplay = document.getElementById('death-reason');

let gameState = 'START';
let score = 0;
let highScore = localStorage.getItem('guangzhou_jump_high_score') || 0;
let cameraY = 0;
let frameCount = 0;

let gyroActive = false;
let tilt = 0;

function handleOrientation(event) {
    let gamma = event.gamma;
    if (gamma > 90) gamma = 90;
    if (gamma < -90) gamma = -90;
    tilt = gamma;
    gyroActive = true;
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Audio System (Web Audio API) ---
let audioCtx;
const bgm = new Audio();
bgm.loop = true;
bgm.volume = 0.4;

// Preload audio to prevent delay on first start
startBtn.disabled = true;
startBtn.innerText = '🎶 音樂載入中...';
startBtn.style.opacity = '0.5';

fetch('assets/bgm.mp3')
    .then(response => response.blob())
    .then(blob => {
        bgm.src = URL.createObjectURL(blob);
        startBtn.disabled = false;
        startBtn.innerText = '開始遊戲';
        startBtn.style.opacity = '1';
    })
    .catch(err => {
        console.error('Audio load failed:', err);
        startBtn.disabled = false;
        startBtn.innerText = '開始遊戲 (無音樂)';
        startBtn.style.opacity = '1';
    });

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (bgm.src) {
        let playPromise = bgm.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log('BGM play failed:', e));
        }
    }
}

function playTone(freq, type, duration, vol, slideFreq) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, audioCtx.currentTime + duration);
    }
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    jump: () => playTone(400, 'sine', 0.15, 0.05, 600),
    break: () => playTone(150, 'sawtooth', 0.2, 0.1, 50),
    powerup: () => {
        playTone(500, 'square', 0.1, 0.05);
        setTimeout(() => playTone(700, 'square', 0.1, 0.05), 100);
        setTimeout(() => playTone(900, 'square', 0.2, 0.05), 200);
    },
    cake: () => {
        playTone(300, 'square', 0.1, 0.05);
        setTimeout(() => playTone(400, 'square', 0.1, 0.05), 100);
        setTimeout(() => playTone(500, 'square', 0.1, 0.05), 200);
        setTimeout(() => playTone(800, 'square', 0.3, 0.05, 1200), 300);
    },
    hit: () => playTone(200, 'sawtooth', 0.3, 0.1, 100),
    die: () => {
        playTone(300, 'triangle', 0.2, 0.1, 200);
        setTimeout(() => playTone(200, 'triangle', 0.4, 0.1, 50), 200);
    }
};

// --- Background Drawing (Guangzhou Skyline) ---
function drawBackground() {
    ctx.fillStyle = '#ffecd2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Sun
    ctx.fillStyle = 'rgba(255, 200, 100, 0.4)';
    ctx.beginPath();
    ctx.arc(canvas.width - 50, 100, 60, 0, Math.PI * 2);
    ctx.fill();

    // Draw Canton Tower (Abstract)
    ctx.save();
    let bgOffset = (cameraY * 0.2) % canvas.height;
    ctx.translate(canvas.width / 2, canvas.height - bgOffset + 200);
    
    // Base
    ctx.fillStyle = 'rgba(200, 150, 150, 0.2)';
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.quadraticCurveTo(-10, -200, -10, -300);
    ctx.lineTo(10, -300);
    ctx.quadraticCurveTo(10, -200, 50, 0);
    ctx.fill();
    
    // Spire
    ctx.fillRect(-2, -450, 4, 150);
    // Rings
    ctx.beginPath();
    ctx.ellipse(0, -150, 20, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(0, -250, 15, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(0, -300, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// --- Particles ---
class Particle {
    constructor(x, y, text, color, vx, vy, life) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 10 + 15;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}
let particles = [];
function spawnParticles(x, y, text, color, count) {
    for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 6;
        let vy = (Math.random() - 0.5) * 6 - 2;
        particles.push(new Particle(x, y, text, color, vx, vy, 40));
    }
}

// --- Game Objects ---
class Player {
    constructor() {
        this.size = 40;
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.gravity = 0.4;
        this.jumpPower = -12;
        this.speed = 6;
        this.emoji = '👧🏻';
        this.isInvincible = false;
        this.invincibleTimer = 0;
    }
    update() {
        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;
        if (this.x < -this.size / 2) this.x = canvas.width + this.size / 2;
        if (this.x > canvas.width + this.size / 2) this.x = -this.size / 2;
        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.isInvincible = false;
            if (frameCount % 3 === 0) spawnParticles(this.x, this.y + 20, '✨', 'yellow', 1);
        }
    }
    jump(boost = 1) {
        this.vy = this.jumpPower * boost;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.isInvincible) {
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 20;
            ctx.font = '50px Arial';
        } else {
            ctx.font = '40px Arial';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (this.vy < -15) {
            ctx.globalAlpha = 0.5;
            ctx.fillText('💨', 0, 30);
            ctx.globalAlpha = 1.0;
        }
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }
}

class Platform {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 110;
        this.height = 20;
        const rand = Math.random();
        if (rand < 0.1) this.type = 'moving';
        else if (rand < 0.2) this.type = 'fragile'; 
        else if (rand < 0.3) this.type = 'car'; 
        else this.type = 'normal'; 
        this.vx = this.type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0;
        this.broken = false;
    }
    update() {
        if (this.type === 'moving') {
            this.x += this.vx;
            if (this.x < 0 || this.x > canvas.width - this.width) this.vx *= -1;
        }
    }
    draw() {
        if (this.broken) return;
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let emoji = '🥟'; 
        if (this.type === 'fragile') emoji = '🥠';
        if (this.type === 'car') emoji = '🚗';
        if (this.type === 'moving') emoji = '🛒';
        ctx.font = '45px Arial';
        ctx.fillText(emoji, 0, 0);
        if (this.type === 'car') {
            ctx.font = '12px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('赣E', 0, 15);
        }
        ctx.restore();
    }
}

class Item {
    constructor(x, y) {
        this.x = x;
        this.y = y - 40; 
        this.size = 30;
        this.collected = false;
        let rand = Math.random();
        if (rand > 0.85) {
            this.type = 'cake';
        } else if (rand > 0.6) {
            this.type = 'book';
        } else {
            this.type = 'greenbean';
        }
    }
    draw() {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x + 55, this.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '30px Arial';
        let emoji = '🍵';
        if (this.type === 'cake') emoji = '🎂';
        if (this.type === 'book') emoji = '📖';
        ctx.fillText(emoji, 0, Math.sin(frameCount * 0.1) * 5);
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y - 50;
        this.size = 40;
        this.active = true;
        this.type = Math.random() > 0.5 ? 'cloud' : 'bill';
        this.vx = Math.random() * 2 - 1;
    }
    update() {
        this.x += this.vx;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x + 55, this.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '40px Arial';
        ctx.fillText(this.type === 'cloud' ? '☁️' : '🧾', 0, Math.sin(frameCount * 0.1) * 5);
        if (this.type === 'cloud') {
             ctx.font = '12px Arial';
             ctx.fillStyle = 'red';
             ctx.fillText('气噗噗', 0, 10);
        }
        ctx.restore();
    }
}

let player;
let platforms = [];
let items = [];
let enemies = [];
let platformCount = 7;

function initGame() {
    player = new Player();
    platforms = [];
    items = [];
    enemies = [];
    particles = [];
    score = 0;
    cameraY = 0;
    frameCount = 0;
    platforms.push(new Platform(canvas.width / 2 - 55, canvas.height - 50));
    platforms[0].type = 'normal';
    for (let i = 1; i < platformCount; i++) {
        generatePlatform(canvas.height - 50 - i * 120);
    }
}

function generatePlatform(y) {
    const x = Math.random() * (canvas.width - 110);
    const p = new Platform(x, y);
    platforms.push(p);
    if (y < canvas.height - 300) {
        if (Math.random() < 0.2) items.push(new Item(x, y));
        else if (Math.random() < 0.1) enemies.push(new Enemy(x, y));
    }
}

let touchLeftActive = false;
let touchRightActive = false;
let keys = { ArrowLeft: false, ArrowRight: false };

document.getElementById('touch-left').addEventListener('touchstart', (e) => { e.preventDefault(); touchLeftActive = true; });
document.getElementById('touch-left').addEventListener('touchend', (e) => { e.preventDefault(); touchLeftActive = false; });
document.getElementById('touch-right').addEventListener('touchstart', (e) => { e.preventDefault(); touchRightActive = true; });
document.getElementById('touch-right').addEventListener('touchend', (e) => { e.preventDefault(); touchRightActive = false; });
document.getElementById('touch-left').addEventListener('mousedown', () => { touchLeftActive = true; });
document.getElementById('touch-left').addEventListener('mouseup', () => { touchLeftActive = false; });
document.getElementById('touch-left').addEventListener('mouseleave', () => { touchLeftActive = false; });
document.getElementById('touch-right').addEventListener('mousedown', () => { touchRightActive = true; });
document.getElementById('touch-right').addEventListener('mouseup', () => { touchRightActive = false; });
document.getElementById('touch-right').addEventListener('mouseleave', () => { touchRightActive = false; });
window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

function handleInput() {
    let finalVx = 0;
    if (gyroActive) {
        let mappedSpeed = (tilt / 30) * player.speed;
        if (mappedSpeed > player.speed) mappedSpeed = player.speed;
        if (mappedSpeed < -player.speed) mappedSpeed = -player.speed;
        if (Math.abs(mappedSpeed) < 0.5) mappedSpeed = 0;
        finalVx = mappedSpeed;
    }
    if (touchLeftActive || keys.ArrowLeft) finalVx = -player.speed;
    else if (touchRightActive || keys.ArrowRight) finalVx = player.speed;
    player.vx = finalVx;
}

function update() {
    if (gameState !== 'PLAYING') return;
    frameCount++;
    handleInput();
    player.update();
    
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);

    if (player.y < canvas.height / 2) {
        let diff = canvas.height / 2 - player.y;
        player.y = canvas.height / 2;
        score += Math.floor(diff);
        cameraY += diff;
        
        platforms.forEach(p => p.y += diff);
        items.forEach(i => i.y += diff);
        enemies.forEach(e => e.y += diff);
        particles.forEach(p => p.y += diff);
    }
    currentScoreDisplay.innerText = score;

    platforms.forEach(p => p.update());
    platforms = platforms.filter(p => p.y < canvas.height + 50);
    while (platforms.length < platformCount) {
        let highestY = platforms[platforms.length - 1].y;
        generatePlatform(highestY - 100 - Math.random() * 50);
    }
    items = items.filter(i => i.y < canvas.height + 50 && !i.collected);
    enemies = enemies.filter(e => e.y < canvas.height + 50 && e.active);
    enemies.forEach(e => e.update());

    // Collision Player/Platform
    if (player.vy > 0) {
        platforms.forEach(p => {
            if (!p.broken && 
                player.x > p.x - 20 && 
                player.x < p.x + p.width + 20 && 
                player.y + player.size/2 > p.y && 
                player.y + player.size/2 < p.y + p.height) {
                
                player.jump();
                sfx.jump();
                spawnParticles(player.x, player.y + 20, '💨', 'white', 3);
                
                if (p.type === 'fragile') {
                    p.broken = true;
                    sfx.break();
                    spawnParticles(p.x + p.width/2, p.y + p.height/2, '🥠', 'orange', 5);
                }
            }
        });
    }

    // Collision Items
    items.forEach(i => {
        if (!i.collected && Math.abs(player.x - (i.x + 55)) < 45 && Math.abs(player.y - i.y) < 45) {
            i.collected = true;
            if (i.type === 'cake') {
                player.jump(3.0);
                player.isInvincible = true;
                player.invincibleTimer = 200;
                sfx.cake();
                spawnParticles(player.x, player.y, '🎂', 'pink', 10);
                spawnParticles(player.x, player.y - 20, '無敵起飛!', '#ff6b6b', 1);
            } else if (i.type === 'book') {
                player.jump(2.2);
                sfx.powerup(); // Reusing powerup sound
                spawnParticles(player.x, player.y, '📖', 'lightblue', 8);
                spawnParticles(player.x, player.y - 20, '撒哈拉的靈感!', '#0984e3', 1);
            } else {
                player.jump(1.8);
                sfx.powerup();
                spawnParticles(player.x, player.y, '🍵', 'green', 5);
                spawnParticles(player.x, player.y - 20, '綠豆力量!', '#55efc4', 1);
            }
        }
    });

    // Collision Enemies
    if (!player.isInvincible) {
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 55)) < 35 && Math.abs(player.y - e.y) < 35) {
                sfx.hit();
                spawnParticles(player.x, player.y, '💥', 'red', 10);
                gameOver(e.type === 'cloud' ? '被气噗噗雲撞到了！' : '被坑人的電信合約宰了！');
            }
        });
    } else {
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 55)) < 60 && Math.abs(player.y - e.y) < 60) {
                e.active = false;
                sfx.hit();
                spawnParticles(e.x + 55, e.y, '💥', 'orange', 5);
            }
        });
    }

    // Fall out of bounds
    if (player.y > canvas.height) {
        gameOver('踩空掉下去啦！');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'PLAYING') {
        drawBackground();
        platforms.forEach(p => p.draw());
        items.forEach(i => i.draw());
        enemies.forEach(e => e.draw());
        particles.forEach(p => p.draw());
        player.draw();
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function gameOver(reason) {
    gameState = 'GAMEOVER';
    sfx.die();
    bgm.pause();
    bgm.currentTime = 0;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('guangzhou_jump_high_score', highScore);
    }
    scoreDisplay.innerText = '得分: ' + score;
    highScoreDisplay.innerText = highScore;
    deathReasonDisplay.innerText = reason;
    gameOverScreen.classList.remove('hidden');
}

function startGameRoutine() {
    initAudio();
    startScreen.classList.add('hidden');
    initGame();
    gameState = 'PLAYING';
}

startBtn.addEventListener('click', () => {
    startBtn.innerText = '準備起飛... 🚀';
    initAudio();
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
                startGameRoutine();
                startBtn.innerText = '開始遊戲'; // Reset for next time
            })
            .catch(err => {
                console.error(err);
                startGameRoutine();
                startBtn.innerText = '開始遊戲';
            });
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
        startGameRoutine();
        startBtn.innerText = '開始遊戲';
    }
});

restartBtn.addEventListener('click', () => {
    initAudio();
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameState = 'START';
});

requestAnimationFrame(loop);
