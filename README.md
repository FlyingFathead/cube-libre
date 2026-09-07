# Cube Libre — Web v0.29.3

<h1 align="center"><a href="https://flyingfathead.github.io/cube-libre/">▶ PLAY THE WEB VERSION HERE</a></h1>

<p align="center"><strong>Play now in your browser. No download or installation needed.</strong><br>
Best played on a desktop computer with a keyboard or an analog game controller.<br>
<strong>Mobile touch controls are now available in beta.</strong></p>

<p align="center">
  <a href="https://flyingfathead.github.io/cube-libre/">
    <img src="docs/assets/cube-libre-logo.png" alt="CUBE LIBRE, spelled in colorful solid and wireframe cubes against a starfield. Play the web version." width="960">
  </a>
</p>

A browser-based JavaScript / WebGL 2 port of **Cube Libre** by FlyingFathead,
*with thanks to ChaosWhisperer*. Guide a body of 125 destructible cubes through
rotating laser corridors, recover loose pieces, and reach the portal.

- **Web repository:** https://github.com/FlyingFathead/cube-libre
- **Original PyGame / OpenGL version:** https://github.com/FlyingFathead/cube-libre-pygame

This repository contains the web port. The desktop version is developed separately.
The port is based on original source commit
`ecf8f0148713e5606e64624464eecc4545c71047`.

## Web release 0.29.3 · Recouple batch recovery

**One press handles the whole batch of recoverable loose blocks, with the
existing amount of loss.** The successful portion returns. Rejected blocks grey
out, become dark wireframes, fall away and fade; they cannot be recovered by
pressing again. Fresh damage can produce a new batch.

The entire Recouple control greys out when unavailable. Repeated presses during
recovery use the existing five-in-ten-seconds allowance on every input method.
Cooldown shows whole seconds; attempting it gives a brief red flash and buzz.
It does not extend the cooldown or grant more recovery.

Startup checks the server version and a local version cookie. A stale or missing
cookie triggers a fresh download of that release's modules and assets before
starting the game. Saved progress stays intact.

### Retained from 0.29.2 · Tap the title

Tap or click either the **Cube Libre logo** or the text above it to start a new
journey or continue a saved one. Mobile says **TAP TO START** or **TAP TO
CONTINUE**; desktop keeps its keyboard/controller prompt. New run still asks
before replacing a saved journey. The logo button follows the fitted title area
through screen resizing and leaves the other controls clear.

### Retained from 0.29.1 · Desktop action HUD

Fix a reproduced disappearing-corridor edge case on levels 7, 8 and later:
when outside drift loses the local route lookup, keep drawing the nearby
corridor instead of the collapsed entrance. Upcoming outlines now extend
five legs ahead by default (`route_outline_ahead_legs`).

Panic and Recouple now have a dedicated action HUD, separate from the optional
touch controls. Desktop shows the round icons during level setup and play,
with **V / Xbox B** under Panic and **C / LB / X** under Recouple. Unavailable
actions are greyed out. Both touch layouts keep the matching circles.

The circle and its labels pulse orange-red **only while usable**: Recouple
during its last-chance window, Panic on overheating or in a timed leg's final
10 seconds. Unavailable actions never flash, including during cooldown.

An optional Panic score penalty is **off by default**. Console:
`set panic_penalty true` enables it; `set panic_penalty false` disables it.
`set panic_score_penalty_percent 5` sets the percentage (default 5, range 0–100).
When enabled, each successful use deducts that percentage of the **current run**
score, rounded to whole points; repeated uses compound. All-time records are
unchanged. Deductions survive reload and retry. These settings last for the
session; a fresh page starts with the penalty off.

### Panic recovery

**A way back when a leg goes badly.** Press **V**, **Xbox B**, or tap the
bottom-left **PANIC** circle. A white tractor beam pulls your existing body
into a laser-bar prison at the start of the furthest leg reached. The bars open
forward, then the reset leg timer starts running. The HUD says **PANIC RECOVERY
REQUESTED** and a zap/whoosh leads into two Doppler-like space-ambulance calls.
The beam requests normal lossy Recouple for still-recoverable loose pieces;
it does not rebuild your body. Old corridors remain sealed.

