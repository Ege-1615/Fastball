// kod.JS - Fiziksel Top Sistemi
'use strict';

// --- KONFİGÜRASYON ---
const CONFIG = {
    baseSpeed: 1.5,          // DAHA DA YAVAŞLATILDI: 2.0'dan 1.5'e
    sprintSpeed: 2.5,        // DAHA DA YAVAŞLATILDI: 3.2'den 2.5'e
    sprintDuration: 4000,
    tackleCooldown: 15000,
    tackleStun: 1000,
    ballFriction: 0.97,
    playerFriction: 0.86,
    shootForce: 6.5,
    passForce: 4,
    kickForce: 2.5,
    gameDuration: 300,
    localMultiplayerDuration: 900,
    aiSprintDuration: 5000,
    goalDepth: 20,
    targetFPS: 60,
    updateInterval: 1000 / 60,
};

// Performans değişkenleri
let lastFrameTime = 0;
let frameCount = 0;
let fps = 60;

// --- DURUM DEĞİŞKENLERİ ---
let selectedFlag = 'tr';
let selectedFlag2 = 'fr';
let playerName = "Oyuncu";
let playerName2 = "Oyuncu2";
let gameActive = false;
let isPaused = false;
let scores = { red: 0, blue: 0 };
let time = 0;
let timerInterval = null;

let sprintEnergy = CONFIG.sprintDuration;
let sprintEnergy2 = CONFIG.sprintDuration;
let lastTackleTime = -CONFIG.tackleCooldown;
let lastTackleTime2 = -CONFIG.tackleCooldown;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const FLAGS = [
    {id:'tr', name:'Türkiye 🇹🇷', colors:['#e30a17', '#fff']},
    {id:'az', name:'Azerbaycan 🇦🇿', colors:['#00B5E2', '#EF3340', '#509E2F']},
    {id:'br', name:'Brezilya 🇧🇷', colors:['#009c3b', '#ffdf00', '#002776']},
    {id:'de', name:'Almanya 🇩🇪', colors:['#000', '#DD0000', '#FFCE00']},
    {id:'fr', name:'Fransa 🇫🇷', colors:['#002157', '#fff', '#e50000']},
    {id:'it', name:'İtalya 🇮🇹', colors:['#009246', '#fff', '#ce2b37']},
    {id:'ar', name:'Arjantin 🇦🇷', colors:['#74acdf', '#fff']},
    {id:'gb', name:'İngiltere 🏴', colors:['#fff', '#cf142b']},
    {id:'es', name:'İspanya 🇪🇸', colors:['#c60b1e', '#ffc400', '#c60b1e']},
    {id:'pt', name:'Portekiz 🇵🇹', colors:['#006600', '#ff0000']},
    {id:'nl', name:'Hollanda 🇳🇱', colors:['#FF4500', '#fff', '#1E90FF']},
    {id:'mx', name:'Meksika 🇲🇽', colors:['#006341', '#fff', '#CE1126']},
];

function getRandomFlag(excludeFlag) {
    const availableFlags = FLAGS.filter(f => f.id !== excludeFlag);
    return availableFlags[Math.floor(Math.random() * availableFlags.length)].id;
}

let playerFlags = [];
let players = [];
let ball = null;
let crowd = [];

let keys = { 
    w:false, a:false, s:false, d:false, Shift:false, Space:false, e:false,
    ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false, 
    l:false, i:false, ShiftRight:false
};
let mouse = { x: 0, y: 0 };

let gameMode = 'normal';
let singleMode = false;
let localMultiplayer = false;
let chatMessages = [];
let confetti = []; // Konfeti parçacıkları

// ---------- TOP SINIFI ----------
class Ball {
    constructor() {
        this.radius = 10;
        this.reset();
    }
    
    reset() {
        this.x = (canvas ? canvas.width/2 : 0);
        this.y = (canvas ? canvas.height/2 : 0);
        this.vx = 0;
        this.vy = 0;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        this.vx *= CONFIG.ballFriction;
        this.vy *= CONFIG.ballFriction;
        
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        if (Math.abs(this.vy) < 0.1) this.vy = 0;

        if (!canvas) return;

        const fieldTop = 80;
        const fieldBottom = canvas.height - 80;
        const fieldLeft = 60;
        const fieldRight = canvas.width - 60;
        const goalCenterY = canvas.height/2;
        const goalHeight = 200;

        if(this.y - this.radius < fieldTop) {
            this.y = fieldTop + this.radius;
            this.vy = -this.vy * 0.7;
        }
        if(this.y + this.radius > fieldBottom) {
            this.y = fieldBottom - this.radius;
            this.vy = -this.vy * 0.7;
        }

        const inGoalRangeY = (this.y > goalCenterY - goalHeight/2) && (this.y < goalCenterY + goalHeight/2);

        if(inGoalRangeY) {
            if(this.x < fieldLeft - CONFIG.goalDepth) {
                handleGoal('blue');
                return;
            }
        } else {
            if(this.x - this.radius < fieldLeft) {
                this.x = fieldLeft + this.radius;
                this.vx = -this.vx * 0.7;
            }
        }

        if(inGoalRangeY) {
            if(this.x > fieldRight + CONFIG.goalDepth) {
                handleGoal('red');
                return;
            }
        } else {
            if(this.x + this.radius > fieldRight) {
                this.x = fieldRight - this.radius;
                this.vx = -this.vx * 0.7;
            }
        }
    }
    
