# Cube Libre — Web v0.22.0

<h1 align="center"><a href="https://flyingfathead.github.io/cube-libre/">▶ PLAY THE WEB VERSION HERE</a></h1>

<p align="center"><strong>Play now in your browser. No download or installation needed.</strong><br>
Best played on a desktop computer with a keyboard.</p>

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

## Web release 0.22.0

**CHANGE ... arrives at level 7: THE LASERS NOW OPEN AND CLOSE.** Electric
shutters seal the entire laser square on a **4-second cycle**, with an amber
warning for 0.4 seconds before a 0.8-second closure. Closing makes an electric
BZZZT; reopening makes a whoosh. Each leg gets its own stable random timing.
Contact with a closed shutter removes **50% of the remaining cubes, rounded down**,
preserving the last cube. A hit grants **1.5 seconds of protection from all laser
grids**, and the same grid cannot hit twice in one closure. Boundaries and the
clock still apply. Pause and Help freeze the shutter cycle.

Open the console with backtick or Ctrl+Shift+F1:

```text
test change_1
set change_1_interval 4
set change_1_min_level 7
toggle change_1_random_per_leg
toggle change_1
viewconfig
```

`test change_1` enables lasers and shutters, then starts the configured introduction
level with its CHANGE banner. It replaces the current level; it is a gameplay debug
command. All shutter timing and damage settings are listed in
[the progression reference](docs/LEVEL_PROGRESSION.md). The feature and random-timing
booleans are saved; numeric shutter changes last for the current browser session.

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
rolling. Use **Help → Microgravity** or `set microgravity off` to compare with
the original direct controls; `toggle microgravity` and `status microgravity`
work too. The browser remembers the setting.

**HEAT at level 15 now introduces both heat penalties:** the outside grace drops
to 1.4 seconds, and new re-coupling requests are blocked while overheating.
Cooling down restores re-coupling. The check uses the heat state, so future heat
sources can reuse it. Refused requests cost no quota; a request already underway
finishes. Use `set overheat_blocks_recoupling off` to disable this restriction.
The flag defaults to on and is saved in Help and through the console.

`BALANCE.heatMinLevel` in [`web/js/difficulty.mjs`](web/js/difficulty.mjs) defaults
to **15**; **0 removes the level gate**. Both heat penalties and the HEAT banner
share this setting. `featuresForSettings()` supplies the ordered introduction
schedule, banner titles and Help milestone table; `LEVEL_FEATURES` is its default snapshot. See [the full progression list](docs/LEVEL_PROGRESSION.md).
Thrust response and coasting are tuned in `PLAYER_PROPULSION` in `web/js/config.mjs`.

The package also declares its JavaScript module type explicitly, so local checks
recognize the bundled Three.js modules without depending on Node's automatic
module detection. No npm installation is needed.

### Retained from 0.20.1 and earlier

The ending now lets **YOU'VE ASCENDED** finish fading in and holds it alone for
two seconds before **... FOR NOW.** fades in underneath. The continue prompt
appears afterward. Reassembly messages sit beneath the rebuilding cube with
subtle white outlines for readability.
The README now features the original game's cube-letter logo and the live play
link above. The gameplay additions from 0.20.0 are retained below.
The animated title also fits the space between the start prompt and instructions,
including narrow browser windows and enlarged browser text.

Each level adds **one corridor leg**: level 1 has one, level 2 has two, and level
50 has fifty. X/Z routes gain the Y axis from level 3. The opening camera pulls
back to fit the whole maze as a faint ghost outline, with the distant exit visible
and no red cutting grids. The outline fades as the camera returns to the start.

During play, only nearby corridors and their hazards are detailed. The previous
leg collapses with sound and debris after you clear the next turn; the distant
exit stays marked while the route ahead remains hidden. A fixed starfield follows
the view, so even the largest maps cannot leave it behind.

**Culling is enabled by default.** Compare with `culling false` / `culling true`
(also `0` / `1`) or **Help → Cull distant corridors**. The browser remembers the
choice. Disabling culling shows the surviving route and future previews; the
collision, hazard-reveal and collapse rules continue to apply.