Panic is available throughout normal legs, with a **30-second cooldown** and
whole-second countdown. Both mobile layouts and desktop get matching Panic and
Recouple circles. Available Panic flashes immediately on overheating. **Options → ALLOW
PANIC BUTTON** defaults on. `set panic_show_inactive false` hides the circle
until 3 seconds outside or earlier overheating; V/B remain available while
hidden. The visibility choice is saved. Bonus rounds do not offer Panic.

The twenty-level journey and White tide ending remain:

**Twenty levels. One more leg each time.** The default journey now reaches
ascension after level 20, with the difficulty curves compressed to reach the
same final severity as the original campaign. Before retries, that is 210 legs.

| Level | What changes |
| --- | --- |
| 3 | SPACE: the Y axis opens. |
| 4 / 6 / 7 / 8 | CHANGE: one, two, three, then four sequential shutter zaps. |
| 5 | TIME begins at 30 seconds per leg. |
| 10 | ENTROPY begins at 50% recovery per request. Colour starts fading almost imperceptibly. TIME announces 24.8 seconds per leg. |
| 15 | HEAT: 1.4 seconds outside before overheating; no new recovery requests while hot. TIME announces 15.2 seconds per leg. Recovery is down to 26%. |
| 16 | LOSS: the exit no longer restores missing pieces. Level 17 receives what survived. |
| 18 | The ongoing curves have tightened to 11 seconds per leg and 6% recovery. |
| 20 | Twenty legs, 10 seconds per leg, 1% recovery and a completely grey body. The final white portal leads to ascension. |

Shutter warnings, open windows, alternating legs, damage protection and the
one-cube minimum per shutter hit are retained. The game keeps its existing
movement speeds and laser rules, with the new Panic controls described above. The final laser
spin multiplier is also unchanged. Shortening the journey does not remove the
late-game pressure.

**A moment before ascension.** The final portal opens onto white. A faint
monochrome ocean horizon widens and a wave sweeps past the view, accompanied
by a soft surf-like noise wash. Both dissolve, leaving roughly half a second
of blank white before the blue-grid/starfield scene appears. This arrival still
lasts 3.3 seconds, followed by the existing 0.12-second scene reveal. The cube rises as before;
once it becomes a star, the stars and horizon linger for 5.7 seconds,
2.5 seconds longer than v0.28.0,
then fades to white. The existing **YOU'VE ASCENDED / ... FOR NOW.**, slow
**thank you for playing / CUBE LIBRE**, and separate statistics/menu inputs follow.
The arrival leaves your saved and physical body unchanged.

**Your existing save is kept.** Continue retains its campaign variant, exact
level-entry pieces, holes, score and progress. Old v0.27.0 saves resume the
original 50-level journey, even when saved at an early level. New runs default
to 20. TOP LEVEL, best score and best escape are tracked separately for each
variant; old records belong to the original one.

### Continue and what remains

New players see one **New run** start option. With a valid saved journey, the
title offers **Continue** and **New run**; replacing the save requires a deliberate choice. Continue opens on white with **Continuing from level X ...**,
then **Welcome back.** An incomplete LOSS body plays the partial reassembly:
missing grey forms tremble and scatter with an engine wind-down, followed by
**ONLY PARTIAL REASSEMBLY SUCCEEDED**. Retries and Continue restore exactly the
body you entered that level with. Fresh debris can still be re-coupled while
it remains available. Bonuses award points without replenishing the normal body.

Saves use local browser storage on this device, with no account or cloud sync.
Clearing site data removes them; the title reports unavailable saving. Pending
bonuses and completed endings resume without duplicating rewards. An old TOP
LEVEL record alone cannot reconstruct a campaign.

### Console previews and variants

The original 50-level progression remains available **only through configuration
and the debug console**, alongside Continue for existing saves. There is no
public mode selector or difficulty checkbox. Open the console with backtick or
Ctrl+Shift+F1:

```text
game_mode
set game_mode 20
level 16
test loss
test end_portal
test ending_1
thank_you_note
```

`test end_portal` starts on **LEG 20/20**, before the last gate, with ten seconds
and the camera located. Entering the actual portal plays the complete ending.
Retry returns to that gap. Previews never replace a saved campaign or award points.
The final portal retains its oversized pure-white frame and glow.

For the preserved original campaign:

```text
set game_mode 50
newrun
```

