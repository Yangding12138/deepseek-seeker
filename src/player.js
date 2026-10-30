import { CFG } from './config.js';

const P = CFG.player;

export class Player {
  constructor(x, y) {
    this.w = 13; this.h = 28;
    this.x = x; this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.invuln = 0;
    this.hurtT = 0;
    this.shotCd = 0;
    this.hp = P.hp;
    this.maxHp = P.hp;
    this.energy = 0;
    this.thinking = false;
    this.thinkT = 0;
    this.dead = false;
    this.slowMul = 1;
    this.animT = 0;
    this.running = false;
    this.events = [];
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get feet() { return this.y + this.h; }

  addEnergy(v) { this.energy = Math.min(CFG.think.max, this.energy + v); }

  update(dt, inp, level) {
    this.events.length = 0;
    this.animT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.shotCd = Math.max(0, this.shotCd - dt);

    // ---- 思考模式切换 ----
    if (inp.thinkPressed) {
      if (this.thinking) {
        this.releaseBurst();
      } else if (this.energy >= CFG.think.max) {
        this.thinking = true;
        this.thinkT = 0;
      }
    }
    if (this.thinking) {
      this.energy -= CFG.think.drain * dt;
      this.thinkT += dt;
      if (this.energy <= 0) { this.energy = 0; this.releaseBurst(); }
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) this.face = dir;
    this.running = dir !== 0 && this.onGround;

    // ---- 冲刺 ----
    if (inp.dashPressed && this.dashCd <= 0) {
      this.dashT = P.dashTime;
      this.dashCd = P.dashCd;
      this.invuln = Math.max(this.invuln, P.dashInvuln);
      this.vx = this.face * P.dashSpeed;
      this.vy = Math.min(this.vy, 0) * 0.2;
      this.events.push({ type: 'dash' });
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.face * P.dashSpeed;
      this.vy += CFG.gravity * 0.12 * dt;
    } else {
      // 水平加速
      const maxSpd = P.speed * this.slowMul;
      const target = dir * maxSpd;
      if (dir !== 0) {
        this.vx += Math.sign(target - this.vx) * P.accel * dt;
        if (Math.abs(this.vx) > maxSpd) this.vx = Math.sign(this.vx) * maxSpd;
      } else {
        const f = P.friction * dt;
        this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
      }
      this.vy = Math.min(this.vy + CFG.gravity * dt, P.maxFall);
    }

    // ---- 跳跃（含土狼时间与输入缓冲）----
    if (inp.jumpPressed) this.jumpBuf = P.jumpBuffer;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.onGround ? P.coyote : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -P.jumpV;
      this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
      this.events.push({ type: 'jump' });
    }
    // 松手小跳
    if (!inp.jump && this.vy < -120) this.vy += 900 * dt;

    // ---- 射击 ----
    if ((inp.shot || (this.touchAutoFire && inp.shotPressed)) && this.shotCd <= 0) {
      this.shotCd = P.shotCd;
      this.events.push({
        type: 'shoot',
        x: this.cx + this.face * 8,
        y: this.y + 18,
        vx: this.face * P.shotSpeed,
        dmg: P.shotDmg * (this.thinking ? CFG.think.dmgMul : 1),
      });
    }

    // ---- 移动 + 碰撞 ----
    this.x += this.vx * dt;
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.length) { this.x = level.length - this.w; this.vx = 0; }

    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;
    this.onGround = false;
    for (const s of level.solids) {
      if (this.x + this.w <= s.x || this.x >= s.x + s.w) continue;
      if (this.vy >= 0 && prevBottom <= s.y + 1 && this.y + this.h >= s.y && this.y + this.h <= s.y + 12) {
        this.y = s.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // 掉出屏幕
    if (this.y > CFG.H + 40) {
      this.hurt(CFG.level.fallDamage, this.face * -1);
      this.events.push({ type: 'fell' });
    }

    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.events.push({ type: 'die' });
    }
    return this.events;
  }

  releaseBurst() {
    if (!this.thinking) return;
    this.thinking = false;
    this.events.push({ type: 'burst', x: this.cx, y: this.cy, r: CFG.think.burstR, dmg: CFG.think.burstDmg });
    this.energy = 0;
  }

  hurt(dmg, fromDir = 0) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = P.hurtInvuln;
    this.hurtT = 0.32;
    this.vx = (fromDir || -this.face) * P.knockX;
    this.vy = P.knockY;
    this.thinking = false;
    this.addEnergy(CFG.think.gainHurt);
    this.events.push({ type: 'hurt' });
    if (this.hp <= 0) { this.dead = true; this.events.push({ type: 'die' }); }
    return true;
  }

  respawn(x, y) {
    this.x = x; this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.hp = Math.max(30, this.hp);
    this.invuln = 1.4;
    this.thinking = false;
    this.energy = Math.max(this.energy, 30);
  }
}
