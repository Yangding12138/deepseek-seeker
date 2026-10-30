import { CFG } from './config.js';

const P = CFG.player;
const PL = CFG.plane;

// 2.5D 平面：x 水平、y 纵深（脚底屏幕 y）、hz 离地高度
export class Player {
  constructor(x, y) {
    this.w = 14; this.h = 28;
    this.x = x;
    this.y = y ?? (PL.y0 + PL.y1) / 2;
    this.hz = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.face = 1;
    this.onGround = true;
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
    this.walkDir = 0;   // -1 上（远）、1 下（近）、0 平
    this.events = [];
  }

  get cx() { return this.x + this.w / 2; }
  get feet() { return this.y - this.hz; }        // 屏幕脚底
  get cy() { return this.feet - this.h * 0.5; }  // 身体中心

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
      if (this.thinking) this.releaseBurst();
      else if (this.energy >= CFG.think.max) { this.thinking = true; this.thinkT = 0; }
    }
    if (this.thinking) {
      this.energy -= CFG.think.drain * dt;
      this.thinkT += dt;
      if (this.energy <= 0) { this.energy = 0; this.releaseBurst(); }
    }

    const dirX = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const dirY = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dirX !== 0) this.face = dirX;
    this.walkDir = dirY;
    this.running = (dirX !== 0 || dirY !== 0);

    // ---- 冲刺（沿面朝方向）----
    if (inp.dashPressed && this.dashCd <= 0) {
      this.dashT = P.dashTime;
      this.dashCd = P.dashCd;
      this.invuln = Math.max(this.invuln, P.dashInvuln);
      this.vx = this.face * P.dashSpeed;
      this.events.push({ type: 'dash' });
    }

    const maxSpd = P.speed * this.slowMul;
    const maxDepthSpd = P.depthSpeed * this.slowMul;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.face * P.dashSpeed;
    } else if (dirX !== 0) {
      this.vx += Math.sign(dirX * maxSpd - this.vx) * P.accel * dt;
      if (Math.abs(this.vx) > maxSpd) this.vx = Math.sign(this.vx) * maxSpd;
    } else {
      const f = P.friction * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    // 纵深速度（不参与重力，纯粹的平面移动）
    if (dirY !== 0) {
      const target = dirY * maxDepthSpd;
      this.vy += Math.sign(target - this.vy) * P.accel * 0.9 * dt;
      if (Math.abs(this.vy) > maxDepthSpd) this.vy = Math.sign(this.vy) * maxDepthSpd;
    } else {
      const f = P.friction * 1.1 * dt;
      this.vy = Math.abs(this.vy) <= f ? 0 : this.vy - Math.sign(this.vy) * f;
    }

    // ---- 跳跃（只在 hz 轴上）----
    if (inp.jumpPressed) this.jumpBuf = P.jumpBuffer;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.onGround ? P.coyote : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vz = P.jumpV;
      this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
      this.events.push({ type: 'jump' });
    }
    // 松手小跳
    if (!inp.jump && this.vz > 120) this.vz -= 900 * dt;

    this.vz -= CFG.gravity * dt;
    this.hz += this.vz * dt;
    if (this.hz <= 0) { this.hz = 0; this.vz = 0; this.onGround = true; }

    // ---- 射击 ----
    if ((inp.shot || (this.touchAutoFire && inp.shotPressed)) && this.shotCd <= 0) {
      this.shotCd = P.shotCd;
      this.events.push({
        type: 'shoot',
        x: this.cx + this.face * 9,
        y: this.y,
        hz: this.hz + 20,
        face: this.face,
        dmg: P.shotDmg * (this.thinking ? CFG.think.dmgMul : 1),
      });
    }

    // ---- 位移 ----
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.length) { this.x = level.length - this.w; this.vx = 0; }
    if (this.y < PL.y0) { this.y = PL.y0; this.vy = 0; }
    if (this.y > PL.y1) { this.y = PL.y1; this.vy = 0; }

    // 机柜障碍（横跨整个纵深，只能绕行）
    for (const s of level.solids) {
      if (s.kind !== 'wall') continue;
      if (this.x + this.w > s.x && this.x < s.x + s.w) {
        this.x = this.vx > 0 ? s.x - this.w : s.x + s.w;
        this.vx = 0;
      }
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
    this.events.push({ type: 'burst', x: this.cx, y: this.cy, hz: this.hz, r: CFG.think.burstR, dmg: CFG.think.burstDmg });
    this.energy = 0;
  }

  hurt(dmg, fromDir = 0) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = P.hurtInvuln;
    this.hurtT = 0.32;
    this.vx = (fromDir || -this.face) * P.knockX;
    this.hz = Math.max(this.hz, 6);
    this.vz = 90;
    this.thinking = false;
    this.addEnergy(CFG.think.gainHurt);
    this.events.push({ type: 'hurt' });
    if (this.hp <= 0) { this.dead = true; this.events.push({ type: 'die' }); }
    return true;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y ?? (PL.y0 + PL.y1) / 2;
    this.hz = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hp = Math.max(30, this.hp);
    this.invuln = CFG.feel.respawnInvuln;
    this.thinking = false;
    this.energy = Math.max(this.energy, 30);
  }
}
