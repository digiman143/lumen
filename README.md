# Lumen — defend the light

A 2D arena survival game for make.fun best-game-01. You are the warden of
the last lantern in a dark field. Shadows crawl out of the dark to kill you
and to snuff the light. Hold the line, gather their embers, and grow stronger
between waves.

## Play

- **Move** — WASD or arrow keys.
- **Aim** — mouse. **Shoot** — hold the left mouse button.
- **Pause** — P or Esc. **Mute** — M.
- **Upgrades** — click a card, or press 1–6, between waves. **Next wave** —
  click the button or press Space.
- **Restart** — click or press Space on the game-over screen.

## Rules

- Shadows drop **embers** when they fall. Walk over them to collect them.
  Embers are both your score and the currency for upgrades.
- Between waves, spend embers on damage, fire rate, move speed, max HP,
  lantern repair, and the Ember Special (spread shot, then piercing).
- The lantern's light shrinks as it is damaged. If you fall, or the lantern
  goes out, the dark wins. Your score is kills, embers, and waves cleared.

## Enemies

| Shadow | Behaviour |
| --- | --- |
| Shade | Fast, frail, hunts the nearest of you or the lantern. |
| Splitter | Breaks into two Shades when it dies. |
| Spitter | Keeps its distance and fires globs (from wave 3). |
| Brute | Slow, heavy, always marches on the lantern (from wave 2). |

## Tech

- Vanilla JavaScript, ES modules, no library, no network request — the game
  runs offline from static files under `game/` (`game/index.html`).
- Sound is synthesized with Web Audio only; there are no audio files.
- `game/src/` is split by job: `config` (tuning), `random` (seeded RNG),
  `audio` (synthesized SFX), `input` (keyboard + mouse), `enemies` (types
  and AI), `upgrades` (the between-wave shop), `world` (rules and state),
  `render` (drawing), `shots` (screenshot staging), `main` (boot and loop).
- `?seed=N` fixes the random pattern; `?shot=start|play|upgrade|end`
  (with `&seed=N`) stages that scene for a screenshot.

## Run

```
node serve.ts        # then open http://localhost:8080
```

Hand it in with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

`screenshots/` holds four frames captured by really playing the game in a
headless browser: the title screen, mid-play, the between-wave upgrade menu,
and game over. The first by name (`1-start.jpg`) is the cover. The `?shot=`
staging in `game/src/shots.js` reproduces the same scenes deterministically
with `?seed=N`.
