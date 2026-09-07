# Cube Libre web progression

Default schedule for web **0.30.1**, based on published v0.30.0 (`91172bf`) with mercy extended to two seconds.
`DEFAULT_GAME_MODE = 20` and the immutable `GAME_MODES` registry live in
[`web/js/difficulty.mjs`](../web/js/difficulty.mjs). Each `Game` owns its active
balance; `featuresForSettings(settings, flags, lossMinLevel, game.balance)` drives
the actual cards and Help table. The `BALANCE` export, default helper arguments
and `LEVEL_FEATURES` snapshot retain the original 50-level reference for tools.
Runtime gameplay always supplies its selected mode explicitly.

## Default campaign: game_mode 20

| Level | Banner | What changes |
| --- | --- | --- |
| 1 onward | Opening story | Microgravity and automatic tracking after the overview. |
| Every level | LEVEL / overview | One added leg: 1 through 20, totaling 210 before retries. |
| 3 | SPACE ... | World Y opens; three-dimensional routes and nearby detail. |
| 4 | CHANGE ... (change_1) | One random gate zaps per sequence. |
| 5 | TIME ... | 30 seconds per leg; continuous tightening starts. |
| 6 | CHANGE ... (change_2) | Two distinct gates in one leg, two seconds between starts; second pitch −3 semitones. |
| 7 | CHANGE ... (change_3) | A third distinct gate; pitch +3 semitones. |
| 8 | CHANGE ... (change_4) | Four gates: inner, far end, opposite end, other inner. Mirrored starting side; fourth pitch +7 semitones. |
| 10 | ENTROPY ..., then TIME ... | 50% recovery per request; colour starts at 2.5% desaturation. TIME announces 24.8 seconds per leg. |
| 15 | HEAT ..., then TIME ... | Outside grace drops to 1.4 seconds; no new recovery requests while hot. TIME announces 15.2 seconds; recovery is 26%. |
| 16 | LOSS ... | PORTALS NO LONGER RESTORE LOST PIECES. Exit 16 carries survivors into 17. Retries restore the entry body. |
| 20 | TIME ... | Ten seconds per leg, 1% recovery, twenty legs and full greyness. The exit is oversized and pure white. |
| After 5, 10, 15 | PICKING UP THE PIECES / BONUS ROUND | 45-second floor bonus with separate body and score. No bonus after the final level. |
| After clearing 20 | White tide → ascension | A faint ocean wave sweeps across white with a soft noise wash. Both fade; blank white lingers before the starfield and ascension. Ending words, thank-you fades, statistics and menu follow. |

Phase cards hold for five seconds each, queued in the order shown. They and the
preview do not consume the leg clock. TIME warnings describe the continuous
curve. The fading has no separate title card and does not cause damage.

## Quiet grace during critical damage

In both campaigns, default-on `mercy_mode` protects the surviving body for
`mercy_seconds` (2) when two damaging hits within
`mercy_damage_window_seconds` (0.5) leave at most `mercy_cube_threshold` (20)
cubes. `mercy_cooldown_seconds` (15) starts after that protection ends.
These are session-only console settings, with no introduction, menu control or
new warning. Low count alone does not activate grace. The triggering hit still
costs cells but preserves the last existing cube if necessary. Lasers, shutters
and boundaries share the protection. Ignored hits do not build a later burst.

Pause, Help and Panic confinement freeze the protection and cooldown. A new
attempt resets them. Recouple yield, failed debris, heat restrictions and
quota still apply. Timer expiry and real sealed-section contact remain lethal;
sealed contact now has a bright blue grid, electric buzz and cause label.

## Same end pressure, shorter ramps

| Level in mode 20 | Seconds per leg | Recovery per request | Colour blended toward grey |
| --- | --- | --- | --- |
| 5 | 30.0 | 90% | 0% |
| 10 | 24.8 | 50% | 2.5% |
| 15 | 15.2 | 26% | 26.9% |
| 16 | 13.5 | 18% | 37.6% |
| 17 | 12.1 | 12% | 50.3% |
| 18 | 11.0 | 6% | 64.9% |
| 19 | 10.3 | 2% | 81.5% |
| 20 | 10.0 | 1% | 100% |