Changing mode returns to the title, resets that mode's LOSS/fade thresholds and
keeps the existing save. `newrun` starts the selected mode; `test end_portal` now
uses its last leg. Selection lasts for the page session. Continue reads the saved
mode without changing the selection for the next new run. `game_mode`, `get`,
`view`, `status`, bare `set` and `viewconfig` report values without changing play.
The only mode values are **20** and **50**; boolean toggles are rejected.

`loss_min_level` defaults to 16 in mode 20, or 44 in mode 50. The separate
`loss_grey_min_level` defaults to 10 or 44 respectively. Both accept 0 for the
first level, up to the active cap, and last for the session. `loss_grey true` /
`false` is a saved visual switch. Gameplay tuning stays console-only.

**See a little farther ahead.** During play, five upcoming corridor legs have
faint exterior outlines without revealing distant laser grids or shutters.
Their independent settings remain:

```text
set route_outline true
set route_outline_ahead_legs 5
set route_outline_fade_after_legs 1
set route_outline_opacity 0.32
set route_outline_far_opacity 0.25
```

See [the full progression and tuning reference](docs/LEVEL_PROGRESSION.md).
[ROADMAP.md](ROADMAP.md) keeps the rescue and merciful Continue ideas as
unimplemented possibilities. “YOU HAVE DESCENDED” is recorded as a humorous
what-if, not a serious continuation proposal; the ascension arc stands complete.

## Mobile orientation lock · Introduced in 0.25.1

On mobile, **⚙ → Options → Lock current orientation** requests a lock to your
current portrait or landscape view. It starts off each visit, and the checkbox
only stays checked after the browser confirms success. If fullscreen is needed,
tap **Fullscreen & lock**. Unsupported browsers explain how to use the device's
rotation lock instead. Both orientations remain playable without a lock.

Leaving fullscreen or hiding the page releases the game's lock; enable it again
when ready. Unlocked orientation changes still pause play and release held touch
gestures. The orientation setting leaves gameplay rules intact.
Browser API and integration checks pass; actual device lock behavior still needs
Android/iPhone/iPad testing.

## Shutter progression · Introduced in 0.25.0

Shutters now develop through four **CHANGE ...** introductions:

| Level | New rule | Zap pitches |
| --- | --- | --- |
| 4 | One randomly selected gate closes. | Original |
| 6 | Two different gates close in sequence inside one leg. | Original, −3 semitones |
| 7 | Three different gates close in sequence. | Original, −3, +3 semitones |
| 8 | Four gates follow a mirrored spatial pattern. | Original, −3, +3, +7 semitones |

**Two seconds between zap starts. One gate closed at a time.** Each gate warns
for 0.4 seconds and closes for 0.8 seconds, leaving room to move. A gate cannot
repeat within its sequence. The complete next sequence uses another revealed
leg; if no other leg is available, it waits. There are at least four seconds
between the previous sequence's last zap and the next sequence's first.

The four-step order is **inner → far end → opposite end → other inner**.
Each leg has five grids: the exact centre is excluded from this pattern. The
starting inner side is random, so the two possible orders mirror each other.
The original buzz and reopening whoosh are pitched in Web Audio; no extra audio
downloads are needed. This replaces the old level-22/36/50 shutter-count ramp.

Console previews: `test change_1`, `test change_2`, `test change_3`, `test change_4`.
Stage switches, minimum levels, timing, pitch and pattern tuning remain
console-only. See [the complete progression and settings](docs/LEVEL_PROGRESSION.md).

The v0.24.1 fix for false whole-body collapse deaths is retained. Automated
checks cover the new rhythms and a complete level-50 traversal; hearing and
playing the revised rhythm on real devices still needs author playtesting.

## Mobile controls beta · Introduced in 0.24.0

Android, iPhone and iPad visitors get two choices on the **MOBILE BROWSER DETECTED**
screen: **TRY MOBILE BETA** or **USE KEYBOARD / CONTROLLER**. Space chooses the beta.
The choice is saved in this browser. The same game and Pages address serve both
control modes; a desktop keyboard or analog controller remains recommended.

**Grab the cube itself.** A faint orb surrounds your surviving pieces, with
cyan X, gold Y and pink Z pull arrows. Grab a labelled side and drag along its
beam to move on that axis. The selected axis stays locked until you release,
even as the view rotates. All six grab points remain touchable as overlays,
including underneath/far-side directions and when only one mini-cube survives.
Grab near the orb's centre for free dragging in the screen plane.

