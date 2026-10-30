// 全部可调参数集中在这里，改数字就能改手感
export const CFG = {
  W: 480, H: 270,
  gravity: 980,
  groundY: 232,

  // 2.5D 平面：y 是纵深（脚底所在的屏幕 y），hz 是离地高度
  plane: { y0: 178, y1: 232, dyTol: 14, nearScale: 1.0, farScale: 0.87 },

  player: {
    speed: 152,
    depthSpeed: 116,     // 纵深移动速度（比左右略慢，符合透视）
    accel: 1200,
    friction: 1500,
    jumpV: 330,
    maxFall: 520,
    aimAssist: 320,      // 自动索敌半径：此范围内子弹会朝最近目标（含空中）修正角度
    shotArc: 0.34,       // 索敌失败时的上抛角（弧度），保证能打到略高处的单位
    dashSpeed: 430,
    dashTime: 0.16,
    dashCd: 0.52,
    dashInvuln: 0.15,
    dashDmg: 9,
    shotCd: 0.13,
    shotSpeed: 380,
    shotDmg: 4,
    hp: 100,
    hurtInvuln: 1.0,
    knockX: 130,
    knockY: -140,
    coyote: 0.09,
    jumpBuffer: 0.1,
  },

  think: {
    gainHit: 4.5,      // 命中获得的思考能量
    gainHurt: 3,
    max: 100,
    slow: 0.34,        // 思考模式时间流速
    dmgMul: 3,         // 思考模式伤害倍率
    drain: 24,         // 每秒消耗
    burstR: 96,
    burstDmg: 46,
  },

  enemy: {
    bug: { hp: 14, dmg: 10, speed: 46, score: 12 },
    ghost: { hp: 10, dmg: 8, speed: 30, score: 16 },
  },

  boss: {
    hp: 240,
    dmg: 14,
    pearlCd: 2.0,
    sweepCd: 5.6,
    summonCd: 8.5,
    touchDmg: 12,
  },

  level: {
    length: 3000,
    bossTrigger: 2520,
    checkpoint: [0, 980, 1900, 2520],
    fallDamage: 18,
  },

  cam: { lerp: 0.14, lookAhead: 46 },

  // 打击感 / 死亡重连
  feel: {
    hitstopLight: 0.030,
    hitstopHeavy: 0.075,
    hitstopKill: 0.055,
    respawnDelay: 0.9,     // 从死亡到重连的定格时长（秒）
    respawnInvuln: 1.6,    // 重连后无敌时间
  },
};
