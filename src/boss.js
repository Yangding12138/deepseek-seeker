import { CFG } from './config.js';
import { drawDoubao, drawPearl, drawPuddle } from './render.js';

const B = CFG.boss;

export class Doubao {
  constructor(x, groundY) {
    this.x = x;
    this.groundY = groundY;
    this.y = groundY;
    this.w = 34; this.h = 44;
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
    this.say = '';
    this.sayT = 0;
  }

  get cx() { return this.x; }
  get cy() { return this.y - this.h * 0.6; }
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

    // 面向玩家
    this.face = player.cx < this.x ? -1 : 1;

    const spd = this.phase2 ? 0.62 : 1;
    this.pearlCd -= dt;
    this.sweepCd -= dt;
    this.summonCd -= dt;

    // 横扫
    if (this.sweepT > 0) {
      this.sweepT -= dt;
      const dir = player.cx < this.x ? -1 : 1;
      this.x += dir * 205 * dt;
      this.x = Math.max(this.homeX - 170, Math.min(this.homeX + 30, this.x));
      if (this._hits(player) && player.invuln <= 0) player.hurt(B.touchDmg, player.cx < this.x ? -1 : 1);
      if (this.sweepT <= 0) { this.x = this.homeX; }
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
        game.spawnEnemy('bug', this.x - 40 - i * 26, this.groundY);
      }
      this.sayT = 1.4; this.say = '再来两杯。';
    }

    // 接触伤害
    if (this._hits(player) && player.invuln <= 0) player.hurt(B.touchDmg, player.cx < this.x ? -1 : 1);

    this._updatePearls(dt, player);
  }

  _throwPearls() {
    const n = this.phase2 ? 5 : 3;
    const dir = this.face;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 0.22;
      this.pearls.push({
        x: this.x - dir * 12,
        y: this.y - 44,
        vx: dir * (110 + Math.random() * 40) * Math.cos(spread),
        vy: (-190 - Math.random() * 40) + spread * 90,
        r: 4.4,
        life: 3,
      });
    }
  }

  _updatePearls(dt, player) {
    for (let i = this.pearls.length - 1; i >= 0; i--) {
      const p = this.pearls[i];
      p.vy += CFG.gravity * 0.85 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // 命中玩家
      if (player.invuln <= 0 &&
          Math.hypot(p.x - player.cx, p.y - player.cy) < p.r + 7) {
        player.hurt(B.dmg, Math.sign(p.vx) || 1);
        this.pearls.splice(i, 1);
        continue;
      }
      if (p.y >= this.groundY - 1 || p.life <= 0) {
        this.puddles.push({ x: p.x, y: this.groundY, r: 24, life: 4.2 });
        this.pearls.splice(i, 1);
      }
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const d = this.puddles[i];
      d.life -= dt;
      if (d.life <= 0) this.puddles.splice(i, 1);
    }
  }

  // 玩家是否站在糖水里
  slowFactor(player) {
    for (const d of this.puddles) {
      if (Math.abs(player.cx - d.x) < d.r && Math.abs(player.feet - d.y) < 8) return 0.55;
    }
    return 1;
  }

  _hits(p) {
    return p.x < this.x + 17 && p.x + p.w > this.x - 17 &&
           p.y + p.h > this.y - 60 && p.y < this.y;
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
          x: this.x, y: this.y - 40,
          vx: (Math.random() - 0.5) * 220,
          vy: -120 - Math.random() * 150,
          r: 2.6, life: 2.2,
        });
      }
    }
    return this.dead;
  }

  draw(ctx) {
    ctx.save();
    // 视觉尺寸放大（判定区同步放宽）
    ctx.translate(this.x, this.y);
    ctx.scale(1.35, 1.35);
    ctx.translate(-this.x, -this.y);
    if (this.hurtT > 0) ctx.globalAlpha = 0.7;
    if (this.dead) {
      ctx.globalAlpha = Math.max(0, 1 - this.deadT * 0.6);
      ctx.translate(0, Math.min(14, this.deadT * 26));
    }
    drawDoubao(ctx, this.x, this.y, { t: this.t, face: this.face, hurtT: this.hurtT });
    ctx.restore();

    for (const d of this.puddles) {
      const a = Math.min(0.42, d.life * 0.2);
      drawPuddle(ctx, d.x, d.y, d.r, a);
    }
    for (const p of this.pearls) drawPearl(ctx, p.x, p.y, p.r);
  }
}
