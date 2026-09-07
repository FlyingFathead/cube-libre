# Cube Libre browser port

The web-based version of Cube Libre, maintained at
[ FlyingFathead/cube-libre](https://github.com/FlyingFathead/cube-libre).
A native JavaScript / WebGL 2 port of the
[original PyGame version](https://github.com/FlyingFathead/cube-libre-pygame), based on
`ecf8f0148713e5606e64624464eecc4545c71047` (`0.15.79-phase cards hold`).

The complete game is in **`web/`**. It needs no Python, npm installation, backend,
database, paid hosting, CDN, or WebAssembly download to run. All runtime files,
including Three.js r180, the original font, and compressed sounds, are bundled.
The original Python game is maintained separately in `cube-libre-pygame`.

## Install into the web repository

Extract this ZIP directly into the root of **`FlyingFathead/cube-libre`**.
`README.md`, `WEB_PORT.md`, `web/`, `tools/`, `tests/`, and `.github/` belong
at the repository root. Include the hidden `.github/` directory when copying.
Keep `web/` in place: the included workflow publishes its contents as the site root.
No checkout of the PyGame repository is needed to play, test, or deploy this port.

## Run locally

From the repository root:

```bash
python -m http.server 8000 --directory web
```

On Windows, `py -m http.server 8000 --directory web` also works.
Open **http://localhost:8000/**. A static HTTP server is needed for JavaScript
module loading; double-clicking `index.html` as a `file://` URL does not work.
This is only for local testing. GitHub Pages supplies the HTTP server when published.

## Publish on GitHub Pages

1. Commit and push the files to `main` (or `master`) in `FlyingFathead/cube-libre`.
2. In the repository, open **Settings → Pages → Build and deployment → Source**
   and select **GitHub Actions**.
3. Open **Actions → Deploy Cube Libre to GitHub Pages → Run workflow**.
4. Wait for the deployment job to finish. GitHub will display the playable URL.

For this web repository, the expected URL after a successful deployment is:

**https://flyingfathead.github.io/cube-libre/**

Future pushes affecting `web/` deploy automatically. If using a branch other than
`master` or `main`, update `branches` in the workflow. If the first automatic run
started before Pages was enabled, rerun it after completing step 2.

All game paths are relative, so the same files also work under a differently named
repository, on a user Pages site, or on another static host. The included workflow publishes `web/` at `/cube-libre/`, not `/cube-libre/web/`.

GitHub documentation: [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Stuck at the loading screen

Check the address bar: use `http://localhost:8000/`, not `file://`.
Start the local server with the command above. The page now explains this
requirement when opened directly, and reports entry-module loading failures.
If startup still fails over HTTP, open the browser console (Firefox: Ctrl+Shift+K)
and inspect the first red error. A WebGL error, missing file, or incorrect module
MIME type requires a different fix; the loading screen alone does not identify it.

## Collapse contact fix (web 0.24.1)

A route-location hint is used for visibility and progress, not physical contact.
Its fallback to leg 1 must never imply that the player touched a collapsed leg.
`Course.collapsedSectionAt()` checks nearby corridor spans and turn-chamber
bounds, with the existing cell-half padding, against the collapsed-section map.
It uses the existing spatial index rather than scanning the full course.

This fixes whole-body deaths while drifting outside a later leg or beside a
sealed corridor, reported during Android level 6 playtesting. It does not remove
timer expiry or real sealed backtracking. Boundary shaving and overheating
remain active. Regression coverage is in `tests/web/collapse-contact.test.mjs`.

## Gameplay included

| System | Port behavior |
| --- | --- |
| Body | 125 individually destructible cubes, slow collective rotation, and gradual greying during LOSS |
| Movement | Fixed world X/Y/Z axes, arrows and Ctrl aliases, 2.6× rush |
| View | Original continuous three-axis rotation; L locate and automatic tracking from level 1 (minimum 0) |
| Lasers | All five original grid templates, rotating/tilting planes, moving cyan apertures, difficulty speed scaling; full-square electric shutters from level 4, with sequential stages at 6, 7 and 8 |
| Maze | Modular self-avoiding X/Z/Y route and open turn chambers; one added leg per level through fifty legs at level 50 |
| Boundary damage | Cell shaving, delayed overheating, cooling, local impacts and drifting debris |
| Recovery | Eight-second expiry, warning blinks, compact reconstruction, five requests per ten seconds, active-spam quota |
| Difficulty | Space at level 3; timed legs from level 5; shutter changes at levels 4, 6, 7 and 8; entropy from level 10; HEAT at level 15; LOSS from the exit of 44; gradual timer/yield ramp to level 50 |
| Collapse | Progressive reveal/arming; the previous leg dissolves after the next turn is cleared, with debris, sound and sealed timed backtracking |
| Portal | Per-cell slab contact, suction, charge, absorption and 98.5% body commitment |
| Progression | Preview, level-ready cards, portal warp, result cards and automatic progression up to level 50, then ascension, thank-you fades and run statistics |
| Death | Dissolve into the void, reconstruct the level-entry body, retry the current level with fresh geometry and timer |
| Persistence | Level-entry campaign checkpoints, best escape, best score and highest level in localStorage, plus mute, shaking, player rotation, hit rotation shocks, portal light, culling, microgravity, heat restriction, shutter booleans and sky preferences |
| UI | Original cube-letter title and dot-matrix prompt; help, pause, menu/reset confirmations, fullscreen |
| Console | Flags, level/restart/newrun, heal/kill/cubes, portal teleport, position/route, score, locate, and a scrollable live parameter listing |
| Audio | 21 sounds in two codecs: 18 originals, shutter buzz/whoosh and a generated LOSS engine wind-down |

The route, collision, scoring and portal rules are ported from the source. Web
0.17.0 deliberately extends timing, re-coupling, heat and end-of-run progression.
Web 0.19.0 adds physical rotation of the surviving body in normal levels.
Web 0.20.0 expands this to three axes and adds the starfield ending and portal glow.
It also restores one added route leg per level, with local collision queries,
nearby rendering and a full-route ghost overview.
The OpenGL effects are recreated in WebGL and are **not pixel-identical**.
Standalone desktop authoring utilities (Audio Lab and the font editor) remain
Python tools; they are not part of the playable browser game.

## Bonus round 001 (web 0.18.1)

The recurring interlude is **PICKING UP THE PIECES**, followed by **BONUS ROUND**
on the white phase card. Its title fades first, then the subtitle, then the brief
instructions. After five seconds, the camera establishes a solid floor arena.
A complete 125-cell body is thrown against it, scattering 124 pieces and leaving
one controllable mini-cube. The impact and scattering take 3.6 seconds; only then
does the **45-second** bonus clock start.

W / Up rolls toward the ramp; S / Down rolls back; A / D or Left / Right rolls
sideways. Q / E are alternate back / forward controls. Shift increases rolling
speed from 6 to 10 units per second. The body tips around its edges with cumulative
rotation, grows as pieces attach, and maintains surface contact on the floor and
ramp. Turns happen at the end of each roll. The camera settles into a following
view without rotating across the controls. A golden contact ring marks the player.
Bonus Help includes its own labeled keyboard diagram and key list.

From five seconds remaining, the body vibrates increasingly, glows with the same
heat colors as the main game and emits heat streaks. These effects leave movement
and collision unchanged. At zero, the visible body explodes into spinning outward
fragments with the main game's crash, collapse and death sounds. The intact body
and locator ring disappear. The fragments shrink and whiten over two seconds;
the final fade starts after 0.7 seconds, so the burst remains visible. Pause and
help freeze both the warning and explosion. A successful escape skips this effect.
`PIECES_RULES.warningSeconds`, `explosionSeconds` and `explosionFadeStarts` configure
these timings. The portal approach check allows rolls absorbed before reaching
the platform edge, fixing a case where a rebuilt body could stop just short.

Touching a piece collects it once. Take the central ramp to the elevated portal
before the deadline to bank **100 bonus points per recovered piece**. Escaping early
is allowed. A timeout forfeits that round's bonus, preserves the existing run score,
and proceeds to the next normal level after its result screen. Corridor damage,
entropy, boundary overheating and the leg timer do not run in this arena. The bonus clock does not
reset at the ramp; pause, help and dialogs freeze it. Normal levels refill until LOSS begins. From the exit of 44 onward, the bonus
preserves the exact campaign body carried through that portal. Run statistics now include bonus rounds played, pieces
successfully banked and bonus points.

`BONUS_SCHEDULE` in `web/js/bonus.mjs` starts after level 5 and repeats every five
cleared levels. The final campaign level takes precedence: with the cap at 50,
bonuses occur after 5, 10, 15, 20, 25, 30, 35, 40 and 45; clearing 50 goes to ascension.
Each scheduled occurrence runs once. `BONUS_TYPES` is a registry keyed by `001`,
with a factory for the round model; new types can be registered and listed in
`BONUS_SCHEDULE.types`. `PIECES_RULES` contains duration, scoring and arena geometry.
Future types supply their own model/renderer while using the shared bonus lifecycle.

Console previews:

```text
test bonus_round_1
test ending_1
```

`bonus 001` and `view_bonus_001` also preview the bonus; `view_end_anim_v1` still
previews the ending. The bonus preview includes the phase card, crash and complete
playable round. Continue after its result to enter the next level of the active
run. If there is no active level (including a menu launch), use the configured
first bonus level, currently 5. This replaces 0.18.0's return-to-interrupted-game
behavior. The destination is capped at the campaign limit and its usual phase
introductions play. Repeating the test command restarts the bonus while retaining
that destination. Bonus test points never alter score or records; entering the next
regular level updates the highest-level record normally. The console closes and resumes simulation
for these commands; this also fixes the old ending preview's accidental re-pause.

## Update notification and mobile entry

`web/version.json` is the authoritative version file. After editing it or adding
modules, run `node tools/prepare_web_release.mjs` and commit the generated
`web/index.html`. This embeds the release metadata and an import map covering
**every module, including transitive Three.js imports**, and versions the CSS URL.
JSON, audio and Help diagrams also use the running release in their asset URLs.
Static checks reject stale metadata or missing module mappings.

Before loading the game, the page fetches its deployed `version.json` with
`cache: no-store`, a unique query parameter and a four-second timeout. If a newer
version is available, it replaces the stale page URL with a release-specific,
cache-busting URL. If that page is still stale during deployment propagation, it
shows a retry message instead of looping. Offline/invalid/older metadata does
not block loading the page's own build. This is a browser startup check against
GitHub Pages; no GitHub API, server-side code or service worker is required.
The running version label comes from the embedded release, never a separately
fetched newer label. Refresh once when first upgrading from v0.22.1.

After startup, the browser checks every two minutes while visible and on return
to the tab (at least ten seconds between checks). Those checks use no-store,
a changing query parameter and an eight-second timeout. Offline, missing-file
and malformed-response failures stay silent.

A strictly newer numeric major.minor.patch version displays:

```text
THIS GAME HAS BEEN UPDATED
PRESS F5 / REFRESH TO RELOAD
SPACE BAR TO DISMISS.

Updated version: <available version>
This version: <running version>
```

The notice waits for other dialogs to close and freezes gameplay. Space dismisses
it, preserving whether the game was already paused. Refresh reloads the page and
ends the current run. Automatic replacement is restricted to startup, before play. A dismissed version does
not prompt again in that page session, but a still newer release can. Checks use
relative URLs, so both the `/cube-libre/` Pages site and a local HTTP server work.
The new version becomes discoverable after a successful Pages deployment, not
merely after editing a repository file or creating a Git tag. Older builds without
the startup loader must first refresh into 0.23.0 or later.

Mobile browsers show a beta notice once per tab session. **TRY MOBILE BETA**
(or Space) saves touch mode; **USE KEYBOARD / CONTROLLER** saves desktop controls.
The notice still recommends a desktop with a keyboard or analog controller.
Automatic detection includes Android, iPhone, iPad, desktop-identifying iPads
and coarse-pointer devices. An explicit saved choice overrides detection.

Help ends with the current game version, author/profile link,
**© 2024–2026 FlyingFathead**, and the PyGame v0.15.79 provenance.

## Web 0.17.0: difficulty and level cap

| Level | Seconds per leg | Re-coupling yield per request | Overheating grace outside |
| --- | --- | --- | --- |
| 5 | 30.0 | 90% | 2.4 s |
| 10 | 29.3 | 50% | 2.4 s |
| 15 | 27.5 | 48% | 1.4 s |
| 20 | 24.8 | 42% | 1.4 s |
| 30 | 18.3 | 26% | 1.4 s |
| 35 | 15.2 | 17% | 1.4 s |
| 40 | 12.5 | 9% | 1.4 s |
| 50 | 10.0 | 1% | 1.4 s |

Both curves use a smooth easing function. Seconds are rounded to a tenth;
re-coupling yield is rounded to the nearest whole percentage. Re-coupling applies
to the currently recoverable loose pieces **per request**. The original minimum
of one piece, eight-second expiry, 1.18-second re-coupling duration, and request
quota remain. Repeated requests can gather more of the remaining pieces.

`web/js/difficulty.mjs` contains `BALANCE` and the ordered `featuresForSettings()`
registry; `LEVEL_FEATURES` is the default schedule snapshot. `spaceStartLevel` defaults to 3, `timeStartLevel` to 5,
`entropyStartLevel` to 10, `heatMinLevel` to 15, and `levelCap` and `capLevel`
(the curve endpoint) to 50. Phase selection, banner wording and the Help table
use this schedule, including CHANGE at the current shutter minimum (default 4).
See [the complete milestone list](docs/LEVEL_PROGRESSION.md).

HEAT subtracts one second from the original 2.4-second outside grace period.
From web 0.21.0, the same HEAT gate also blocks new re-coupling requests when
`overheat_blocks_recoupling` is enabled and `game.heat > 0`. A minimum level of
**0 removes the gate** and shows HEAT after the opening at level 1. The restriction
uses the overheating state itself, so it can apply to future heat sources too.
The current corridor heat becomes active after the outside grace period, and
returning inside clears it immediately. Cooling restores the ability to request
re-coupling. Refused requests consume no quota and do not change cooldown or
fragments; any request already accepted finishes normally. Bonus collection is
independent. Subsequent heating and cooling rates remain unchanged.

TIME cards return at levels 20, 35 and 50 and show the effective allowance.
Phase cards, pause and help do not consume the leg timer. New legs, retries and
reassembly all reset to the current level's allowance. Level-ready cards and Help
show the current rules. At level 50 the ten-second warning is active from the
start of each timed leg.

Top speeds remain 6 units/second, or 15.6 with Shift. At full speed, a straight
46-unit corridor takes about 7.7 seconds, or 3 seconds rushing; thrust buildup
and braking add maneuvering time. A
simulation test traverses level 50 with rush, active lasers, actual turns and the
ten-second timer. This demonstrates a viable route, not a guarantee of human
playability or a complete balance assessment.

## Electric shutter sequences, camera and sky (updated in web 0.25.0)

CHANGE appears at levels 4, 6, 7 and 8 for one-, two-, three- and four-step
sequences. Gates close one at a time in one leg, with two seconds between zap
starts by default. Two/three steps choose distinct random gates; four steps use
one of two mirrored patterns across the five original grids: **2,5,1,4** or
**4,1,5,2**. The exact centre is omitted only from that four-step pattern.

A step warns for 0.4 seconds, closes for 0.8 seconds, then leaves at least 0.8
seconds open before the next warning. Complete sequences alternate nearby
revealed legs; a lone leg finishes its own sequence before waiting. Four seconds
separate the last zap of one sequence from the next sequence's first. Removing a
leg cancels unfinished steps and preserves the rest budget. Hidden grids remain
inactive. Panel geometry uses the existing reusable mesh buffer.

Pitch offsets are 0, −3, +3 and +7 semitones, applied to the existing buzz and
reopening whoosh via Web Audio playback rate. The two decoded sound buffers are
reused, so no additional downloads or audio processors are required. Current-leg
steps remain audible across that leg; adjacent-leg sounds use the distance limit.

Contact while closed removes half the survivors, rounded down and preserving
the last cube. Each step has an independent contact ID; each grid can hit once
per closure, including contacts consumed during the 1.5-second shared immunity.
The timer and boundary damage remain active. No ordinary beam damage is applied
through a closed sheet.

`test change_1` through `test change_4` start the appropriate configured level and
banner, closing the console and unpausing play. These are normal debug level
changes, with normal scoring. Stage flags, the four-step pattern, randomness and
sequence alternation have saved console booleans. Levels, timing, pitches and
sequence-length override have validated session-only numeric settings. Every
setting appears in `viewconfig`; public Options still exposes no difficulty switches.

The full schedule, semantics, default values and retired ramp parameters are in
[docs/LEVEL_PROGRESSION.md](docs/LEVEL_PROGRESSION.md). That replaces the earlier
level-22/36/50 count ramp and simultaneous closures.

`CAMERA_RULES.autoLocateMinLevel` in `web/js/config.mjs` now defaults to **0**,
so the normal camera tracks the cube from the beginning. Intro overviews still
frame the whole maze and settle onto the player before movement. The console
setting is `auto_locate_min_level`; set it to 3 to restore the earlier threshold.
It is session-only and independent of SPACE/culling. Manual `locate` can force
following regardless of the threshold, so turning manual locate off does not
cancel automatic following.

`VISUAL_EFFECTS.starPattern` defaults to **2**. Only the console changes the sky:
`star_pattern 0` hides it, `star_pattern 1` restores the exact prior Fibonacci
layout and monochrome intensities, and `star_pattern 2` selects the new seeded
random sky. Pattern 2 has natural gaps/clumps, uneven brightness and sizes, and
subtle cool/warm hues. Both skies use 1,600 points at a fixed radius around the
camera. Pattern changes update existing buffers once; movement allocates no new
sky geometry. The browser saves `cube-libre-star-pattern-v1`. The ending retains
its own cinematic starfield and is not affected by this background preference.

### Inspect every console parameter

These six commands are aliases:

```text
viewconfig
showconfig
showvars
viewvars
listvars
listconfig
```

The output has four columns: parameter, current value, friendly name and
description. It includes all console-settable booleans and numbers, plus level,
score and surviving cell count. It reads the command registry each time, so new
registered settings are included without maintaining another inclusion list.
Browser-owned entries can supply `name` and `description` alongside their getters
and setters. Listing values never calls setters or changes gameplay state.

The console scrolls vertically with the mouse wheel and Page Up / Page Down;
its output can also receive keyboard focus. Long responses are retained in full.
Use `status name` for one value. Numeric settings use `set name number`, except
existing score/cell cheats which use `score N` and `cubes N`.

## Continue and the final portal (web 0.27.0)

`web/js/save-game.mjs` owns the browser store, checkpoint schema validation and
welcome timing. Campaign data uses `cube-libre-campaign-v1`, separately from
`cube-libre-scores-v1` and preferences. `Game` receives a `saveCheckpoint`
callback; simulation code has no direct browser-storage dependency.

A schema-1 checkpoint contains a level, a stage (`level`, `bonus` or `ending`),
exact cell IDs, score, run statistics, completed level, last escape count and
completed bonus scheduling history. It contains no live movement, input, debris,
renderer buffers or clock position. Continue always restarts the saved stage;
normal levels start at their first leg with their full level-entry allowance.

- New run enables checkpoint writes and creates the level-one checkpoint.
- Level entry and the next-level transition save the body that belongs there.
  Before LOSS it is full; exits from 44 onward carry the exact survivors.
- Reloading during milestone cards or a portal transition already has the next
  checkpoint. Continue shows that level's applicable cards after its welcome.
- A pending scheduled bonus is saved before it starts. Reloading restarts that
  bonus, retaining the normal survivor body and score from before the bonus.
  Completion saves the next normal level immediately, including any awarded
  points, so revisiting cannot duplicate a completed reward.
- Clearing 50 saves an ending checkpoint. Resume replays the ending without
  re-awarding the portal score. The ordinary statistics-to-menu transition clears
  the completed checkpoint. Preview endings never clear a campaign save.
- Console previews, level jumps, healing, cube-count/score edits and the portal
  teleport stop checkpoint writes for that debug session. New run or Continue
  establishes a campaign again. Visual switches and status queries remain safe
  to use during a saved run. This is save isolation, not an anti-cheat system.

The title's main button and Space/Enter/controller A continue when a checkpoint
exists. A separate New run button asks before replacing it. Touch uses those
same buttons. The entire title action group is measured by the existing title
fitter, so save text and the extra choice reserve room above the cube logo.

Continue uses `resume_intro` against blank white. `RESUME_TIMING` gives the
first line a one-second fade; "Welcome back." starts at 1.5 seconds and fades
in over 1.5 seconds. Both hold until 4.5 seconds, fade out over 1.5 seconds, then
restore the checkpoint. Pause/Help freeze this sequence; Continue input cannot
skip it. An incomplete LOSS body subsequently uses `loss_assembly`, its original
missing-cell forms, wind-down, partial-success caption and level-dependent grey.

The browser adapter catches unavailable storage and quota errors. A same-page
checkpoint remains usable but the title says it will not survive leaving the
page. Invalid or unknown-schema saves are not loaded or silently deleted; only
an explicit new run replaces them. No cookies, backend or GitHub API are required
for the checkpoint. It is local to the browser/device, not a cloud save. Existing
high-level records from older releases do not contain enough data to migrate a
campaign. The roadmap retains full-body Continue as a possible mercy alternative.

### Final exit and its playable preview

`end_portal` defaults true and is saved under `cube-libre-end-portal-v1`.
`END_PORTAL` in `config.mjs` sets the final frame scale (3), halo diameter (80),
core diameter (24) and approach distance (85), in scene units. The corridor is
14 units wide. The predicate follows `BALANCE.levelCap` (currently 50) and excludes
bonus scenes. All final frame/spiral lines and the distant endpoint marker are
white. The original small glow texture is shared by the halo and one extra
reusable core sprite. No bloom pass, real-time lights or remote asset is added.

The `portal_white_light` switch disables both glow layers; `end_portal false`
restores ordinary portal presentation. Capture, suction, collision and the
level-cap ending trigger use the existing simulation constants.

`test end_portal` starts level 50 on its last leg, at local X=10.8 in the safe
gap between the last two gates. All earlier legs are already revealed/collapsed;
the last is active, its clock begins at ten seconds, drift is neutral and the
camera follows the cube. The console closes and the test runs immediately.
Normal movement through the exit triggers the full ending and thank-you note.
Automatic and manual retries return to that gap. Test play, deaths and arrival
award no score, top level, records or run-stat increments, and leave an existing
campaign checkpoint untouched. The summary is marked as an END PORTAL preview.

## LOSS and route visibility (web 0.26.0)

`BALANCE.lossMinLevel` defaults to 44 and supplies the runtime `loss_min_level`
console value. `loss` is enabled by default. The threshold applies to the exit:
43 → 44 refills normally; 44 → 45 carries exact survivor IDs and the same holes.
The ordered milestone registry supplies **LOSS ...**, **PORTALS NO LONGER
RESTORE LOST PIECES**, and **WHAT SURVIVES GOES WITH YOU.** Moving the threshold
moves the rule and the card together; 0 enables both from level 1.

`Game.entryCells` is an immutable per-level checkpoint. `portalCarry` holds the
exit snapshot across result screens and scheduled bonuses; `pendingLevelCells`
holds it through any milestone cards. A new level fixes its entry snapshot
before spawning. Automatic death, console restart and menu retry restore that
snapshot. New runs and deliberate `level N` debug jumps start a full body.
Normal re-coupling rules still apply to freshly detached debris.

Bonus rounds have their own body and score. They never replace the campaign
snapshot, whether they succeed or time out. The main-level clock and physics
wait until incomplete assembly and the normal overview finish.

Incomplete arrivals and retries reconstruct entry cells only. Absent cells
briefly attempt to form in grey, tremble (when `shake` is enabled), then fly
outward from 2.45 seconds and disappear by 3.65. These are rendering poses,
not player cells or debris. `loss_weep` fires once as they depart. The caption
switches to **ONLY PARTIAL REASSEMBLY SUCCEEDED**, with the surviving count, under the cube.
The existing batches draw at most 125 real-plus-absent forms.

`loss_grey` independently controls colour fading during LOSS. It begins with
2.5% desaturation at the threshold and follows a quadratic curve to full neutral
grey at level 50, preserving luminance. `LOSS_COLOUR` defines onset/exponent in
`loss.mjs`. Heat, cooling and hit cues are applied afterward. This changes no
collision positions, spin, damage or controls. Bonus bodies and the white
ending cube retain their own colours. `test loss` previews the card plus an
incomplete demonstration body; `level 44` shows the actual full-body introduction.

The gameplay route guide now reuses four exterior edges for each of up to three
upcoming legs. Its draw range moves forward through the existing buffer: at most
12 segments with defaults, one line draw, no new per-frame geometry. It omits
ghost edges where nearby detail is already drawn. Gates, shutters, culling of
detailed walls, physical contact and hazard revelation retain their own rules.

Use `route_outline`, `route_outline_ahead_legs`,
`route_outline_fade_after_legs`, `route_outline_opacity` and
`route_outline_far_opacity` (defaults true, 3, 1, 0.32, 0.25).
`ROUTE_OUTLINE_NUMBERS` defines numeric ranges/defaults. The last opacity is a
fraction of the near opacity; fade follows the route. `preview_*` still applies
only to the opening overview. Desktop and mobile share the gameplay outline.

The three new booleans persist through console changes. Numeric overrides are
session-only. Help does not expose LOSS or its difficulty controls as checkboxes.
See [LEVEL_PROGRESSION.md](docs/LEVEL_PROGRESSION.md) for the complete registry.

## Microgravity and thrust (web 0.21.0)

Normal levels use `PLAYER_PROPULSION` in `web/js/config.mjs`. This is controlled
inertia: movement builds velocity, releasing keys coasts to rest, and opposite
input brakes before accelerating the other way. There is no random force or
downward pull; a newly spawned cube rests until thrust is applied.

| Parameter | Default | Effect |
| --- | --- | --- |
| `enabled` | `true` | Initial `microgravity` preference |
| `speed` | `6` | Maximum speed per world axis, units/second |
| `rushMultiplier` | `2.6` | Shift maximum: 15.6 units/second |
| `thrustResponseSeconds` | `0.14` | Approximately 0.32 seconds to reach 90% of target speed |
| `coastResponseSeconds` | `0.22` | About 1.32 units of total coast from full normal speed; 3.43 from rush |
| `reverseResponseSeconds` | `0.08` | Faster braking while input opposes current motion |

The exponential response integrates displacement as well as velocity, including
splitting a step when braking crosses zero. Different frame rates give matching
trajectories. Existing per-axis speeds, Shift and portal suction are retained.
Momentum affects physical positions and collisions; no extra GPU passes are used.
Pause, Help and previews freeze travel. Retries, new levels and portal teleports
clear drift. Turning microgravity off immediately clears stored velocity and
restores direct controls. Bonus floor rolling and ascension have their own motion.

Use `toggle microgravity`, `set microgravity off` or `status microgravity`.
For the heat restriction, use `toggle overheat_blocks_recoupling`,
`set overheat_blocks_recoupling false` or `status overheat_blocks_recoupling`.
Both support all normal boolean aliases through the debug console and persist as
`cube-libre-microgravity-v1` and `cube-libre-overheat-blocks-recoupling-v1`.
The default heat restriction lives in `BALANCE.overheatBlocksRecoupling`;
its minimum level is `BALANCE.heatMinLevel`. These configuration numbers are
edited in the file; the console flag changes the restriction's enabled state.

## Ascension and run statistics

Clearing the current level cap awards the final portal score once, then replaces
normal level advancement with the ten-second starfield ascension scene. The scene
fades completely white, holds white for two seconds, and fades in:

> YOU'VE ASCENDED
>
> ... FOR NOW.

After the text and the thank-you sequence below finish, Space, Enter or a click shows the run's total score, best
score, levels cleared, final level, final portal cube count, best escape, time
spent playing, death/reassembly count and pieces successfully re-coupled. A second
input returns to the main menu. Held keys and immediate double clicks cannot skip
both screens. A new run resets run statistics; saved best records remain.
The cap is also enforced by the developer level command.

Help includes the versioned FlyingFathead credit and profile link. The original
unlisted ending command remains available; the `test ending_1` alias is now listed
in console help. Neither awards score or records.

## Web release 0.16.0: countdown warning

At 10 seconds remaining in a timed leg, a boxed bottom-center warning appears
alongside the top-right timer: **ONLY 10 SECONDS LEFT!**, down to **ONLY 1 SECOND LEFT!**.
It follows the actual leg timer, disappears immediately on a leg reset or state
transition, and freezes its blinking while the game is paused. The blink period
shortens from 1.26 seconds to 0.45 seconds; the final three seconds use a red box.
The countdown, recovery messages, audio status, touch controls, and toolbar share
a stacked layout so each occupies its own space. Reduced-motion preferences keep
the warning steady while its text and urgency colors still update. In 0.17.0, the
top-right numeric timer remains visible for the entire timed leg and becomes
progressively redder over the final ten seconds. A separate bottom-center box
flashes **TIME RESET ... FOR NOW** for 1.6 seconds when timed play begins, a new
leg resets the clock, or a death/reassembly restarts it. Its lifetime and blinking
pause with the game, and it shares the bottom stack with the other messages.

## Tabbed Help and public options

Help has four sections: **KEYBOARD**, **CONTROLLER**, **TOUCH** and **OPTIONS**.
Touch mode opens Touch; otherwise a connected controller opens Controller.
The settings cog opens Options directly. Every tab remains available.
Keyboard maps adapt to normal/bonus play. A tablist uses roving keyboard focus,
Left/Right arrows and Home/End. Clicking a tab or activating it with controller A
shows exactly one panel. The right stick scrolls that panel, and inactive-panel
controls are excluded from navigation. Tab labels and the return button stay
visible while content scrolls, including in narrow windows. Credits stay beneath
the tabs. Game rules/milestones are inside a disclosure under Keyboard controls;
controller navigation can focus and open that disclosure too.

Public Options includes input mode, optional touch helper areas, and the visual
effects `shake`, `rotation_shocks` and `portal_white_light`.
They retain browser persistence and the existing console aliases. `spin` affects
physical collisions; `microgravity`, the HEAT restriction and shutters affect
rules. Culling exposes extra route detail when disabled. These settings stay
console-only, and merely opening Help does not change their saved values.
The separate run-reset dialog is named RESTART / RETRY to avoid confusion with
visual options. There are no difficulty switches in the public Options tab.

## Keyboard help and opening sequence

H / Help shows a color-coded keyboard diagram above the existing key list.
Leader lines connect movement, rush, recovery and locate keys to their actions.
The map scrolls horizontally on small screens, and the full list stays visible
below it. Opening help pauses the game.

A new run flashes to white and displays these centered lines in order:

> I have no fixed place here.
>
> I only have my remaining pieces.
>
> I'm on my way to the portal.

Each line fades in over 1.2 seconds, starting at 0.8, 2.4 and 4.0 seconds.
The complete text holds, then fades together from 7.2 to 8.4 seconds. White holds
until 9.2 seconds, then fades into the level-one card. Pause/help freezes this
sequence, and retries and subsequent levels do not replay it.

## Overheating vibration and flashes (web 0.18.2)

Once the outside-grid overheating grace period expires, the player body vibrates
rapidly along all three axes, with a smaller independent tremor on each surviving
cell. Heat increases the amplitude. Cell colors pulse between red/orange and
white-hot peaks, following the PyGame thermal palette's escalating pulse rate.
Boundary-hit flashes no longer overwrite an overheated cell with a blue tint.
The heat flames and re-coupling targets follow the visible body displacement.

Shaking is a render effect: laser hits, portal absorption and boundary damage use
the physical cell positions before the visual tremor is applied. From 0.19.0,
those physical positions include the player's slow collective rotation.
Returning inside stops the shaking and resumes the normal cooling tint. Pause and
help freeze the effects along with game time.

**Help → Options → Shaking and heat flashes** is enabled by default. The console accepts:

```text
shake 0
shake 1
set shake false
set shake true
```

The switch controls body vibration, bonus warning tremors, camera jolts and rapid
heat-color pulses. With it disabled, overheating still displays a steady hot tint
and continues to affect gameplay. The browser remembers the choice using
`cube-libre-shake-v1`; changing it through Help or the console updates that value.
`VISUAL_EFFECTS` at the top of `web/js/config.mjs` supplies the default boolean and
body/cell amplitudes. Existing saved preferences take precedence over the default.

## Long routes, ghost overviews and culling (web 0.20.0)

Level 1 has one leg, level 2 has two, and each subsequent level adds one, through
50 legs at the current cap. Routing starts on X, adds Z at level 2, and introduces
Y from level 3. The self-avoiding route generator and open turn chambers remain.
The imported PyGame 0.15.79 snapshot has a seven-leg performance cap; web 0.20.0
deliberately replaces that cap with the intended growing route.

The seven-second introduction starts close to the forming cube, pulls back to fit
the entire route, holds that overview, then returns toward the first leg. The
whole maze is a faint cached outline and the exit is marked in the distance.
The outline contains only four longitudinal exterior edges per corridor, with
no end caps, joint boxes or wall lattice. `preview_max_legs` defaults to 50;
`preview_fade_after_legs` defaults to 2. After the first two legs, opacity fades
gradually toward `preview_far_opacity` (default 0.12 of the near opacity).
`preview_opacity` defaults to 0.24. All four numeric values are session console
settings in `PREVIEW_NUMBERS`. The saved `preview_outline` boolean can hide the
outline; setting its leg limit to zero also hides it. The distant portal and
full-route camera framing remain. These settings never reveal upcoming gates.
There are **no red laser grids during the overview**. As the camera returns, the
ghost outline fades and the nearby blue corridor forms. Hazard detail appears
once play begins, and later sections reveal and arm as you advance.

During normal play, roughly one recent, one current and one upcoming leg are
drawn in detail. The distant exit remains marked, while the rest of the maze is
hidden. From level 3, the previous section collapses after the player has cleared
the next turn, with the original collapse/dissipation sounds, flashes and debris.
The trigger waits beyond the joint so it cannot seal the passage under the
player. Collapsed hazards are removed, and timed play kills attempts to return
into a sealed section. Transient debris remains capped at 300 particles.

The performance limits are structural:

- The 50-leg overview has 400 line vertices (200 segments) in one static buffer, plus an exit
  marker. It is rebuilt only when the course changes.
- Normal detailed rendering selects at most three nearby legs and their laser
  sets. Collision queries use a spatial index and at most four nearby laser sets.
- The main sky uses a fixed 1,600-point sphere centered on the camera. Its buffers
  stay constant while the player travels or the overview zooms out.
- The camera's far plane and overview distance accommodate the complete cap-level
  route. Large maps do not multiply star counts or detailed hazard draw calls.

Corridor culling is enabled by default and can be changed only through the debug console:

```text
culling true
culling false
set culling 1
set culling 0
```

The browser saves this under `cube-libre-culling-v1`.
`VISUAL_EFFECTS.courseCulling` in `web/js/config.mjs` supplies the default.
Disabling it expands the detailed rendering window to the surviving route and
future previews; physical damage, local collision checks, reveal/arming and
collapse continue to apply. The opening overview always hides cutting grids.

The level-50 traversal test uses ordinary damage, microgravity, spin, shutters,
rush and one legal re-coupling request every 2.1 seconds. Its controller waits
for an open window before crossing each leg. A deterministic run cleared all
fifty legs with surviving cubes and more than two seconds left on every leg.
This verifies a viable route; it is not a browser FPS benchmark or a substitute
for human difficulty testing.

## Player rotation (web 0.20.0)

In normal levels, the entire surviving collective tumbles smoothly across three
axes: X at 3°/second, Y at 6°/second and Z at 2°/second. The independent phases
compose X, then Y, then Z; their different rates make the rotation axis evolve
over time. The pivot travels
with the player's origin. Each mini-cube shares the body's orientation, and lost
cells remain missing from that body as it turns. Re-coupling aims at moving slots
and blends arriving pieces into the collective's orientation.

Rotation starts during spawn materialization and resumes after reassembly. Pause
and Help freeze it. Bonus rounds retain their separate impact and floor-rolling
motion; the ending retains its own animation. Spin continues through the portal
approach until absorption completes.

The cell centers used for field damage, laser hits and portal absorption rotate
with their visible geometry. Detached fragments launch from those positions and
then follow their existing independent trajectories. World-axis movement controls
stay the same. Geometry is reused through the existing instanced renderer, and
the simulation caches one orientation quaternion and rotation matrix per update
for all body cells. Rendering uses that same quaternion.

Player auto-rotation is on by default and is now console-only because rotated cells affect collisions:

```text
spin 0
spin 1
set spin false
set spin true
```

Disabling it restores axis alignment immediately. The browser saves console changes under `cube-libre-spin-v1`. `PLAYER_ROTATION` in
`web/js/config.mjs` defines the default boolean and `degreesPerSecond: {x, y, z}`; an existing
saved preference takes precedence over the default. Shaking has its own switch.

## Hit rotation shocks and uniform console settings (web 0.20.0)

Laser and field-edge hits apply a sharp angular impulse to the surviving body's
visual pose. The axis depends on the impact location and surface, with variation
between hits. A damped spring returns the body to its normal tumble. Repeated
hits are bounded to a 28-degree recoil and 700 degrees/second angular speed;
an ordinary impulse starts at 420 degrees/second. These limits and the default
are in `VISUAL_EFFECTS` in `web/js/config.mjs`.

Cell centers, cell geometry and arriving re-coupled pieces follow the same
visual recoil. Physical collision and portal positions keep their existing
slow-tumble pose, so recoil cannot create an extra damage cascade. Pause and
Help freeze the effect; spawning resets it. Bonus rolling and ending animations
remain independent. It works with slow spin or overheating shake disabled.

**Help → Options → Hit rotation shocks** is on by default. Its separate `rotation_shocks`
setting is saved under `cube-libre-rotation-shocks-v1`; disabling it clears any
active recoil immediately.

Every console boolean uses this interface:

| Command | Result |
| --- | --- |
| `toggle shake` | Flips the setting; replies `shake set to true` or `shake set to false` |
| `set shake enabled` | Sets it explicitly; accepts true/false, on/off, 1/0, enabled/disabled |
| `status shake` | Reports `Status for shake is: Enabled` or `Disabled` |
| `view shake`, `get shake`, `set shake` | Same read-only status query |
| `flags` | Lists the current status of every registered boolean |
| `toggle missing` | Reports `missing not found!` |
| `toggle level` | Reports `level cannot be toggled with on/off!` |

Names and values are case-insensitive. Legacy `flag <thing> <value>`, bare flag
shortcuts and yes/no remain accepted. A bare flag name toggles, except `portal`,
which retains its original teleport action. Use `status portal` to query the
portal switch without moving. Invalid values report an error and leave the
setting unchanged. `toggle` takes only the name; use `set` for an explicit value.

Available booleans: `damage`, `lasers`, `bounds`, `noclip`, `portal`, `suction`,
`route3d`, `shake`, `spin`, `rotation_shocks`, `portal_white_light`, `culling`,
`microgravity`, `overheat_blocks_recoupling`, `change_1`, `change_2`, `change_3`, `change_4`, `change_4_pattern`,
`change_1_random_per_leg`, `change_1_no_repeat_leg`, `loss`, `loss_grey`, `route_outline`, `preview_outline`, `controller`, `locate` and browser audio `mute`.
The movement, heat restriction, shutter booleans, visual preferences and mute settings are saved;
debug flags and locate remain session controls. Numeric `level`, `score` and
`cubes` also support status queries. `set level X` starts a fresh body at the chosen level and plays its applicable milestone cards.
Internal animation state and original Python reference constants are not console
settings. Browser settings join the same registry through `game.consoleSettings`.

## Ascending into the stars (web 0.20.0)

Ending 001 begins with one white cube resting just above a blue grid floor.
The broad grid fades toward the distant horizon. After a brief 0.6-second hold,
the cube levitates upward and away while the camera smoothly tilts into the sky.
It shrinks and blends into a white star from 5.2 to 6.4 seconds, then remains a
small point among the stars. The white fade starts at 7.6 seconds and completes
at 10 seconds. A two-second white hold follows. From web 0.20.1, YOU'VE ASCENDED
then fades in for 1.4 seconds and holds fully visible on its own for two seconds.
Only then does ... FOR NOW. fade in beneath it over 1.2 seconds. The stats prompt
now follows the thank-you segment below; earlier input cannot skip the cinematic.

The sky uses 900 points in one reusable geometry buffer. A separate single point
keeps the final star visible even as the cube's mesh shrinks away. The scene is
created on first use and reused for later previews; it is hidden during other
states. Pausing freezes its movement and fades. Normal-level rotation settings
do not change this animation.

Use `test ending_1` or the original `view_end_anim_v1` to preview it. The preview
does not award scores or records. Scene geometry and motion are in
`web/js/ending.mjs`; timing is in `ASCENSION_TIMING` in `web/js/core.mjs`.

### Thank-you segment (web 0.26.0)

After the subtitle finishes, both lines hold for three seconds, then fade back
to white together over three seconds. The `thank_you_note` state follows:

| Part | Seconds |
| --- | --- |
| Blank white pause | 4 |
| Fade in `thank you for playing` / `CUBE LIBRE` together | 4 |
| Hold both lines | 5 |
| Fade out to white | 7 |
| Blank white hold | 2 |

Only then does the prompt to view statistics appear. The separate stats-to-menu
input remains. The background is plain white; no starfield, gameplay HUD,
controls or scene geometry is drawn. Smoothstep fades use simulation time, so
pause, Help and tab interruptions freeze them. Repeated input cannot skip them.
`THANK_YOU_TIMING` and `thankYouOpacity()` are in `core.mjs`.

`thank_you_note` and `test thank_you_note` preview just this segment. The full
`test ending_1` and legacy `view_end_anim_v1` previews include it automatically.
They do not award points or save new records. Normal progression reaches the
ending only after clearing the campaign cap, still level 50.

## Title framing and readability (web 0.20.1)

The animated CUBE / LIBRE title fits into the measured space between the start
prompt and the instruction panel. Resize and text-wrapping changes update this
area, including narrow desktop windows and browser zoom. Cached geometry bounds
include the miniature cubes' rotation and depth movement; the camera frames the
whole title inside that area with a margin. A camera offset centers it vertically
in the available space and is cleared when leaving the title screen.

Layout measurements run on title entry or changed dimensions, rather than every
frame. The title keeps its original colors, individual cell rotation and gentle
whole-logo sway. REASSEMBLY IN PROGRESS and REASSEMBLED sit below the projected
bounds of the rebuilding cube, with a small gap and a one-pixel white outline
around their dark lettering. Their position follows the camera and viewport.

The README's clickable logo is the original `cube_libre_title.png` artwork from
the PyGame repository, included as `docs/assets/cube-libre-logo.png`. It is a
repository document asset, so the game does not download it during play.

## Portal white light and console alias (web 0.20.0)

Within 22 world units of a portal, a soft white halo and rays grow smoothly with
proximity. Normal-level portals use the player's distance to the portal center;
bonus portals use the floor approach distance. The effect is a camera-facing
additive sprite with a shared 64×64 texture. It does not add dynamic lighting,
shadows or postprocessing, and does not affect collision or absorption.

Enabled by default, with **Help → Options → Portal white light** and these console controls:

```text
portal_white_light true
portal_white_light false
set portal_white_light 1
set portal_white_light 0
```

The browser saves the choice under `cube-libre-portal-white-light-v1`.
`VISUAL_EFFECTS.portalWhiteLight` supplies the default. The halo hides on menus,
ending screens and other scenes without an active portal approach.

`set level X` is also an alias for `level X`, with the same validation, level-cap
clamping and attempt reset. For example, `set level 20` starts level 20.

## Saved top-level display (web 0.22.1)

Title, level result and HUD records use `TOP LEVEL: <highest reached>/<level cap>`.
The numerator comes from `game.stats.highest_level`, saved in this browser across
runs; the denominator comes from `BALANCE.levelCap` (currently 50). It reports the
highest level reached, rather than cleared. Console level jumps also update this
record under the existing debug behavior. The title and HUD record tooltips
explain that the value persists across runs.

The storage key is `cube-libre-scores-v1`, field `highest_level`. It is specific
to a browser profile and origin. `toplevel` / `top_level` queries it;
`toplevel reset`, `top_level reset`, `reset top level`, `reset top_level`,
`reset toplevel` and `reset highest_level` reset only this record to 1 and save it.
Best score, best escape, other preferences and the current run stay intact.
Malformed commands do not modify records. `status top_level`, `view top_level`,
`get top_level` and bare `set top_level` are also read-only.

The top-right timer now uses the actual route length: `LEG 1/50` through
`LEG 50/50`. Bonus rounds retain their separate BONUS timer label.

## Xbox-style controllers (web 0.23.0)

The browser's standard Gamepad mapping is polled once per animation frame.
Left stick and D-pad move X/Y; LT / RT move +Z / −Z. Stick and trigger magnitudes
are analog. **LB re-couples on each press; X is an alias. RB holds rush.**
In bonus rounds, left stick/D-pad roll on X/Z and the triggers are unused.
A starts/confirms/continues, B returns/opens the menu, Y locates, View opens Help,
and Menu pauses. D-pad/left stick navigate menus; right stick scrolls dialogs.
Help includes an exact controller diagram plus tables alongside keyboard Help.

Connect by USB or Bluetooth, focus the page, then press and release a controller
button. Firefox exposes gamepads after interaction; code polls fresh objects
rather than relying on its timestamp. Only a standard browser mapping is
accepted. One active controller is retained until disconnect; disconnect pauses
an active run. Focus changes, dialog transitions and new connections require
neutral inputs before resuming to prevent accidental confirmations and drift.
Movement combines with keyboard/touch controls but clamps each axis to its limit.
Holding LB/X does not repeatedly spend the re-coupling quota.

`controller` defaults true and is saved under `cube-libre-controller-v1`.
`controller_deadzone` defaults 0.18 (range 0–0.8) and is saved under
`cube-libre-controller-deadzone-v1`. Both use set/view/status; the boolean supports
toggle. A controller start proceeds without waiting for browser audio permission;
a click or keyboard gesture can enable sound afterward. No npm dependency,
custom controller button-remapping UI or rumble is added. Touch beta uses the same game.

Reference: [MDN Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API),
[standard mapping](https://w3c.github.io/gamepad/#remapping).


## Mobile touch beta (web 0.24.0)

`web/js/mobile.mjs` translates pointer gestures into ordinary movement inputs.
It never changes player positions directly. `Renderer.touchView` projects the
surviving cell centres and provides the camera basis; a bounded SVG overlay draws
an orb and six labelled axis handles. Overlapping or view-aligned handles fan
apart, so a depth-facing axis always has a touchable target. The selected world
axis and its drag direction are locked until release. An outer-side grab selects
the closest handle; a centre grab produces view-relative planar thrust. Bonus
play instead maps dragging to floor X/Z, with forward toward the ramp.

The initial touch anchors the grey rush ring. Analog strength reaches normal
thrust before the ring; crossing it engages the existing rush multiplier. Moving
10 CSS pixels back inside disengages rush, avoiding boundary chatter. Released
input becomes zero; the existing propulsion model supplies coasting and braking.
All gestures are cleared on pause, Help, mode changes, resize, visibility loss
and pointer cancellation. A held finger needs a new press to start again.
Orientation changes and leaving fullscreen during touch play pause the game.

The circular re-couple control checks the actual fragment lifetime, recovery,
heat and request quota. Disabled states cannot waste requests. Pointer presses
trigger once; normal keyboard activation is also supported. Optional thumb drag
and view-depth areas can be enabled in Options. They are hidden by default.

| Console setting | Default | Meaning / range |
| --- | --- | --- |
| `mobile_mode` | `0` | 0 automatic, 1 touch beta, 2 keyboard/controller; saved |
| `touch_helpers` | `false` | Extra drag/depth thumb areas; saved boolean |
| `touch_rush_radius` | `56` | Rush distance in CSS pixels; 38–140 |
| `touch_deadzone` | `6` | Ignore small finger motion in CSS pixels; 0–24 |
| `touch_grab_radius` | `44` | Minimum grab-region radius in CSS pixels; 24–100 |
| `mobile_pixel_ratio` | `1.25` | Touch drawing-resolution cap; 0.5–2 |

These settings appear in `viewconfig` and support `set`, `view` and `status`;
`touch_helpers` also supports `toggle` and all usual boolean aliases. Numeric
tuning other than input mode lasts for this page session. Preferences use
`cube-libre-input-mode-v1` and `cube-libre-touch-helpers-v1`. They never overwrite
saved gameplay flags or records. Ordinary desktop drawing retains its ratio cap.

Fullscreen is an enhancement; touch controls must also work in a normal browser
view. iPhone users can use Safari's home-screen web-app launch when available.
No service worker, offline cache or native app is included. CSS suppresses page
panning/zooming on game controls and leaves Help scrollable. Safe-area insets keep
actions away from cutouts and system edges; OS navigation cannot be locked out.
Sound starts from a gesture, with touch play continuing while audio downloads.

### Mobile orientation lock (web 0.25.1)

Options → **Lock current orientation** is available on detected mobile devices
(including when using a keyboard/controller) and in forced touch mode. It is off
at each page load. `web/js/orientation.mjs` requests the current screen orientation,
and the checkbox represents a confirmed native lock, never a pending preference.
No fullscreen request or orientation preference is saved in localStorage.

Try the lock in the current browser view first. If it is denied and fullscreen
is available, show **Fullscreen & lock** for a separate user gesture. Capture the
orientation before entering fullscreen, which may rotate the viewport. Missing
or unsupported lock APIs and failed fullscreen attempts leave play available and
suggest the device's rotation lock. Fullscreen remains optional. Browser support
varies; see [MDN's ScreenOrientation.lock() documentation](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock).

Unchecking releases only the game's orientation lock; it does not exit fullscreen.
Fullscreen exit, page hiding and leaving mobile presentation release the lock and
invalidate pending requests. Native orientation changes that break a confirmed
lock clear its checkbox. Existing app handlers continue to release touch gestures
and pause active touch play across orientation changes or fullscreen exit.
The option is browser presentation, not a difficulty flag; it is operated by
an Options gesture rather than the synchronous simulation console registry.
Tests in `tests/web/orientation.test.mjs` simulate browser success, rejection,
async cancellation and Options state, and run the real app resize/pause handlers.
Physical device behavior remains unverified.

Validation covers all six pulls, changing view orientation, tiny surviving
bodies, free dragging, analog thrust/coasting, rush hysteresis, two-finger helper
input, cancelled gestures, pauses, recouple states, saved modes, entry choices,
Help tabs and bonus rolling. The touch diagram is visually checked. The author
reports playable Android touch controls through roughly level 6 and currently
prefers portrait. Players can choose either orientation. Portrait and
landscape are both supported: resizing reprojects controls, releases gestures,
and pauses active play across orientation changes. The new shutter rhythm and
layout comfort still need device playtesting; iPhone/iPad remain unverified.
The cloud browser could not access the local preview. See ROADMAP.md for the
unimplemented panic/return proposal arising from this Android feedback.

## Versioning

`web/version.json` is the machine-readable source for the **web version** and
its **PyGame baseline**. The title, browser tab and help screen read it locally;
no GitHub API or remote service is needed.

The current web release is **0.27.0**, continuing from published **0.26.0** (`bb6a420`). The first explicitly numbered web release was **0.16.0**, branched from PyGame
**0.15.79**, source commit `ecf8f0148713e5606e64624464eecc4545c71047`.
The prior v2 ZIP label was a package revision, not the game's version.

For future releases, use `0.27.1`, `0.27.2`, etc. for fixes, and `0.28.0` for the
next feature release. Update `web/version.json`, run `node tools/prepare_web_release.mjs`, update the release notes, refresh
`WEB_PORT_CHECKSUMS.sha256`, and use the same version in the ZIP filename and Git
tag (for example, `cube-libre-web-port-v0.27.0.zip` and `v0.27.0`). Keep the upstream
version and commit fixed unless deliberately rebasing on a different PyGame source.

## Browser-specific behavior

- Audio starts after user interaction. The Start button waits for the sounds to
  load/decode; a failed audio load falls back to silent play. Muting before starting
  bypasses that wait. Controller start also bypasses the wait for audio permission.
- Ogg Vorbis is preferred when supported; MP3 is included as a decoding fallback.
  The browser downloads one format, not both, unless fallback is necessary.
- Pause, help, modal dialogs, an unfocused window, and hidden tabs freeze gameplay.
  Help also freezes loose-fragment expiry, so reading instructions cannot cost cubes.
- Touch controls appear on devices with a coarse pointer. A keyboard or a
  standard analog controller is recommended for desktop play.
- Use the Fullscreen button or Alt+F if the browser reserves F11. Browser/system
  shortcuts may intercept some Ctrl combinations; Q/E avoids the Ctrl movement alias.
- Esc opens the game menu; quitting offers to end the session. Websites cannot
  reliably close tabs they did not open.
- Scores are local to this browser and origin. They do not import the Python
  `cube_libre_scores.json`, sync between devices, or form an online leaderboard.
- WebGL 2, JavaScript and import maps are required. Web 0.23.0 is the published
  baseline. Controller mapping and the new tabbed Help layout still require
  browser and hardware playtesting; automated checks do not claim a hardware benchmark.

## Verify or regenerate

No npm installation is required. The project declares its ES module configuration explicitly; earlier releases
were checked by the author on Node.js 18.19.1.
This release was checked with Node.js 24:

```bash
node tools/check_web.mjs
node --test tests/web/*.test.mjs
```

The root `package.json` explicitly declares ES modules, including the bundled
Three.js `.js` files. Keep it with the package when running checks. There are
no npm dependencies to install.

Optional regeneration requires a separate checkout of the original Python source.
Use source commit `ecf8f0148713e5606e64624464eecc4545c71047` to reproduce the
port's baseline; a newer source revision may intentionally change the results.
The checked-in fixtures and compressed audio are already sufficient for deployment.

To regenerate fixtures without installing Pygame, pass the source file explicitly
(the example assumes sibling repository directories):

```bash
python tools/web_reference.py --source ../cube-libre-pygame/cube_libre_pygame.py
node --test tests/web/*.test.mjs
```

The reference suite covers 16 course configurations, 2,250 laser samples, 640
portal samples, boundary/joint samples, compact recovery targets, and complete
progression/death/timeout scenarios. The Python fixtures intentionally remain
outside the published `web/` directory.
Player-based baseline fixtures use a neutral body orientation and the original
seven-leg limit through an explicit test-only course-length override. Separate web tests
cover rotated field damage, rendered poses, re-coupling, portal entry, pause and
respawn behavior, saved settings, exclusion from bonus rounds, all fifty route
lengths, spatial queries against full scans, overview framing, culling, collapse,
starfield continuity, a complete 50-leg traversal, hit recoil and settling,
uniform boolean aliases, precise errors, saved controls and audio mute. Web
0.21.0 adds frame-rate-independent thrust and braking, coasting limits, drift
resets, heat gates including a zero minimum, quota preservation, cooling and
shared milestone sequencing checks. Web 0.22.0 adds shutter timing, collision and
immunity, warning/closed rendering, local audio events, movable introductions,
camera centering, legacy and irregular skies, saved pattern switching and full
configuration listings. Web 0.23.0 adds controller axes/buttons and browser-dispatch
checks, record resets, globally capped alternating shutters, preview limits/fade
uniforms, startup cache replacement and live leg totals. The suite now has 162 passing test groups, including LOSS carry/retries/bonus isolation, colour fading, forward outlines, and the complete ending UI timing.
The fifty-leg simulated pilot accounts for closed shutters.

The original synthesized WAV cache is approximately 10.5 MiB; the web audio is
approximately 2.6 MiB with both codecs included (roughly 0.75 MiB for the preferred
Ogg set). The complete published folder remains under 4 MiB.

To regenerate sounds, install FFmpeg with libvorbis and libmp3lame, then run:

```bash
python tools/build_web_audio.py --source ../cube-libre-pygame/cube_libre_pygame.py
python tools/build_shutter_audio.py
python tools/build_loss_audio.py
```

The script uses the original synthesizer functions directly and reuses an existing
`assets/sfx/` cache in the supplied PyGame checkout. Deleting that cache forces a fresh original synthesis. Python
and FFmpeg are developer tools only; visitors do not need them.
The shutter script uses Python standard-library synthesis and FFmpeg; it needs no
PyGame checkout. It creates a 0.56-second electric buzz and a 0.72-second reopening
whoosh, both in Ogg and MP3. Each generator preserves the other set of manifest
entries. The LOSS generator makes a 0.14-second fault stutter followed by a falling engine whine
(3.2 seconds total)
using standard-library oscillators and a diffuse tail, then encodes both formats.
It contains no sampled voice. Temporary source WAV files are not included in the published game.

## Source layout

| File | Purpose |
| --- | --- |
| `web/js/core.mjs` | Browser-independent simulation and debug commands |
| `web/js/config.mjs` | Original constants and web visual, camera, rotation and propulsion defaults |
| `web/js/changes.mjs` | Numbered mechanic registry, shutter defaults, timing and damage rules |
| `web/js/console-config.mjs` | Live configuration listing aliases and friendly descriptions |
| `web/js/difficulty.mjs` | Balance thresholds, ordered feature introductions, banners and heat restriction |
| `docs/LEVEL_PROGRESSION.md` | Feature, banner and level reference |
| `docs/GITHUB_METADATA.md` | Repository description, homepage and topic command |
| `web/js/loss.mjs` | Nonlinear colour fading and visual-only missing assembly forms |
| `tools/build_loss_audio.py` | Reproducible electronic engine wind-down synthesis and encoding |
| `web/js/ending.mjs` | Blue-grid and starfield ascension scene and motion |
| `web/js/portal-light.mjs` | Proximity-based portal halo and reusable glow sprite |
| `web/js/space-view.mjs` | Cached ghost route, overview framing, detail window and selectable infinite starfields |
| `web/js/render.mjs` | Batched cube/line rendering, title, field and transition effects |
| `web/js/audio.mjs` | Local audio loading, codecs, channels, loops and state mix |
| `web/js/help-tabs.mjs` | Accessible Help tabs and explicit visual-only option allowlist |
| `web/js/orientation.mjs` | Optional mobile orientation lock, confirmed state and fullscreen/device fallback |
| `web/js/gamepad.mjs` | Standard controller polling, analog inputs, action edges and menu navigation |
| `web/assets/controller-controls.svg` | Controller diagram with exact action callouts |
| `tools/prepare_web_release.mjs` | Regenerate committed release metadata, import map and stylesheet version |
| `web/js/updates.mjs` | Version comparison, in-session update checks and release asset URLs |
| `web/js/app.mjs` | Browser input, overlays, storage, fullscreen and fixed timestep |
| `web/index.html`, `web/style.css` | Accessible UI and responsive game surface |
| `web/assets/` | Original title geometry, font and compressed generated audio |
| `web/vendor/` | Bundled Three.js and its MIT license |

Cube Libre's original authorship and rights remain with its author. The included
MIT notice applies to Three.js, not to the game as a whole.