Time uses smoothstep from level 5 to the active endpoint; entropy from 10 to
that endpoint. Seconds round to tenths, recovery to whole percentages. Both
variants finish at the same 10 seconds / 1% / 1.4-second heat grace. Recovery
still guarantees at least one available piece per accepted request, with the
existing quota and expiry. One press handles the entire eligible batch. The
failed fraction becomes unrecoverable grey/wireframe debris and fades; repeated
presses cannot reclaim it. Fresh damage supplies a new batch. Shutter windows, immunity, damage, movement speeds
and the laser-spin cap remain unchanged; spin reaches its 1.45× ceiling by 14.

## Preserved original: game_mode 50

| Feature | Mode 20 (default) | Mode 50 (console/config only) |
| --- | --- | --- |
| SPACE / TIME / ENTROPY / HEAT | 3 / 5 / 10 / 15 | 3 / 5 / 10 / 15 |
| CHANGE 1 / 2 / 3 / 4 | 4 / 6 / 7 / 8 | 4 / 6 / 7 / 8 |
| Repeated TIME cards | 10 / 15 / 20 | 20 / 35 / 50 |
| First LOSS exit | 16 → 17 | 44 → 45 |
| Colour fade range | 10–20 | 44–50 |
| Curve endpoint / final portal / ending | 20 | 50 |
| Bonus rounds | After 5, 10, 15 | Every five from 5 through 45 |

`set game_mode 50` selects the original for `newrun` and console previews.
`set game_mode 20` restores the default selection. A changed mode returns to
the title, resets LOSS/fade thresholds to that mode's defaults, and leaves the
saved campaign intact. A same-value set is inert. Continue uses its saved mode
without changing the session selection for the next new run. Reloading returns
the new-run selection to 20. There is no public mode selector.

## Editing the schedule

Both balances are in `GAME_MODES`; mode 50 is the original `BALANCE` object.
Shared defaults such as SPACE and HEAT remain defined there and inherited by 20.
Use the mode registry to change campaign milestones, and keep its `levelCap`
and `capLevel` aligned. Public mode values are validated as exactly 20 or 50.

| Console setting | Default in 20 / 50 | Meaning |
| --- | --- | --- |
| `game_mode` | 20 / selected explicitly | Variant, with no public checkbox. Queries never change it. |
| `loss_min_level` | 16 / 44 | First exit without refill and LOSS card; 0 means first level. |
| `loss_grey_min_level` | 10 / 44 | Separate colour-fade onset; 0 means first level. |
| `loss` | true / true | Enable portal survivor carry; saved flag. |
| `loss_grey` | true / true | Enable visual desaturation; saved flag. |

Numeric LOSS/fade thresholds accept integers from 0 through the active cap and
last for the session. `game_mode` is session-only; saves record their own mode.
All appear in `viewconfig` with current values and descriptions. Remaining
shutter, camera, visual and control settings keep their existing commands.

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
LOSS and automatic-camera thresholds also have console overrides, listed below. Bonus schedules and types live separately in
[`web/js/bonus.mjs`](../web/js/bonus.mjs); thrust tuning lives in
[`PLAYER_PROPULSION`](../web/js/config.mjs). Bonus rolling and pickup rules are
independent of normal-level propulsion and the heat re-coupling restriction.


## LOSS and incomplete assembly

The rule applies to the **source level's exit**. Level 15 → 16 still refills.
Level 16 → 17 carries exact cell IDs and positions within the formation. Later
portals keep doing this. A snapshot at each level's entry controls retries and
automatic reassembly, so dying can never refill beyond that entry body. Ordinary
re-coupling can still recover fresh debris under the current entropy/heat rules.
Bonuses score independently and preserve the carry. The original variant retains
its bonus after 45 and its 44 → 45 LOSS transition.

Absent entry cells are temporary grey visual forms, never physical or recoverable
fragments. They tremble and fly away with a generated `loss_weep` sound. The
caption changes to **ONLY PARTIAL REASSEMBLY SUCCEEDED**. The level clock waits for assembly
and the overview to finish.

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `loss` | `true` | Carry survivors through portals from the threshold; saved boolean |
| `loss_min_level` | `16` | First affected exit and LOSS card; integer 0–20 in default mode, session only |
| `loss_grey_min_level` | `10` | Independent fade onset, same range; session only |
| `loss_grey` | `true` | Gradual body desaturation; saved visual flag |

The colour blend is **2.5% at the starting level**, then follows a quadratic
curve to 100% at the cap. Original-mode defaults for 44–50: 2.5%, 5.2%, 13.3%, 26.9%, 45.8%,
70.2%, 100%. These are colour-blend amounts, not damage or re-coupling rates.
`LOSS_COLOUR` in `web/js/loss.mjs` defines the onset and exponent. Disabling
`loss_grey` changes appearance only; heat and hit flashes remain visible.

