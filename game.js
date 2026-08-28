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

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highScore = localStorage.getItem('guangzhou_jump_high_score') || 0;
let cameraY = 0;
let frameCount = 0;

// Gyroscope Variables
let gyroActive = false;
let tilt = 0;

function handleOrientation(event) {
    let gamma = event.gamma; // Left-to-right tilt in degrees
    if (gamma > 90) gamma = 90;
    if (gamma < -90) gamma = -90;
    tilt = gamma;
    gyroActive = true;
}

// Resize Canvas
function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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
        // Gravity
        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;

        // Screen wrap
        if (this.x < -this.size / 2) this.x = canvas.width + this.size / 2;
        if (this.x > canvas.width + this.size / 2) this.x = -this.size / 2;

        // Invincibility
        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
            }
        }
    }

    jump(boost = 1) {
        this.vy = this.jumpPower * boost;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.isInvincible) {
            ctx.shadowColor = 'yellow';
            ctx.shadowBlur = 20;
            ctx.font = '50px Arial';
        } else {
            ctx.font = '40px Arial';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (this.vy < -15) {
            ctx.globalAlpha = 0.5;
            ctx.fillText('✨', 0, 30);
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
        this.width = 110; // Increased platform width (was 70)
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
            if (this.x < 0 || this.x > canvas.width - this.width) {
                this.vx *= -1;
            }
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
        
        ctx.font = '45px Arial'; // Increased font size for larger platform
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
        
        this.type = Math.random() > 0.8 ? 'cake' : 'greenbean';
    }

    draw() {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x + 55, this.y); // Center relative to 110 width
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '30px Arial';
        ctx.fillText(this.type === 'cake' ? '🎂' : '🍵', 0, Math.sin(frameCount * 0.1) * 5);
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
        ctx.translate(this.x + 55, this.y); // Center relative to 110 width
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '40px Arial';
        ctx.fillText(this.type === 'cloud' ? '☁️' : '🧾', 0, 0);
        
        if (this.type === 'cloud') {
             ctx.font = '12px Arial';
             ctx.fillStyle = 'red';
             ctx.fillText('气噗噗', 0, 5);
        }
        ctx.restore();
    }
}

// Global Variables
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
    score = 0;
    cameraY = 0;
    frameCount = 0;
    
    // Initial platform (safe)
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
        if (Math.random() < 0.2) {
            items.push(new Item(x, y));
        } else if (Math.random() < 0.1) {
            enemies.push(new Enemy(x, y));
        }
    }
}

// Input Handling
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
        // Map tilt (-30 to 30) to speed
        let mappedSpeed = (tilt / 30) * player.speed;
        if (mappedSpeed > player.speed) mappedSpeed = player.speed;
        if (mappedSpeed < -player.speed) mappedSpeed = -player.speed;
        
        // Deadzone
        if (Math.abs(mappedSpeed) < 0.5) mappedSpeed = 0;
        
        finalVx = mappedSpeed;
    }

    // Touch / Keyboard overrides Gyro
    if (touchLeftActive || keys.ArrowLeft) {
        finalVx = -player.speed;
    } else if (touchRightActive || keys.ArrowRight) {
        finalVx = player.speed;
    }

    player.vx = finalVx;
}

// Game Loop
function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;
    handleInput();
    player.update();

    if (player.y < canvas.height / 2) {
        let diff = canvas.height / 2 - player.y;
        player.y = canvas.height / 2;
        score += Math.floor(diff);
        
        platforms.forEach(p => p.y += diff);
        items.forEach(i => i.y += diff);
        enemies.forEach(e => e.y += diff);
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

    // Collision (Player falling down hitting platform)
    if (player.vy > 0) {
        platforms.forEach(p => {
            if (!p.broken && 
                player.x > p.x - 20 && 
                player.x < p.x + p.width + 20 && 
                player.y + player.size/2 > p.y && 
                player.y + player.size/2 < p.y + p.height) {
                
                player.jump();
                
                if (p.type === 'fragile') {
                    p.broken = true;
                }
            }
        });
    }

    // Item Collision
    items.forEach(i => {
        if (!i.collected && Math.abs(player.x - (i.x + 55)) < 45 && Math.abs(player.y - i.y) < 45) {
            i.collected = true;
            if (i.type === 'cake') {
                player.jump(2.5);
                player.isInvincible = true;
                player.invincibleTimer = 150;
            } else {
                player.jump(1.5);
            }
        }
    });

    // Enemy Collision
    if (!player.isInvincible) {
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 55)) < 35 && Math.abs(player.y - e.y) < 35) {
                gameOver(e.type === 'cloud' ? '被气噗噗雲撞到了！' : '被坑人的電信合約宰了！');
            }
        });
    } else {
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 55)) < 60 && Math.abs(player.y - e.y) < 60) {
                e.active = false;
            }
        });
    }

    if (player.y > canvas.height) {
        gameOver('踩空掉下去啦！');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        platforms.forEach(p => p.draw());
        items.forEach(i => i.draw());
        enemies.forEach(e => e.draw());
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
    startScreen.classList.add('hidden');
    initGame();
    gameState = 'PLAYING';
}

startBtn.addEventListener('click', () => {
    // Request Gyroscope Permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
                startGameRoutine();
            })
            .catch(console.error);
    } else {
        // Non-iOS 13+ devices
        window.addEventListener('deviceorientation', handleOrientation);
        startGameRoutine();
    }
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    initGame();
    gameState = 'PLAYING';
});

// Start loop
requestAnimationFrame(loop);
