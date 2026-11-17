// The upgrade menu between waves. Six cards, each with a cost in embers that
// rises every time it is bought. The player spends embers (the same embers
// dropped by enemies) and the effect applies at once. Nothing here touches the
// screen; it only describes the catalogue and applies a purchase to the state.

export const UPGRADE_IDS = ['damage', 'firerate', 'speed', 'maxhp', 'repair', 'special'];

/** The catalogue. `cost` is the base price; each purchase multiplies it. */
export const UPGRADES = [
  {
    id: 'damage', name: 'Bright Rounds', key: '1',
    desc: '+6 bullet damage',
    baseCost: 6, costScale: 1.6,
    apply(state) { state.player.damage += 6; },
  },
  {
    id: 'firerate', name: 'Rapid Wick', key: '2',
    desc: '+1.2 shots per second',
    baseCost: 6, costScale: 1.6,
    apply(state) { state.player.fireRate += 1.2; },
  },
  {
    id: 'speed', name: 'Swift Boots', key: '3',
    desc: '+30 move speed',
    baseCost: 5, costScale: 1.5,
    apply(state) { state.player.speed += 30; },
  },
  {
    id: 'maxhp', name: 'Warm Heart', key: '4',
    desc: '+25 max HP, heal 25',
    baseCost: 5, costScale: 1.5,
    apply(state) {
      state.player.maxHp += 25;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
    },
  },
  {
    id: 'repair', name: 'Mend the Lantern', key: '5',
    desc: 'Restore 35 lantern HP',
    baseCost: 4, costScale: 1.5,
    apply(state) {
      state.lantern.hp = Math.min(state.lantern.maxHp, state.lantern.hp + 35);
    },
  },
  {
    id: 'special', name: 'Ember Special', key: '6',
    // Two stages: the first two purchases widen the spread, the third
    // makes bullets pierce. After that the card is maxed out.
    desc: 'Spread shot, then piercing',
    baseCost: 10, costScale: 2.0,
    apply(state) {
      if (state.player.spread < 2) state.player.spread += 1;
      else state.player.piercing = true;
    },
  },
];

/** What the special card promises next, so its label stays honest. */
export function specialNext(state) {
  if (state.player.spread < 2) return 'Spread shot, then piercing';
  if (!state.player.piercing) return 'Piercing bullets';
  return 'Already mastered';
}

/** Price of an upgrade given how many times it has been bought. */
export function upgradeCost(upgrade, bought) {
  return Math.round(upgrade.baseCost * upgrade.costScale ** bought);
}

/** Can this upgrade be bought right now? (Repair is useless at full health.) */
export function canBuy(upgrade, state) {
  if (upgrade.id === 'repair' && state.lantern.hp >= state.lantern.maxHp) return false;
  if (upgrade.id === 'special' && state.player.spread >= 2 && state.player.piercing) return false;
  return state.emberCount >= upgradeCost(upgrade, state.bought[upgrade.id] || 0);
}

/**
 * Buy an upgrade: spend the embers and apply the effect. Returns true when
 * the purchase went through.
 */
export function buyUpgrade(upgrade, state) {
  const bought = state.bought[upgrade.id] || 0;
  const cost = upgradeCost(upgrade, bought);
  if (state.emberCount < cost) return false;
  if (upgrade.id === 'repair' && state.lantern.hp >= state.lantern.maxHp) return false;
  if (upgrade.id === 'special' && state.player.spread >= 2 && state.player.piercing) return false;
  state.emberCount -= cost;
  state.bought[upgrade.id] = bought + 1;
  upgrade.apply(state);
  return true;
}