`level N` / `set level N` start a fresh body and display all applicable cards.
`test loss` shows the LOSS card and a deliberately incomplete demonstration body.
`test ending_1` / `view_end_anim_v1` include the thank-you segment;
`thank_you_note` or `test thank_you_note` previews that segment alone. Previews
are developer tools. The normal ending still requires clearing the active cap: 20 or 50.

## CHANGE 1–4: shutter sequences

The numbered stages all display **CHANGE ...** with their own explanation.
`change_1` is the master switch. The highest enabled stage whose threshold has
been reached determines the sequence length; turning off a later stage exposes
the next enabled lower stage. A fixed count override takes precedence. Later
stages cannot begin before the master threshold, even if their own minimum is 0.
Shared levels queue their cards in numeric order after any existing phase card.

Two- and three-step sequences randomly choose distinct gates from all five
laser grids in the leg. The default four-step pattern selects the two outer
and two inner grids. In travel order, numbering the grids **1–5**, it is either
**2 → 5 → 1 → 4** or **4 → 1 → 5 → 2**. Grid 3 remains an ordinary laser grid.
Disable `change_4_pattern` for four randomly chosen distinct gates instead.
Disabling randomness fixes the selection/order; it does not close gates together.

Zap starts within a sequence are 2 seconds apart. Each step has a 0.4-second
warning, 0.8-second closure, and at least 0.8 seconds fully open before the next
warning. The initial sequence closes its first gate 3.2 seconds into active play.
A complete next sequence starts no sooner than 4 seconds after the previous
sequence's last zap start. If a leg disappears, remaining steps are cancelled
and the next sequence retains the cooldown; no catch-up sound or damage burst.

Only one sequence is active across the scene and only one gate closes at once.
`change_1_no_repeat_leg` applies **between complete sequences**. A lone revealed
leg completes all its steps, then waits for another eligible leg. It does not
interrupt its own rhythm to alternate legs between individual zaps.

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `change_1` | true | Master shutter switch; ordinary lasers must also be enabled. |
| `change_2`, `change_3`, `change_4` | true | Enable the two-, three- and four-step stages. |
| `change_1_min_level` | 4 | First shutter level; 0 means level 1. |
| `change_2_min_level` | 6 | Two-step stage threshold. |
| `change_3_min_level` | 7 | Three-step stage threshold. |
| `change_4_min_level` | 8 | Four-step stage threshold. |
| `change_4_pattern` | true | Use mirrored inner/end/end/inner order for four gates. |
| `change_1_random_per_leg` | true | Random sequence gates/legs, or random starting side of the four-step pattern. |
| `change_1_no_repeat_leg` | true | Require another revealed leg for the next complete sequence. |
| `change_1_gates_per_leg` | 0 | 0 uses stages; 1–5 overrides distinct gates per sequence. |
| `change_1_step_seconds` | 2 | Seconds between zap starts within one sequence. |
| `change_1_interval` | 4 | Minimum last-zap to next-sequence-first-zap spacing. |
| `change_1_gate_cooldown` | 0.8 | Minimum open rest before the next warning. Can extend either spacing. |
| `change_1_warning_seconds` | 0.4 | Warning duration before each zap. |
| `change_1_closed_seconds` | 0.8 | Duration of each full closure. |
| `change_1_damage_fraction` | 0.5 | Fraction of remaining cubes lost, rounded down; preserve the last cube. |
| `change_1_damage_cooldown` | 1.5 | Protection from all laser grids after a shutter hit. |
| `change_1_pitch_1` | 0 | First zap semitones relative to original audio. |
| `change_1_pitch_2` | −3 | Second zap semitones. |
| `change_1_pitch_3` | +3 | Third zap semitones. |
| `change_1_pitch_4` | +7 | Fourth zap semitones. |
| `change_1_pitch_5` | −7 | Fifth zap pitch, used only with a five-gate override. |

Pitch is a playback-rate change: `2 ** (semitones / 12)`, reusing the same decoded
buzz and whoosh buffers. Closing and reopening use the same pitch for a given
step. Lower pitch slightly lengthens the effect; gate timing is independent.
Current-leg steps are audible throughout that leg; distant-leg sounds retain
the proximity filter. No additional sound assets or effects processors are used.