A **grey ring marks the rush threshold** around your initial touch point.
Pull beyond it to rush; return inside to slow down. Release to coast, or pull
opposite your current movement to brake. Existing acceleration, speed limits,
collisions, timers, heat, entropy and shutter rules still apply.

The circular **RECOUPLE** button has a whole-cube symbol. It lights up when
pieces are available; the entire control dims when there is nothing to recover. Its small label
also explains active recovery, heat restrictions and cooldown. A press requests
re-coupling once; holding it does not repeatedly spend your quota.

**⚙ opens Options directly.** Choose Automatic, Touch beta or Keyboard/controller.
Optional extra drag/depth thumb areas are off by default. Help now has
**KEYBOARD | CONTROLLER | TOUCH | OPTIONS**, including a touch diagram.
Gameplay difficulty switches remain console-only; public Options covers input
preferences and the existing visual effects. In bonus rounds, drag to roll on
the floor and collect by contact; axis/depth and re-coupling controls are hidden.

Touch mode caps drawing resolution at 1.25 device pixels per CSS pixel. Controls
respect screen insets, gestures release on interruptions, and orientation changes
pause play. Fullscreen is optional, including on iPhone. System navigation
remains available. Touch starts proceed while audio loads in the background.

**Beta testing:** the author reports playable Android touch controls through
roughly level 6. Automated input, projection and regression checks also pass.
The revised shutter rhythm still needs human playtesting; iPhone/iPad gameplay,
layout and performance remain unverified. Portrait and landscape are both
supported; use whichever feels better to you.

The earlier prison-node proposal is implemented in v0.29.0 as Panic recovery.
See [ROADMAP.md](ROADMAP.md) for its settled rules and other considered ideas.

### Retained from 0.23.0

**Xbox-style controllers are supported**, including analog movement and menus.
Use the left stick for X/Y, LT / RT for Z, **LB to re-couple** (X also works), and
RB to rush. In bonus rounds, the stick rolls on the floor and pieces are picked
up by contact. Help now includes a labeled controller diagram and action list
alongside the keyboard map. Press and release a controller button while the page
is focused to let Firefox detect it. Click or press a keyboard key once if the
browser needs that gesture to enable sound.

**Shutter hits remain bounded.** A hit removes half your remaining cubes,
rounded down, preserves the last cube, and grants 1.5 seconds of protection from
all laser grids. Boundary damage and the timer remain active.

Example tuning in the debug console (backtick or Ctrl+Shift+F1):

```text
set change_1_step_seconds 2
set change_1_pitch_2 -3
set change_4_pattern true
set change_1_no_repeat_leg true
set change_1_gates_per_leg 0
viewconfig
```

`change_1_gates_per_leg 0` uses the level stages; 1–5 overrides sequence length.
Booleans are saved; numeric shutter tuning lasts for the page session.

**The opening map preview is just four exterior lines per corridor**, with no
laser gates or shutter previews. Its configured ceiling remains 50 legs, limited by the actual route, and it fades after
the first two, keeping the distant exit visible. Fifty legs use 200 line segments
in a reusable buffer. Tune it with:

```text
set preview_max_legs 50
set preview_fade_after_legs 2
set preview_opacity 0.24
set preview_far_opacity 0.12
toggle preview_outline
```

The top-right timer now shows **LEG 1/20**, using the actual route length.
**TOP LEVEL: 7/20** remains your highest reached level saved in this browser
across runs in the active variant, including debug level jumps. Query it with `toplevel` or `top_level`.
Use `toplevel reset`, `top_level reset` or `reset top level` to reset that record
to 1, keeping your best score, best escape, preferences and current run.

**Startup checks the deployed version before play.** A cached older entrypoint
loads a fresh page automatically; JavaScript dependencies, styles and fetched
assets use release-specific URLs. The running version label stays tied to that
build. During an active run, updates still show a dismissible notice instead of
automatically interrupting the run. No GitHub API or separate server is needed.
Refresh once after deploying this update to install the new startup behavior.

### Existing camera, sky and configuration tools

**The camera follows the cube from the first level.** The minimum is now
`auto_locate_min_level = 0`, meaning always on. Full-maze opening overviews still
settle onto the player. `set auto_locate_min_level 3` restores the former threshold;
`set auto_locate_min_level 0` restores the new default. This session setting is
independent of SPACE and corridor culling.

