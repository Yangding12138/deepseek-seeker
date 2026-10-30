import { CFG } from './config.js';

const PL = CFG.plane;

// 2.5D 平面关卡：地面是一个有纵深的平面，机柜横跨纵深当障碍（只能左右绕）
export class Level {
  constructor(n = 1) {
    this.id = n;
    this.plane = PL;
    this.groundY = PL.y1;
    this.length = CFG.level.length;
    this.solids = [];

    // 障碍机柜（横跨整条纵深）
    this.props = [
      { x: 560, w: 18 },
      { x: 1240, w: 20 },
      { x: 2020, w: 18 },
    ];
    for (const p of this.props) this.solids.push({ x: p.x, y: PL.y0, w: p.w, h: PL.y1 - PL.y0, kind: 'wall' });

    this.spawn = { x: 96, y: (PL.y0 + PL.y1) / 2 };
    this.checkpoints = CFG.level.checkpoint.map((x) => ({ x, y: (PL.y0 + PL.y1) / 2 }));
    this.bossTrigger = CFG.level.bossTrigger;
    this.bossX = 2740;
    this.bossY = (PL.y0 + PL.y1) / 2 + 6;

    // 敌人出生：y 在平面内随机分布，ghost 额外给 hz（飞行高度）
    const yMid = (PL.y0 + PL.y1) / 2;
    this.enemySpawns = [
      { type: 'bug', x: 300, y: yMid }, { type: 'bug', x: 430, y: PL.y1 - 6 }, { type: 'ghost', x: 520, y: yMid - 14 },
      { type: 'bug', x: 760, y: yMid + 10 }, { type: 'bug', x: 900, y: PL.y0 + 6 }, { type: 'ghost', x: 1050, y: yMid },
      { type: 'bug', x: 1180, y: yMid }, { type: 'bug', x: 1320, y: PL.y1 - 8 }, { type: 'ghost', x: 1400, y: yMid + 12 },
      { type: 'bug', x: 1700, y: yMid - 8 }, { type: 'bug', x: 1820, y: yMid + 8 }, { type: 'ghost', x: 1900, y: yMid },
      { type: 'bug', x: 2050, y: yMid }, { type: 'bug', x: 2200, y: PL.y1 - 6 }, { type: 'ghost', x: 2320, y: yMid - 12 },
    ];
  }

  // 深度越大（越靠近屏幕下方）显得越大
  scaleAt(y) {
    const k = (y - PL.y0) / Math.max(1, PL.y1 - PL.y0);
    return PL.farScale + (PL.nearScale - PL.farScale) * Math.max(0, Math.min(1, k));
  }

  draw(ctx, camX, t, bgImg) {
    const { W, H } = CFG;
    const y0 = PL.y0, y1 = PL.y1;

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
    vg.addColorStop(0.55, 'rgba(4,10,20,.10)');
    vg.addColorStop(1, 'rgba(4,10,20,.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camX, 0);

    // ── 纵深地面 ──
    const gg = ctx.createLinearGradient(0, y0 - 6, 0, y1 + 16);
    gg.addColorStop(0, '#0e1c2b');
    gg.addColorStop(0.45, '#16293c');
    gg.addColorStop(1, '#0b1622');
    ctx.fillStyle = gg;
    ctx.fillRect(-40, y0 - 6, this.length + 80, y1 - y0 + 26);

    // 远端地平线（亮）
    ctx.fillStyle = 'rgba(53,224,255,.55)';
    ctx.fillRect(-40, y0 - 6, this.length + 80, 1.3);
    ctx.fillStyle = 'rgba(53,224,255,.10)';
    ctx.fillRect(-40, y0 - 6, this.length + 80, 7);

    // 近端前沿（暗）
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(-40, y1 + 12, this.length + 80, 26);

    // 透视网格：横向线（随纵深变亮）
    for (let i = 1; i <= 3; i++) {
      const y = y0 + (y1 - y0) * (i / 4);
      ctx.fillStyle = 'rgba(80,170,220,' + (0.05 + i * 0.02) + ')';
      ctx.fillRect(-40, y, this.length + 80, 0.8);
    }
    // 纵向线：向近端张开，形成透视收束
    for (let x = 0; x < this.length; x += 48) {
      const spread = 20;
      ctx.fillStyle = 'rgba(80,170,220,.07)';
      ctx.beginPath();
      ctx.moveTo(x, y0 - 6);
      ctx.lineTo(x - spread, y1 + 12);
      ctx.lineTo(x - spread + 2, y1 + 12);
      ctx.lineTo(x + 2, y0 - 6);
      ctx.closePath(); ctx.fill();
    }

    // 远端雾化（拉开纵深）
    const fog = ctx.createLinearGradient(0, y0 - 6, 0, y0 + 30);
    fog.addColorStop(0, 'rgba(9,20,33,.9)');
    fog.addColorStop(1, 'rgba(9,20,33,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(-40, y0 - 6, this.length + 80, 36);

    // ── 机柜障碍（带透视侧面） ──
    for (const p of this.props) {
      const top = y0 - 44;
      const bot = y1 + 12;
      // 主体
      const bg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      bg.addColorStop(0, '#0f1e2c'); bg.addColorStop(0.5, '#1d3348'); bg.addColorStop(1, '#0d1a26');
      ctx.fillStyle = bg;
      ctx.fillRect(p.x, top, p.w, bot - top);
      // 指示灯
      ctx.fillStyle = 'rgba(53,224,255,.5)';
      for (let y = top + 6; y < bot - 10; y += 7) ctx.fillRect(p.x + 4, y, p.w - 8, 1.4);
      ctx.fillStyle = 'rgba(255,180,60,.35)';
      ctx.fillRect(p.x + 4, top + 2, p.w - 8, 1.2);
      // 底部投影
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, bot - 4, p.w * 0.9, 4, 0, 0, 7); ctx.fill();
    }

    ctx.restore();
  }
}
