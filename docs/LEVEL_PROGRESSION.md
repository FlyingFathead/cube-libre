# Cube Libre web progression

Default schedule for web **0.22.0**, based on published v0.21.0 (`34faa15`).
[`featuresForSettings()`](../web/js/difficulty.mjs) combines `BALANCE` milestones
with [`CHANGES` and `CHANGE_NUMBERS`](../web/js/changes.mjs), sorts by level, and
supplies phase selection, banner titles and the Help table. `LEVEL_FEATURES` is a
snapshot of that schedule with default values. Console changes to the shutter
minimum update the live schedule.

| Level | Banner | What changes |
| --- | --- | --- |
| 1 onward | Opening story | Microgravity starts enabled; automatic camera tracking settles onto the cube after the overview. |
| Every level | LEVEL number / overview | One added corridor leg per level, reaching fifty legs at level 50. |
| 3 | SPACE ... | Introduces world Y and three-dimensional routes; nearby detail takes over. Camera tracking already starts at level 1. |
| 5 | TIME ... | Starts at 30 seconds per leg; gradually tightens to 10 seconds by level 50. Each new leg resets the allowance. |
| 7 | CHANGE ... | THE LASERS NOW OPEN AND CLOSE. Electric shutters cycle every 4 seconds, closing for 0.8 seconds after a 0.4-second warning. Contact removes half the remaining cells, rounded down. |
| 10 | ENTROPY ... | Re-coupling yield falls from 90% to 50% per request, then gradually to 1% by level 50, rounded to whole percentages. |
| 15 | HEAT ... | Outside grace falls from 2.4 to 1.4 seconds. Once overheating, new re-coupling requests are blocked until the heat clears, if the restriction is enabled. |
| 20 | TIME ... | Announces 24.8 seconds per leg. |
| 35 | TIME ... | Announces 15.2 seconds per leg. |
| 50 | TIME ... | Announces the final allowance of 10 seconds per leg. |
| After 5, 10, 15 ... 45 | PICKING UP THE PIECES / BONUS ROUND | A 45-second floor bonus: collect scattered pieces and escape via the ramp. |
| After clearing 50 | YOU'VE ASCENDED / ... FOR NOW. | Single-cube starfield ascension, then run statistics and the main menu. |

Phase cards last five seconds each. If multiple introductions share a level,
they play in schedule order before the level preview; the timer stays frozen.
The TIME reminders describe an ongoing curve, rather than abruptly reducing the
allowance only on those three levels. Heat and entropy are separate rules.

## Editing the schedule

In `web/js/difficulty.mjs`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `BALANCE.spaceStartLevel` | `3` | SPACE, Y-route introduction and nearby-detail behavior |
| `BALANCE.timeStartLevel` | `5` | First timed level and TIME introduction |
| `BALANCE.entropyStartLevel` | `10` | First entropy level and ENTROPY introduction |
| `BALANCE.heatMinLevel` | `15` | Gate for both heat penalties and the HEAT introduction; **0 removes the level gate** |
| `BALANCE.overheatBlocksRecoupling` | `true` | Default for the `overheat_blocks_recoupling` console flag |
| `BALANCE.timeReminderLevels` | `[20,35,50]` | Additional TIME announcements |
| `BALANCE.capLevel` | `50` | Endpoint of timer and recovery curves |
| `BALANCE.levelCap` | `50` | Last level before ascension |
| `featuresForSettings()` | Ordered records | Live feature IDs, configured levels, phase states, banners and descriptions |
| `LEVEL_FEATURES` | Default snapshot | The schedule before session overrides |

`heatStartLevel` is derived from `heatMinLevel` for the introduction. With a
minimum of 0, the penalties apply from the first normal level, and HEAT appears
after the opening story at level 1. With the default 15, no heat-related
re-coupling restriction applies before level 15, even if the cube is hot.

The restriction is exactly: **level gate satisfied AND flag enabled AND current
heat greater than zero**. It does not require an out-of-bounds flag, so other heat
sources can reuse it later. At present, corridor boundaries create heat after the
grace period; returning inside clears that heat. Requests are permitted during
the grace period. Rejected requests do not spend quota or restart a cooldown.
An already accepted request finishes normally.

The saved movement and heat console switches use the existing uniform syntax:

```text
set microgravity on
toggle microgravity
status microgravity
set overheat_blocks_recoupling true
toggle overheat_blocks_recoupling
status overheat_blocks_recoupling
```

`view` and bare `set` also report status. Explicit values accept true/false,
on/off, 1/0 and enabled/disabled. The BALANCE thresholds are edited in the configuration file. Shutter and
automatic-camera thresholds also have console overrides, listed below. Bonus schedules and types live separately in
[`web/js/bonus.mjs`](../web/js/bonus.mjs); thrust tuning lives in
[`PLAYER_PROPULSION`](../web/js/config.mjs). Bonus rolling and pickup rules are
independent of normal-level propulsion and the heat re-coupling restriction.


## CHANGE 1: electric shutters

The stable mechanic ID is `change_1`. Its phase card says **CHANGE ...**, then
**THE LASERS NOW OPEN AND CLOSE**, then **PASS THROUGH WHILE THEY ARE OPEN**.
The default introduction is **level 7**, between TIME and ENTROPY. A minimum of 0
activates shutters from level 1 and places the card after the opening story.
Moving this minimum to an existing milestone level queues both cards.

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `change_1` | `true` | Enable shutters; ordinary laser grids must also be enabled |
| `change_1_min_level` | `7` | First level, 0–50; 0 removes the gate |
| `change_1_random_per_leg` | `true` | Stable random timing offset per leg; false synchronizes all legs |
| `change_1_interval` | `4` | Seconds between closures; range 0.5–60 |
| `change_1_closed_seconds` | `0.8` | Seconds fully closed; range 0.05–30 |
| `change_1_warning_seconds` | `0.4` | Amber warning before closing; range 0–10 |
| `change_1_damage_fraction` | `0.5` | Fraction of remaining cells lost; range 0–1 |
| `change_1_damage_cooldown` | `1.5` | Seconds of protection from all laser grids after a shutter hit; range 0–30 |

Closed duration plus warning must be shorter than the interval. Invalid settings
leave the old value intact. Fractional seconds and damage fractions are retained.
Each grid can damage once per closure; a protected contact consumes that grid's
hit for the closure too. Damage rounds down, preserving at least one cell:
125 becomes 63, 10 becomes 5, and 1 stays 1. Detached cells remain recoverable
under the current entropy, expiry and HEAT rules. Invulnerability covers laser
grids only; it does not pause the leg timer or disable boundary damage.

Shutters also hurt if entered while already closed. The electric sheet covers
the whole rotating square, including the former opening. Turn chambers retain
their existing safety rule. Hidden/unrevealed grids remain inactive, and nearby
legs provide one closing/opening sound per transition, rather than one per grid.
Pause, Help, introductions and bonus rounds freeze the normal shutter clock.
Attempts and setting changes restart the clock and clear closure contacts.

```text
test change_1
set change_1_min_level 7
set change_1_interval 4
set change_1_damage_cooldown 1.5
toggle change_1_random_per_leg
status change_1
```

The test enables `change_1` and `lasers`, then starts the configured level with its
phase card; it replaces the active level and uses normal scoring. Boolean shutter
preferences are saved in the browser. Numeric tuning lasts for this session;
edit `CHANGE_NUMBERS` in `web/js/changes.mjs` to change shipped defaults.

## Camera, sky and configuration listing

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `auto_locate_min_level` | `0` | Always follow after the overview; set 3 to restore the old level gate. Session only. |
| `star_pattern` | `2` | 0: off; 1: original evenly spaced sky; 2: irregular sky with varied sizes, brightness and subtle hues. Saved in the browser. |

Camera defaults live in `CAMERA_RULES`; the star default is
`VISUAL_EFFECTS.starPattern`, both in `web/js/config.mjs`. They do not change the
SPACE threshold. Sky selection is console-only; the ending uses its own sky.

`viewconfig`, `showconfig`, `showvars`, `viewvars`, `listvars` and `listconfig` all
list every console-settable value with a friendly name and description. Values
come from the command registry at the time of the request. Mouse-wheel scrolling
and Page Up / Page Down work in the console. `status`, `view`, `get` and bare `set`
query a single parameter. Booleans additionally support `toggle`; numeric controls
use `set name number` (or the documented `score N` / `cubes N` commands).