**The default sky is more irregular:** random gaps and clusters, varied point
sizes and brightness, and restrained blue/warm hues. It retains a fixed 1,600 stars
and follows the camera. Compare through the debug console only:

| Command | Background |
| --- | --- |
| `star_pattern 0` | No stars |
| `star_pattern 1` | The original evenly spaced pattern |
| `star_pattern 2` | The new irregular sky, enabled by default |

The browser remembers the pattern. `set star_pattern N` also works. These options
leave the ending's own cinematic starfield intact.

**List every console-settable parameter** with `viewconfig`, `showconfig`,
`showvars`, `viewvars`, `listvars` or `listconfig`. Each row shows its name, current
value, friendly name and description. Use the mouse wheel or Page Up / Page Down
to scroll; the listing reads live settings without changing them.

### Retained from 0.21.0


**Microgravity is on by default in normal levels.** Movement keys apply thrust:
the cube builds speed, coasts briefly when released, and brakes faster when you
steer against its motion. Top speed stays 6 units/second, or 15.6 with Shift.
The drift affects the actual body and collisions. Bonus rounds keep their floor
rolling. Use `set microgravity off` in the debug console to compare with
the original direct controls; `toggle microgravity` and `status microgravity`
work too. The browser remembers the setting.

**HEAT at level 15 now introduces both heat penalties:** the outside grace drops
to 1.4 seconds, and new re-coupling requests are blocked while overheating.
Cooling down restores re-coupling. The check uses the heat state, so future heat
sources can reuse it. Refused requests cost no quota; a request already underway
finishes. Use `set overheat_blocks_recoupling off` to disable this restriction.
The flag defaults to on and is saved through the debug console.

`BALANCE.heatMinLevel` in [`web/js/difficulty.mjs`](web/js/difficulty.mjs) defaults
to **15**; **0 removes the level gate**. Both heat penalties and the HEAT banner
share this setting. `featuresForSettings()` supplies the ordered introduction
schedule, banner titles and Help milestone table with `game.balance`; `LEVEL_FEATURES` remains the legacy 50-level reference snapshot. See [the full progression list](docs/LEVEL_PROGRESSION.md).
Thrust response and coasting are tuned in `PLAYER_PROPULSION` in `web/js/config.mjs`.

The package also declares its JavaScript module type explicitly, so local checks
recognize the bundled Three.js modules without depending on Node's automatic
module detection. No npm installation is needed.

### Retained from 0.20.1 and earlier

The ending now lets **YOU'VE ASCENDED** finish fading in and holds it alone for
two seconds before **... FOR NOW.** fades in underneath. The continue prompt now follows the added thank-you sequence. Reassembly messages sit beneath the rebuilding cube with
subtle white outlines for readability.
The README now features the original game's cube-letter logo and the live play
link above. The gameplay additions from 0.20.0 are retained below.
The animated title also fits the space between the start prompt and instructions,
including narrow browser windows and enlarged browser text.

Each level adds **one corridor leg**: level 1 has one, level 2 has two, and level
20 has twenty (50 in the original variant). X/Z routes gain the Y axis from level 3. The opening camera pulls
back to fit the whole maze as a faint ghost outline, with the distant exit visible
and no red cutting grids. The outline fades as the camera returns to the start.

During play, only nearby corridors and their hazards are detailed. The previous
leg collapses with sound and debris after you clear the next turn; the distant
exit stays marked while the route ahead remains hidden. A fixed starfield follows
the view, so even the largest maps cannot leave it behind.

**Culling is enabled by default.** Compare with `culling false` / `culling true`
(also `0` / `1`) in the debug console. The browser remembers the
choice. Disabling culling shows the surviving route and future previews; the
collision, hazard-reveal and collapse rules continue to apply.

The surviving player collective now tumbles smoothly across **X, Y and Z** in
normal levels. Different slow rates on each axis keep its motion evolving.
It starts turning as it appears.
Every remaining mini-cube moves with the body, including its holes; the rotated
positions determine which pieces hit the field and laser gaps. Re-coupled pieces
settle into the turning body. The aim is to reach the portal with whatever remains.

Rotation is on by default. Use `spin 0` / `spin 1` in the debug console (`false` / `true` also work).
Turning it off restores the body's axis alignment, and the browser remembers
your choice. Bonus rounds keep their own floor rolling and crash animations.
The speed and default live in `PLAYER_ROTATION` in `web/js/config.mjs`.

