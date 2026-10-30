import { CFG } from './config.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Doubao } from './boss.js';
import { Level } from './level.js';
import { drawHero, rr } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const { W, H } = CFG;
const PL = CFG.plane;

let dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const vw = innerWidth, vh = innerHeight;
  const scale = Math.min(vw / W, vh / H);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = Math.round(W * scale) + 'px';
  canvas.style.height = Math.round(H * scale) + 'px';
  canvas.style.imageRendering = 'auto';
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

/* ---------------- 声音 ---------------- */
let ac = null;
function initAudio() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
}
function sfx(type) {
  if (!ac) return;
  const t0 = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g); g.connect(ac.destination);
  let f0 = 440, f1 = 440, dur = 0.08, vol = 0.06, wave = 'square';
  switch (type) {
    case 'shot': f0 = 720; f1 = 980; dur = 0.06; vol = 0.03; wave = 'square'; break;
    case 'hit': f0 = 320; f1 = 140; dur = 0.09; vol = 0.05; wave = 'sawtooth'; break;
    case 'kill': f0 = 220; f1 = 70; dur = 0.16; vol = 0.07; break;
    case 'jump': f0 = 380; f1 = 620; dur = 0.1; vol = 0.04; wave = 'triangle'; break;
    case 'dash': f0 = 180; f1 = 520; dur = 0.12; vol = 0.05; wave = 'sawtooth'; break;
    case 'hurt': f0 = 160; f1 = 60; dur = 0.22; vol = 0.09; wave = 'sawtooth'; break;
    case 'think': f0 = 520; f1 = 880; dur = 0.3; vol = 0.05; wave = 'sine'; break;
    case 'burst': f0 = 880; f1 = 110; dur = 0.4; vol = 0.1; wave = 'sine'; break;
    case 'win': f0 = 523; f1 = 1046; dur = 0.5; vol = 0.08; wave = 'triangle'; break;
    case 'die': f0 = 520; f1 = 60; dur = 0.55; vol = 0.11; wave = 'sawtooth'; break;
    case 'respawn': f0 = 300; f1 = 900; dur = 0.22; vol = 0.06; wave = 'sine'; break;
    case 'tick': f0 = 900; f1 = 900; dur = 0.03; vol = 0.02; wave = 'square'; break;
  }
  o.type = wave;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/* ---------------- 背景图 ---------------- */
const bgImg = new Image();
bgImg.src = './art/web/09-bg-shaft.jpg';

/* ---------------- 游戏状态 ---------------- */
let state = 'menu';       // menu | play | dead | win
let G = null;
let shakeT = 0, shakeMag = 0;
let overlayT = 0;
const REASON = [
  '分析：敌人投掷前摇约 0.4s',
  '推断：落点可预测，糖水会减速',
  '策略：冲刺穿过弹幕间隙',
  '注意：珍珠落地生成黏滞区',
  '计划：先清小兵，再贴脸输出',
  '风险：血量低于 30% 应拉开距离',
  '结论：现在，动手。',
];

function newGame() {
  const level = new Level(1);
  G = {
    level,
    player: new Player(level.spawn.x, level.spawn.y),
    enemies: [],
    bullets: [],
    particles: [],
    boss: null,
    bossActive: false,
    bossDone: 0,
    camX: 0,
    t: 0,
    kills: 0,
    spawnIdx: 0,
    checkpoint: level.spawn,
    hintT: 6,
    reasonScroll: 0,
    score: 0,
    hitstop: 0,
    deathT: 0,
    deaths: 0,
    reconnecting: 0,
  };
  state = 'play';
  overlayT = 0;
  Input.clear();
}

function spawnEnemy(type, x, y) {
  G.enemies.push(new Enemy(type, x, y));
}

/* ---------------- 主循环 ---------------- */
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;

  Input.begin();
  if (state === 'play') update(dt);
  else updateOverlay(dt);
  draw(dt);
  requestAnimationFrame(frame);
}

