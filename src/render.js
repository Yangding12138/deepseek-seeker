// 程序化绘制的角色/道具，配合 art/ 下的概念图做背景与立绘
const C = {
  deep: '#1b4b8f', blue: '#2f86c8', cyan: '#35e0ff', ice: '#bfefff',
  white: '#f4fbff', skin: '#ffe5d2', apron: '#eef6ff',
  pink: '#ff9ec4', cream: '#ffeede', brown: '#6b4a3a', cup: '#f7e9d7',
  purple: '#8a5cf0', green: '#4caf7d', grey: '#9aa7b4', red: '#ff4d5e',
  gold: '#e8c46a', ink: '#101826',
};

/* ---------- 精灵资源（立绘抠图，见 tools/make_sprites.py） ---------- */
const HERO_H = 58;
const _spr = {};
for (const [k, src] of Object.entries({
  idle: './art/sprites/hero-idle.png',
  run:  './art/sprites/hero-run.png',
  jump: './art/sprites/hero-jump.png',
})) {
  const im = new Image();
  im.src = src;
  _spr[k] = im;
}

export function drawHero(ctx, cx, feetY, o = {}) {
  const t = o.t || 0;
  const key = o.air ? 'jump' : (o.running ? 'run' : 'idle');
  const img = _spr[key];
  if (!img || !img.complete || !img.naturalWidth) {
    drawHeroVector(ctx, cx, feetY, o);   // 图未就绪时退回矢量版
    return;
  }

  // 地面投影（跟纵深站脚点走，随跳跃高度变小变淡）
  const gY = o.groundY ?? feetY;
  const lift = Math.max(0, gY - feetY);
  const k = Math.max(0.18, 1 - lift / 130);
  ctx.save();
  ctx.globalAlpha = (o.air ? 0.3 : 0.42) * k;
  ctx.fillStyle = 'rgba(2,10,18,.9)';
  ctx.beginPath();
  ctx.ellipse(cx, gY + 1, (o.air ? 8 : 11) * k, (o.air ? 2.2 : 3) * k, 0, 0, 7);
  ctx.fill();
  ctx.restore();

  const h = HERO_H * (key === 'jump' ? 0.97 : 1);
  let w = h * (img.naturalWidth / img.naturalHeight);

  let sx = 1, sy = 1, rot = 0, bob = 0;
  if (key === 'run') {
    bob = -Math.abs(Math.sin(t * 13)) * 1.8;
    rot = Math.sin(t * 13) * 0.05;
  } else if (key === 'idle') {
    sy = 1 + Math.sin(t * 2.2) * 0.014;
    bob = Math.sin(t * 2.2) * 0.7;
  } else {
    const vy = Math.abs(o.vy || 0);
    sy = 1 + Math.min(0.14, vy / 700);
    sx = 1 - Math.min(0.08, vy / 1600);
  }
  if (o.dashing) { sx *= 1.14; sy *= 0.95; }
  if (o.hurtT > 0) rot += (Math.random() - 0.5) * 0.18;

  const face = o.face < 0 ? -1 : 1;

  // 冲刺残影
  if (o.dashing) {
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = 0.13 * (4 - i) / 3;
      ctx.translate(cx - face * i * 7, feetY + bob);
      ctx.scale(face * sx, sy);
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
    }
  }

  ctx.save();
  if (o.blink) ctx.globalAlpha = Math.sin(t * 26) > 0 ? 1 : 0.4;
  if (o.thinking) { ctx.shadowColor = 'rgba(90,225,255,.95)'; ctx.shadowBlur = 12; }
  else if (o.hurtT > 0) { ctx.shadowColor = 'rgba(255,95,125,.95)'; ctx.shadowBlur = 10; }
  else { ctx.shadowColor = 'rgba(120,220,255,.4)'; ctx.shadowBlur = 6; }
  ctx.translate(cx, feetY + bob);
  ctx.rotate(rot);
  ctx.scale(face * sx, sy);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- 主角：鲸鱼娘 小索 ---------------- */