The effective step spacing is the larger of `change_1_step_seconds` and the sum
of warning, closure and open rest. The same floor applies to `change_1_interval`.
Warning plus closure must be shorter than both requested spacings; invalid
values leave settings unchanged. Thus even extreme valid tuning never creates
overlapping closed gates. Numeric pitch range is −12 to +12 semitones.

Each grid can damage once per closure. A protected contact consumes its hit for
that closure too. Normal beams do not also damage through a closed sheet. Damage
removes half the survivors by default, rounded down, preserving the last cell;
fragments remain recoverable under existing entropy, expiry and HEAT rules.
Immunity covers laser grids, not the timer or corridor boundaries.

```text
test change_1
test change_2
test change_3
test change_4
set change_1_step_seconds 2
set change_1_pitch_2 -3
toggle change_4_pattern
status change_2
viewconfig
```

Previews enable the master, requested stage and lasers, then replace the current
level with the configured introduction level and banner. Normal scoring applies.
Pause, Help, intros and bonus rounds freeze the shutter clock. Attempt resets
and configuration changes discard pending sequences, immunity and contacts.
Booleans are saved in this browser; numbers last for the page session. Edit
`CHANGE_NUMBERS` in `web/js/changes.mjs` to change shipped defaults.

The old `change_1_start_gates`, `change_1_max_gates`, `change_1_ramp_end_level`
and `change_1_max_simultaneous` parameters are retired. Stages now determine
count and gates always close sequentially. Those names report not found.

## Camera, sky and configuration listing

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `auto_locate_min_level` | `0` | Always follow after the overview; set 3 to restore the old level gate. Session only. |
| `star_pattern` | `2` | 0: off; 1: original evenly spaced sky; 2: irregular sky with varied sizes, brightness and subtle hues. Saved in the browser. |

During-play outlines have separate console settings from the introductory view:

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `route_outline` | `true` | Enable upcoming exterior outlines; saved boolean |
| `route_outline_ahead_legs` | `5` | Outline this many upcoming legs; 0 hides them |
| `route_outline_fade_after_legs` | `1` | Fade after this many near upcoming legs |
| `route_outline_opacity` | `0.32` | Near line opacity, 0–1 |
| `route_outline_far_opacity` | `0.25` | Far opacity as a fraction of near opacity, 0–1 |

Numeric outline values last for the session. Defaults live in
`ROUTE_OUTLINE_NUMBERS`. Five legs use at most twenty cached line segments,
with no extra wall lattice, caps or hazards. Existing nearby detail replaces
its overlapping ghost edges. No collision, reveal or shutter timing is changed.

Preview controls also appear in the same listing:

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `preview_outline` | `true` | Show the ghost route in the opening overview; saved boolean |
| `preview_max_legs` | `50` | Draw at most this many preview legs; 0 hides the outline |
| `preview_fade_after_legs` | `2` | Fade gradually after this many near legs |
| `preview_opacity` | `0.24` | Near opacity, 0–1 |
| `preview_far_opacity` | `0.12` | Remaining fraction of near opacity at the far end, 0–1 |

Numeric preview values last for the session. Shipped values live in
`PREVIEW_NUMBERS` in `web/js/config.mjs`. The camera still frames the whole route,
and the portal remains marked even when the outline limit is lower.

Camera defaults live in `CAMERA_RULES`; the star default is
`VISUAL_EFFECTS.starPattern`, both in `web/js/config.mjs`. They do not change the
SPACE threshold. Sky selection is console-only; the ending uses its own sky.

`viewconfig`, `showconfig`, `showvars`, `viewvars`, `listvars` and `listconfig` all
list every console-settable value with a friendly name and description. Values
come from the command registry at the time of the request. Mouse-wheel scrolling
and Page Up / Page Down work in the console. `status`, `view`, `get` and bare `set`
query a single parameter. Booleans additionally support `toggle`; numeric controls
use `set name number` (or the documented `score N` / `cubes N` commands).

## Player records and controller settings

`toplevel` / `top_level` reports the highest level reached in this browser.
`toplevel reset`, `top_level reset` and `reset top level` reset only that record
to 1. `status top_level` is read-only. The record is stored in
`cube-libre-mode-scores-v1`, nested under the mode (20 or 50), field
`highest_level`. The old `cube-libre-scores-v1` record is imported into 50 only,
without deleting its original key. Debug level jumps update the active record.

`controller` is a saved boolean, on by default. `controller_deadzone` is a saved
number from 0 to 0.8, default 0.18. Both use the standard console syntax and appear
in `viewconfig`. Help includes the Xbox-style controller map and keyboard diagram.