    draw() {
        if (!ctx) return;
        
        // Futbol topu - Klasik beşgen/altıgen deseni
        const rotation = (this.vx + this.vy) * 0.1; // Top hareket ederken dönsün
        
        // Beyaz zemin
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Gölge efekti
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Siyah beşgenler (12 tane - gerçek futbol topu gibi)
        ctx.shadowColor = 'transparent';
        const pentagons = [
            {x: 0, y: -0.7},
            {x: 0.5, y: -0.4},
            {x: 0.6, y: 0.2},
            {x: 0, y: 0.6},
            {x: -0.6, y: 0.2},
            {x: -0.5, y: -0.4},
        ];
        
        pentagons.forEach((pos, i) => {
            const angle = rotation + (Math.PI * 2 / pentagons.length) * i;
            const centerX = this.x + Math.cos(angle) * pos.x * this.radius + Math.sin(angle) * pos.y * this.radius;
            const centerY = this.y + Math.sin(angle) * pos.x * this.radius - Math.cos(angle) * pos.y * this.radius;
            
            ctx.beginPath();
            for(let j = 0; j < 5; j++) {
                const pentAngle = (Math.PI * 2 / 5) * j - Math.PI / 2;
                const px = centerX + Math.cos(pentAngle) * this.radius * 0.28;
                const py = centerY + Math.sin(pentAngle) * this.radius * 0.28;
                if(j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = '#000000';
            ctx.fill();
        });
        
        // Dış çerçeve
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // Parlama efekti (üst sol)
        const gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3, 
            this.y - this.radius * 0.3, 
            0,
            this.x - this.radius * 0.3, 
            this.y - this.radius * 0.3, 
            this.radius * 0.6
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

// ---------- OYUNCU SINIFI ----------
class Player {
    constructor(x, y, team, isHuman, number, flagId, position) {
        this.originX = x;
        this.originY = y;
        this.x = x;
        this.y = y;
        this.team = team;
        this.isHuman = isHuman;
        this.number = number;
        this.radius = 16;
        this.vx = 0;
        this.vy = 0;
        this.stunned = false;
        this.flagId = flagId;
        this.position = position || 'midfielder';
        this.aiSprintEnergy = CONFIG.aiSprintDuration;
        this.lastAiTackleTime = -CONFIG.tackleCooldown;
        
        if (!this.isHuman) {
            const aiNames = ['Ronaldo', 'Messi', 'Neymar', 'Mbappe', 'Haaland', 'Lewandowski', 
                           'Benzema', 'Salah', 'Kane', 'Modric', 'De Bruyne', 'Kroos'];
            this.aiName = aiNames[Math.floor(Math.random() * aiNames.length)];
        }
    }

    resetPos() {
        this.x = this.originX;
        this.y = this.originY;
        this.vx = 0;
        this.vy = 0;
        this.stunned = false;
        this.angle = 0; // Yön açısı
        if (canvas) this.y = Math.min(Math.max(this.y, 85), canvas.height - 85);
    }

    update() {
        if(this.stunned) {
            this.vx *= CONFIG.playerFriction;
            this.vy *= CONFIG.playerFriction;
            if(Date.now() > this.stunTimer) this.stunned = false;
        } else {
            let speed = CONFIG.baseSpeed;

            if(this.isHuman) {
                let inputX = 0;
                let inputY = 0;
                
                if (this.team === 'red' && (!localMultiplayer || singleMode)) {
                    if(keys.Shift && sprintEnergy > 0) speed = CONFIG.sprintSpeed;
                    if(keys.w) inputY = -1;
                    if(keys.s) inputY = 1;
                    if(keys.a) inputX = -1;
                    if(keys.d) inputX = 1;
                    
                    if(keys.Shift && sprintEnergy > 0) sprintEnergy -= 16;
                    else if(sprintEnergy < CONFIG.sprintDuration) sprintEnergy += 5;
                }
                else if (this.team === 'blue' && localMultiplayer) {
                    if(keys.ShiftRight && sprintEnergy2 > 0) speed = CONFIG.sprintSpeed;
                    if(keys.ArrowUp) inputY = -1;
                    if(keys.ArrowDown) inputY = 1;
                    if(keys.ArrowLeft) inputX = -1;
                    if(keys.ArrowRight) inputX = 1;
                    
                    if(keys.ShiftRight && sprintEnergy2 > 0) sprintEnergy2 -= 16;
                    else if(sprintEnergy2 < CONFIG.sprintDuration) sprintEnergy2 += 5;
                }
                else if (this.team === 'red' && localMultiplayer) {
                    if(keys.Shift && sprintEnergy > 0) speed = CONFIG.sprintSpeed;
                    if(keys.w) inputY = -1;
                    if(keys.s) inputY = 1;
                    if(keys.a) inputX = -1;
                    if(keys.d) inputX = 1;
                    
                    if(keys.Shift && sprintEnergy > 0) sprintEnergy -= 16;
                    else if(sprintEnergy < CONFIG.sprintDuration) sprintEnergy += 5;
                }
                
                if(inputX !== 0 && inputY !== 0) {
                    inputX *= 0.707;
                    inputY *= 0.707;
                }
                
                this.vx = inputX * speed;
                this.vy = inputY * speed;
            } else {
                if(this.aiSprintEnergy > 0) speed = CONFIG.sprintSpeed;
                this.aiUpdate(speed);
                if(speed === CONFIG.sprintSpeed && this.aiSprintEnergy > 0) this.aiSprintEnergy -= 16;
                else if(this.aiSprintEnergy < CONFIG.aiSprintDuration) this.aiSprintEnergy += 5;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        if (canvas) {
            const fTop = 85;
            const fBot = canvas.height - 85;
            const fLeft = 65;
            const fRight = canvas.width - 65;
            if(this.x < fLeft) this.x = fLeft;
            if(this.x > fRight) this.x = fRight;
            if(this.y < fTop) this.y = fTop;
            if(this.y > fBot) this.y = fBot;
        }

        if (ball && !this.stunned) {
            let dx = ball.x - this.x;
            let dy = ball.y - this.y;
            let dist = Math.hypot(dx, dy);
            let minDist = this.radius + ball.radius + 5; // Hitbox genişletildi

            if (dist < minDist && dist > 0) {
                let nx = dx / dist;
                let ny = dy / dist;
                
                // Oyuncunun hızını topa aktar
                let pushForce = CONFIG.kickForce * 0.8;
                ball.vx += nx * pushForce + this.vx * 0.5;
                ball.vy += ny * pushForce + this.vy * 0.5;
                
                let overlap = minDist - dist;
                this.x -= nx * overlap * 0.6;
                this.y -= ny * overlap * 0.6;
                ball.x += nx * overlap * 0.4;
                ball.y += ny * overlap * 0.4;
            }
        }

        // *** TİTREME DÜZELTMESİ - YUMUŞAK İTME ***
        players.forEach(other => {
            if (other === this) return;
            
            let dx = other.x - this.x;
            let dy = other.y - this.y;
            let dist = Math.hypot(dx, dy);
            let minDist = this.radius + other.radius + 2; // 2 piksel boşluk
            
            if (dist < minDist && dist > 0) {
                let nx = dx / dist;
                let ny = dy / dist;
                let overlap = minDist - dist;
                
                // Sadece belirli eşik üzerinde it
                if (overlap > 0.5) {
                    if (this.isHuman && !other.isHuman) {
                        // AI'yı yavaşça ite
                        other.x += nx * overlap * 0.3;
                        other.y += ny * overlap * 0.3;
                        other.vx += nx * 0.5;
                        other.vy += ny * 0.5;
                    } else if (!this.isHuman && other.isHuman) {
                        // AI geri çekilir
                        this.x -= nx * overlap * 0.3;
                        this.y -= ny * overlap * 0.3;
                        this.vx = 0;
                        this.vy = 0;
                    } else if (!this.isHuman && !other.isHuman) {
                        // AI'lar hafifçe çarpar
                        this.x -= nx * overlap * 0.2;
                        this.y -= ny * overlap * 0.2;
                        other.x += nx * overlap * 0.2;
                        other.y += ny * overlap * 0.2;
                    } else {
                        // İnsan oyuncular
                        this.x -= nx * overlap * 0.5;
                        this.y -= ny * overlap * 0.5;
                        other.x += nx * overlap * 0.5;
                        other.y += ny * overlap * 0.5;
                    }
                }
            }
        });
    }

    aiUpdate(speed) {
        if (!ball) { 
            this.vx = 0; 
            this.vy = 0; 
            return; 
        }

        let targetX = this.originX;
        let targetY = this.originY;
        
        if (!this.closestCheckFrame) this.closestCheckFrame = 0;
        this.closestCheckFrame++;
        
        let closestTeammateDistToBall = Infinity;
        let isClosestToBall = false;
        
        if (this.closestCheckFrame % 3 === 0) {
            players.forEach(p => {
                if (p.team === this.team && p !== this && !p.isHuman) {
                    let d = Math.hypot(p.x - ball.x, p.y - ball.y);
                    if (d < closestTeammateDistToBall) {
                        closestTeammateDistToBall = d;
                    }
                }
            });
        }
        
        let myDistToBall = Math.hypot(this.x - ball.x, this.y - ball.y);
        isClosestToBall = myDistToBall <= closestTeammateDistToBall;

        // KALECİ
        if (this.position === 'goalkeeper') {
            const goalX = (this.team === 'red') ? 80 : canvas.width - 80;
            const goalCenterY = canvas.height / 2;
            
            targetX = goalX;
            
            if (Math.random() < 0.7) {
                let targetBallY = ball.y;
                const goalPostTop = goalCenterY - 100;
                const goalPostBottom = goalCenterY + 100;
                
                if (targetBallY < goalPostTop) {
                    targetBallY = goalPostTop + 20;
                } else if (targetBallY > goalPostBottom) {
                    targetBallY = goalPostBottom - 20;
                }
                
                targetY = this.y + (targetBallY - this.y) * 0.35;
                speed *= 0.5;
            } else {
                if (Math.random() > 0.5) {
                    targetY = this.y;
                } else {
                    targetY = this.y + (Math.random() - 0.5) * 60;
                }
                speed *= 0.25;
            }
            
            let distToBall = Math.hypot(this.x - ball.x, this.y - ball.y);
            if (distToBall < 30 && Math.random() < 0.8) {
                let clearAngle = (this.team === 'red') ? 0 : Math.PI;
                clearAngle += (Math.random() - 0.5) * 1.0;
                ball.vx = Math.cos(clearAngle) * 7;
                ball.vy = Math.sin(clearAngle) * 7;
            }
        }
        // DEFANS
        else if (this.position === 'defender') {
            let ballInDangerZone = (this.team === 'red') ? (ball.x < canvas.width * 0.35) : (ball.x > canvas.width * 0.65);
            
            if (Math.random() > 0.6) {
                targetX = this.originX + (Math.random() - 0.5) * 100;
                targetY = this.originY + (Math.random() - 0.5) * 100;
                speed *= 0.3;
            }
            else if (ballInDangerZone && isClosestToBall && myDistToBall < 250) {
                targetX = ball.x;
                targetY = ball.y;
                
                if (this.aiSprintEnergy > 1000) {
                    speed = CONFIG.sprintSpeed;
                }
                
                if (myDistToBall < 50 && Math.random() < 0.3) {
                    let clearAngle = (this.team === 'red') ? 0 : Math.PI;
                    clearAngle += (Math.random() - 0.5) * 1.2;
                    ball.vx = Math.cos(clearAngle) * 8;
                    ball.vy = Math.sin(clearAngle) * 8;
                }
                
                if (myDistToBall < 60 && Date.now() > this.lastAiTackleTime + CONFIG.tackleCooldown) {
                    tryTackle(this);
                }
            } else {
                targetX = (this.originX * 0.8 + ball.x * 0.2);
                targetY = (this.originY * 0.7 + ball.y * 0.3);
                speed *= 0.5;
            }
        }
        // ORTA SAHA
        else if (this.position === 'midfielder') {
            if (Math.random() > 0.7) {
                targetX = this.originX + (Math.random() - 0.5) * 120;
                targetY = this.originY + (Math.random() - 0.5) * 120;
                speed *= 0.4;
            }
            else if (isClosestToBall && myDistToBall < 300) {
                targetX = ball.x;
                targetY = ball.y;
                
                if (this.aiSprintEnergy > 1500) {
                    speed = CONFIG.sprintSpeed;
                }
                
                if (myDistToBall < 50) {
                    let goalX = (this.team === 'red') ? canvas.width - 60 : 60;
                    let distToGoal = Math.abs(this.x - goalX);
                    
                    if (distToGoal < 450 && Math.random() < 0.25) {
                        shootBall(this);
                    } else if (Math.random() < 0.2) {
                        const forwards = players.filter(p => p.team === this.team && p.position === 'forward');
                        if (forwards.length > 0) {
                            const target = forwards[Math.floor(Math.random() * forwards.length)];
                            let passAngle = Math.atan2(target.y - this.y, target.x - this.x);
                            ball.vx = Math.cos(passAngle) * CONFIG.passForce;
                            ball.vy = Math.sin(passAngle) * CONFIG.passForce;
                        }
                    }
                }
                
                if (myDistToBall < 60 && Date.now() > this.lastAiTackleTime + CONFIG.tackleCooldown) {
                    tryTackle(this);
                }
            } else {
                targetX = (this.originX * 0.7 + ball.x * 0.3);
                targetY = (this.originY * 0.6 + ball.y * 0.4);
                speed *= 0.5;
            }
        }
        // FORVET
        else if (this.position === 'forward') {
            let ballInAttackZone = (this.team === 'red') ? (ball.x > canvas.width * 0.4) : (ball.x < canvas.width * 0.6);
            
            if (Math.random() > 0.65) {
                targetX = this.originX + (Math.random() - 0.5) * 150;
                targetY = this.originY + (Math.random() - 0.5) * 150;
                speed *= 0.35;
            }
            else if (ballInAttackZone && isClosestToBall && myDistToBall < 350) {
                targetX = ball.x;
                targetY = ball.y;
                
                if (this.aiSprintEnergy > 1000) {
                    speed = CONFIG.sprintSpeed;
                }
                
                if (myDistToBall < 50) {
                    let goalX = (this.team === 'red') ? canvas.width - 60 : 60;
                    let goalY = canvas.height / 2;
                    let angleToGoal = Math.atan2(goalY - this.y, goalX - this.x);
                    let angleToBall = Math.atan2(ball.y - this.y, ball.x - this.x);
                    
                    if (Math.abs(angleToGoal - angleToBall) < Math.PI / 2.5 && Math.random() < 0.4) {
                        shootBall(this);
                    }
                }
                
                players.forEach(enemy => {
                    if (enemy.team !== this.team) {
                        let distToEnemy = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                        if (distToEnemy < 60 && Date.now() > this.lastAiTackleTime + CONFIG.tackleCooldown) {
                            tryTackle(this);
                        }
                    }
                });
            } else {
                let attackX = (this.team === 'red') ? canvas.width * 0.75 : canvas.width * 0.25;
                targetX = (attackX * 0.8 + ball.x * 0.2);
                targetY = (this.originY * 0.7 + ball.y * 0.3);
                speed *= 0.4;
            }
        }

        // *** TİTREME DÜZELTMESİ - YUMUŞAK HAREKET ***
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist > 5) {
            let angle = Math.atan2(dy, dx);
            // Yavaş hızlanma
            let targetVx = Math.cos(angle) * speed * 0.7;
            let targetVy = Math.sin(angle) * speed * 0.7;
            
            this.vx += (targetVx - this.vx) * 0.15; // Yumuşak geçiş
            this.vy += (targetVy - this.vy) * 0.15;
        } else {
            this.vx *= 0.7;
            this.vy *= 0.7;
        }
    }

    draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Oyuncuları DÖNDÜRMEYİN - Sabit çizin
        drawFlagPlayer(ctx, this.radius, this.flagId);

        if (this.isHuman) {
            let initial = '';
            if (this.team === 'red') {
                initial = playerName.charAt(0).toUpperCase();
            } else if (this.team === 'blue' && localMultiplayer) {
                initial = playerName2.charAt(0).toUpperCase();
            }
            
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.strokeText(initial, 0, 0);
            ctx.fillText(initial, 0, 0);
        }

        if(this.stunned) {
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 3, 0, Math.PI*2);
            ctx.stroke();

            for(let i = 0; i < 4; i++) {
                const angle = (Date.now() / 200 + i * Math.PI/2);
                const x = Math.cos(angle) * (this.radius + 8);
                const y = Math.sin(angle) * (this.radius + 8);
                ctx.fillStyle = '#ff0';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI*2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

// ---------- YARDIMCI FONKSİYONLAR ----------
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Oyun aktifse sadece taraftarları yeniden oluştur, oyuncuları değil
    if (gameActive) {
        initCrowd();
    }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', () => {
    resizeCanvas();
    
    const scoreBoard = document.getElementById('scoreBoard');
    if(scoreBoard) {
        scoreBoard.style.top = '10px';
    }
});

window.openModeMenu = function() {
    const main = document.getElementById("mainMenu");
    const mode = document.getElementById("modeMenu");
    if(main) main.style.display = "none";
    if(mode) mode.style.display = "flex";
}

window.backToMainMenu = function() {
    const main = document.getElementById("mainMenu");
    const mode = document.getElementById("modeMenu");
    if(mode) mode.style.display = "none";
    if(main) main.style.display = "flex";
}

window.selectMode = function(mode) {
    gameMode = mode;
    singleMode = (mode === 'single');
    localMultiplayer = (mode === 'local2p');
    const modeEl = document.getElementById("modeMenu");
    if(modeEl) modeEl.style.display = "none";
    
    if (localMultiplayer) {
        openLocal2PSetup();
    } else {
        openGame();
    }
}

window.toggleSettings = function(show) {
    const main = document.getElementById('mainMenu');
    const settings = document.getElementById('settingsModal');
    if(main) main.style.display = show ? 'none' : 'flex';
    if(settings) settings.style.display = show ? 'flex' : 'none';

    const list = document.getElementById('skinList');
    if(!list) return;
    list.innerHTML = '';
    FLAGS.forEach(f => {
        const div = document.createElement('div');
        div.className = `btn ${selectedFlag===f.id?'btn-play':'btn-settings'}`;
        div.innerText = f.name;
        div.style.border = selectedFlag===f.id ? '3px solid #ffd700' : '2px solid #666';
        div.style.transform = selectedFlag===f.id ? 'scale(1.05)' : 'scale(1)';
        div.onclick = () => {
            selectedFlag = f.id;
            toggleSettings(true);
        };
        list.appendChild(div);
    });
}

function openGame() {
    const inp = document.getElementById('playerNameInput');
    if(inp && inp.value.trim()) playerName = inp.value;

    const main = document.getElementById('mainMenu');
    const wrapper = document.getElementById('gameWrapper');
    if (main) main.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';

    scores = { red: 0, blue: 0 };
    time = 0;
    const sr = document.getElementById('scoreRed');
    const sb = document.getElementById('scoreBlue');
    if(sr) sr.innerText = 0;
    if(sb) sb.innerText = 0;

    initCrowd();
    initMatch();
    startCountdown();
}

function openLocal2PSetup() {
    const main = document.getElementById('mainMenu');
    const setup = document.getElementById('local2pSetup');
    if (main) main.style.display = 'none';
    if (setup) setup.style.display = 'flex';
    
    selectedFlag2 = getRandomFlag(selectedFlag);
    
    // Bayrak listelerini oluştur
    const list1 = document.getElementById('player1FlagList');
    const list2 = document.getElementById('player2FlagList');
    
    if(list1) {
        list1.innerHTML = '';
        FLAGS.forEach(f => {
            const div = document.createElement('div');
            div.className = `btn ${selectedFlag===f.id?'btn-play':'btn-settings'}`;
            div.innerText = f.name;
            div.style.border = selectedFlag===f.id ? '3px solid #ffd700' : '2px solid #666';
            div.style.transform = selectedFlag===f.id ? 'scale(1.05)' : 'scale(1)';
            div.onclick = () => {
                selectedFlag = f.id;
                openLocal2PSetup();
            };
            list1.appendChild(div);
        });
    }
    
    if(list2) {
        list2.innerHTML = '';
        FLAGS.forEach(f => {
            const div = document.createElement('div');
            div.className = `btn ${selectedFlag2===f.id?'btn-play':'btn-settings'}`;
            div.innerText = f.name;
            div.style.border = selectedFlag2===f.id ? '3px solid #ffd700' : '2px solid #666';
            div.style.transform = selectedFlag2===f.id ? 'scale(1.05)' : 'scale(1)';
            div.onclick = () => {
                selectedFlag2 = f.id;
                openLocal2PSetup();
            };
            list2.appendChild(div);
        });
    }
}

window.backToMainFromLocal2P = function() {
    const setup = document.getElementById('local2pSetup');
    const main = document.getElementById('mainMenu');
    if (setup) setup.style.display = 'none';
    if (main) main.style.display = 'flex';
}

window.startLocal2PGame = function() {
    const inp1 = document.getElementById('player1NameInput');
    const inp2 = document.getElementById('player2NameInput');
    
    if(inp1 && inp1.value.trim()) playerName = inp1.value.trim();
    else playerName = "Oyuncu1";
    
    if(inp2 && inp2.value.trim()) playerName2 = inp2.value.trim();
    else playerName2 = "Oyuncu2";
    
    const setup = document.getElementById('local2pSetup');
    const wrapper = document.getElementById('gameWrapper');
    if (setup) setup.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';

    scores = { red: 0, blue: 0 };
    time = 0;
    const sr = document.getElementById('scoreRed');
    const sb = document.getElementById('scoreBlue');
    if(sr) sr.innerText = 0;
    if(sb) sb.innerText = 0;

    initCrowd();
    initLocal2PMatch();
    startCountdown();
}

function initCrowd() {
    crowd = [];
    if (!canvas) return;
    const botY = canvas.height - 80;

    for(let i=0; i<50; i++) {
        let x = Math.random() * canvas.width;
        let y = 10 + Math.random() * 60;
        
        let teamSide = x < canvas.width / 2 ? 'red' : 'blue';
        let color;
        
        if (Math.random() > 0.7) {
            color = teamSide === 'red' ? '#e74c3c' : '#3498db';
        } else if (Math.random() > 0.5) {
            color = '#ecf0f1';
        } else {
            const colors = ['#95a5a6', '#34495e', '#f39c12', '#2ecc71', '#9b59b6'];
            color = colors[Math.floor(Math.random() * colors.length)];
        }
        
        crowd.push({
            x: x,
            y: y,
            color: color,
            size: 3 + Math.random() * 2,
            offset: Math.random() * 10,
            waveSpeed: 3 + Math.random() * 3,
            team: teamSide
        });
    }
    
    for(let i=0; i<50; i++) {
        let x = Math.random() * canvas.width;
        let y = botY + 10 + Math.random() * 60;
        
        let teamSide = x < canvas.width / 2 ? 'red' : 'blue';
        let color;
        
        if (Math.random() > 0.7) {
            color = teamSide === 'red' ? '#e74c3c' : '#3498db';
        } else if (Math.random() > 0.5) {
            color = '#ecf0f1';
        } else {
            const colors = ['#95a5a6', '#34495e', '#f39c12', '#2ecc71', '#9b59b6'];
            color = colors[Math.floor(Math.random() * colors.length)];
        }
        
        crowd.push({
            x: x,
            y: y,
            color: color,
            size: 3 + Math.random() * 2,
            offset: Math.random() * 10,
            waveSpeed: 3 + Math.random() * 3,
            team: teamSide
        });
    }
}

function initMatch() {
    if (!canvas) return;
    if (!ball) ball = new Ball();

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    const opponentFlag = getRandomFlag(selectedFlag);

    if (singleMode) {
        players = [
            new Player(width * 0.3, midY, 'red', true, 10, selectedFlag, 'midfielder'),
            new Player(width * 0.05, midY, 'red', false, 1, selectedFlag, 'goalkeeper'),
            new Player(width * 0.7, midY, 'blue', false, 10, opponentFlag, 'midfielder'),
            new Player(width * 0.95, midY, 'blue', false, 1, opponentFlag, 'goalkeeper')
        ];
    } else {
        players = [
            new Player(width * 0.3, midY, 'red', true, 10, selectedFlag, 'midfielder'),
            new Player(width * 0.05, midY, 'red', false, 1, selectedFlag, 'goalkeeper'),
            new Player(width * 0.15, midY, 'red', false, 2, selectedFlag, 'defender'),
            new Player(width * 0.25, height * 0.35, 'red', false, 3, selectedFlag, 'midfielder'),
            new Player(width * 0.4, height * 0.3, 'red', false, 4, selectedFlag, 'forward'),
            new Player(width * 0.4, height * 0.7, 'red', false, 5, selectedFlag, 'forward'),
            
            new Player(width * 0.95, midY, 'blue', false, 1, opponentFlag, 'goalkeeper'),
            new Player(width * 0.85, midY, 'blue', false, 2, opponentFlag, 'defender'),
            new Player(width * 0.75, height * 0.35, 'blue', false, 3, opponentFlag, 'midfielder'),
            new Player(width * 0.6, height * 0.3, 'blue', false, 4, opponentFlag, 'forward'),
            new Player(width * 0.6, height * 0.7, 'blue', false, 5, opponentFlag, 'forward'),
            new Player(width * 0.7, height * 0.65, 'blue', false, 6, opponentFlag, 'midfielder')
        ];
    }

    ball.reset();
    sprintEnergy = CONFIG.sprintDuration;
    lastTackleTime = -CONFIG.tackleCooldown;

    if(!timerInterval) {
        timerInterval = setInterval(() => {
            if(gameActive && !isPaused) {
                time++;
                if(time >= CONFIG.gameDuration) {
                    endGame();
                }
                let m = Math.floor(time/60).toString().padStart(2,'0');
                let s = (time%60).toString().padStart(2,'0');
                const tEl = document.getElementById('timer');
                if(tEl) tEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    }
    requestAnimationFrame(gameLoop);
}

function initLocal2PMatch() {
    if (!canvas) return;
    if (!ball) ball = new Ball();

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    players = [
        new Player(width * 0.2, midY, 'red', true, 10, selectedFlag, 'midfielder'),
        new Player(width * 0.05, midY, 'red', false, 1, selectedFlag, 'goalkeeper'),
        
        new Player(width * 0.8, midY, 'blue', true, 10, selectedFlag2, 'midfielder'),
        new Player(width * 0.95, midY, 'blue', false, 1, selectedFlag2, 'goalkeeper'),
    ];

    ball.reset();
    sprintEnergy = CONFIG.sprintDuration;
    sprintEnergy2 = CONFIG.sprintDuration;
    lastTackleTime = -CONFIG.tackleCooldown;
    lastTackleTime2 = -CONFIG.tackleCooldown;

    if(!timerInterval) {
        timerInterval = setInterval(() => {
            if(gameActive && !isPaused) {
                time++;
                if(time >= CONFIG.localMultiplayerDuration) {
                    endGame();
                }
                let m = Math.floor(time/60).toString().padStart(2,'0');
                let s = (time%60).toString().padStart(2,'0');
                const tEl = document.getElementById('timer');
                if(tEl) tEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    }
    requestAnimationFrame(gameLoop);
}

window.resetGame = function() {
    const endModal = document.getElementById('endGameModal');
    const main = document.getElementById('mainMenu');
    const wrapper = document.getElementById('gameWrapper');
    if(endModal) endModal.style.display = 'none';
    if(main) main.style.display = 'none';
    if(wrapper) wrapper.style.display = 'block';
    scores = { red: 0, blue: 0 };
    time = 0;
    const sr = document.getElementById('scoreRed');
    const sb = document.getElementById('scoreBlue');
    if(sr) sr.innerText = 0;
    if(sb) sb.innerText = 0;
    
    if (localMultiplayer) {
        initLocal2PMatch();
    } else {
        initMatch();
    }
    startCountdown();
}

window.returnToMenu = function() {
    const endModal = document.getElementById('endGameModal');
    const wrapper = document.getElementById('gameWrapper');
    const main = document.getElementById('mainMenu');
    if(endModal) endModal.style.display = 'none';
    if(wrapper) wrapper.style.display = 'none';
    if(main) main.style.display = 'flex';
    gameActive = false;
    isPaused = true;
    if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function startCountdown() {
    isPaused = true;
    gameActive = true;
    let count = 3;
    const msg = document.getElementById('bigMessage');
    if(msg) {
        msg.style.display = 'block';
        msg.style.color = 'white';
        msg.style.textShadow = '0 0 20px rgba(0,0,0,0.8)';
        msg.innerText = count;
    }
    
    addChatMessage('⏱️ Maç başlıyor...');
    
    let intv = setInterval(() => {
        count--;
        if(msg) {
            if(count > 0) {
                msg.innerText = count;
                msg.style.color = 'white';
            }
            else if (count === 0) { 
                msg.innerText = "BAŞLA!"; 
                msg.style.color = '#ffd700';
                addChatMessage('🎮 Maç başladı! İyi şanslar!');
            }
            else { 
                clearInterval(intv); 
                msg.style.display = 'none'; 
                isPaused = false;
            }
        } else {
            if(count <= -1) { 
                clearInterval(intv); 
                isPaused = false;
            }
        }
    }, 1000);
}

function handleGoal(scoringTeam) {
    isPaused = true;
    gameActive = false;
    
    const msg = document.getElementById('bigMessage');
    if(msg) {
        msg.style.display = 'block';
        msg.style.color = scoringTeam === 'red' ? '#ff6b6b' : '#4dabf7';
        msg.innerText = "GOOOOOOLLLL!!!";
        msg.style.fontSize = '120px';
    }

    if(scoringTeam === 'red') scores.red++;
    else scores.blue++;
    
    const sr = document.getElementById('scoreRed');
    const sb = document.getElementById('scoreBlue');
    if(sr) sr.innerText = scores.red;
    if(sb) sb.innerText = scores.blue;

    const teamName = scoringTeam === 'red' ? '🔴 Kırmızı Takım' : '🔵 Mavi Takım';
    addChatMessage(`⚽ ${teamName} GOL ATTI! Skor: ${scores.red} - ${scores.blue}`);

    // KONFETİ PATLASIN!
    createConfetti();

    setTimeout(() => {
        if(msg) { 
            msg.style.fontSize = '100px';
        }
        players.forEach(p => p.resetPos());
        if(ball) ball.reset();
        startCountdown();
    }, 2500);
}

// KONFETİ SİSTEMİ
function createConfetti() {
    confetti = [];
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493'];
    
    for(let i = 0; i < 150; i++) {
        confetti.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            gravity: 0.3,
            life: 100
        });
    }
}

function updateConfetti() {
    for(let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.life--;
        
        if(p.life <= 0 || p.y > canvas.height) {
            confetti.splice(i, 1);
        }
    }
}

function drawConfetti() {
    if (!ctx) return;
    
    confetti.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
    });
}

function endGame() {
    gameActive = false;
    isPaused = true;

    const finalMsg = document.getElementById('finalMessage');
    const statsDiv = document.getElementById('endGameStats');
    const redScore = scores.red;
    const blueScore = scores.blue;

    if(finalMsg && statsDiv) {
        if (redScore > blueScore) {
            finalMsg.innerText = "🏆 MAÇ BİTTİ! KAZANAN SENSİN! 🏆";
            statsDiv.innerHTML = `<p class="winner">KAZANAN: <strong>Kırmızı Takım (Senin Takımın)</strong></p><p class="loser">KAYBEDEN: <strong>Mavi Takım</strong></p><p><strong>Nihai Skor:</strong> <span style="color:#ff6b6b">${redScore}</span> - <span style="color:#4dabf7">${blueScore}</span></p>`;
        } else if (blueScore > redScore) {
            finalMsg.innerText = "😞 MAÇ BİTTİ! KAYBEDEN SENSİN... 😞";
            statsDiv.innerHTML = `<p class="winner">KAZANAN: <strong>Mavi Takım</strong></p><p class="loser">KAYBEDEN: <strong>Kırmızı Takım (Senin Takımın)</strong></p><p><strong>Nihai Skor:</strong> <span style="color:#ff6b6b">${redScore}</span> - <span style="color:#4dabf7">${blueScore}</span></p>`;
        } else {
            finalMsg.innerText = "🤝 MAÇ BİTTİ! BERABERLIK! 🤝";
            statsDiv.innerHTML = `<p class="winner">SONUÇ: <strong>BERABERLIK</strong></p><p><strong>Nihai Skor:</strong> <span style="color:#ff6b6b">${redScore}</span> - <span style="color:#4dabf7">${blueScore}</span></p>`;
        }
    }

    const endModal = document.getElementById('endGameModal');
    if(endModal) endModal.style.display = 'flex';
}

function shootBall(player) {
    if (!ball || isPaused || !player) return;

    let dist = Math.hypot(player.x - ball.x, player.y - ball.y);
    if (dist > player.radius + ball.radius + 20) return; // Hitbox genişletildi

    let angle;
    if (player.isHuman) {
        let directionX = 0;
        let directionY = 0;
        
        if (player.team === 'red' && (!localMultiplayer || singleMode)) {
            if (keys.w) directionY = -1;
            if (keys.s) directionY = 1;
            if (keys.a) directionX = -1;
            if (keys.d) directionX = 1;
        } 
        else if (player.team === 'blue' && localMultiplayer) {
            if (keys.ArrowUp) directionY = -1;
            if (keys.ArrowDown) directionY = 1;
            if (keys.ArrowLeft) directionX = -1;
            if (keys.ArrowRight) directionX = 1;
        }
        else if (player.team === 'red' && localMultiplayer) {
            if (keys.w) directionY = -1;
            if (keys.s) directionY = 1;
            if (keys.a) directionX = -1;
            if (keys.d) directionX = 1;
        }
        
        // Eğer hiçbir yön tuşuna basılmadıysa, oyuncunun son hareket yönünü kullan
        if (directionX === 0 && directionY === 0) {
            // Oyuncunun hızına göre yön belirle
            if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
                directionX = player.vx;
                directionY = player.vy;
            } else {
                // Hiç hareket etmiyorsa takımın kale yönüne vur
                directionX = player.team === 'red' ? 1 : -1;
            }
        }
        
        angle = Math.atan2(directionY, directionX);
        
        // Rastgele sapma ekle (daha az)
        if (Math.random() < 0.15) {
            angle += (Math.random() - 0.5) * 0.4;
        }
        
    } else {
        const targetX = (player.team === 'red') ? canvas.width : 0;
        const targetY = canvas.height / 2;
        angle = Math.atan2(targetY - player.y, targetX - player.x);
    }

    // Oyuncunun hızını da hesaba kat
    const speedBonus = Math.hypot(player.vx, player.vy) * 0.3;
    const totalForce = CONFIG.shootForce + speedBonus;
    
    ball.vx = Math.cos(angle) * totalForce;
    ball.vy = Math.sin(angle) * totalForce;
}

function tryTackle(p) {
    if(!p || isPaused) return;
    
    if(p.isHuman) {
        if(p.team === 'red') {
            if(Date.now() < lastTackleTime + CONFIG.tackleCooldown) {
                return;
            }
            lastTackleTime = Date.now();
        } 
        else if(p.team === 'blue') {
            if(Date.now() < lastTackleTime2 + CONFIG.tackleCooldown) {
                return;
            }
            lastTackleTime2 = Date.now();
        }
    } else {
        if(Date.now() < p.lastAiTackleTime + CONFIG.tackleCooldown) return;
        p.lastAiTackleTime = Date.now();
    }

    let tackleSuccess = false;
    players.forEach(enemy => {
        if(enemy.team !== p.team) {
            let dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if(dist < 70) {
                enemy.stunned = true;
                enemy.stunTimer = Date.now() + CONFIG.tackleStun;
                tackleSuccess = true;
            }
        }
    });
    
    if(tackleSuccess && p.isHuman) {
        const teamName = p.team === 'red' ? '🔴 Kırmızı' : '🔵 Mavi';
        const playerDisplayName = p.team === 'red' ? playerName : playerName2;
        addChatMessage(`💥 ${teamName} - ${playerDisplayName} rakibe müdahale etti!`);
    }
}

function addChatMessage(message) {
    const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chatMessages.push({ text: message, time: timestamp });
    
    if(chatMessages.length > 50) {
        chatMessages.shift();
    }
    
    updateChatDisplay();
}

function updateChatDisplay() {
    const chatBox = document.getElementById('chatBox');
    if(!chatBox) return;
    
    chatBox.innerHTML = '';
    chatMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        msgDiv.innerHTML = `<span class="chat-time">[${msg.time}]</span> ${msg.text}`;
        chatBox.appendChild(msgDiv);
    });
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

function drawField() {
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fieldTop = 80;
    const fieldBottom = canvas.height - 80;
    const fieldLeft = 60;
    const fieldRight = canvas.width - 60;
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, fieldTop);
    ctx.fillRect(0, fieldBottom, canvas.width, canvas.height - fieldBottom);
    ctx.fillRect(0, fieldTop, fieldLeft, fieldBottom - fieldTop);
    ctx.fillRect(fieldRight, fieldTop, canvas.width - fieldRight, fieldBottom - fieldTop);

    crowd.forEach(c => {
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x - 2, c.y, 4, 6);
        
        ctx.beginPath();
        ctx.arc(c.x, c.y - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        const wave = Math.sin(Date.now() / 500 + c.x) * 2;
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x - 2, c.y + 2);
        ctx.lineTo(c.x - 4, c.y + 4 + wave);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c.x + 2, c.y + 2);
        ctx.lineTo(c.x + 4, c.y + 4 - wave);
        ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    for(let i = fieldLeft; i < fieldRight; i += 40) {
        if(Math.floor((i - fieldLeft) / 40) % 2 === 0) {
            ctx.fillStyle = '#3a6b1e';
        } else {
            ctx.fillStyle = '#2d5016';
        }
        ctx.fillRect(i, fieldTop, 40, fieldBottom - fieldTop);
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(fieldLeft, fieldTop, fieldRight - fieldLeft, fieldBottom - fieldTop);

    ctx.beginPath();
    ctx.moveTo(midX, fieldTop);
    ctx.lineTo(midX, fieldBottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    const penaltyW = 160;
    const penaltyH = 300;
    
    ctx.strokeRect(fieldLeft, midY - penaltyH/2, penaltyW, penaltyH);
    ctx.beginPath();
    ctx.arc(fieldLeft + 110, midY, 80, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(fieldLeft + 110, midY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeRect(fieldRight - penaltyW, midY - penaltyH/2, penaltyW, penaltyH);
    ctx.beginPath();
    ctx.arc(fieldRight - 110, midY, 80, Math.PI/2, -Math.PI/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(fieldRight - 110, midY, 4, 0, Math.PI * 2);
    ctx.fill();

    const smallW = 60;
    const smallH = 160;
    ctx.strokeRect(fieldLeft, midY - smallH/2, smallW, smallH);
    ctx.strokeRect(fieldRight - smallW, midY - smallH/2, smallW, smallH);

    drawGoal(fieldLeft, 'left');
    drawGoal(fieldRight, 'right');

    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(fieldLeft - 4, fieldTop - 4, 8, 8);
    ctx.fillRect(fieldRight - 4, fieldTop - 4, 8, 8);
    ctx.fillRect(fieldLeft - 4, fieldBottom - 4, 8, 8);
    ctx.fillRect(fieldRight - 4, fieldBottom - 4, 8, 8);
}

function drawGoal(x, side) {
    const midY = canvas.height / 2;
    const goalH = 200;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    
    let xOff = side === 'left' ? -40 : 0;
    
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.fillRect(x + xOff, midY - goalH/2, 40, goalH);
    
    ctx.strokeRect(x + xOff, midY - goalH/2, 40, goalH);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for(let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x + xOff, midY - goalH/2 + (i * goalH/5));
        ctx.lineTo(x + xOff + 40, midY - goalH/2 + (i * goalH/5));
        ctx.stroke();
    }
    for(let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + xOff + (i * 20), midY - goalH/2);
        ctx.lineTo(x + xOff + (i * 20), midY + goalH/2);
        ctx.stroke();
    }
}

function drawFlagPlayer(c, r, flagId) {
    if (!c) return;
    const flagData = FLAGS.find(f => f.id === flagId);
    if (!flagData) {
        c.beginPath();
        c.fillStyle = '#999';
        c.arc(0,0,r,0,Math.PI*2);
        c.fill();
        return;
    }

    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.clip();

    const w = r * 2;
    const h = r * 2;
    const x = -r;
    const y = -r;
    const segmentW = w / flagData.colors.length;

    flagData.colors.forEach((color, index) => {
        c.fillStyle = color;
        c.fillRect(x + index * segmentW, y, segmentW, h);
    });

    c.strokeStyle = '#222';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
}

function updateSkillHUD() {
    if (localMultiplayer) {
        // 2 Oyuncu modunda - SOL ve SAĞ
        const container1 = document.getElementById('skillBarContainer');
        const container2 = document.getElementById('skillBarContainer2');
        if (container1) {
            container1.style.display = 'flex';
            container1.style.left = '20px';  // SOL
            container1.style.right = 'auto';
        }
        if (container2) {
            container2.style.display = 'flex';
            container2.style.right = '20px';  // SAĞ
            container2.style.left = 'auto';
        }
        
        // Oyuncu 1 (Kırmızı) - SOL
        const shiftBar = document.getElementById('staminaShift');
        const pct = (sprintEnergy / CONFIG.sprintDuration) * 100;
        if(shiftBar) shiftBar.style.height = pct + "%";

        const eBar = document.getElementById('cooldownE');
        let remaining = (lastTackleTime + CONFIG.tackleCooldown) - Date.now();
        if(remaining < 0) remaining = 0;
        const ePct = (remaining / CONFIG.tackleCooldown) * 100;
        if(eBar) eBar.style.height = ePct + "%";
        
        // Oyuncu 2 (Mavi) - SAĞ
        const shiftBar2 = document.getElementById('staminaShift2');
        const pct2 = (sprintEnergy2 / CONFIG.sprintDuration) * 100;
        if(shiftBar2) shiftBar2.style.height = pct2 + "%";

        const iBar = document.getElementById('cooldownI');
        let remaining2 = (lastTackleTime2 + CONFIG.tackleCooldown) - Date.now();
        if(remaining2 < 0) remaining2 = 0;
        const iPct = (remaining2 / CONFIG.tackleCooldown) * 100;
        if(iBar) iBar.style.height = iPct + "%";
        
        return;
    }
    
    // Normal modda sadece oyuncu 1 - SOL
    const container1 = document.getElementById('skillBarContainer');
    const container2 = document.getElementById('skillBarContainer2');
    if (container1) {
        container1.style.display = 'flex';
        container1.style.left = '20px';  // SOL
        container1.style.right = 'auto';
    }
    if (container2) container2.style.display = 'none';
    
    const shiftBar = document.getElementById('staminaShift');
    const pct = (sprintEnergy / CONFIG.sprintDuration) * 100;
    if(shiftBar) shiftBar.style.height = pct + "%";

    const eBar = document.getElementById('cooldownE');
    let remaining = (lastTackleTime + CONFIG.tackleCooldown) - Date.now();
    if(remaining < 0) remaining = 0;
    const ePct = (remaining / CONFIG.tackleCooldown) * 100;
    if(eBar) eBar.style.height = ePct + "%";
}

function gameLoop(currentTime) {
    if (lastFrameTime) {
        const delta = currentTime - lastFrameTime;
        fps = 1000 / delta;
    }
    lastFrameTime = currentTime;

    if (!gameActive) {
        requestAnimationFrame(gameLoop);
        return;
    }

    drawField();

    updateSkillHUD();

    if(!isPaused) {
        players.forEach(p => p.update());
        if (ball) ball.update();
        updateConfetti(); // Konfeti güncelle
    }

    players.forEach(p => p.draw());
    if (ball) ball.draw();
    
    drawConfetti(); // Konfeti çiz
    drawChatBox();
    drawFPS();

    requestAnimationFrame(gameLoop);
}

// FPS SAYACI
function drawFPS() {
    if (!ctx || !canvas) return;
    
    // FPS rengini belirle
    let fpsColor;
    if (fps >= 60) {
        fpsColor = '#00ff00'; // Yeşil
    } else if (fps >= 30) {
        fpsColor = '#ffff00'; // Sarı
    } else {
        fpsColor = '#ff0000'; // Kırmızı
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 100, 40);
    
    ctx.strokeStyle = fpsColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 100, 40);
    
    ctx.fillStyle = fpsColor;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${Math.round(fps)}`, 20, 38);
}

function drawChatBox() {
    if (!ctx || !canvas) return;
    
    const boxWidth = 400;
    const boxHeight = 180;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = canvas.height - boxHeight - 30;
    
    ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📢 MAÇ YORUMLARI', boxX + boxWidth/2, boxY + 25);
    
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxX + 10, boxY + 35);
    ctx.lineTo(boxX + boxWidth - 10, boxY + 35);
    ctx.stroke();
    
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    const startY = boxY + 55;
    const lineHeight = 22;
    const maxMessages = 5;
    const startIndex = Math.max(0, chatMessages.length - maxMessages);
    
    for(let i = startIndex; i < chatMessages.length; i++) {
        const msg = chatMessages[i];
        const yPos = startY + (i - startIndex) * lineHeight;
        
        ctx.fillStyle = '#ccc';
        ctx.fillText(`[${msg.time}]`, boxX + 15, yPos);
        
        ctx.fillStyle = '#fff';
        const messageText = msg.text.substring(0, 50);
        ctx.fillText(messageText, boxX + 95, yPos);
    }
}

// ---------- GİRİŞ (INPUT) ----------
window.addEventListener('keydown', e => {
    if(e.key.toLowerCase() === 'w') keys.w = true;
    if(e.key.toLowerCase() === 'a') keys.a = true;
    if(e.key.toLowerCase() === 's') keys.s = true;
    if(e.key.toLowerCase() === 'd') keys.d = true;
    if(e.key === 'Shift' && e.location === 1) keys.Shift = true;
    
    if(localMultiplayer) {
        if(e.key === 'ArrowUp') { e.preventDefault(); keys.ArrowUp = true; }
        if(e.key === 'ArrowDown') { e.preventDefault(); keys.ArrowDown = true; }
        if(e.key === 'ArrowLeft') { e.preventDefault(); keys.ArrowLeft = true; }
        if(e.key === 'ArrowRight') { e.preventDefault(); keys.ArrowRight = true; }
        if(e.key === 'Shift' && e.location === 2) keys.ShiftRight = true;
    }
    
    const humanPlayers = players.filter(p => p.isHuman);
    if (humanPlayers.length === 0) return;

    const player1 = humanPlayers.find(p => p.team === 'red');
    if(player1) {
        if(e.code === 'Space') {
            e.preventDefault();
            shootBall(player1);
        }
        if(e.key.toLowerCase() === 'e') {
            tryTackle(player1);
        }
    }
    
    if(localMultiplayer) {
        const player2 = humanPlayers.find(p => p.team === 'blue');
        if(player2) {
            if(e.key.toLowerCase() === 'l') {
                e.preventDefault();
                shootBall(player2);
            }
            if(e.key.toLowerCase() === 'i') {
                tryTackle(player2);
            }
        }
    }
});

window.addEventListener('keyup', e => {
    if(e.key.toLowerCase() === 'w') keys.w = false;
    if(e.key.toLowerCase() === 'a') keys.a = false;
    if(e.key.toLowerCase() === 's') keys.s = false;
    if(e.key.toLowerCase() === 'd') keys.d = false;
    if(e.key === 'Shift' && e.location === 1) keys.Shift = false;
    
    if(localMultiplayer) {
        if(e.key === 'ArrowUp') keys.ArrowUp = false;
        if(e.key === 'ArrowDown') keys.ArrowDown = false;
        if(e.key === 'ArrowLeft') keys.ArrowLeft = false;
        if(e.key === 'ArrowRight') keys.ArrowRight = false;
        if(e.key === 'Shift' && e.location === 2) keys.ShiftRight = false;
    }
});

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});