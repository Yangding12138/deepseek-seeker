import { CFG } from './config.js';

const G = CFG.groundY;

// 地面被切成若干段，段与段之间是深井（掉下去扣血并回检查点）
const GROUND_SEGS = [
  [0, 700], [820, 1480], [1600, 2180], [2300, 3000],
];

export class Level {
  constructor(n = 1) {
    this.id = n;
    this.groundY = G;
    this.length = CFG.level.length;
    this.solids = [];
    for (const [a, b] of GROUND_SEGS) {
      this.solids.push({ x: a, y: G, w: b - a, h: 46, kind: 'ground' });
    }
    // 浮空检修平台
    const plats = [
      [240, 186, 74], [360, 156, 60], [470, 190, 70],
      [640, 168, 66], [880, 176, 78], [1010, 146, 62],
      [1140, 182, 70], [1290, 158, 74], [1420, 190, 60],
      [1660, 180, 76], [1800, 150, 64], [1950, 186, 82],
      [2100, 160, 66], [2240, 188, 70],
      [2400, 176, 70], [2500, 150, 60],
    ];
    for (const [x, y, w] of plats) this.solids.push({ x, y, w, h: 8, kind: 'plat' });

    // 静态障碍（机柜），当墙用
    this.props = [
      { x: 560, y: G - 34, w: 16, h: 34, kind: 'rack' },
      { x: 1240, y: G - 40, w: 18, h: 40, kind: 'rack' },
      { x: 2020, y: G - 30, w: 16, h: 30, kind: 'rack' },
    ];
    for (const p of this.props) this.solids.push({ x: p.x, y: p.y, w: p.w, h: p.h, kind: 'wall' });

    this.spawn = { x: 96, y: G };
    this.checkpoints = CFG.level.checkpoint.map((x) => ({ x, y: G }));
    this.bossTrigger = CFG.level.bossTrigger;
    this.bossX = 2740;

    this.enemySpawns = [
      { type: 'bug', x: 300 }, { type: 'bug', x: 420 }, { type: 'ghost', x: 520, y: 150 },
      { type: 'bug', x: 760 }, { type: 'bug', x: 900 }, { type: 'ghost', x: 1050, y: 120 },
      { type: 'bug', x: 1180 }, { type: 'bug', x: 1320 }, { type: 'ghost', x: 1400, y: 160 },
      { type: 'bug', x: 1700 }, { type: 'bug', x: 1820 }, { type: 'ghost', x: 1900, y: 130 },
      { type: 'bug', x: 2050 }, { type: 'bug', x: 2200 }, { type: 'ghost', x: 2320, y: 150 },
    ];
  }

  groundAt(y) { return y >= G; }

  draw(ctx, camX, t, bgImg) {
    const { W, H } = CFG;

    // 远景（视差）
    if (bgImg && bgImg.complete) {
      const par = 0.28;
      const sw = bgImg.width, sh = bgImg.height;
      const scale = Math.max(H / sh, 1);
      const dw = sw * scale, dh = sh * scale;
      let ox = -(camX * par) % dw;
      if (ox > 0) ox -= dw;
      ctx.globalAlpha = 0.85;
      for (let x = ox; x < W; x += dw) ctx.drawImage(bgImg, x, 0, dw, dh);
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a1526'); g.addColorStop(1, '#123049');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 暗角
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(4,10,20,.55)');
    vg.addColorStop(0.5, 'rgba(4,10,20,.12)');
    vg.addColorStop(1, 'rgba(4,10,20,.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camX, 0);

    // 地面
    for (const s of this.solids) {
      if (s.kind === 'ground') {
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        g.addColorStop(0, '#1a2a3c'); g.addColorStop(1, '#0a131f');
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = 'rgba(53,224,255,.5)';
        ctx.fillRect(s.x, s.y, s.w, 1.4);
        // 机柜纹理
        ctx.fillStyle = 'rgba(80,150,200,.10)';
        for (let x = s.x + 6; x < s.x + s.w; x += 26) ctx.fillRect(x, s.y + 4, 18, s.h - 8);
      } else if (s.kind === 'plat') {
        ctx.fillStyle = '#20374d';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = 'rgba(53,224,255,.65)';
        ctx.fillRect(s.x, s.y, s.w, 1.2);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        for (let x = s.x + 8; x < s.x + s.w - 4; x += 14) ctx.fillRect(x, s.y + 3, 2, s.h - 4);
      }
    }
    // 机柜障碍
    for (const p of this.props) {
      ctx.fillStyle = '#182b3d';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(53,224,255,.35)';
      for (let y = p.y + 4; y < p.y + p.h - 2; y += 6) ctx.fillRect(p.x + 3, y, p.w - 6, 1.6);
    }

    // 深井底部的雾
    for (const gap of [[700, 820], [1480, 1600], [2180, 2300]]) {
      const g = ctx.createLinearGradient(0, G, 0, H);
      g.addColorStop(0, 'rgba(255,70,90,.05)');
      g.addColorStop(1, 'rgba(255,70,90,.22)');
      ctx.fillStyle = g;
      ctx.fillRect(gap[0], G, gap[1] - gap[0], H - G);
      // 警告条
      ctx.fillStyle = 'rgba(255,190,60,.25)';
      ctx.fillRect(gap[0] - 4, G + 2, 4, 10);
      ctx.fillRect(gap[1], G + 2, 4, 10);
    }

    ctx.restore();
  }
}