function updateOverlay(dt) {
  overlayT += dt;
  if (state === 'menu') {
    if (anyStart()) { initAudio(); newGame(); }
  } else if (state === 'win') {
    if (overlayT > 2.6 && anyStart()) { initAudio(); newGame(); }
  }
  Input.clearEdges && Input.clearEdges();
}

function anyStart() {
  return Input.jumpPressed || Input.dashPressed || Input.shotPressed || Input.enterPressed;
}

function doRespawn() {
  const p = G.player;
  const inBoss = G.bossActive && G.boss && !G.boss.dead;
  p.dead = false;
  p.hp = p.maxHp;
  p.invuln = CFG.feel.respawnInvuln;
  p.energy = 0;
  G.bullets.length = 0;
  if (inBoss) {
    p.respawn(G.level.bossTrigger + 10, G.level.bossY);
    const b = G.boss;
    b.hp = b.maxHp; b.state = 'idle'; b.stateT = 0; b.pearlCd = 1.6;
    b.sweepCd = 2.0; b.summonCd = 3.0; b.pearls.length = 0; b.puddles.length = 0; b.sweepT = 0;
    b.x = b.homeX; b.y = b.homeY; b.hurtT = 0;
  } else {
    p.respawn(G.checkpoint.x, G.checkpoint.y);
    G.enemies = G.enemies.filter(e => !e.dead);
  }
  G.deathT = 0;
  G.reconnecting = 1.5;
  shake(0.22, 3);
  sfx('respawn');
}

// 自动索敌：优先锁定最近的目标（含空中飞行的幽灵），没有目标就沿朝向平射
// 自动索敌：空中目标优先（地面敌人靠近了再瞄，远的直接平射）
function aimedShot(e) {
  const P = CFG.player;
  let best = null, bestScore = 1e9;
  const consider = (t) => {
    const dx = t.cx - e.x, dy = t.y - e.y, dz = t.midHz - e.hz;
    if (dx * e.face < -30) return;                     // 身后的不管
    const air = t.midHz > 26;
    const d = Math.hypot(dx, dy, dz);
    if (d > (air ? P.aimAssist : P.aimAssist * 0.45)) return;
    const score = d * (air ? 0.5 : 1) * (1 - 0.2 * Math.min(1, Math.abs(dy) / 44));
    if (score < bestScore) { bestScore = score; best = t; }
  };
  for (const en of G.enemies) if (!en.dead) consider(en);
  if (G.boss && !G.boss.dead) consider(G.boss);

  const sp = P.shotSpeed;
  const base = { x: e.x, y: e.y, hz: e.hz, r: 2.7, dmg: e.dmg, life: 1.5, from: 'p' };
  if (best) {
    G.lockTarget = best; G.lockT = 0.32;
    const dx = best.cx - e.x, dy = best.y - e.y, dz = best.midHz - e.hz;
    const L = Math.hypot(dx, dy, dz) || 1;
    return Object.assign(base, { vx: dx / L * sp, vy: dy / L * sp, vhz: dz / L * sp, homing: best });
  }
  // 没目标时带一点上抛，略微抬高的单位也能喂到
  return Object.assign(base, { vx: e.face * sp, vy: 0, vhz: Math.sin(P.shotArc) * sp, homing: null });
}

