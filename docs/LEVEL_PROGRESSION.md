# Cube Libre web progression

Default schedule for web **0.21.0**. This release builds on published v0.20.1.
The runtime source is [`BALANCE` and `LEVEL_FEATURES`](../web/js/difficulty.mjs).
The game uses that registry for phase selection, banner titles and the Help table.

| Level | Banner | What changes |
| --- | --- | --- |
| 1 onward | Opening story | Microgravity starts enabled: thrust builds speed, release coasts, opposite input brakes. |
| Every level | LEVEL number / overview | One added corridor leg per level, reaching fifty legs at level 50. |
| 3 | SPACE ... | Introduces world Y and three-dimensional routes; nearby detail and automatic camera tracking take over. |
| 5 | TIME ... | Starts at 30 seconds per leg; gradually tightens to 10 seconds by level 50. Each new leg resets the allowance. |
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
| `LEVEL_FEATURES` | Ordered records | Feature IDs, configured levels, phase states, banners and descriptions |

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

The two new saved console switches use the existing uniform syntax:

```text
set microgravity on
toggle microgravity
status microgravity
set overheat_blocks_recoupling true
toggle overheat_blocks_recoupling
status overheat_blocks_recoupling
```

`view` and bare `set` also report status. Explicit values accept true/false,
on/off, 1/0 and enabled/disabled. The level thresholds themselves are edited in
the configuration file. Bonus schedules and types live separately in
[`web/js/bonus.mjs`](../web/js/bonus.mjs); thrust tuning lives in
[`PLAYER_PROPULSION`](../web/js/config.mjs). Bonus rolling and pickup rules are
independent of normal-level propulsion and the heat re-coupling restriction.
