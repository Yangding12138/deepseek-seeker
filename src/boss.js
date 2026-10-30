import { CFG } from './config.js';
import { drawDoubao, drawPearl, drawPuddle } from './render.js';

const B = CFG.boss;
const PL = CFG.plane;

// 豆包：站在平面上，珍珠弹带高度（hz），糖水铺在地面的某个纵深位置
export class Doubao {
  constructor(x, y) {
    this.x = x;
    this.y = y ?? (PL.y0 + PL.y1) / 2;
    this.w = 34; this.h = 52;
    this.hz = 0;
    this.hp = B.hp; this.maxHp = B.hp;
    this.face = -1;
    this.t = 0;
    this.hurtT = 0;
    this.dead = false;
    this.deadT = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.pearlCd = 1.4;
    this.sweepCd = B.sweepCd;
    this.summonCd = B.summonCd;
    this.pearls = [];
    this.puddles = [];
    this.sweepT = 0;
    this.homeX = x;
    this.homeY = this.y;
    this.say = '';
    this.sayT = 0;
  }

  get cx() { return this.x; }
  get feet() { return this.y; }
  get cy() { return this.y - this.h * 0.55; }
  get midHz() { return this.h * 0.55; }
  get phase2() { return this.hp < this.maxHp * 0.5; }

  update(dt, player, game) {
    this.t += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.sayT = Math.max(0, this.sayT - dt);

    if (this.dead) {
      this.deadT += dt;
      this._updatePearls(dt, player);
      return;
    }

    this.face = player.cx < this.x ? -1 : 1;

    const spd = this.phase2 ? 0.62 : 1;
    this.pearlCd -= dt;
    this.sweepCd -= dt;
    this.summonCd -= dt;

    // 缓慢在纵深上跟着玩家（压迫感）
    const wantY = Math.max(PL.y0 + 8, Math.min(PL.y1 - 6, player.y));
    this.y += Math.sign(wantY - this.y) * 14 * dt;

    // 横扫
    if (this.sweepT > 0) {
      this.sweepT -= dt;
      const dir = player.cx < this.x ? -1 : 1;
      this.x += dir * 205 * dt;
      this.x = Math.max(this.homeX - 170, Math.min(this.homeX + 30, this.x));
      if (this._hits(player) && player.invuln <= 0) player.hurt(B.touchDmg, player.cx < this.x ? -1 : 1);
      if (this.sweepT <= 0) this.x = this.homeX;
      return;
    }

    if (this.pearlCd <= 0) {
      this.pearlCd = B.pearlCd * spd;
      this._throwPearls();
      this.sayT = 1.6; this.say = '要不要加一份珍珠？';
    }
    if (this.sweepCd <= 0 && Math.abs(player.cx - this.x) < 170) {
      this.sweepCd = B.sweepCd * spd;
      this.sweepT = 0.62;
      this.sayT = 1.4; this.say = '小心烫哦！';
    }
    if (this.summonCd <= 0) {
      this.summonCd = B.summonCd * spd;
      for (let i = 0; i < 2; i++) {
        game.spawnEnemy('bug', this.x - 40 - i * 26, this.y + (i ? 8 : -8));
      }
      this.sayT = 1.4; this.say = '再来两杯。';
    }

    if (this._hits(player) && player.invuln <= 0) player.hurt(B.touchDmg, player.cx < this.x ? -1 : 1);
    this._updatePearls(dt, player);
  }

  _throwPearls() {
    const n = this.phase2 ? 5 : 3;
    const dir = this.face;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) / Math.max(1, n - 1);   // -0.5 .. 0.5
      this.pearls.push({
        x: this.x - dir * 12,
        y: this.y,
        hz: 42,
        vx: dir * (108 + Math.random() * 36),
        vy: spread * 46,          // 纵深散开
        vhz: 120 + Math.random() * 40,
        r: 4.4,
        life: 3,
      });
    }
  }

  _updatePearls(dt, player) {
    for (let i = this.pearls.length - 1; i >= 0; i--) {
      const p = this.pearls[i];
      p.vhz -= CFG.gravity * 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.hz += p.vhz * dt;
      p.life -= dt;

      // 命中玩家（3D：水平 + 纵深 + 高度）
      if (player.invuln <= 0 &&
          Math.abs(p.x - player.cx) < p.r + 7 &&
          Math.abs(p.y - player.y) < PL.dyTol + 2 &&
          Math.abs(p.hz - (player.hz + 14)) < 20) {
        player.hurt(B.dmg, Math.sign(p.vx) || 1);
        this.pearls.splice(i, 1);
        continue;
      }
      if (p.hz <= 0 || p.life <= 0) {
        this.puddles.push({ x: p.x, y: Math.max(PL.y0, Math.min(PL.y1, p.y)), r: 24, life: 4.2 });
        this.pearls.splice(i, 1);
      }
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const d = this.puddles[i];
      d.life -= dt;
      if (d.life <= 0) this.puddles.splice(i, 1);
    }
  }

  // 玩家是否站在糖水里（要求同一纵深）
  slowFactor(player) {
    for (const d of this.puddles) {
      if (Math.abs(player.cx - d.x) < d.r && Math.abs(player.y - d.y) < PL.dyTol) return 0.55;
    }
    return 1;
  }

  _hits(p) {
    return Math.abs(p.cx - this.x) < 17 + p.w * 0.4 &&
           Math.abs(p.y - this.y) < PL.dyTol &&
           p.hz < 34;
  }

  hit(dmg) {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtT = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      this.say = '……最后一杯，算我请。';
      this.sayT = 4;
      for (let i = 0; i < 14; i++) {
        this.pearls.push({
          x: this.x, y: this.y, hz: 40,
          vx: (Math.random() - 0.5) * 220,
          vy: (Math.random() - 0.5) * 40,
          vhz: 120 + Math.random() * 150,
          r: 2.6, life: 2.2,
        });
      }
    }
    return this.dead;
  }

  draw(ctx, scale) {
    const s = (scale ?? 1) * 1.28;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, 16 * s, 4 * s, 0, 0, 7); ctx.fill();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    if (this.hurtT > 0) ctx.globalAlpha = 0.7;
    if (this.dead) {
      ctx.globalAlpha = Math.max(0, 1 - this.deadT * 0.6);
      ctx.translate(0, Math.min(10, this.deadT * 20));
    }
    drawDoubao(ctx, 0, 0, { t: this.t, face: this.face, hurtT: this.hurtT });
    ctx.restore();

    // 糖水铺在地面（按纵深位置画）
    for (const d of this.puddles) {
      const a = Math.min(0.42, d.life * 0.2);
      drawPuddle(ctx, d.x, d.y, d.r, a);
    }
    // 珍珠按高度画在纵深位置上
    for (const p of this.pearls) drawPearl(ctx, p.x, p.y - p.hz, p.r);
  }
}