function update(dt) {
  G.t += dt;
  if (G.lockT > 0) G.lockT -= dt;
  const p = G.player;
  const level = G.level;

  // ── 死亡：世界定格，0.9 秒后原地/检查点重连（不弹菜单、不进结算，节奏不断）
  if (p.dead) {
    G.deathT += dt;
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const q = G.particles[i];
      q.x += q.vx * dt * 0.35; q.y += q.vy * dt * 0.35;
      q.vy += 60 * dt; q.life -= dt;
      if (q.life <= 0) G.particles.splice(i, 1);
    }
    if (shakeT > 0) shakeT -= dt;
    if (G.reconnecting > 0) G.reconnecting -= dt;
    if (G.deathT >= CFG.feel.respawnDelay) doRespawn();
    return;
  }

  // ── 命中顿帧（打击感）
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  if (G.reconnecting > 0) G.reconnecting -= dt;

  // 世界时间（思考模式慢放）
  const worldDt = dt * (p.thinking ? CFG.think.slow : 1);

  // 糖水减速
  p.slowMul = G.boss ? G.boss.slowFactor(p) : 1;

  // 玩家
  const ev = p.update(dt, Input, level);
  for (const e of ev) {
    if (e.type === 'shoot') {
      G.bullets.push(aimedShot(e));
      sfx('shot');
    } else if (e.type === 'jump') sfx('jump');
    else if (e.type === 'dash') {
      sfx('dash');
      for (let i = 0; i < 6; i++) addParticle(p.cx, p.cy, 'rgba(120,220,255,.8)', 3);
    } else if (e.type === 'hurt') { sfx('hurt'); shake(0.35, 4); }
    else if (e.type === 'die') {
      sfx('die'); shake(0.75, 7); G.hitstop = 0.14; G.deathT = 0; G.deaths++;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
        G.particles.push({
          x: p.cx, y: p.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 0.5 + Math.random() * 0.5, max: 1.0,
          color: i % 3 === 0 ? '#ffffff' : (i % 2 ? '#7fe9ff' : '#2f86c8'), size: 1.4 + Math.random() * 2,
        });
      }
    }
    else if (e.type === 'burst') {
      sfx('burst'); shake(0.4, 6);
      burstEffect(e);
    } else if (e.type === 'fell') {
      if (!p.dead) { p.respawn(G.checkpoint.x, G.checkpoint.y); shake(0.4, 5); }
    }
  }
  if (p.thinking && Math.random() < dt * 30) {
    addParticle(p.cx + (Math.random() - 0.5) * 16, p.cy + (Math.random() - 0.5) * 20, 'rgba(53,224,255,.9)', 2);
  }
  if (p.thinking) G.reasonScroll += dt * 14;

  // 检查点
  for (const c of level.checkpoints) {
    if (p.cx > c.x && c.x > G.checkpoint.x) G.checkpoint = c;
  }

  // 按距离生成敌人
  while (G.spawnIdx < level.enemySpawns.length &&
         level.enemySpawns[G.spawnIdx].x < p.cx + W * 0.9) {
    const s = level.enemySpawns[G.spawnIdx++];
    spawnEnemy(s.type, s.x, s.y);
  }

  // 敌人
  for (const en of G.enemies) {
    if (!en.dead) en.update(worldDt, p, level);
  }
  // 冲刺撞击 / 子弹
  for (const en of G.enemies) {
    if (en.dead) continue;
    if (p.dashT > 0 && overlap(p, en)) {
      G.hitstop = Math.max(G.hitstop, CFG.feel.hitstopHeavy);
      if (en.hit(CFG.player.dashDmg)) { onKill(en); }
      else { sfx('hit'); addParticle(en.cx, en.cy, '#ffd76b', 4); }
    }
  }
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    // 轻度追踪：锁定的目标还活着，就慢慢把弹道掰过去
    if (b.homing && !b.homing.dead) {
      const tg = b.homing;
      const dx = tg.cx - b.x, dy = tg.y - b.y, dz = tg.midHz - b.hz;
      const L = Math.hypot(dx, dy, dz) || 1;
      const sp = Math.hypot(b.vx, b.vy, b.vhz) || 1;
      const k = Math.min(1, 3.2 * worldDt);
      b.vx += (dx / L * sp - b.vx) * k;
      b.vy += (dy / L * sp - b.vy) * k;
      b.vhz += (dz / L * sp - b.vhz) * k;
    }
    b.x += b.vx * worldDt; b.y += b.vy * worldDt; b.hz += b.vhz * worldDt;
    b.life -= worldDt;
    if (b.life <= 0 || b.hz < -40 || b.hz > 220 || b.x < -80 || b.x > level.length + 80) {
      G.bullets.splice(i, 1); continue;
    }
    let hitSomething = false;
    for (const en of G.enemies) {
      if (en.dead) continue;
      if (Math.abs(b.x - en.cx) < b.r + en.w * 0.5 &&
          Math.abs(b.y - en.y) < PL.dyTol &&
          Math.abs(b.hz - en.midHz) < 18) {
        p.addEnergy(CFG.think.gainHit);
        addParticle(b.x, b.y - b.hz, '#7fe9ff', 3);
        if (en.hit(b.dmg)) { onKill(en); G.hitstop = Math.max(G.hitstop, CFG.feel.hitstopKill); }
        else { sfx('hit'); G.hitstop = Math.max(G.hitstop, CFG.feel.hitstopLight); }
        hitSomething = true;
        break;
      }
    }
    if (!hitSomething && G.boss && !G.boss.dead &&
        Math.abs(b.x - G.boss.cx) < 20 + b.r &&
        Math.abs(b.y - G.boss.y) < PL.dyTol + 3 &&
        b.hz > 1 && b.hz < G.boss.h * 1.05) {
      p.addEnergy(CFG.think.gainHit);
      addParticle(b.x, b.y - b.hz, '#ffc2d8', 3);
      if (G.boss.hit(b.dmg)) onBossDefeat();
      else { sfx('hit'); G.hitstop = Math.max(G.hitstop, CFG.feel.hitstopLight); }
      hitSomething = true;
    }
    if (hitSomething) G.bullets.splice(i, 1);
  }

  // Boss
  if (!G.bossActive && p.cx > level.bossTrigger) {
    G.bossActive = true;
    G.boss = new Doubao(level.bossX, level.bossY);
    G.hintT = 0;
  }
  if (G.boss && !G.boss.dead) {
    G.boss.update(worldDt, p, { spawnEnemy });
    if (G.boss.sweepT > 0 && Math.random() < dt * 20) addParticle(G.boss.x + (Math.random() - 0.5) * 20, G.boss.cy, 'rgba(255,180,210,.9)', 3);
  } else if (G.boss && G.boss.dead) {
    G.boss.deadT += dt;
    if (G.boss.deadT > 2.0 && state === 'play') {
      state = 'win'; overlayT = 0; sfx('win');
      saveBest(G.score);
    }
  }

  // 粒子
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const q = G.particles[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += 240 * dt; q.life -= dt;
    if (q.life <= 0) G.particles.splice(i, 1);
  }

  // 摄像机
  const maxCam = level.length - W;
  let targetCam = p.cx - W * 0.42;
  if (G.bossActive) targetCam = maxCam;
  targetCam = Math.max(0, Math.min(maxCam, targetCam));
  G.camX += (targetCam - G.camX) * Math.min(1, dt * 7);

  if (G.hintT > 0) G.hintT -= dt;
  if (shakeT > 0) shakeT -= dt;
}

