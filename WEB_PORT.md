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

## Gameplay included

| System | Port behavior |
| --- | --- |
| Body | 125 individually destructible cubes, original color gradient, optional slow collective rotation in normal levels |
| Movement | Fixed world X/Y/Z axes, arrows and Ctrl aliases, 2.6× rush |
| View | Original continuous three-axis rotation; L locate and automatic tracking at level 3+ |
| Lasers | All five original grid templates, rotating/tilting planes, moving cyan apertures, difficulty speed scaling |
| Maze | Same modular self-avoiding X/Z/Y route, open turn chambers, maximum seven physical modules |
| Boundary damage | Cell shaving, delayed overheating, cooling, local impacts and drifting debris |
| Recovery | Eight-second expiry, warning blinks, compact reconstruction, five requests per ten seconds, active-spam quota |
| Difficulty | Space at level 3; timed legs from level 5; entropy from level 10; HEAT at level 15; gradual timer/yield ramp to level 50 |
| Collapse | Progressive reveal/arming, old sections dissolving, debris, sealing effects, timed backtracking death |
| Portal | Per-cell slab contact, suction, charge, absorption and 98.5% body commitment |
| Progression | Preview, level-ready cards, portal warp, result cards and automatic progression up to level 50, then ascension and run statistics |
| Death | Dissolve into the void, reconstruct the body, retry the current level with fresh geometry and timer |
| Persistence | Best escape, best score and highest level in localStorage, plus mute, shaking and player rotation preferences |
| UI | Original cube-letter title and dot-matrix prompt; help, pause, menu/reset confirmations, fullscreen |
| Console | Flags, level/restart/newrun, heal/kill/cubes, portal teleport, position/route, score and locate commands |
| Audio | All 18 original generated sounds, ambience/gamelan, portal feedback, countdown layers and alarms |

The route, collision, scoring and portal rules are ported from the source. Web
0.17.0 deliberately extends timing, re-coupling, heat and end-of-run progression.
Web 0.19.0 adds physical rotation of the surviving body in normal levels.
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
reset at the ramp; pause, help and dialogs freeze it. Normal levels still begin
with their usual full body. Run statistics now include bonus rounds played, pieces
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

## Update notification and mobile placeholder

The existing `web/version.json` is the authoritative version file. Keep its web
version increasing and deploy it with the matching game changes. No separate
`VERSION` file or GitHub API is required. The browser captures its current version
when starting, then checks the same deployed file at startup, every two minutes
while visible, and on return to the tab (at least ten seconds between checks).
Requests use `cache: no-store`, a changing query parameter, and an eight-second
timeout. Offline, missing-file and malformed-response failures stay silent.

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
ends the current run; it never reloads automatically. A dismissed version does
not prompt again in that page session, but a still newer release can. Checks use
relative URLs, so both the `/cube-libre/` Pages site and a local HTTP server work.
The new version becomes discoverable after a successful Pages deployment, not
merely after editing a repository file or creating a Git tag. Older builds without
this checker must first load 0.18.0 or later.

Mobile browsers show the requested desktop-play notice once per tab session, with
**TAP HERE TO CONTINUE** and Space as an alternative. This is a placeholder, not a
separate mobile version. The existing touch buttons remain available, with WASD
labels adapted for the floor bonus. A full mobile control redesign is deferred.
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

`web/js/difficulty.mjs` contains the settings: `entropyStartLevel` defaults to 10,
`heatDelayLevels` to 5, `levelCap` to 50, and `capLevel` (the curve endpoint) to 50.
The phase levels and end-of-run logic use these settings. HEAT is derived as five
levels after the entropy introduction. It subtracts one second from the original
2.4-second out-of-bounds grace period; subsequent heating and cooling rates remain.

TIME cards return at levels 20, 35 and 50 and show the effective allowance.
Phase cards, pause and help do not consume the leg timer. New legs, retries and
reassembly all reset to the current level's allowance. Level-ready cards and Help
show the current rules. At level 50 the ten-second warning is active from the
start of each timed leg.

The movement speeds remain 6 units/second, or 15.6 with Shift. A straight 46-unit
corridor takes about 7.7 seconds at normal speed, or 3 seconds rushing. A
simulation test traverses level 50 with rush, active lasers, actual turns and the
ten-second timer. This demonstrates a viable route, not a guarantee of human
playability or a complete balance assessment.

## Ascension and run statistics

Clearing the current level cap awards the final portal score once, then replaces
normal level advancement with a single cube ascending over 4.8 seconds. The scene
fades completely white, holds white for two seconds, and fades in:

> YOU'VE ASCENDED
>
> ... FOR NOW.

After the text appears, Space, Enter or a click shows the run's total score, best
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