The active `game.balance` supplies both the ending cap and curve endpoint.
Choose the bundled pair with `game_mode 20` or `game_mode 50`; no independent
cap-only console setting can leave LOSS or the ending outside the campaign.

## Public Options versus developer configuration

Help → Options contains input mode, optional extra touch areas, shaking/heat
flashes, hit rotation shocks and portal white light. Body auto-rotation, microgravity, HEAT restrictions, shutters and
culling remain editable through the debug console; they have no public checkboxes.
All listed commands and persistence rules still apply. Help opening/tab switching
never resets saved gameplay flags. Keyboard, Controller and Touch each have their own
Help tab; the milestone table is under Keyboard → GAME RULES & LEVEL PROGRESSION.


Mobile beta introduces no level-dependent rule changes. `mobile_mode` selects
0 automatic / 1 touch / 2 keyboard-controller; `touch_helpers` toggles optional
extra thumb areas. Both are saved and listed in `viewconfig`. Touch sensitivity
and drawing resolution have session console settings documented in
[WEB_PORT.md](../WEB_PORT.md#mobile-touch-beta-web-0240).

## Continue checkpoints and the final white exit (0.27.0)

Continue restores the saved level's entrance, score, run statistics and exact
level-entry cell IDs. Its white splash says "Continuing from level X ...", then
fades in "Welcome back." Normal milestone cards follow when applicable.
From the body carried out of 16 into 17 onward (44 into 45 in original mode), an incomplete saved body uses
the partial LOSS assembly and that level's grey colour; returning cannot refill
pieces missing before the saved level. The more forgiving level-only/full-body
alternative remains considered in [ROADMAP.md](../ROADMAP.md).

Pending bonuses keep the normal survivor body separate. Completed bonus rewards
save the next normal checkpoint once. Clearing the active final level saves the ending until
the player finishes the statistics and returns to the menu; reloading the ending
does not award its score again. Saves use this browser/device only.

At the final level, `end_portal` (saved visual boolean, default true) makes the
exit frame three times its normal size, pure white, with an oversized white glow.
`portal_white_light` controls its halo; physics and the final ending threshold
are unchanged. `test end_portal` starts on LEG 20/20 (50/50 in original mode) before the last gate, with
normal hazards and ten seconds. It runs through the actual portal into the full
ending, awards no records or points and cannot overwrite the saved campaign.


## Expanded ending (updated in 0.28.2)

The final exit begins on white. A faint monochrome ocean horizon opens and
water contours sweep past the view, with one soft sea-like noise wash. The wave
fades by 2.8 seconds, leaving half a second of blank white within the existing
3.3-second arrival. The blue-grid/starfield scene then appears over 0.12 seconds.
Gameplay audio and portal tails stop at entry; the wash respects mute and pause
and never replays after late loading. Physical and saved survivor bodies are unchanged.

The existing rise begins after the scene's original 0.6-second rest. The cube
still becomes a star over 1.2 seconds at the end of its rise, but the completed
star and horizon now hold for 5.7 seconds, 2.5 seconds longer than v0.28.0.
The subsequent 2.4-second white
fade, two-second white pause, title/subtitle and full thank-you sequence remain.
Pause and Help freeze every part. These presentation changes apply to both modes
and the existing `test ending_1` and `test end_portal` previews.

## Optional Panic recovery (updated in 0.29.1)

Available throughout normal legs, on by default in Options. V / Xbox B / PANIC
returns the surviving body to the start of the furthest physically reached leg.
A white tractor beam brings it into laser prison bars; forward bars open before
the fresh leg timer starts counting down. One normal lossy Recouple request
may recover existing loose pieces. The return never rebuilds missing pieces or
refills the LOSS entry body. Previous pipes stay sealed. Bonus rounds exclude it.
The cooldown is 30 seconds of play, including recall, frozen during pause/Help.
An available Panic circle pulses orange-red on overheating or with at most
10 seconds left. Available Recouple pulses in its last-chance window. Unavailable
actions never pulse. Desktop shows keyboard/controller labels beneath both.
Console `panic_penalty` defaults false. If enabled, each successful use costs
`panic_score_penalty_percent` of the current run score (default 5, range 0–100),
rounded to whole points. Repeated uses compound; all-time records are unchanged.
The cost is saved with the entrance body and survives reload/retry. Penalty
settings are session only; a fresh page starts with the penalty off.
This assistance changes practical difficulty; the underlying level curves above
stay the same. Human playtesting remains needed.