function burstEffect(e) {
  for (const en of G.enemies) {
    if (en.dead) continue;
    if (Math.hypot(en.cx - e.x, en.y - e.y, en.midHz - e.hz) < e.r) {
      if (en.hit(e.dmg)) onKill(en);
    }
  }
  if (G.boss && !G.boss.dead) {
    if (Math.hypot(G.boss.cx - e.x, G.boss.y - e.y, G.boss.midHz - e.hz) < e.r + 14) {
      if (G.boss.hit(e.dmg)) onBossDefeat();
    }
    G.boss.pearls.length = 0;
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    G.particles.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * (120 + Math.random() * 130),
      vy: Math.sin(a) * (120 + Math.random() * 130),
      life: 0.5 + Math.random() * 0.3, max: 0.8,
      color: i % 2 ? '#7fe9ff' : '#ffffff', size: 1.6 + Math.random() * 1.6,
    });
  }
}

function onKill(en) {
  G.kills++;
  G.score += en.score;
  sfx('kill');
  for (let i = 0; i < 10; i++) addParticle(en.cx, en.cy, i % 2 ? '#5fbf8c' : '#3fe0ff', 3);
}

function onBossDefeat() {
  G.score += 5000;
  shake(0.8, 8);
  for (let i = 0; i < 40; i++) {
    addParticle(G.boss.x + (Math.random() - 0.5) * 40, G.boss.cy + (Math.random() - 0.5) * 40, i % 2 ? '#ff9ec4' : '#ffeede', 4);
  }
}

