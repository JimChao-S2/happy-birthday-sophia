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

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highScore = localStorage.getItem('guangzhou_jump_high_score') || 0;
let cameraY = 0;
let frameCount = 0;

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
        this.emoji = '👧🏻'; // Q萌女孩 / 蝦餃
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
        
        // Draw trailing effect if moving fast upwards
        if (this.vy < -15) {
            ctx.globalAlpha = 0.5;
            ctx.fillText('✨', 0, 30);
            ctx.globalAlpha = 1.0;
        }

        // Draw character
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }
}

class Platform {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 70;
        this.height = 20;
        
        const rand = Math.random();
        if (rand < 0.1) this.type = 'moving';
        else if (rand < 0.2) this.type = 'fragile'; // 易碎蛋卷
        else if (rand < 0.3) this.type = 'car'; // 赣E車牌
        else this.type = 'normal'; // 蒸籠

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
        
        let emoji = '🥟'; // default
        if (this.type === 'fragile') emoji = '🥠';
        if (this.type === 'car') emoji = '🚗';
        if (this.type === 'moving') emoji = '🛒';
        
        ctx.font = '35px Arial';
        ctx.fillText(emoji, 0, 0);
        
        if (this.type === 'car') {
            ctx.font = '10px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('赣E', 0, 10);
        }
        ctx.restore();
    }
}

class Item {
    constructor(x, y) {
        this.x = x;
        this.y = y - 40; // above platform
        this.size = 30;
        this.collected = false;
        
        // 綠豆湯 (小衝刺) vs 生日蛋糕 (大衝刺無敵)
        this.type = Math.random() > 0.8 ? 'cake' : 'greenbean';
    }

    draw() {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x + 35, this.y); // center of platform is x+35
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '30px Arial';
        ctx.fillText(this.type === 'cake' ? '🎂' : '🍵', 0, Math.sin(frameCount * 0.1) * 5); // floating animation
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y - 50;
        this.size = 40;
        this.active = true;
        
        // 气噗噗雲 vs 坑人合約
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
        ctx.translate(this.x + 35, this.y);
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
    platforms.push(new Platform(canvas.width / 2 - 35, canvas.height - 50));
    platforms[0].type = 'normal';

    for (let i = 1; i < platformCount; i++) {
        generatePlatform(canvas.height - 50 - i * 120);
    }
}

function generatePlatform(y) {
    const x = Math.random() * (canvas.width - 70);
    const p = new Platform(x, y);
    platforms.push(p);

    // Randomly spawn item or enemy on platform (not the first few)
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
    if (touchLeftActive || keys.ArrowLeft) {
        player.vx = -player.speed;
    } else if (touchRightActive || keys.ArrowRight) {
        player.vx = player.speed;
    } else {
        player.vx = 0;
    }
}

// Game Loop
function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;
    handleInput();
    player.update();

    // Camera movement / Scrolling
    if (player.y < canvas.height / 2) {
        let diff = canvas.height / 2 - player.y;
        player.y = canvas.height / 2;
        score += Math.floor(diff);
        
        platforms.forEach(p => p.y += diff);
        items.forEach(i => i.y += diff);
        enemies.forEach(e => e.y += diff);
    }
    
    currentScoreDisplay.innerText = score;

    // Platform logic
    platforms.forEach(p => p.update());

    // Remove off-screen objects & generate new ones
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
        if (!i.collected && Math.abs(player.x - (i.x + 35)) < 40 && Math.abs(player.y - i.y) < 40) {
            i.collected = true;
            if (i.type === 'cake') {
                player.jump(2.5); // Super boost
                player.isInvincible = true;
                player.invincibleTimer = 150;
            } else {
                player.jump(1.5); // Green bean boost
            }
        }
    });

    // Enemy Collision
    if (!player.isInvincible) {
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 35)) < 30 && Math.abs(player.y - e.y) < 30) {
                // hit enemy
                gameOver();
            }
        });
    } else {
        // Destroy enemy if invincible
        enemies.forEach(e => {
            if (e.active && Math.abs(player.x - (e.x + 35)) < 50 && Math.abs(player.y - e.y) < 50) {
                e.active = false;
            }
        });
    }

    // Fall off screen -> Game Over
    if (player.y > canvas.height) {
        gameOver();
    }
}

function draw() {
    // Clear canvas
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

function gameOver() {
    gameState = 'GAMEOVER';
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('guangzhou_jump_high_score', highScore);
    }
    scoreDisplay.innerText = '得分: ' + score;
    highScoreDisplay.innerText = highScore;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    initGame();
    gameState = 'PLAYING';
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    initGame();
    gameState = 'PLAYING';
});

// Start loop
requestAnimationFrame(loop);