**Help → Shaking and heat flashes** is enabled by default. The console accepts:

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

## Player rotation (web 0.19.0)

In normal levels, the entire surviving collective turns about its own vertical
axis at six degrees per second, one full revolution per minute. The pivot travels
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
the simulation caches a single sine/cosine pair per update for all body cells.

**Help → Player auto-rotation (normal levels)** is on by default. Console commands:

```text
spin 0
spin 1
set spin false
set spin true
```

Disabling it restores axis alignment immediately. The browser saves either Help
or console changes under `cube-libre-spin-v1`. `PLAYER_ROTATION` in
`web/js/config.mjs` defines the default boolean and `degreesPerSecond`; an existing
saved preference takes precedence over the default. Shaking has its own switch.

## Versioning

`web/version.json` is the machine-readable source for the **web version** and
its **PyGame baseline**. The title, browser tab and help screen read it locally;
no GitHub API or remote service is needed.

The current web release is **0.19.0**. The first explicitly numbered web release was **0.16.0**, branched from PyGame
**0.15.79**, source commit `ecf8f0148713e5606e64624464eecc4545c71047`.
The prior v2 ZIP label was a package revision, not the game's version.

For future releases, use `0.19.1`, `0.19.2`, etc. for fixes, and `0.20.0` for the
next feature release. Update `web/version.json` and the release notes, refresh
`WEB_PORT_CHECKSUMS.sha256`, and use the same version in the ZIP filename and Git
tag (for example, `cube-libre-web-port-v0.19.0.zip` and `v0.19.0`). Keep the upstream
version and commit fixed unless deliberately rebasing on a different PyGame source.

## Browser-specific behavior

- Audio starts after user interaction. The Start button waits for the sounds to
  load/decode; a failed audio load falls back to silent play. Muting before starting
  bypasses that wait.
- Ogg Vorbis is preferred when supported; MP3 is included as a decoding fallback.
  The browser downloads one format, not both, unless fallback is necessary.
- Pause, help, modal dialogs, an unfocused window, and hidden tabs freeze gameplay.
  Help also freezes loose-fragment expiry, so reading instructions cannot cost cubes.
- Touch controls appear on devices with a coarse pointer. A keyboard offers the
  closest control experience to the original.
- Use the Fullscreen button or Alt+F if the browser reserves F11. Browser/system
  shortcuts may intercept some Ctrl combinations; Q/E avoids the Ctrl movement alias.
- Esc opens the game menu; quitting offers to end the session. Websites cannot
  reliably close tabs they did not open.
- Scores are local to this browser and origin. They do not import the Python
  `cube_libre_scores.json`, sync between devices, or form an online leaderboard.
- WebGL 2 and JavaScript are required. The author confirmed web
  0.16.0 works. This release’s new visuals have not been browser-playtested in
  the implementation session.

## Verify or regenerate

Use Node.js 22 or newer:

```bash
node tools/check_web.mjs
node --test tests/web/*.test.mjs
```

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
Player-based baseline fixtures use a neutral body orientation. Separate web tests
cover rotated field damage, rendered poses, re-coupling, portal entry, pause and
respawn behavior, saved settings, and exclusion from bonus rounds.

The original synthesized WAV cache is approximately 10.5 MiB; the web audio is
approximately 2.6 MiB with both codecs included (roughly 0.75 MiB for the preferred
Ogg set). The complete published folder is roughly 3.4 MiB.

To regenerate sounds, install FFmpeg with libvorbis and libmp3lame, then run:

```bash
python tools/build_web_audio.py --source ../cube-libre-pygame/cube_libre_pygame.py
```

The script uses the original synthesizer functions directly and reuses an existing
`assets/sfx/` cache in the supplied PyGame checkout. Deleting that cache forces a fresh original synthesis. Python
and FFmpeg are developer tools only; visitors do not need them.

## Source layout

| File | Purpose |
| --- | --- |
| `web/js/core.mjs` | Browser-independent simulation and debug commands |
| `web/js/config.mjs` | Original configuration values and web shaking/rotation defaults |
| `web/js/render.mjs` | Batched cube/line rendering, title, field and transition effects |
| `web/js/audio.mjs` | Local audio loading, codecs, channels, loops and state mix |
| `web/js/app.mjs` | Browser input, overlays, storage, fullscreen and fixed timestep |
| `web/index.html`, `web/style.css` | Accessible UI and responsive game surface |
| `web/assets/` | Original title geometry, font and compressed generated audio |
| `web/vendor/` | Bundled Three.js and its MIT license |

Cube Libre's original authorship and rights remain with its author. The included
MIT notice applies to Three.js, not to the game as a whole.