function addParticle(x, y, color, spd) {
  const a = Math.random() * Math.PI * 2;
  G.particles.push({
    x, y,
    vx: Math.cos(a) * spd * 40, vy: Math.sin(a) * spd * 40 - 40,
    life: 0.3 + Math.random() * 0.35, max: 0.65, color, size: 1 + Math.random() * 1.8,
  });
}

function shake(t, m) { shakeT = Math.max(shakeT, t); shakeMag = m; }

// 3D 接触判定（水平 + 纵深 + 高度）
function overlap(a, b) {
  const ac = a.hz + 14, bc = (b.midHz ?? b.hz) + 6;
  return Math.abs(a.cx - b.cx) < (a.w + b.w) * 0.5 &&
         Math.abs(a.y - b.y) < PL.dyTol &&
         Math.abs(ac - bc) < 24;
}

/* ---------------- 绘制 ---------------- */
function draw(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  if (!G) { drawMenu(dt); return; }
  const p = G.player, level = G.level;
  let camX = G.camX;
  if (shakeT > 0) {
    camX += (Math.random() - 0.5) * shakeMag;
  }

  level.draw(ctx, camX, G.t, bgImg);

  ctx.save();
  ctx.translate(-camX, 0);

  // 实体按纵深排序（远的先画，近的盖住远的）
  const ents = [];
  for (const en of G.enemies) {
    if (en.dead) continue;
    ents.push({ y: en.y, f: () => en.draw(ctx, G.t, level.scaleAt(en.y)) });
  }
  if (G.boss) ents.push({ y: G.boss.y, f: () => G.boss.draw(ctx, level.scaleAt(G.boss.y)) });
  if (!p.dead) {
    ents.push({
      y: p.y, f: () => {
        const sc = level.scaleAt(p.y);
        ctx.save();
        ctx.translate(p.cx, p.y);
        ctx.scale(sc, sc);
        drawHero(ctx, 0, -p.hz, {
          t: p.animT, face: p.face, running: p.running || p.walkDir !== 0,
          air: !p.onGround, dashing: p.dashT > 0,
          thinking: p.thinking, hurtT: p.hurtT,
          vz: p.vz, blink: p.invuln > 0.05, groundY: 0,
        });
        ctx.restore();
      }
    });
  }
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.f();

  // 子弹
  // 索敌锁定准星：告诉玩家这一发瞄的是谁（空中的也能锁）
  if (G.lockTarget && !G.lockTarget.dead && G.lockT > 0) {
    const lt = G.lockTarget;
    const lx = lt.cx, ly = lt.y - lt.midHz;
    const rr2 = 13 + Math.sin(G.t * 16) * 1.4;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,240,255,' + Math.min(1, G.lockT * 4).toFixed(2) + ')';
    ctx.lineWidth = 1.2;
    for (let q = 0; q < 4; q++) {
      ctx.beginPath();
      ctx.arc(lx, ly, rr2, q * Math.PI / 2 + 0.3, (q + 1) * Math.PI / 2 - 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const b of G.bullets) {
    const sy = b.y - b.hz;
    const sc = level.scaleAt(b.y);
    ctx.save();
    ctx.translate(b.x, sy);
    ctx.scale(sc, sc);
    ctx.shadowColor = '#7fe9ff';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#eaffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 2.5, 0, 0, 7); ctx.fill();
    ctx.restore();
    // 拖尾（沿速度反方向）
    const tl = Math.hypot(b.vx, b.vy, b.vhz) || 1;
    ctx.fillStyle = 'rgba(110,235,255,.55)';
    ctx.beginPath();
    ctx.ellipse(b.x - b.vx / tl * 12, sy + b.vhz / tl * 12, 14, 1.9, Math.atan2(-b.vhz, b.vx), 0, 7);
    ctx.fill();
  }
  // 粒子
  for (const q of G.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 思考模式滤镜
  if (p.thinking) drawThinkFilter();
  drawHUD();
  if (p.dead) drawReconnect();
  if (state === 'win') drawWin();
}

function drawThinkFilter() {
  ctx.save();
  ctx.fillStyle = 'rgba(8,26,46,.34)';
  ctx.fillRect(0, 0, W, H);
  // 扫描线
  ctx.fillStyle = 'rgba(53,224,255,.06)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  // 左侧推理链（深色底板，避免和场景糊在一起）
  ctx.fillStyle = 'rgba(3,12,22,.68)';
  rr(ctx, 6, 46, 158, 96, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(80,200,255,.20)'; ctx.lineWidth = 0.7;
  rr(ctx, 6, 46, 158, 96, 5); ctx.stroke();

  const lh = 11;
  const off = G.reasonScroll % (REASON.length * lh);
  ctx.font = '6.5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(140,240,255,.6)';
  ctx.fillText('推理链', 12, 58);
  ctx.fillStyle = 'rgba(80,200,255,.18)';
  ctx.fillRect(12, 61, 146, 0.7);

  for (let i = 0; i < 8; i++) {
    const idx = (Math.floor(off / lh) + i) % REASON.length;
    const y = 74 + i * lh - (off % lh);
    if (y < 68 || y > 139) continue;
    const k = 1 - i * 0.11;
    ctx.fillStyle = i === 0
      ? 'rgba(175,250,255,.96)'
      : `rgba(115,205,240,${Math.max(0.16, k * 0.72)})`;
    ctx.fillText(REASON[idx], 12, y);
  }
  ctx.restore();
}

function drawHUD() {
  const p = G.player;
  ctx.save();
  // ---- 左上：状态面板 ----
  ctx.fillStyle = 'rgba(6,14,24,.72)';
  rr(ctx, 8, 8, 110, 40, 5); ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '5.5px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(160,215,245,.85)';
  ctx.fillText('上下文窗口', 13, 16);
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 113, 16);

  const hpr = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  rr(ctx, 13, 18.5, 100, 6, 3); ctx.fill();
  const hg = ctx.createLinearGradient(13, 0, 113, 0);
  hg.addColorStop(0, hpr < 0.3 ? '#ff5b6e' : '#35e0ff');
  hg.addColorStop(1, hpr < 0.3 ? '#ff8a5b' : '#8ff0ff');
  ctx.fillStyle = hg;
  if (hpr > 0.002) { rr(ctx, 13, 18.5, 100 * hpr, 6, 3); ctx.fill(); }

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(160,215,245,.72)';
  ctx.fillText('思考', 13, 32);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(p.energy) + '%', 113, 32);

  ctx.fillStyle = 'rgba(255,255,255,.12)';
  rr(ctx, 13, 34, 100, 4.5, 2.2); ctx.fill();
  const er = Math.max(0, p.energy / CFG.think.max);
  const full = p.energy >= CFG.think.max;
  ctx.fillStyle = full ? (Math.floor(G.t * 8) % 2 ? '#fff6c0' : '#ffd76b') : '#6f8cff';
  if (er > 0.002) { rr(ctx, 13, 34, 100 * er, 4.5, 2.2); ctx.fill(); }

  if (full && !p.thinking) {
    ctx.textAlign = 'left';
    ctx.font = '6px -apple-system,sans-serif';
    ctx.fillStyle = Math.floor(G.t * 6) % 2 ? '#ffe9a8' : '#fff6c0';
    ctx.fillText('思考模式就绪 · 按 E 进入', 13, 56);
  } else if (p.thinking) {
    ctx.textAlign = 'left';
    ctx.font = '6px -apple-system,sans-serif';
    ctx.fillStyle = '#8ff0ff';
    ctx.fillText('思考中… 再按一次提前爆发', 13, 56);
  }

  // ---- 右上：分数与进度 ----
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(210,240,255,.92)';
  ctx.fillText(String(G.score).padStart(5, '0'), W - 12, 15);
  ctx.font = '5.5px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(150,200,230,.55)';
  ctx.fillText('SCORE', W - 12, 21.5);

  const pr = Math.max(0, Math.min(1, p.cx / G.level.length));
  ctx.fillStyle = 'rgba(150,200,230,.55)';
  ctx.textAlign = 'left';
  ctx.fillText('进度', W - 112, 27.5);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  rr(ctx, W - 92, 25, 80, 2.6, 1.3); ctx.fill();
  ctx.fillStyle = '#35e0ff';
  if (pr > 0.002) { rr(ctx, W - 92, 25, 80 * pr, 2.6, 1.3); ctx.fill(); }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(150,200,230,.55)';
  ctx.fillText('第 1 关 · 机房深井', W - 12, 36);

  // Boss 血条
  if (G.boss && !G.boss.dead) {
    const bw = 200, bx = (W - bw) / 2, by = 40;
    ctx.fillStyle = 'rgba(6,14,24,.7)';
    rr(ctx, bx - 6, by - 12, bw + 12, 24, 5); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px -apple-system,sans-serif';
    ctx.fillStyle = '#ffd6e8';
    ctx.fillText('豆包 ·「奶茶店员」', W / 2, by - 2);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    rr(ctx, bx, by + 3, bw, 5, 2.5); ctx.fill();
    const br = G.boss.hp / G.boss.maxHp;
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bg.addColorStop(0, '#ff9ec4'); bg.addColorStop(1, '#ffd9e6');
    ctx.fillStyle = bg;
    rr(ctx, bx, by + 3, bw * br, 5, 2.5); ctx.fill();
    // 台词
    if (G.boss.sayT > 0) {
      ctx.font = '7px -apple-system,sans-serif';
      ctx.fillStyle = `rgba(255,240,246,${Math.min(1, G.boss.sayT)})`;
      ctx.fillText(G.boss.say, W / 2, by + 20);
    }
  }

  // 开场提示
  if (G.hintT > 0) {
    const a = Math.min(1, G.hintT / 1.2) * Math.min(1, (6 - G.hintT) / 0.6);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = '7px -apple-system,sans-serif';
    ctx.fillStyle = '#cfeaff';
    ctx.fillText(Input.touch ? '左摇杆四向移动 · 右「跳 / 弹 / 冲撞」' : 'WASD 四向移动 · 空格跳 · U 射击 · J 冲撞 · E 思考', W / 2, H - 16);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMenu(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#08131f'); g.addColorStop(1, '#0d2438');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 网格
  ctx.strokeStyle = 'rgba(53,224,255,.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // 光晕
  const rg = ctx.createRadialGradient(W / 2, H * 0.36, 10, W / 2, H * 0.36, 150);
  rg.addColorStop(0, 'rgba(53,224,255,.18)');
  rg.addColorStop(1, 'rgba(53,224,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  const t = performance.now() / 1000;
  // 主角站立
  drawHero(ctx, W / 2, H * 0.62, { t, face: 1, running: false, air: false });

  ctx.textAlign = 'center';
  ctx.font = 'bold 26px -apple-system,"PingFang SC",sans-serif';
  ctx.fillStyle = '#eaf8ff';
  ctx.fillText('深 求 者', W / 2, H * 0.28);
  ctx.font = '8px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(140,220,255,.75)';
  ctx.fillText('DEEP SEEKER — 第一章 · 机房深井', W / 2, H * 0.28 + 14);

  const blink = 0.55 + Math.sin(t * 3) * 0.35;
  ctx.globalAlpha = blink;
  ctx.font = 'bold 10px -apple-system,sans-serif';
  ctx.fillStyle = '#9fefff';
  ctx.fillText(Input.touch ? '点下方按钮开始' : '按 空格 / Enter 开始', W / 2, H * 0.82);
  ctx.globalAlpha = 1;

  ctx.font = '6.5px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(150,200,230,.5)';
  ctx.fillText('同人作品 · 角色形象基于 DeepSeek 民间设定 · 非官方', W / 2, H - 8);
}

function drawReconnect() {
  const T = CFG.feel.respawnDelay;
  const k = Math.min(1, G.deathT / T);

  // 故障扫描条
  for (let i = 0; i < 5; i++) {
    const y = (G.t * 90 + i * 61) % H;
    const h = 2 + (i % 3);
    const off = Math.sin(G.t * 12 + i) * 5 * (1 - k * 0.6);
    ctx.fillStyle = i % 2 ? 'rgba(255,80,110,.13)' : 'rgba(80,220,255,.11)';
    ctx.fillRect(off, y, W, h);
  }
  // 整体压暗
  ctx.fillStyle = 'rgba(4,10,18,.62)'; ctx.fillRect(0, 0, W, H);

  // 提示底板
  const pw = 176, ph = 74, px = W / 2 - pw / 2, py = H / 2 - 40;
  ctx.fillStyle = 'rgba(6,16,26,.9)';
  rr(ctx, px, py, pw, ph, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(120,225,255,.26)'; ctx.lineWidth = 1;
  rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 6); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 14px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,140,160,.98)';
  ctx.fillText('连接中断', W / 2, py + 22);

  const dots = '.'.repeat(1 + Math.floor(G.t * 6) % 3);
  ctx.font = '8px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(190,228,246,.9)';
  ctx.fillText('重新连接中' + dots, W / 2, py + 36);

  // 进度条
  const bw = 108, bh = 3, bx = W / 2 - bw / 2, by = py + 45;
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  rr(ctx, bx, by, bw, bh, 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(120,225,255,.95)';
  rr(ctx, bx, by, bw * k, bh, 1.5); ctx.fill();

  ctx.font = '7.5px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(210,236,250,.95)';
  ctx.fillText('本次掉线 ' + G.deaths + ' 次 · 进度不丢，原地续上', W / 2, py + 63);
}


function drawWin() {
  const a = Math.min(0.9, overlayT * 1.4);
  ctx.fillStyle = `rgba(4,10,16,${a})`;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px -apple-system,sans-serif';
  ctx.fillStyle = '#eaf8ff';
  ctx.fillText('第一章 通关', W / 2, H / 2 - 22);
  ctx.font = '8px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(150,220,250,.8)';
  ctx.fillText('豆包把最后一杯递给你，说：下次别打脸。', W / 2, H / 2 - 4);
  ctx.font = 'bold 10px ui-monospace,monospace';
  ctx.fillStyle = '#9fefff';
  ctx.fillText('分数 ' + G.score + '   击败 ' + G.kills + '   掉线 ' + G.deaths, W / 2, H / 2 + 16);
  const best = +(localStorage.getItem('ds_seeker_best') || 0);
  ctx.font = '7px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(160,200,230,.7)';
  ctx.fillText('最佳 ' + Math.max(best, G.score), W / 2, H / 2 + 30);
  if (overlayT > 2.6) {
    ctx.globalAlpha = 0.55 + Math.sin(overlayT * 4) * 0.35;
    ctx.fillStyle = '#cfeaff';
    ctx.font = '8px -apple-system,sans-serif';
    ctx.fillText(Input.touch ? '点按钮再玩一次' : '按空格再来一次', W / 2, H - 26);
    ctx.globalAlpha = 1;
  }
}

function saveBest(s) {
  const best = +(localStorage.getItem('ds_seeker_best') || 0);
  if (s > best) localStorage.setItem('ds_seeker_best', String(s));
}

/* ---------------- 启动 ---------------- */
Input.init(canvas);
requestAnimationFrame((t) => { last = t; frame(t); });

// 桌面鼠标左键也能开始
canvas.addEventListener('mousedown', () => {
  if (state === 'menu' || state === 'win') { initAudio(); newGame(); }
});

// 调试钩子（本地验证用，不影响玩法）
window.__dev = {
  get G() { return G; },
  get state() { return state; },
  setState(s) { state = s; overlayT = 0; },
  newGame,
  warp(x, y) { if (G) { G.player.x = x; if (y != null) G.player.y = y; } },
  kill() { if (G && !G.player.dead) { G.player.hp = 0; G.player.dead = true; G.deathT = 0; G.deaths++; sfx('die'); shake(0.75, 7); } },
  hurt(n) { if (G) G.player.hurt(n, G.player.cx > 0 ? 1 : -1); },
};