Laser and field-edge hits now jolt the whole surviving body into a sharp
rotational recoil that settles back into its slow tumble. **Hit rotation shocks**
is enabled by default in Help → Options and has its own saved `rotation_shocks` switch.
The recoil is visual and does not inflict additional collision damage.

All console boolean settings use the same commands, including `locate` and `mute`:

```text
toggle rotation_shocks
set rotation_shocks enabled
status rotation_shocks
```

`toggle <thing>` flips it and replies `<thing> set to true/false`.
`set <thing> <value>` accepts `true/false`, `on/off`, `1/0` and
`enabled/disabled`. `status <thing>`, `view <thing>`, `get <thing>` and
`set <thing>` all report `Status for <thing> is: Enabled` or `Disabled`.
Use `flags` to list them. Unknown names report `<thing> not found!`;
recognized non-boolean controls report `<thing> cannot be toggled with on/off!`.
Numeric `level`, `score` and `cubes` also support status queries.

The ending now begins with **one white cube above an endless blue grid**. It
levitates into a starfield as the camera tilts upward, shrinks into a bright point,
and holds among the stars before everything fades to white. Preview it with
`test ending_1`. The scene lasts ten seconds, followed by the two-second white
hold, ending text, the thank-you sequence and run statistics.

Portals now radiate a white glow that strengthens as you approach, in normal and
bonus rounds. Use `portal_white_light true` / `portal_white_light false`, or
**Help → Options → Portal white light**, to compare it. It is enabled by default and the
browser saves the setting. The effect uses one small glow sprite.
`set level 20` now works as an alias for `level 20`.

Outside the grid, overheating makes the player body vibrate violently and
flash red/orange with white-hot peaks. The effect intensifies with heat and stops
on returning inside. Open **Help → Options → Shaking and heat flashes** to toggle it, or use
`shake 0` / `shake 1` in the console (`false` / `true` also work). The browser saves
your choice. The switch also controls bonus warning tremors and camera jolts.


**PICKING UP THE PIECES · BONUS ROUND 001** follows levels 5, 10 and 15 in the default campaign.
A full cube crashes onto a solid floor and shatters. Roll the surviving mini-cube
through the scattered pieces to rebuild, then climb the ramp to the portal.
You have **45 seconds** after the crash; escape banks **100 points per piece**.
During the final five seconds the body shakes and glows with heat. At zero it
explodes into spinning fragments, then fades to white. A timeout forfeits the
bonus and continues your journey. WASD / arrows roll on
the floor, Shift rushes, and Help shows the matching bonus keyboard diagram.

Open the console with backtick or Ctrl+Shift+F1:

```text
test bonus_round_1
test ending_1
```

After a test bonus, continue to the next level of the active run. If there is no
active level, the destination is the configured first bonus level (currently 5).
The portal now accepts an approaching roll even when the roll would otherwise
finish beyond the back of the platform. `view_end_anim_v1`
remains an alias for the ending. Bonus types, timing and scheduling are configured
in [`web/js/bonus.mjs`](web/js/bonus.mjs), ready for future round types.

After the startup check, the game checks its deployed `web/version.json` for updates every two minutes
and on return to the tab. A newer version pauses play and shows the update notice;
Space dismisses it, and F5 / Refresh reloads the game. Deployment on GitHub Pages
is enough; there is no GitHub API or separate update server.

Help includes **© 2024–2026 FlyingFathead**. The mobile notice offers the touch
beta or keyboard/controller mode. You can change the choice later through ⚙ Options.

## Difficulty and the current ending

Time tightens from 30 seconds per leg at level 5 to 10 at level 20. ENTROPY
reduces recovery from 50% per request at 10 to 1% at 20. HEAT at 15 shortens
outside grace to 1.4 seconds and blocks new requests while hot. TIME warnings
return at 10, 15 and 20; the curves tighten continuously between them. LOSS
starts at the exit of 16, with partial bodies carried into 17 and onward.
Colour fades quadratically from barely perceptible at 10 to completely grey at 20.

Clear the **20-level cap** to see the faint ocean wave on white,
starfield ascension, slow thank-you fade and statistics. The original 50-level
variant retains its own difficulty curves, LOSS at 44 and colour fading from
44 to 50, followed by the same expanded ending.