function drawHeroVector(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const face = o.face || 1;
  const run = o.running ? 1 : 0;
  const air = o.air ? 1 : 0;
  const dash = o.dashing ? 1 : 0;
  const think = o.thinking ? 1 : 0;
  const hurt = o.hurtT > 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  if (hurt && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.55;

  const swing = Math.sin(t * 16) * (run ? 1 : 0.35);
  const bob = run ? Math.abs(Math.sin(t * 16)) * 1.6 : Math.sin(t * 2.4) * 0.7;

  // 轮廓光：保证在深色机房里始终能看见自己
  const glow = ctx.createRadialGradient(0, -18, 2, 0, -18, 26);
  glow.addColorStop(0, 'rgba(190,245,255,.20)');
  glow.addColorStop(1, 'rgba(190,245,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, -18, 26, 0, 7); ctx.fill();

  // 影子
  ctx.globalAlpha *= 0.9;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 1, 11, 3, 0, 0, 7); ctx.fill();
  ctx.globalAlpha /= 0.9;

  // 鲸尾（在身后，摆动）
  ctx.save();
  ctx.translate(-9, -13 + bob * 0.5);
  ctx.rotate(-0.5 + Math.sin(t * 3.2) * 0.22 + swing * 0.18);
  const tg = ctx.createLinearGradient(0, 0, -13, 3);
  tg.addColorStop(0, C.blue); tg.addColorStop(1, 'rgba(90,210,255,.55)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -5, -14, -7);
  ctx.quadraticCurveTo(-11, -1, -15, 4);
  ctx.quadraticCurveTo(-8, 4, 0, 3);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // 腿
  const legSwing = air ? 0.5 : swing;
  ctx.strokeStyle = C.skin; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2.4, -8); ctx.lineTo(-2.4 + legSwing * 2.6, -1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.4, -8); ctx.lineTo(2.4 - legSwing * 2.6, -1); ctx.stroke();
  // 鞋
  ctx.fillStyle = C.deep;
  ctx.beginPath(); ctx.ellipse(-2.4 + legSwing * 2.6, -0.6, 2.6, 1.6, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2.4 - legSwing * 2.6, -0.6, 2.6, 1.6, 0, 0, 7); ctx.fill();

  // 身体（围裙裙）
  const bodyY = -8 + bob * 0.4;
  ctx.fillStyle = C.deep;
  rr(ctx, -6.2, bodyY - 12, 12.4, 13, 3.4); ctx.fill();
  ctx.fillStyle = C.apron;
  rr(ctx, -5.2, bodyY - 9.5, 10.4, 9, 2.6); ctx.fill();
  // 领结
  ctx.fillStyle = C.cyan;
  ctx.beginPath(); ctx.moveTo(0, bodyY - 12.6); ctx.lineTo(-3, bodyY - 14.4); ctx.lineTo(-3, bodyY - 11); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, bodyY - 12.6); ctx.lineTo(3, bodyY - 14.4); ctx.lineTo(3, bodyY - 11); ctx.closePath(); ctx.fill();

  // 手臂
  ctx.strokeStyle = C.skin; ctx.lineWidth = 2.8;
  const armA = Math.sin(t * 16 + 1.4) * (run ? 0.9 : 0.3) - dash * 0.6;
  ctx.beginPath(); ctx.moveTo(5, bodyY - 10);
  ctx.lineTo(5 + Math.cos(armA) * 6, bodyY - 10 + Math.sin(armA) * 6 + 4); ctx.stroke();

  // 头
  const hy = bodyY - 21 - bob * 0.3;
  // 后发
  const hg = ctx.createLinearGradient(0, hy - 9, 0, hy + 14);
  hg.addColorStop(0, C.deep); hg.addColorStop(0.55, C.blue); hg.addColorStop(1, C.ice);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.ellipse(-0.5, hy + 3, 9.4, 12.4, 0, 0, 7); ctx.fill();
  // 脸
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.ellipse(0.5, hy + 0.4, 7.4, 7.0, 0, 0, 7); ctx.fill();
  // 刘海
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-7.6, hy - 1.6);
  ctx.quadraticCurveTo(-6, hy - 8.6, 0, hy - 8.2);
  ctx.quadraticCurveTo(6.4, hy - 8, 7.6, hy - 1.2);
  ctx.quadraticCurveTo(4, hy - 4.6, 1, hy - 3.4);
  ctx.quadraticCurveTo(-3.4, hy - 5.4, -7.6, hy - 1.6);
  ctx.closePath(); ctx.fill();
  // 呆毛
  ctx.strokeStyle = C.ice; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0.4, hy - 8.2);
  ctx.quadraticCurveTo(2.4, hy - 13.6, 5.2, hy - 12.2); ctx.stroke();
  // 鲸鳍耳
  ctx.fillStyle = 'rgba(90,210,255,.72)';
  ctx.beginPath(); ctx.moveTo(-6.6, hy - 1); ctx.quadraticCurveTo(-13.4, hy - 6.4, -12.4, hy + 2.2);
  ctx.quadraticCurveTo(-9.6, hy + 1.2, -6.6, hy + 2.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6.8, hy - 1.4); ctx.quadraticCurveTo(13.6, hy - 6.8, 12.6, hy + 1.8);
  ctx.quadraticCurveTo(9.8, hy + 0.8, 6.8, hy + 2.2); ctx.closePath(); ctx.fill();

  // 眼睛
  const blink = (t * 0.9 % 4.4) < 0.09;
  if (think) {
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(1.4, hy + 0.4); ctx.lineTo(5.2, hy + 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.6, hy + 0.6); ctx.lineTo(-1.6, hy + 0.5); ctx.stroke();
  } else if (blink) {
    ctx.strokeStyle = '#2a3a4a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(1.6, hy + 0.8); ctx.lineTo(4.8, hy + 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.4, hy + 1); ctx.lineTo(-1.4, hy + 1); ctx.stroke();
  } else {
    ctx.fillStyle = '#0d2438';
    ctx.beginPath(); ctx.ellipse(3.3, hy + 0.6, 1.5, 2.2, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2.9, hy + 0.8, 1.4, 2.1, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.cyan;
    ctx.beginPath(); ctx.ellipse(3.9, hy - 0.3, 0.7, 0.9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2.3, hy - 0.2, 0.65, 0.85, 0, 0, 7); ctx.fill();
  }
  // 腮红
  ctx.fillStyle = 'rgba(255,140,150,.42)';
  ctx.beginPath(); ctx.ellipse(5.8, hy + 3.4, 1.9, 1.1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4.6, hy + 3.6, 1.7, 1.0, 0, 0, 7); ctx.fill();

  // 手中提示词杖
  ctx.save();
  ctx.translate(6.5, bodyY - 9);
  ctx.rotate(-0.35 + Math.sin(t * 4) * 0.06);
  ctx.strokeStyle = C.ice; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -9); ctx.stroke();
  ctx.fillStyle = C.cyan;
  ctx.globalAlpha = 0.85 + Math.sin(t * 6) * 0.15;
  ctx.beginPath(); ctx.arc(0, -10.4, 2.4, 0, 7); ctx.fill();
  ctx.restore();

  // 思考模式光环
  if (think) {
    ctx.strokeStyle = `rgba(53,224,255,${0.35 + Math.sin(t * 9) * 0.15})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, hy - 22, 8 + Math.sin(t * 7) * 1.5, 0, 7); ctx.stroke();
  }

  ctx.restore();
}

/* ---------------- Boss：豆包 ---------------- */
function drawDoubaoVector(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const face = o.face || -1;
  const hurt = o.hurtT > 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  if (hurt && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.6;

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(0, 1, 16, 4, 0, 0, 7); ctx.fill();

  const bob = Math.sin(t * 2.2) * 1.2;
  // 腿
  ctx.strokeStyle = C.skin; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(-3, -1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -12); ctx.lineTo(3, -1); ctx.stroke();
  // 身体（奶茶店围裙）
  ctx.fillStyle = '#fff2e2';
  rr(ctx, -9, -30 + bob, 18, 19, 4); ctx.fill();
  ctx.fillStyle = C.pink;
  rr(ctx, -7, -24 + bob, 14, 13, 3); ctx.fill();
  // 领巾
  ctx.fillStyle = '#ffd9e6';
  rr(ctx, -5, -31 + bob, 10, 3.4, 1.6); ctx.fill();

  // 头
  const hy = -40 + bob;
  const hg = ctx.createLinearGradient(0, hy - 11, 0, hy + 8);
  hg.addColorStop(0, '#ffd0e0'); hg.addColorStop(1, C.pink);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, hy, 10.4, 0, 7); ctx.fill();
  // 双丸子
  ctx.beginPath(); ctx.arc(-9.4, hy - 7.6, 4.6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(9.4, hy - 7.6, 4.6, 0, 7); ctx.fill();
  // 猫耳发带
  ctx.fillStyle = '#ffeaf2';
  ctx.beginPath(); ctx.moveTo(-6, hy - 9.4); ctx.lineTo(-4.2, hy - 15.6); ctx.lineTo(-1.6, hy - 10.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6, hy - 9.4); ctx.lineTo(4.2, hy - 15.6); ctx.lineTo(1.6, hy - 10.2); ctx.closePath(); ctx.fill();
  // 脸
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.ellipse(1, hy + 1.4, 7.6, 6.8, 0, 0, 7); ctx.fill();
  // 眼睛（甜但累）
  ctx.fillStyle = '#3a2030';
  ctx.beginPath(); ctx.ellipse(4.2, hy + 1.2, 1.5, 2.1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-1.6, hy + 1.3, 1.4, 2.0, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(4.7, hy + 0.3, 0.55, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-1.1, hy + 0.4, 0.5, 0, 7); ctx.fill();
  // 微笑
  ctx.strokeStyle = '#c2607a'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(1.6, hy + 3.6, 2.2, 0.25, 2.9); ctx.stroke();
  // 腮红
  ctx.fillStyle = 'rgba(255,120,150,.4)';
  ctx.beginPath(); ctx.ellipse(7.2, hy + 4.2, 2, 1.2, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4.4, hy + 4.3, 1.9, 1.1, 0, 0, 7); ctx.fill();

  // 奶茶杯武器
  ctx.save();
  ctx.translate(11, -30 + bob);
  ctx.rotate(-0.2 + Math.sin(t * 3) * 0.08);
  ctx.fillStyle = C.cup;
  ctx.beginPath(); ctx.moveTo(-3.4, -8); ctx.lineTo(3.4, -8); ctx.lineTo(2.4, 7); ctx.lineTo(-2.4, 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c89a72';
  ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(3, -4); ctx.lineTo(2.5, 6.4); ctx.lineTo(-2.5, 6.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a28';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.arc(-1.3 + i * 0.9, 2 + (i % 2) * 2.4, 1, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#9fd6ff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(1.6, -8.6); ctx.lineTo(3.4, -16); ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/* ---------------- 杂兵 ---------------- */
const BOSS_H = 64;
const _bossImg = new Image();
_bossImg.src = './art/sprites/boss-doubao.png';

export function drawDoubao(ctx, x, feetY, o = {}) {
  const t = o.t || 0;
  const img = _bossImg;
  if (!img.complete || !img.naturalWidth) { drawDoubaoVector(ctx, x, feetY, o); return; }

  const face = o.face || -1;
  const hurt = o.hurtT > 0;
  const bob = Math.sin(t * 2.2) * 1.4;
  const h = BOSS_H, w = h * (img.naturalWidth / img.naturalHeight);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = 'rgba(2,10,18,.9)';
  ctx.beginPath(); ctx.ellipse(x, feetY + 1, 19, 4.4, 0, 0, 7); ctx.fill();
  ctx.restore();

  ctx.save();
  if (hurt && Math.floor(t * 22) % 2 === 0) ctx.globalAlpha = 0.55;
  ctx.translate(x, feetY + bob);
  ctx.scale(face, 1);
  if (hurt) { ctx.translate((Math.random() - 0.5) * 2.4, 0); }
  ctx.shadowColor = hurt ? 'rgba(255,120,150,.85)' : 'transparent';
  ctx.shadowBlur = hurt ? 12 : 0;
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  ctx.shadowBlur = 0;
}

export function drawBug(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const face = o.face || 1;
  ctx.save();
  ctx.translate(x, y); ctx.scale(face, 1);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 1, 8, 2.4, 0, 0, 7); ctx.fill();
  // 发光底圈（深色背景下保证可见）
  const bg2 = ctx.createRadialGradient(0, -5, 1, 0, -5, 13);
  bg2.addColorStop(0, 'rgba(80,255,180,.30)');
  bg2.addColorStop(1, 'rgba(80,255,180,0)');
  ctx.fillStyle = bg2;
  ctx.beginPath(); ctx.arc(0, -5, 13, 0, 7); ctx.fill();
  // 腿
  ctx.strokeStyle = '#2c3a2e'; ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    const ph = Math.sin(t * 14 + i) * 2;
    ctx.beginPath(); ctx.moveTo(i * 3, -4); ctx.lineTo(i * 3 - 3 + ph, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * 3, -4); ctx.lineTo(i * 3 + 3 + ph, 0); ctx.stroke();
  }
  // 壳
  const g = ctx.createLinearGradient(0, -10, 0, -1);
  g.addColorStop(0, '#5fbf8c'); g.addColorStop(1, '#2c6b4c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -5.4, 8.4, 5.2, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(140,255,210,.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, -5.4, 8.4, 5.2, 0, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#1e4a34';
  ctx.beginPath(); ctx.ellipse(0, -4.6, 8.4, 2.2, 0, 0, Math.PI); ctx.fill();
  // 电路纹
  ctx.strokeStyle = '#3fe0ff'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-4, -6.6); ctx.lineTo(0, -7.6); ctx.lineTo(4, -6.6); ctx.stroke();
  // 眼睛
  ctx.fillStyle = '#35e0ff';
  ctx.beginPath(); ctx.arc(-3, -5.2, 1.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -5.2, 1.1, 0, 7); ctx.fill();
  ctx.restore();
}

export function drawGhost(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const blink = Math.floor(t * 3) % 4 === 0;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.2) * 3);
  ctx.globalAlpha = blink ? 0.32 : 0.82;
  const g = ctx.createRadialGradient(0, -8, 1, 0, -8, 12);
  g.addColorStop(0, 'rgba(180,140,255,.95)');
  g.addColorStop(1, 'rgba(90,60,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -8, 12.5, 0, 7); ctx.fill();
  // 轮廓描亮，避免暗背景里糊成一团
  ctx.strokeStyle = 'rgba(212,186,255,.75)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, -8, 9.4, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-2.6, -9, 1.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(2.6, -9, 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1030';
  ctx.beginPath(); ctx.arc(-2.6, -9, 0.7, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(2.6, -9, 0.7, 0, 7); ctx.fill();
  ctx.restore();
}

export function drawPearl(ctx, x, y, r = 3) {
  if (!isFinite(x) || !isFinite(y) || !isFinite(r)) return;
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
  halo.addColorStop(0, 'rgba(255,205,230,.40)');
  halo.addColorStop(1, 'rgba(255,205,230,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#ffd9e8');
  g.addColorStop(1, '#b6778f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,232,.9)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}

export function drawPuddle(ctx, x, y, r, a = 0.42) {
  if (!isFinite(x) || !isFinite(y) || !isFinite(r)) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,190,215,.95)');
  g.addColorStop(1, 'rgba(180,120,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.34, 0, 0, 7); ctx.fill();
  ctx.restore();
}

export { C as COLORS, rr };
