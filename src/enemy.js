import { CFG } from './config.js';
import { drawBug, drawGhost } from './render.js';

const PL = CFG.plane;

// 2.5D 敌人：x 水平、y 纵深、hz 高度（幽灵在空中）
export class Enemy {
  constructor(type, x, y) {
    this.type = type;
    this.dead = false;
    this.hurtT = 0;
    this.t = Math.random() * 6;
    this.x = x;
    this.y = y ?? (PL.y0 + PL.y1) / 2;

    if (type === 'bug') {
      const c = CFG.enemy.bug;
      this.w = 18; this.h = 12;
      this.hz = 0;
      this.hp = c.hp; this.maxHp = c.hp; this.dmg = c.dmg;
      this.speed = c.speed; this.score = c.score;
      this.face = 1;
      this.homeY = this.y;
    } else {
      const c = CFG.enemy.ghost;
      this.w = 20; this.h = 20;
      this.hz = 30 + Math.random() * 12;
      this.baseHz = this.hz;
      this.hp = c.hp; this.maxHp = c.hp; this.dmg = c.dmg;
      this.speed = c.speed; this.score = c.score;
      this.face = 1;
    }
  }

  get cx() { return this.x + this.w / 2; }
  get feet() { return this.y - this.hz; }
  get cy() { return this.feet - this.h * 0.5; }
  get midHz() { return this.hz + this.h * 0.5; }   // 身体中心高度

  update(dt, player, level) {
    this.t += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);

    const dx = player.cx - this.cx;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.type === 'bug') {
      // 平面追击，只在近距离咬人
      if (dist > 22 && dist < 230) {
        const k = 1 / (dist || 1);
        this.x += dx * k * this.speed * dt;
        this.y += dy * k * this.speed * 0.8 * dt;
        this.face = dx > 0 ? 1 : -1;
      } else {
        // 无目标时在纵深上轻微晃动
        this.y += Math.sin(this.t * 1.6) * 6 * dt;
      }
      this.hz = 0;
    } else {
      // 幽灵：悬浮 + 平面靠近，高度跟随玩家头部附近
      const wantHz = Math.max(26, player.hz + 24);
      this.hz += (wantHz - this.hz) * 1.6 * dt;
      this.hz += Math.sin(this.t * 2.2) * 5 * dt;
      if (dist < 210) {
        const k = 1 / (dist || 1);
        this.x += dx * k * this.speed * dt;
        this.y += dy * k * this.speed * 0.9 * dt;
      }
      this.face = dx > 0 ? 1 : -1;
    }

    // 边界
    this.x = Math.max(0, Math.min(level.length - this.w, this.x));
    this.y = Math.max(PL.y0, Math.min(PL.y1, this.y));

    // 接触伤害（3D 判定）
    if (this.hitsPlayer(player) && player.invuln <= 0) {
      player.hurt(this.dmg, Math.sign(player.cx - this.cx) || 1);
    }
  }

  hitsPlayer(p) {
    return Math.abs(p.cx - this.cx) < (p.w + this.w) * 0.42 &&
           Math.abs(p.y - this.y) < PL.dyTol &&
           Math.abs((p.hz + 14) - this.midHz) < 22;
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hurtT = 0.12;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  draw(ctx, t, scale) {
    const s = scale ?? 1;
    ctx.save();
    // 地面影子：离地越高越小越淡
    const lift = this.hz || 0;
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0.1, 0.34 * (1 - lift / 110)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(this.cx, this.y + 1, (this.w * 0.44) * s * (1 - lift / 240), 2.4 * s, 0, 0, 7);
    ctx.fill();
    ctx.translate(this.cx, this.feet);
    ctx.scale(s, s);
    if (this.hurtT > 0) ctx.globalAlpha = 0.72;
    if (this.type === 'bug') drawBug(ctx, 0, 0, { t, face: this.face });
    else drawGhost(ctx, 0, -this.h * 0.5, { t });
    ctx.restore();
  }
}
