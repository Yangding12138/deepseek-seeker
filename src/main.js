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
  } else if (state === 'dead') {
    if (overlayT > 2.2) respawnAtCheckpoint();
  } else if (state === 'win') {
    if (overlayT > 2.6 && anyStart()) { initAudio(); newGame(); }
  }
  Input.clearEdges && Input.clearEdges();
}

function anyStart() {
  return Input.jumpPressed || Input.dashPressed || Input.shotPressed || Input.enterPressed;
}

function respawnAtCheckpoint() {
  const p = G.player;
  p.dead = false;
  p.hp = p.maxHp;
  p.respawn(G.checkpoint.x, G.checkpoint.y);
  G.enemies = G.enemies.filter(e => !e.dead);
  state = 'play';
  overlayT = 0;
}

function update(dt) {
  G.t += dt;
  const p = G.player;
  const level = G.level;

  // 世界时间（思考模式慢放）
  const worldDt = dt * (p.thinking ? CFG.think.slow : 1);

  // 糖水减速
  p.slowMul = G.boss ? G.boss.slowFactor(p) : 1;

  // 玩家
  const ev = p.update(dt, Input, level);
  for (const e of ev) {
    if (e.type === 'shoot') {
      G.bullets.push({ x: e.x, y: e.y, vx: e.vx, vy: 0, r: 2.6, dmg: e.dmg, life: 1.6, from: 'p' });
      sfx('shot');
    } else if (e.type === 'jump') sfx('jump');
    else if (e.type === 'dash') {
      sfx('dash');
      for (let i = 0; i < 6; i++) addParticle(p.cx, p.cy, 'rgba(120,220,255,.8)', 3);
    } else if (e.type === 'hurt') { sfx('hurt'); shake(0.35, 4); }
    else if (e.type === 'die') { state = 'dead'; overlayT = 0; sfx('hurt'); shake(0.6, 6); }
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
    spawnEnemy(s.type, s.x, s.y || level.groundY);
  }

  // 敌人
  for (const en of G.enemies) {
    if (!en.dead) en.update(worldDt, p, level);
  }
  // 冲刺撞击 / 子弹
  for (const en of G.enemies) {
    if (en.dead) continue;
    if (p.dashT > 0 && overlap(p, en)) {
      if (en.hit(CFG.player.dashDmg)) { onKill(en); }
      else { sfx('hit'); addParticle(en.cx, en.cy, '#ffd76b', 4); }
    }
  }
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * worldDt; b.y += b.vy * worldDt; b.life -= worldDt;
    if (b.life <= 0) { G.bullets.splice(i, 1); continue; }
    let hitSomething = false;
    for (const en of G.enemies) {
      if (en.dead) continue;
      if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
        p.addEnergy(CFG.think.gainHit);
        addParticle(b.x, b.y, '#7fe9ff', 3);
        if (en.hit(b.dmg)) onKill(en);
        else sfx('hit');
        hitSomething = true;
        break;
      }
    }
    if (!hitSomething && G.boss && !G.boss.dead &&
        b.x > G.boss.x - 18 && b.x < G.boss.x + 18 &&
        b.y > G.boss.y - 60 && b.y < G.boss.y) {
      p.addEnergy(CFG.think.gainHit);
      addParticle(b.x, b.y, '#ffc2d8', 3);
      if (G.boss.hit(b.dmg)) onBossDefeat();
      else sfx('hit');
      hitSomething = true;
    }
    if (hitSomething) G.bullets.splice(i, 1);
  }

  // Boss
  if (!G.bossActive && p.cx > level.bossTrigger) {
    G.bossActive = true;
    G.boss = new Doubao(level.bossX, level.groundY ?? CFG.groundY);
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
    if (Math.hypot(en.cx - e.x, en.cy - e.y) < e.r) {
      if (en.hit(e.dmg)) onKill(en);
    }
  }
  if (G.boss && !G.boss.dead) {
    if (Math.hypot(G.boss.cx - e.x, G.boss.cy - e.y) < e.r + 14) {
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

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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

  // 地面敌人 / 幽灵
  for (const en of G.enemies) if (!en.dead) en.draw(ctx, G.t);
  if (G.boss) G.boss.draw(ctx);
  // 子弹
  for (const b of G.bullets) {
    ctx.save();
    ctx.shadowColor = '#7fe9ff';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#eaffff';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 3.0, 1.9, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(90,225,255,.45)';
    ctx.beginPath(); ctx.ellipse(b.x - b.vx * 0.016, b.y, 9, 1.3, 0, 0, 7); ctx.fill();
  }
  // 粒子
  for (const q of G.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;

  // 玩家
  if (!p.dead) {
    drawHero(ctx, p.cx, p.feet, {
      t: p.animT, face: p.face, running: p.running,
      air: !p.onGround, dashing: p.dashT > 0,
      thinking: p.thinking, hurtT: p.hurtT,
    });
  }
  ctx.restore();

  // 思考模式滤镜
  if (p.thinking) drawThinkFilter();
  drawHUD();
  if (state === 'dead') drawDead();
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
    ctx.fillText(Input.touch ? '左摇杆移动 · 右「跳 / 弹 / 冲撞」' : 'A D 移动 · 空格跳 · U 射击 · J 冲撞 · E 思考', W / 2, H - 16);
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

function drawDead() {
  const a = Math.min(0.85, overlayT * 1.6);
  ctx.fillStyle = `rgba(4,8,14,${a})`;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,120,140,.95)';
  ctx.fillText('掉线重连中…', W / 2, H / 2 - 6);
  const dots = '.'.repeat(1 + Math.floor(overlayT * 3) % 3);
  ctx.font = '8px ui-monospace,monospace';
  ctx.fillStyle = 'rgba(180,220,240,.65)';
  ctx.fillText('reconnect' + dots, W / 2, H / 2 + 10);
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
  ctx.fillText('分数 ' + G.score + '   击败 ' + G.kills, W / 2, H / 2 + 16);
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
  warp(x) { if (G) { G.player.x = x; G.player.y = CFG.groundY - G.player.h; } },
};
