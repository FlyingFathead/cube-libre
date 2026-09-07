# Cube Libre web progression

Default schedule for web **0.27.0**, continuing from published v0.26.0 (`bb6a420`).
[`featuresForSettings()`](../web/js/difficulty.mjs) combines the `BALANCE`
milestones and [`CHANGES`](../web/js/changes.mjs), sorts by configured level,
and supplies phase selection, banner text and the Help table. `LEVEL_FEATURES`
is its default snapshot. Moving a shutter threshold moves its actual rule and card.

| Level | Banner | What changes |
| --- | --- | --- |
| 1 onward | Opening story | Microgravity and automatic camera tracking after the overview. |
| Every level | LEVEL number / overview | One added corridor leg per level, reaching fifty at level 50. |
| 3 | SPACE ... | World Y opens; three-dimensional routes and nearby detail. |
| 4 | CHANGE ... (change_1) | THE LASERS NOW OPEN AND CLOSE. One random gate zaps per sequence. |
| 5 | TIME ... | 30 seconds per leg, gradually tightening to 10 at level 50. |
| 6 | CHANGE ... (change_2) | TWO GATES. ONE AFTER ANOTHER. Two different random gates inside one leg, two seconds between starts. The second pitch is 3 semitones lower. |
| 7 | CHANGE ... (change_3) | NOW THERE ARE THREE. A third different gate, 3 semitones above the original. |
| 8 | CHANGE ... (change_4) | FOUR GATES. A PATTERN EMERGES. Inner, far end, opposite end, other inner; mirrored starting side. Fourth pitch is 7 semitones above the original. |
| 10 | ENTROPY ... | Re-coupling yield drops from 90% to 50%, then gradually to 1% at level 50. |
| 15 | HEAT ... | Outside grace drops from 2.4 to 1.4 seconds; new re-coupling requests are blocked while overheating. |
| 20 | TIME ... | Announces 24.8 seconds per leg. |
| 35 | TIME ... | Announces 15.2 seconds per leg. |
| 44 | LOSS ... | PORTALS NO LONGER RESTORE LOST PIECES. Exiting 44 carries survivors into 45; retries restore the level-entry body. Colour loss begins subtly here. |
| 50 | TIME ... | Announces 10 seconds per leg. Re-coupling yield is 1%; four-step sequences still close one gate at a time. The surviving body is fully grey. |
| After 5, 10, 15 ... 45 | PICKING UP THE PIECES / BONUS ROUND | 45-second floor bonus; gather pieces and escape up the ramp. |
| After clearing 50 | YOU'VE ASCENDED / ... FOR NOW. | Single-cube ascension, a long white thank-you fade, statistics and main menu. |

There are no longer shutter-count changes at levels 22 and 36. The four stages
replace that ramp. Other difficulty curves and the v0.24.1 collapse fix remain.

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
| `BALANCE.lossEnabled` | `true` | Default for the permanent-loss console flag `loss` |
| `BALANCE.lossMinLevel` | `44` | First exit without a refill; console override `loss_min_level`, 0 means level 1 |
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
LOSS and automatic-camera thresholds also have console overrides, listed below. Bonus schedules and types live separately in
[`web/js/bonus.mjs`](../web/js/bonus.mjs); thrust tuning lives in
[`PLAYER_PROPULSION`](../web/js/config.mjs). Bonus rolling and pickup rules are
independent of normal-level propulsion and the heat re-coupling restriction.


## LOSS and incomplete assembly

The rule applies to the **source level's exit**. Level 43 → 44 still refills.
Level 44 → 45 carries exact cell IDs and positions within the formation. Later
portals keep doing this. A snapshot at each level's entry controls retries and
automatic reassembly, so dying can never refill beyond that entry body. Ordinary
re-coupling can still recover fresh debris under the current entropy/heat rules.
Bonuses, including the one after 45, score independently and preserve the carry.

Absent entry cells are temporary grey visual forms, never physical or recoverable
fragments. They tremble and fly away with a generated `loss_weep` sound. The
caption changes to **ONLY PARTIAL REASSEMBLY SUCCEEDED**. The level clock waits for assembly
and the overview to finish.

| Console parameter | Default | Meaning |
| --- | --- | --- |
| `loss` | `true` | Carry survivors through portals from the threshold; saved boolean |
| `loss_min_level` | `44` | First affected exit and LOSS card; integer 0–50, session only |
| `loss_grey` | `true` | Gradual body desaturation during LOSS; saved visual flag |

The colour blend is **2.5% at the starting level**, then follows a quadratic
curve to 100% at the cap. Defaults for 44–50: 2.5%, 5.2%, 13.3%, 26.9%, 45.8%,
70.2%, 100%. These are colour-blend amounts, not damage or re-coupling rates.
`LOSS_COLOUR` in `web/js/loss.mjs` defines the onset and exponent. Disabling
`loss_grey` changes appearance only; heat and hit flashes remain visible.

`level N` / `set level N` start a fresh body and display all applicable cards.
`test loss` shows the LOSS card and a deliberately incomplete demonstration body.
`test ending_1` / `view_end_anim_v1` include the thank-you segment;
`thank_you_note` or `test thank_you_note` previews that segment alone. Previews
are developer tools. The normal ending still requires clearing level 50.

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
| `route_outline_ahead_legs` | `3` | Outline this many upcoming legs; 0 hides them |
| `route_outline_fade_after_legs` | `1` | Fade after this many near upcoming legs |
| `route_outline_opacity` | `0.32` | Near line opacity, 0–1 |
| `route_outline_far_opacity` | `0.25` | Far opacity as a fraction of near opacity, 0–1 |

Numeric outline values last for the session. Defaults live in
`ROUTE_OUTLINE_NUMBERS`. Three legs use at most twelve cached line segments,
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
`cube-libre-scores-v1`, field `highest_level`; debug level jumps still update it.

`controller` is a saved boolean, on by default. `controller_deadzone` is a saved
number from 0 to 0.8, default 0.18. Both use the standard console syntax and appear
in `viewconfig`. Help includes the Xbox-style controller map and keyboard diagram.

The campaign ending limit is still file-configured: `BALANCE.levelCap`, currently
50. `BALANCE.capLevel` is the independent endpoint of the time/entropy curves.
There is no runtime console setter for those two limits in this release.

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
From the body carried out of 44 into 45 onward, an incomplete saved body uses
the partial LOSS assembly and that level's grey colour; returning cannot refill
pieces missing before the saved level. The more forgiving level-only/full-body
alternative remains considered in [ROADMAP.md](../ROADMAP.md).

Pending bonuses keep the normal survivor body separate. Completed bonus rewards
save the next normal checkpoint once. Clearing level 50 saves the ending until
the player finishes the statistics and returns to the menu; reloading the ending
does not award its score again. Saves use this browser/device only.

At the final level, `end_portal` (saved visual boolean, default true) makes the
exit frame three times its normal size, pure white, with an oversized white glow.
`portal_white_light` controls its halo; physics and the final ending threshold
are unchanged. `test end_portal` starts on LEG 50/50 before the last gate, with
normal hazards and ten seconds. It runs through the actual portal into the full
ending, awards no records or points and cannot overwrite the saved campaign.
