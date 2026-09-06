# Changelog

## 0.21.0 — Thrust, drift and heat

- Add gentle microgravity to normal levels, enabled by default. Movement keys
  build velocity, released keys coast to rest, and opposite input brakes faster.
  Preserve the original per-axis top speeds and Shift multiplier. Integrate
  velocity and displacement across braking transitions for consistent motion
  across frame rates. Keep bonus rolling and ascension motion independent.
- Add saved Help and uniform console settings for `microgravity` and
  `overheat_blocks_recoupling`. Disabling microgravity clears drift and restores
  direct controls; retries, new levels and portal teleports clear drift too.
- Introduce the re-coupling heat restriction with **HEAT at level 15**, alongside
  the existing reduction from 2.4 to 1.4 seconds of outside grace. New requests
  are blocked while overheating and permitted again when heat clears. Refused
  requests consume no quota; accepted requests finish normally. The restriction
  checks the heat state independently of its source.
- Make `BALANCE.heatMinLevel` the shared heat gate. Default: 15. Zero removes the
  level gate and introduces HEAT after the opening at level 1. The separate
  `overheat_blocks_recoupling` flag defaults to true and can disable the request
  restriction. `BALANCE.overheatBlocksRecoupling` sets its initial default.
- Centralize phase levels, banners and descriptions in `LEVEL_FEATURES`. Use it
  for phase sequencing and the Help milestone table. Explain both penalties on
  HEAT's banner and show the restriction in the recovery HUD. Include a complete
  progression reference in `docs/LEVEL_PROGRESSION.md`.
- Include repository description, live-game homepage and topic commands in
  `docs/GITHUB_METADATA.md`. Preserve the prominent README play link and logo.
- Declare ES modules in the root `package.json`, allowing local syntax checks
  to recognize bundled Three.js `.js` files without automatic module detection.
  No npm installation is required.

Validation: 93 test groups pass. The full suite and static gate pass with Node's
automatic module detection disabled; an additional isolated configuration test
verifies a zero heat minimum and two introductions sharing a level. Checks cover
thrust, coasting, countersteering, saved flags, restart behavior, hot/cold request
gates, quotas, and a complete fifty-leg run with both new mechanics enabled.
The new movement feel and heat rule still need browser playtesting.

## 0.20.1 — Let the ending breathe

- Let YOU'VE ASCENDED finish its 1.4-second fade, hold it alone for two seconds,
  then fade in ... FOR NOW. over 1.2 seconds. Show the continue prompt afterward
  and prevent early input from skipping the pause or subtitle.
- Place REASSEMBLY IN PROGRESS and REASSEMBLED beneath the projected rebuilding
  cube, with a subtle one-pixel white outline around the dark lettering.
- Put a large, centered PLAY THE WEB VERSION HERE link immediately below the
  README title. Add the original cube-letter title artwork as a clickable logo
  and remove the old deployment placeholder now that the game is live.
- Fit the animated cube-letter title between the start prompt and the actual
  instruction panel. Recenter and scale it on resize, browser zoom and text
  wrapping, including narrow desktop windows, without clipping its moving cubes.

Validation: 83 test groups and static checks pass, including the actual ending
UI fade sequence, two-second hold, pause behavior and separate continue inputs.
Title checks project every animated cube corner inside the available area across
full-width, half-width and zoomed viewport sizes, and verify resize tracking and
camera reset. Reassembly label checks cover multiple viewport shapes and rotating
views. The text outline and resized title still need browser playtesting.

## 0.20.0 — Into the stars

- Restore one added leg per level through fifty legs at level 50, retaining X/Z/Y
  axis introduction, the route generator, difficulty progression and cap ending.
- Add a full-route ghost overview with camera framing scaled to the maze, a
  distant exit marker, no red cutting grids, and a fade into nearby gameplay.
- Limit detail to nearby legs, use spatial collision queries and grouped laser
  checks, and cache the whole-route outline. Collapse the previous leg with sound
  and debris after the next junction is safely cleared. Keep debris bounded.
- Add saved `culling true/false` / `1/0` controls and a Help checkbox, enabled by
  default. Preserve collision, reveal and collapse rules when culling is off.
- Keep a fixed 1,600-point sky centered on the camera so larger maps and overview
  zooms cannot carry the player out of the starfield.
- Expand normal-level player rotation to smooth X/Y/Z tumbling at 3, 6 and 2
  degrees per second. Use one cached pose for cell positions and rendering,
  retaining re-coupling alignment, pause behavior and the saved `spin` switch.
- Rebuild ending 001 around one white cube above an endless blue grid. Levitate
  into the starfield with an upward camera tilt, become a small white star, hold
  there, then fade to white. Keep the two-second white hold, text and stats flow.
- Use a reusable 900-point sky, a distant fading grid and one final star point.
  Preserve both `test ending_1` and `view_end_anim_v1` without awarding records.
- Add a proximity-based white portal halo in normal and bonus levels. Enable it
  by default with `portal_white_light true/false` (also 0/1) and a Help checkbox;
  save the preference. Use one small sprite without dynamic lights or shadows.
- Alias `set level X` to `level X`, including validation and level-cap behavior.
- Add strong, damped rotational recoil for laser and field-edge hits. Rotate the
  visible collective together without extra collision damage. Enable it by
  default with saved `rotation_shocks` controls and Help's Hit rotation shocks.
- Unify every console boolean, including locate and mute: `toggle <thing>`,
  `set <thing> <value>`, and status aliases `status`, `view`, `get` and bare `set`.
  Accept true/false, on/off, 1/0 and enabled/disabled; distinguish missing names
  from recognized controls that cannot be toggled. Preserve legacy shortcuts.
- Retain the author's README thanks formatting and revised copyright wording.

Validation: 78 test groups and static checks pass, including three-axis pose
agreement and continuity, normal-level portal/level-50 traversal, bonus isolation,
ending geometry, framing and star-before-white timing, portal light settings,
buffer reuse, console persistence and level aliases. Added coverage checks every
route length through 50, spatial queries against full scans, overview framing,
nearby detail limits, collapse safety and an actual 50-leg traversal with scarce
re-coupling, hit recoil and settling, collision invariance, uniform boolean
commands, non-mutating status aliases, error replies and audio mute integration.
Browser playtesting and GPU profiling of the new graphics are still
outstanding.

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
