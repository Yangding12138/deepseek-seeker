import { CFG } from './config.js';
import { drawBug, drawGhost } from './render.js';

export class Enemy {
  constructor(type, x, y) {
    this.type = type;
    this.dead = false;
    this.hurtT = 0;
    this.t = Math.random() * 6;
    if (type === 'bug') {
      const c = CFG.enemy.bug;
      this.w = 18; this.h = 12;
      this.x = x; this.y = y - this.h;
      this.hp = c.hp; this.maxHp = c.hp; this.dmg = c.dmg;
      this.speed = c.speed; this.score = c.score;
      this.vx = Math.random() < 0.5 ? -1 : 1;
      this.baseX = x; this.range = 46;
      this.face = this.vx > 0 ? 1 : -1;
    } else {
      const c = CFG.enemy.ghost;
      this.w = 20; this.h = 20;
      this.x = x; this.y = (y || 140) - this.h;
      this.hp = c.hp; this.maxHp = c.hp; this.dmg = c.dmg;
      this.speed = c.speed; this.score = c.score;
      this.baseY = this.y;
      this.face = 1;
    }
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt, player, level) {
    this.t += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);

    if (this.type === 'bug') {
      this.x += this.vx * this.speed * dt;
      if (this.x < this.baseX - this.range) { this.x = this.baseX - this.range; this.vx *= -1; }
      if (this.x > this.baseX + this.range) { this.x = this.baseX + this.range; this.vx *= -1; }
      // 撞墙掉头
      for (const s of level.solids) {
        if (s.kind !== 'wall') continue;
        if (this.x + this.w > s.x && this.x < s.x + s.w && this.y + this.h > s.y) {
          this.x = this.vx > 0 ? s.x - this.w : s.x + s.w;
          this.vx *= -1;
        }
      }
      this.face = this.vx > 0 ? 1 : -1;
    } else {
      // 幽灵缓慢贴近玩家
      const dx = player.cx - this.cx;
      const dy = player.cy - 8 - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 190) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * 0.7 * dt;
      }
      this.y += Math.sin(this.t * 2.4) * 8 * dt;
      this.x = Math.max(0, Math.min(level.length - this.w, this.x));
      this.face = dx > 0 ? 1 : -1;
    }

    // 接触伤害
    if (this._hits(player) && player.invuln <= 0) {
      player.hurt(this.dmg, Math.sign(player.cx - this.cx) || 1);
    }
  }

  _hits(p) {
    return p.x < this.x + this.w && p.x + p.w > this.x &&
           p.y < this.y + this.h && p.y + p.h > this.y;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hurtT = 0.12;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  draw(ctx, t) {
    if (this.hurtT > 0) ctx.globalAlpha = 0.75;
    if (this.type === 'bug') drawBug(ctx, this.cx, this.y + this.h, { t, face: this.face });
    else drawGhost(ctx, this.cx, this.y + this.h * 0.6, { t });
    ctx.globalAlpha = 1;
  }
}
