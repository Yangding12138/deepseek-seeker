// 键盘 + 触屏统一输入层
export const Input = {
  left: false, right: false, up: false, down: false,
  jump: false, dash: false, shot: false, think: false,
  jumpPressed: false, dashPressed: false, thinkPressed: false,
  touch: false,
  _edge: {},
  _prev: {},

  init(canvas) {
    const keymap = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      Space: 'jump', KeyK: 'jump',
      KeyJ: 'dash', ShiftLeft: 'dash', KeyL: 'dash',
      KeyU: 'shot', KeyI: 'shot',
      KeyE: 'think', KeyQ: 'think',
    };
    addEventListener('keydown', (e) => {
      const k = keymap[e.code];
      if (k) {
        e.preventDefault();
        if (!this[k]) this._edge[k] = true;
        this[k] = true;
      }
      if (e.code === 'Enter') this._enterFlag = true;
    });
    addEventListener('keyup', (e) => {
      const k = keymap[e.code];
      if (k) { e.preventDefault(); this[k] = false; }
    });

    // 触屏
    const pad = document.getElementById('pad');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const isTouch = matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    if (isTouch) { pad.classList.add('on'); this.touch = true; }

    let sid = null, cx = 0, cy = 0;
    const R = 42;
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      sid = t.identifier;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this._moveStick(t.clientX, t.clientY, cx, cy, R, knob);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === sid) this._moveStick(t.clientX, t.clientY, cx, cy, R, knob);
      }
    }, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          sid = null; this.left = this.right = false;
          knob.style.transform = 'translate(0,0)';
        }
      }
    };
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);

    const bind = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); if (!this[key]) this._edge[key] = true; this[key] = true; el.dataset.hit = '1'; }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this[key] = false; }, { passive: false });
      el.addEventListener('touchcancel', () => { this[key] = false; });
    };
    bind('btnJump', 'jump');
    bind('btnDash', 'dash');
    bind('btnShot', 'shot');
    bind('btnThink', 'think');

    // 触屏点画布 = 跳跃（左侧区域）/ 射击（右侧）
    canvas.addEventListener('touchstart', (e) => {
      if (e.target !== canvas) return;
      for (const t of e.changedTouches) {
        const r = canvas.getBoundingClientRect();
        if (t.clientX < r.left + r.width * 0.5) this.jump = true;
        else this.shot = true;
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { this.jump = false; this.shot = false; });

    this._knob = knob;
  },

  _moveStick(x, y, cx, cy, R, knob) {
    let dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    dx = dx / len * cl; dy = dy / len * cl;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    this.left = dx < -12;
    this.right = dx > 12;
    this.down = dy > 26;
  },

  // 每帧开始：计算边沿触发
  begin() {
    this.jumpPressed = !!this._edge.jump || (this.jump && !this._prev.jump);
    this.dashPressed = !!this._edge.dash || (this.dash && !this._prev.dash);
    this.thinkPressed = !!this._edge.think || (this.think && !this._prev.think);
    this.shotPressed = !!this._edge.shot || (this.shot && !this._prev.shot);
    this._edge = {};
    this.enterPressed = !!this._enterFlag;
    this._enterFlag = false;
    this._prev.jump = this.jump;
    this._prev.dash = this.dash;
    this._prev.think = this.think;
    this._prev.shot = this.shot;
  },

  clear() {
    this.left = this.right = this.up = this.down = false;
    this.jump = this.dash = this.shot = this.think = false;
  },
};
