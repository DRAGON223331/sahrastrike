// الأسلحة — بدون أي قدرات خاصة، أسلحة وسكاكين فقط
export const WEAPONS = {
  knife: {
    id: 'knife', name: 'الخنجر', slot: 2, price: 0, melee: true,
    dmg: 50, backDmg: 120, altDmg: 60, rate: 0.5, altRate: 1.2, range: 2.4, draw: 0.3, auto: true,
  },
  pistol: {
    id: 'pistol', name: 'الصقر', slot: 1, price: 0,
    dmg: 25, head: 75, interval: 0.17, auto: false, mag: 12, reserve: 36, reload: 1.5,
    spread: 0.004, moveSpread: 0.03, sprayAdd: 0.004, sprayMax: 0.02, kick: 0.012, draw: 0.4,
  },
  smg: {
    id: 'smg', name: 'العقرب', slot: 0, price: 1100,
    dmg: 21, head: 63, interval: 0.075, auto: true, mag: 30, reserve: 90, reload: 2.2,
    spread: 0.008, moveSpread: 0.035, sprayAdd: 0.0025, sprayMax: 0.035, kick: 0.008, draw: 0.5,
  },
  rifle: {
    id: 'rifle', name: 'الكلاش', slot: 0, price: 2900,
    dmg: 38, head: 152, interval: 0.105, auto: true, mag: 25, reserve: 50, reload: 2.5,
    spread: 0.003, moveSpread: 0.045, sprayAdd: 0.004, sprayMax: 0.05, kick: 0.012, draw: 0.6,
  },
  sniper: {
    id: 'sniper', name: 'النسر', slot: 0, price: 4500,
    dmg: 140, head: 255, interval: 1.5, auto: false, mag: 5, reserve: 10, reload: 3.4,
    spread: 0.0005, unscopedSpread: 0.06, moveSpread: 0.08, sprayAdd: 0, sprayMax: 0,
    kick: 0.03, draw: 0.8, zoom: 3,
  },
};

export const WEAPON_INDEX = ['knife', 'pistol', 'smg', 'rifle', 'sniper'];
export const ARMOR = { price: 400, value: 50 };
export const BUYABLE = ['smg', 'rifle', 'sniper'];
