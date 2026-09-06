# Changelog

## 0.19.0 — The surviving body turns

- Slowly rotate the whole player collective about its own vertical axis in normal
  levels, enabled by default from spawn, at one revolution per minute.
- Rotate cell centers and cube geometry together. Field damage, laser hits and
  portal absorption use the rotated positions; missing pieces remain holes in
  the turning body. Debris launches from the impact position.
- Make re-coupled pieces join the moving body with matching orientation.
- Freeze rotation with pause/help, reset it on respawn, and keep bonus rolling,
  bonus crash sequences and the ending's animation independent.
- Add Help's Player auto-rotation checkbox and console `spin`, accepting
  true/false, 0/1 and on/off. Disabling it restores axis alignment; save the
  preference across reloads. Expose the default and speed in `PLAYER_ROTATION`.
- Reuse the instanced cube geometry and cache body rotation trigonometry in the
  simulation. Keep the independent overheating shake/flash setting.

Validation: 56 test groups and static checks pass, including physical/rendered
rotation agreement, field damage and debris, re-coupling, full-body portal entry,
bonus isolation, saved settings and a level-50 traversal with lasers and timer.
Visual/browser playtesting of the new rotation is still outstanding.

## 0.18.2 — Violent overheating feedback

- Vibrate the surviving player body in three axes while overheating outside the
  grid, with additional cell tremors and increasing amplitude as heat rises.
- Add strong red/orange pulses and white-hot peaks. Prevent boundary-hit feedback
  from overriding overheated cells with a blue tint.
- Keep all shaking visual: preserve collision, movement and portal calculations;
  make heat streaks and re-coupling targets track the displayed body.
- Add Help's Shaking and heat flashes checkbox and the console `shake` flag,
  accepting true/false, 0/1 and on/off. Save the preference across reloads.
- Apply the switch to bonus tremors and camera jolts too. Disabling it retains a
  steady heat tint and the existing gameplay rules.

Validation: 49 test groups and static checks pass, including overheat onset,
stronger vibration, returning inside, paused visuals, red pulses, stable colors
with shaking disabled, collision invariance and saved console settings.
Visual/browser playtesting of the new effect is still outstanding.

## 0.18.1 — Bonus urgency and portal fixes

- Shake and heat-tint the bonus body with increasing urgency during the last five
  seconds. At zero, replace it with spinning, disintegrating fragments, play the
  main game's crash/collapse/death sounds, and fade to white after a visible burst.
- Fix portal entry when a large body's next roll would finish beyond the platform
  edge: the roll can enter the portal first. Verify all 125 body sizes from three
  different approach offsets, plus a complete console-test exit.
- Send bonus tests onward to the next regular level. With no active level, use the
  configured first bonus level. Keep test bonus points out of score and records.
- Start scheduled bonuses after level 5, then every five levels through 45. Use
  the same setting for the test fallback, and preserve the level-50 campaign cap.

Validation: 46 test groups and static checks pass. New coverage includes portal
approach offsets, test-mode destinations, heat timing, paused effects and timeout
explosions. The visual effects still need browser playtesting.

## 0.18.0 — Picking up the pieces

- Add extensible bonus round type 001 after cleared levels 10, 15, 20…45.
- Fade in PICKING UP THE PIECES, then BONUS ROUND, before a visible crash and
  shattering sequence on a solid floor. Start the 45-second clock afterward.
- Add literal edge rolling, cumulative orientation, automatic pickups and a growing
  body, a moving follow camera, and a central ramp to an elevated portal.
- Bank 100 bonus points per recovered piece on escape. Timeout forfeits only the
  bonus; either outcome continues to the next level. Track bonus run statistics.
- Add bonus keyboard help and adapt existing touch buttons for floor movement.
- Add `test bonus_round_1` and `test ending_1`; preserve `view_end_anim_v1`.
  Bonus previews restore the interrupted game. Fix previews re-pausing after the
  console closes. No preview score or records are awarded.
- Poll the deployed version file with cache bypass; pause for the requested update
  popup, show available/running versions, and dismiss with Space. No forced reload.
- Add © 2024–2026 FlyingFathead to Help, retaining dynamic version and PyGame credit.
- Add the mobile browser desktop-play placeholder with TAP HERE TO CONTINUE.
  A dedicated mobile edition and redesigned touch controls remain deferred.

Validation: 41 test groups plus static checks pass. Coverage includes body growth,
floor/ramp contact, escape with up to 125 cubes, a collection route with turns,
scheduling, scoring/timeout, preview restoration and console aliases, numeric
update comparisons, offline failures, cache bypass and modal pause/dismissal.
New graphics and mobile behavior still need browser/device playtesting.


## 0.17.0 — Time, entropy, heat and ascension

- Keep the top-right timer visible and gradually redden it near zero. Flash
  TIME RESET ... FOR NOW in the bottom stack whenever a timed leg starts or resets.

- Ease timed legs from 30 seconds at level 5 to a 10-second floor at level 50.
  Repeat TIME cards at levels 20, 35 and 50 with the current allowance.
- Ease re-coupling yield from 50% at the configurable entropy introduction
  (default level 10) to 1% at level 50, rounded to whole percentages. Preserve
  the existing one-piece minimum, expiry window and request quota.
- Introduce HEAT five levels after entropy (default level 15): the out-of-bounds
  overheating grace period decreases from 2.4 to 1.4 seconds.
- Put the phase levels, curve limits and current level cap in `web/js/difficulty.mjs`.
- End the current campaign after level 50 with one ascending cube, a fade to white,
  a two-second white hold, YOU'VE ASCENDED and ... FOR NOW.
- Use separate Space / Enter / click inputs for the run statistics and main menu.
- Track best score and per-run play time, cleared levels, deaths and re-coupled
  pieces, alongside the existing score and cube records.
- Add the requested versioned author/profile credit to Help and an unlisted
  developer command for previewing the complete ending without awarding records.

Validation: 25 test groups and static checks pass. Coverage includes difficulty
bounds, timer resets, heat thresholds, repeat phase cards, a viable level-50 route
with lasers, the one-cube ending, two-second white hold, input sequencing and the
preview command. Browser playtesting of these additions is still needed.

## 0.16.0 — Web

First explicitly numbered web release, based on PyGame 0.15.79
(`ecf8f0148713e5606e64624464eecc4545c71047`). Earlier ZIPs were package revisions.

- Show a bottom-center boxed countdown for the final 10 seconds of a timed leg,
  with faster blinking toward zero and a red box for the final three seconds.
- Stack countdown, recovery, audio messages and controls to reserve their space.
- Add a color-coded keyboard map with callout lines above the existing help list.
- Add the three-line white-screen opening before level one on every new run,
  with staggered fades, a shared fade-out, and a smooth transition to the level card.
- Read web version and PyGame provenance from `web/version.json`; display the
  release in the title, browser tab and help screen.
- Retain the standalone `FlyingFathead/cube-libre` layout, original PyGame credit,
  procedural soundtrack, relative asset paths, and GitHub Pages workflow.

Validation: static checks and 15 simulation/presentation test groups, including
opening order, pausing, progression and original Python parity fixtures. The new
visual changes still need browser playtesting.