The game reads its version from [`web/version.json`](web/version.json).
Balance settings, including the entropy introduction level and current level cap,
live in [`web/js/difficulty.mjs`](web/js/difficulty.mjs).
The keyboard help, boxed countdown and three-line opening from 0.16.0 are retained.
The top-right timer now reddens near zero, and a bottom-center TIME RESET ... FOR NOW
box flashes whenever a timed leg starts or resets.

The web version continues independently from the **PyGame 0.15.79** baseline.
See [CHANGELOG.md](CHANGELOG.md) for release notes and [WEB_PORT.md](WEB_PORT.md)
for development and deployment details.

## Play and controls

Use a browser with JavaScript, import maps and WebGL 2. Audio starts after interaction.

| Key | Action |
| --- | --- |
| A / D | Move on X |
| W / S | Move on Y |
| Q / E | Move on Z |
| Shift | Rush |
| C | Re-couple loose pieces |
| V | Panic recovery to the start of the furthest reached leg |
| L | Locate camera |
| H | Help |
| P | Pause |
| M | Mute |
| Esc | Menu |

### Xbox-style controller

| Input | Action |
| --- | --- |
| Left stick / D-pad | Move X/Y; roll on the floor in bonus rounds |
| LT / RT | Move +Z / −Z in normal levels |
| **LB / X** | **Re-couple** on each press |
| RB | Hold to rush |
| A | Start / confirm / continue |
| B | Panic in normal play; Back in menus; menu in bonus rounds |
| Y | Locate cube |
| View / Back | Help |
| Menu / Start | Pause / resume |
| Right stick | Scroll Help and dialogs |

In menus, use the D-pad or left stick to select, then A to activate.
Only one controller controls the game at a time. Disconnecting it pauses play.
`toggle controller` and `set controller_deadzone 0.18` are saved console settings.
A standard browser gamepad mapping is required; custom remapping and rumble are
not included in this release. Hardware/controller playtesting is still needed.

## Run locally

From this repository's root:

```bash
python -m http.server 8000 --directory web
```

Open http://localhost:8000/ (on Windows, `py` can replace `python`).
The complete static game lives in `web/`, including its renderer, font and
23 sounds in Ogg and MP3 (18 originals, two shutter effects, the LOSS engine wind-down, arrival water sweep and Panic ambulance recall). No backend or npm installation is required.

## GitHub Pages

1. Place this package's contents at the root of `FlyingFathead/cube-libre`,
   including `.github/`. Keep the `web/` directory intact.
2. Select **Settings → Pages → Source → GitHub Actions**.
3. Push to `main` or `master`, or run **Deploy Cube Libre to GitHub Pages**
   from the Actions tab.

The included workflow checks the port and publishes `web/` at
https://flyingfathead.github.io/cube-libre/.

Repository description, homepage and topic commands are in
[docs/GITHUB_METADATA.md](docs/GITHUB_METADATA.md).

## Development

```bash
node tools/check_web.mjs
node --test tests/web/*.test.mjs
```

See [WEB_PORT.md](WEB_PORT.md) for gameplay details, browser differences,
source layout, and optional regeneration using a separate PyGame checkout.
Web 0.29.2 (`5bdd1ce`) is the published baseline. This release passes 211
automated test groups and static checks on Node.js 18.19.1, including both
campaigns, legacy save migration, independent records, LOSS body carry, ending
wave/audio timing and render data, controller/touch dispatch, simulated final routes,
and Panic returns at every leg start in both campaigns with preserved recovery limits.
Action checks cover desktop/touch availability and orange-red urgency; optional
penalty checks cover repeated uses, unchanged records and saved deductions.
Outside-drift checks keep nearby walls drawn on levels 7, 8 and both campaign
caps, including the touch-input path on both mobile layouts.
The baseline tests explicitly select mode 50; additional mode tests exercise the
default 20-level campaign. The shorter campaign's human balance and Panic's
visual/audio pacing still need device playtesting. Automated traversal does not
establish human completion under campaign LOSS.

After changing the version or adding/removing modules, regenerate the committed
startup metadata before the checks:

```bash
node tools/prepare_web_release.mjs
```

© 2024–2026 FlyingFathead. Original authorship and rights remain with the author. The bundled
[Three.js MIT license](web/vendor/THREE-LICENSE.txt) applies to Three.js.