The surviving player collective now tumbles smoothly across **X, Y and Z** in
normal levels. Different slow rates on each axis keep its motion evolving.
It starts turning as it appears.
Every remaining mini-cube moves with the body, including its holes; the rotated
positions determine which pieces hit the field and laser gaps. Re-coupled pieces
settle into the turning body. The aim is to reach the portal with whatever remains.

Rotation is on by default. Use **Help → Player auto-rotation (normal levels)**
or `spin 0` / `spin 1` in the console (`false` / `true` also work).
Turning it off restores the body's axis alignment, and the browser remembers
your choice. Bonus rounds keep their own floor rolling and crash animations.
The speed and default live in `PLAYER_ROTATION` in `web/js/config.mjs`.

Laser and field-edge hits now jolt the whole surviving body into a sharp
rotational recoil that settles back into its slow tumble. **Hit rotation shocks**
is enabled by default in Help and has its own saved `rotation_shocks` switch.
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
hold, ending text and run statistics.

Portals now radiate a white glow that strengthens as you approach, in normal and
bonus rounds. Use `portal_white_light true` / `portal_white_light false`, or
**Help → Portal white light**, to compare it. It is enabled by default and the
browser saves the setting. The effect uses one small glow sprite.
`set level 20` now works as an alias for `level 20`.

Outside the grid, overheating makes the player body vibrate violently and
flash red/orange with white-hot peaks. The effect intensifies with heat and stops
on returning inside. Open **Help → Shaking and heat flashes** to toggle it, or use
`shake 0` / `shake 1` in the console (`false` / `true` also work). The browser saves
your choice. The switch also controls bonus warning tremors and camera jolts.


**PICKING UP THE PIECES · BONUS ROUND 001** follows levels 5, 10, 15…45.
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

The game checks its deployed `web/version.json` for updates every two minutes
and on return to the tab. A newer version pauses play and shows the update notice;
Space dismisses it, and F5 / Refresh reloads the game. Deployment on GitHub Pages
is enough; there is no GitHub API or separate update server.

Help includes **© 2024–2026 FlyingFathead**. Mobile browsers get a desktop-play
notice with **TAP HERE TO CONTINUE**. This is a placeholder for future mobile work;
existing touch buttons are available, but a dedicated mobile edition is deferred.

## Difficulty and the current ending

Time tightens from 30 seconds per leg at level 5 to 10 seconds at level 50.
Entropy reduces re-coupling yield from 50% at level 10 to 1% at level 50, rounded
to the nearest whole percent. **HEAT** arrives at level 15, shortening the
out-of-bounds overheating grace period from 2.4 to 1.4 seconds. **TIME** returns
at levels 20, 35 and 50 to announce the current allowance. From HEAT onward,
active overheating also blocks new re-coupling requests when its flag is enabled.
The route also grows by one leg each level, so the final level combines fifty
legs with the strictest timer, heat and re-coupling settings.

The current level cap is **50**. Clear it to see a single white cube ascend into the stars,
followed by the ending and your run statistics. Separate Space / Enter / click
inputs advance to the stats and then return to the main menu.

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

Use a browser with JavaScript and WebGL 2. Audio starts after interaction.

| Key | Action |
| --- | --- |
| A / D | Move on X |
| W / S | Move on Y |
| Q / E | Move on Z |
| Shift | Rush |
| C | Re-couple loose pieces |
| L | Locate camera |
| H | Help |
| P | Pause |
| M | Mute |
| Esc | Menu |

## Run locally

From this repository's root:

```bash
python -m http.server 8000 --directory web
```

Open http://localhost:8000/ (on Windows, `py` can replace `python`).
The complete static game lives in `web/`, including its renderer, font and
20 sounds in Ogg and MP3 (18 originals plus two shutter effects). No backend or npm installation is required.

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
Web 0.21.0 is the published baseline. This release has automated checks;
its new shutter effects, camera behavior and sky still need browser playtesting. The WebGL effects
are recreated and are not pixel-identical to the desktop version.

© 2024–2026 FlyingFathead. Original authorship and rights remain with the author. The bundled
[Three.js MIT license](web/vendor/THREE-LICENSE.txt) applies to Three.js.
