# Changelog

## 0.30.0 — Critical grace

Based on published web v0.29.3 (`e0a7e85`).

- Add a quiet, default-on mercy window for rapid disintegration in normal play.
  Two damaging hits within 0.5 seconds, leaving 20 cubes or fewer, grant 1.5
  seconds without laser, shutter or boundary damage, then 15 seconds of
  cooldown. Low count alone does not activate it. A qualifying otherwise-lethal
  hit preserves the final existing cube; no replacement cells are created.
- Keep the mechanic internal: no new button, Options item, banner or sound.
  Register session-only `mercy_mode`, `mercy_seconds`, `mercy_cube_threshold`,
  `mercy_damage_window_seconds` and `mercy_cooldown_seconds` in the console.
  Standard boolean aliases and non-mutating status/configuration queries work.
- Put trigger history, timing and loss limiting in `web/js/mercy.mjs`. Both
  ordinary damage and shutters share the guard. Blocked hits do not extend it,
  contribute to another burst or queue damage for later. Pause, Help, setup,
  bonus play and Panic confinement freeze the clocks. Attempts reset them;
  checkpoints do not serialize live protection. Toggling off does not erase
  an incurred cooldown; numeric tuning applies to the next trigger.
- Make real sealed-corridor deaths identifiable. A bright blue crossed grid
  appears at the contact point, accompanied by a sustained electric BZZZZZZZT
  and `SEALED CORRIDOR · LETHAL GRID`. Show the grid before whiteout within a
  0.75-second sealed death. Ordinary deaths retain their existing timing.
  Reuse the electric shutter buffer at a lower pitch on a separate channel,
  with no new audio download. Mute and pause apply; recent shutter sounds
  cannot suppress the cue. The label remains briefly into reassembly.
- Preserve Recouple batch loss, rejected debris, quota and heat restrictions,
  desktop/mobile action circles, Panic recovery and forced component refresh.
  Leg expiry and sealed backtracking remain lethal. Re-entry into an open
  section from outside does not trigger the sealed grid.

Validation: all 222 automated test groups and static checks pass on Node.js
18.19.1. New coverage includes both campaigns at 30/60/120 FPS, rapid/spaced
hits, critical thresholds, final-cell preservation, all ordinary damage sources,
expiry/cooldown, pause, Panic, recovery, console validation and checkpoint
isolation. Sealed-contact checks cover route axes, single audio dispatch,
rendered beam geometry, blocked sound cooldowns, pause and the actual browser
cause-label handler. Portrait and landscape projections of the actual grid
geometry were inspected. Device playtesting of mercy balance and the new
visual/audio feedback remains needed.

## 0.29.3 — Recouple batch recovery

Based on published web v0.29.2 (`5bdd1ce`).

- Fix recovery of the failed fraction of a previous Recouple request. One press
  handles the entire eligible batch at the existing level-dependent yield.
  Successful blocks return; rejected blocks immediately become unrecoverable,
  grey out, turn to dark wireframes, fall away and fade. Further presses cannot
  recover those rejected blocks. New damage creates a fresh eligible batch.
- Put batch selection, fragment eligibility, timings and the five-requests-in-ten-
  seconds limit in `web/js/recoupling.mjs`. Keep the current yield curve, minimum
  one returned block, compact target selection and active-press quota rule.
- Grey the entire Recouple control: circle, symbol, name, status and key labels.
  Exclude rejected/expired debris and full bodies from availability and the HUD
  counter. Keep urgency orange-red only while recovery is actually available.
- Make distinct touch/mouse presses during an active recovery consume the same
  quota as C / LB / X. Holding a pointer does not repeat. Remove the release latch
  that could obstruct a later press. Show cooldown immediately at the limit,
  use the same exact expiry for controls and simulation, and count whole seconds.
- A cooldown attempt gives a brief red flash and a throttled buzz, using the
  existing audio buffer. It neither starts recovery nor extends the cooldown.
  Pause, Help and mute remain respected. Panic cannot recover failed leftovers.
- Store the booted release in a project-scoped version cookie. Check the server
  version without cache at startup. When the verified release differs from the
  cookie, refresh every versioned module and asset with `cache: reload` before
  boot, then record the release. Refresh applied CSS too. Missing files stop boot;
  unavailable checks and blocked cookies do not create reload loops. Keep the
  existing saved campaign and update notice; its refresh action bypasses the
  entrypoint cache.

Validation: 211 automated test groups and static checks pass on Node.js 18.19.1.
Checks cover early/ENTROPY batch loss in both campaigns, fresh damage during
recovery, irreversible failed debris, rendered grey/wireframe fade, all input
layouts, quota parity, rejection feedback, exact expiry, and complete component
refresh. The level-50 test driver now requests recovery for fresh damage when
eligible, rather than relying on repeated recovery of old fragments. Device
visual/audio checking remains outstanding. Laser, maze, movement, difficulty
curve and Panic gameplay rules are unchanged.


## 0.29.2 — Tap the title

Based on published web v0.29.1 (`1b2b3e3`).

- Make the animated Cube Libre logo an additional Start/Continue button on
  mobile and desktop. The existing text button remains clickable. Both use the
  same saved-run choice and audio startup behavior.
- Keep the mobile prompt simple: TAP TO START or TAP TO CONTINUE. Preserve the
  existing desktop keyboard/controller prompt, without an extra visible label.
- Fit the transparent logo button to the title's measured free area on resize
  and layout changes. Keep it clear of the New run choice and information below;
  hide its hit area if there is no room. Preserve the animated cube layout.
- Ignore title-button activation during loading, pause, Help, dialogs, console or after
  leaving the title. Repeated taps cannot restart a run or skip its introduction.

Validation: 205 automated test groups and static checks pass on Node.js 18.19.1.
Title checks cover the actual text/logo handlers for Start and Continue on both
input modes, exact prompt wording, saved-run protection, repeated and blocked
activation, and hit-area updates during resize and wrapping. Device checking of
the added tap target remains needed.

## 0.29.1 — Desktop action HUD

Based on published web v0.29.0 (`cd7c357`).

- Give Panic and Recouple a dedicated action HUD, separate from optional touch
  steering/depth controls. Desktop keeps the round icons visible during level
  setup and play, disabled whenever unavailable. Show V / Xbox B beneath Panic
  and C / LB / X beneath Recouple. Keep both mobile layouts and position Recouple
  on the right even when Panic is hidden or disabled in Options.
- Pulse the circle and all its labels orange-red only while the action is usable.
  Recouple warns during the last 1.75 seconds of recoverable fragment life;
  Panic warns immediately on overheating or in a timed leg's final 10 seconds.
  Unavailable actions never pulse, including during cooldown, active recovery,
  confinement, heat-blocked Recouple, pause and Help.
- Add console-only `panic_penalty`, off by default, and
  `panic_score_penalty_percent`, default 5 and range 0–100. Both are session
  settings. When enabled, deduct that percentage of the current run score once
  per successful use, rounding the deduction to whole points. Repeated uses
  compound; refused presses cost nothing. All-time records remain unchanged.
- Show an enabled penalty's actual deduction beneath PANIC RECOVERY REQUESTED
  and save the reduced score immediately with the existing entrance body.
  Reload and retry retain the cost; the rescue pose and live hazards are never
  saved. Keep preview isolation, ordinary rescue mechanics and ambulance audio.
- Update Help, Options explanations and current documentation for availability
  warnings and the optional penalty.
- Fix a reproduced corridor disappearance when outside drift leaves the local
  location lookup on levels 7, 8 and later. Keep drawing the nearest corridor
  instead of jumping to the already-collapsed entrance. Keep known walls and
  nearby portal drawing visible, without changing collision, timers, physical
  progress, hazard activation or sealed-pipe rules.
- Increase `route_outline_ahead_legs` from 3 to 5 by default. The two extra
  upcoming outlines reuse the same buffer and do not reveal distant hazards.

Validation: 204 automated test groups and static checks pass on Node.js 18.19.1.
Expanded control checks cover desktop and both touch layouts, setup visibility,
key labels and availability-gated urgency. New penalty checks cover both modes,
default-off behavior, repeated/blocked requests, rounding, console validation,
unchanged records, saved entry cells, reload/retry and preview isolation.
Corridor checks reproduce outside lookup loss on levels 7, 8, 20 and 50, verify
the actual nearby wall drawing and use touch-driven drift on both mobile
layouts. Normal in-course lookup and the bounded detail window are preserved.
Browser/device visual and audio playtesting remains needed.

## 0.29.0 — Panic recovery

Based on published web v0.28.2 (`f6a91de`).

- Add default-on Panic rescue throughout normal play: V, Xbox B, or the new
  bottom-left shedding-cube circle opposite Recouple. Both mobile layouts and
  desktop use matching action circles, disabled states and whole-second cooldown.
  B still goes back in menus; Panic is unavailable in bonus rounds.
- Display **PANIC RECOVERY REQUESTED** and pull the existing body along a white
  tractor beam into laser prison bars at the start of the furthest physically
  reached leg. The bars retract toward the forward exit. Keep the live scene,
  reset the leg timer, and start its countdown only after the 2.75-second recall.
  The return junction stays safe until forward departure; old pipes stay sealed.
- Request normal lossy Recouple on arrival for existing recoverable fragments,
  preserving its quota and any request already underway. No fresh body, score
  award or permanent restoration of lost cells. Entry checkpoints remain intact.
- Add ALLOW PANIC BUTTON to Options, on by default. Saved `panic_show_inactive`
  also defaults on; off hides the circle until 3 seconds outside or earlier
  overheating. V/B still work while hidden. Heat makes it flash immediately,
  including on cooldown. `panic_outside_seconds` and `panic_cooldown_seconds`
  tune the delay and 30-second cooldown for the session. Pause and Help freeze it.
- Synthesize a zap/whoosh and two DEEE–DAAAHH ambulance calls with a falling
  Doppler pitch sweep, in Ogg and MP3. Respect mute/pause and silence the leg
  clock's sirens during confinement. Update Help, control maps and documentation.
- Require physical progress before sealing a previous corridor, so drifting
  alongside an unreached future leg cannot collapse the rescue destination.

Validation: 200 automated test groups and static checks pass on Node.js 18.19.1.
New checks cover both campaigns, every leg's return point, live transport, clock
freezing/restart, sealed-pipe safety, normal recovery yield/quota, keyboard and
controller dispatch, both touch layouts and desktop buttons, preferences,
rendered beam/prison geometry and one-shot audio. Both codecs decode without
clipping. Device visual/audio playtesting remains needed.

## 0.28.2 — White tide

Based on published web v0.28.1 (`2a4970b`).

- Add a faint monochrome ocean horizon and three water contours to the final
  portal's white arrival. The horizon opens, the wave sweeps past the view, and
  its outlines dissolve back to white. Keep half a second of blank white before
  the existing ascension scene, within the same 3.3-second arrival.
- Synthesize a soft sea-like filtered-noise wash in Ogg and MP3. Play it once
  instead of gameplay/portal tails, respect mute and pause, align delayed first
  frames with an audio offset, and avoid replay after late loading or unlock.
- Keep the 5.7-second star/horizon hold, full ending and thank-you segment in
  both modes and their previews. Use four bounded canvas paths and one decoded
  sound buffer; no new WebGL geometry, textures or runtime dependencies.

Validation: all 189 automated test groups and static checks pass on Node.js
18.19.1. Ending checks cover wave motion and disappearance, portrait/landscape,
pause, both modes, scene transition, one-shot audio, mute, preview restarts and
late loading. Generated contour previews were inspected and both audio codecs
were decoded and checked for clipping. Real-device visual/audio playtesting
remains needed.

## 0.28.1 — Silent arrival

Based on published web v0.28.0 (`8839995`).

- Replace the outlined cube at the beginning of the ending with a completely
  blank white screen. Keep the same 3.3-second silent arrival and the existing
  transition into the blue-grid/starfield ascension scene.
- Apply this to both campaign modes and the ending/final-portal previews. Keep
  the ending text, thank-you sequence and pause/input guards.
- Linger on the stars and horizon for 2.5 additional seconds after the cube
  becomes a star: 5.7 seconds total before the existing fade to white.
- Remove the unused outline fade helper and update the ending render checks and
  current documentation. Campaign rules, browser saves and records are unchanged.

Validation: all 188 automated test groups and static checks pass on Node.js
18.19.1. The arrival render check covers the complete white hold in portrait and
landscape, both modes, pause/Help, scene reveal, the longer star/horizon hold
and survivor preservation. Existing
audio checks verify silence and dropped portal tails. Real-device visual checking
of this replacement remains outstanding.

## 0.28.0 — Twenty levels

Based on published web v0.27.0 (`fd8ce6a`).

- Make the 20-level campaign the default. Keep the original 50-level progression
  under console/config `game_mode 50`, with no public mode selector. Per-game
  immutable balances keep routes, cards, timers, recovery, bonuses and ending
  predicates on the selected variant. Mode queries are inert; switching returns
  to the title and preserves the saved campaign.
- Compress time and entropy curves to their original final 10 seconds per leg
  and 1% recovery at 20. TIME warnings recur at 10, 15 and 20. Keep SPACE at 3,
  CHANGE at 4/6/7/8, ENTROPY at 10 and HEAT at 15. Retain shutter windows,
  alternating legs, damage protection, speeds and the laser-spin ceiling.
- Start barely perceptible greyness at 10 and reach full grey at 20. Move LOSS to
  exit 16: exact survivors carry into 17 and onward. Add independent console
  loss_grey_min_level. Original mode retains LOSS/fade at 44 and ending at 50.
- Save gameMode in schema-2 checkpoints. Migrate schema-1 saves to mode 50,
  including early-level saves. Continue restores its saved mode, exact cells,
  holes and rewards without changing the selection for the next new run.
  Keep TOP LEVEL, best score and best escape separately per mode; import old
  records into 50 only. Preserve original storage and unrelated preferences.
- Expand the shared ending: one intact cube outline rotates slowly on white in
  silence for three seconds, then flashes once into the existing blue-grid and
  starfield scene. Stop all audio, including queued portal tails, for the arrival.
  Hold the completed star two seconds longer before the white fade. Keep the
  full title/subtitle, thank-you note and separate statistics/menu inputs.
  The outline is visual only and never refills the physical or saved body.
- Make test end_portal use the active final leg (20/20 or 50/50), leading through
  the real oversized white portal into the full ending. Keep previews isolated
  from campaign saves and records. Update Help, progression and technical docs.
- Record YOU HAVE DESCENDED and atmospheric re-entry as a humorous roadmap
  thought experiment, not a serious proposal or an implemented continuation.
  The author considers the ascension arc complete as it stands.

Validation: all 188 automated test groups and static checks pass on Node.js
18.19.1. Coverage includes both variants, compressed curves and actual recovery,
legacy-save migration, separate records, LOSS carry/Continue, public Help, final
portal traversal, outline geometry, silence, longer star hold and input guards.
Both final routes are traversable in simulation; this does not establish human
balance under campaign LOSS. New ending visuals/audio and the shorter journey
still need real browser/device playtesting.

## 0.27.0 — Welcome back

Based on published web v0.26.0 (`bb6a420`).

- Add local browser campaign checkpoints and Continue alongside New run. Restore
  the level entrance, exact cells and holes, score and run progress. Ask before
  replacing a saved run; report when browser storage is unavailable.
- Welcome returning players on white with "Continuing from level X ...", then
  fade in "Welcome back." Hold briefly and fade out before the level begins.
  Include pause handling and prevent early input from skipping the sequence.
- Preserve the LOSS level-entry body on Continue. From the carry into level 45,
  incomplete bodies perform the existing failed reassembly: missing grey forms
  shake and drift away, the engine winds down, and the partial-success caption
  appears. Keep the resumed level's grey colour progression.
- Save pending bonuses separately from the normal body; bank completed bonus
  rewards once. Resume a completed level-50 ending without another score award,
  and clear the completed checkpoint after the statistics-to-menu transition.
- Make the final portal three times larger, with pure-white lines, an oversized
  halo and bright core beyond the corridor. Share the existing texture and reuse
  two sprites. Keep normal portal capture/suction and earlier portal colours.
- Add test end_portal: start on LEG 50/50 before the final gate, with located camera
  and the normal ten-second allowance. Actual entry plays the full ending.
  Retries return to the test gap; award no test records, points or run statistics.
  Add the saved end_portal visual flag. Debug previews/jumps leave campaign saves
  intact. No new difficulty controls are added to the public Options tab.
- Update title fitting for the Continue controls, versioned loading, docs and
  roadmap. Record the possible full-body Continue reprieve during LOSS as
  considered, not implemented.

Validation: all 175 automated test groups and static checks pass on Node.js
18.19.1. Coverage includes checkpoint validation and unavailable storage, bonus
reward isolation, exact LOSS shapes and assembly, welcome fades and input guards,
final-portal geometry/glow reuse, and real portal entry into the full ending.
Real browser/device testing of the new layout and white-portal brightness is
still needed; automated simulation and render-data checks do not establish it.

## 0.26.0 — What remains

Based on the web v0.25.1 package.

- Add faint during-play outlines for three upcoming corridor legs, independently
  configurable by distance, opacity and fade. Reuse cached exterior edges without
  revealing distant gates or changing hazard/physics rules. Desktop and mobile
  use the same bounded draw range; introductory preview settings remain separate.
- Introduce LOSS at level 44: portals no longer restore lost pieces. Level 44
  starts normally; its exit carries the exact surviving shape into 45 and onward.
  Automatic death and manual retry restore only the level-entry checkpoint.
  Bonus rounds award their own score and preserve the normal body's carry.
- Show missing assembly cells as trembling grey forms that scatter away without
  becoming recoverable debris. Add a short electrical fault stutter followed by a soft engine wind-down in
  Ogg and MP3 and an ONLY PARTIAL REASSEMBLY SUCCEEDED caption beneath the body.
- Add default-on loss_grey: barely visible 2.5% colour loss at the LOSS threshold,
  accelerating quadratically to full grey at level 50. Preserve heat/hit cues.
  Add uniform console flags and tuning, including loss_min_level and test loss.
- Make level N / set level N display the chosen level's applicable milestone
  cards. Multiple cards at one level still queue before gameplay starts.
- Retain the ending after clearing 50. After YOU'VE ASCENDED / ... FOR NOW.,
  hold and fade those lines into white, then add thank you for playing / CUBE LIBRE:
  four seconds white, four fade-in, five hold, seven fade-out and two white.
  Only afterward accept an input for statistics, followed by another for the menu.
  Include this in test ending_1 / view_end_anim_v1; add thank_you_note for its
  standalone preview. Pause and early-input guards cover the full sequence.
- Update README, progression, technical notes and roadmap. The optional jail-node
  rescue remains considered, not implemented. Add no public difficulty switches.

Validation: all 162 automated test groups and static checks pass, including on
Node.js 18.19.1. Coverage includes
exact survivor identity across portals, bonuses and retries; movable LOSS cards;
nonlinear colour fading and visible heat; unrecoverable assembly forms and one-shot
sound; bounded outline draws; and the actual ending UI's fades, pauses and inputs.
Android/Apple/desktop visual and audio playtesting of this release remains needed.
The simulated level-50 route does not establish human balance under campaign LOSS.

## 0.25.1 — Mobile orientation lock

Based on web v0.25.0. The shutter release remains a separate package.

- Add mobile Options → Lock current orientation, off at the start of each visit.
  Keep the current portrait/landscape direction, including reversed orientations;
  only check the box after the browser confirms the lock.
- Offer an explicit Fullscreen & lock retry when the browser requires fullscreen.
  Capture the original orientation before fullscreen can rotate the display.
  Explain the device rotation-lock fallback when browser locking is unavailable.
- Release the lock on fullscreen exit, page hiding or leaving mobile presentation.
  Cancel pending requests safely so late browser promises cannot restore a lock.
  Keep unlocked portrait/landscape resizing, pause behavior and touch cancellation.
- Preserve all v0.25.0 shutters, sound pitches, balance and roadmap proposals.
  The orientation option does not modify gameplay flags or saved player records.

Validation: all 155 automated test groups and static checks pass, including on
Node.js 18.19.1. New coverage
includes confirmed and rejected locks, explicit fullscreen fallback, orientation
capture, async cancellation, Options state and actual app rotation/pause handlers.
Native browser APIs are simulated in these tests; physical Android and Apple
device lock behavior still requires playtesting.


## 0.25.0 — Learn the shutter rhythm

Based on published web v0.24.1 (`3240594`).

- Move the first CHANGE to level 4. Add CHANGE 2 at level 6 (two zaps), CHANGE 3
  at level 7 (three) and CHANGE 4 at level 8 (four), each with its own explanation.
  Replace the old 22/36/50 shutter-count ramp with these stages.
- Close one distinct gate per step in the same leg, two seconds between zap
  starts. Warn for 0.4 seconds, close for 0.8, and keep open rest between steps.
  Complete sequences alternate revealed legs, with at least four seconds from
  the last zap to the next sequence's first. A lone leg finishes, then waits.
- Give the four-step sequence a mirrored spatial order: inner, far end, opposite
  end, other inner. Across the five original grids this is 2,5,1,4 or 4,1,5,2;
  the exact centre grid is not selected for that pattern. Two/three-step
  sequences select distinct random gates from all five.
- Pitch the existing buzz and reopening whoosh by 0, -3, +3 and +7 semitones
  using Web Audio playback rate. Reuse decoded buffers and keep all current-leg
  steps audible. No new audio downloads or render effects are required.
- Add saved console-only stage/pattern switches, configurable minimum levels,
  within-sequence spacing and semitone offsets. Extend test change_1 through
  test change_4; update live Help, configuration descriptions and progression.
  Retire start/max/ramp and simultaneous-count parameters in favor of stages
  and sequential closures. Fixed one-to-five-gate overrides remain available.
- Preserve the v0.24.1 collapse fix, damage fractions, grid immunity, other
  milestones, mobile controls and the level cap. Cancel unfinished sequences
  when their leg disappears, retaining cooldown instead of replaying old steps.

- Add ROADMAP.md with the optional panic/return-to-corridor proposal clearly
  marked considered, not implemented: return to the collapsed leg's connection
  node, briefly cage the player in prison-bar beams, then open toward the next
  leg. Record Android playtesting through roughly level 6; trigger timing,
  confinement duration and additional penalties remain undecided.

Validation: all 149 automated test groups and static checks pass. Coverage
includes 30/60/120 FPS sequencing, mirrored patterns, distinct gates, local sound
pitch dispatch and buffer rates, preview/persistence controls, pause/cancellation,
extreme valid timing and a full fifty-leg simulated traversal with normal damage
and the ten-second leg limit. Listening and playtesting the new rhythm on real
browsers/devices remain outstanding; simulation does not establish human balance.


## 0.24.1 — Physical collapse contact

Based on published web v0.24.0 (`a278315`).

- Fix instant whole-body deaths when drifting outside the route after an earlier
  leg has collapsed. The visibility lookup's fallback to leg 1 was incorrectly
  treated as lethal contact; reproduced with 119 surviving cubes and 29 seconds
  still available. Also fix false contact in a sealed leg's broad nearby area.
- Check actual corridor and turn-chamber volumes through the existing local
  spatial index before applying collapse death. Keep ordinary boundary shaving,
  heat, real sealed backtracking and timer expiry intact.
- Add regression coverage for level 6 side drift and return at 30/60/120 FPS,
  with microgravity on/off, plus physical contact across fifty-leg routes,
  forward turns, legitimate sealed-section returns and timeout.

Validation: all 145 automated test groups and static checks pass. The failure
was reproduced in the v0.24.0 simulation and the new regression tests failed
before the fix. The report came from Android playtesting; this patch still
needs confirmation on the player's device.


## 0.24.0 — Mobile touch beta

Based on published web v0.23.1 (`ddbd545`).

- Offer TRY MOBILE BETA or USE KEYBOARD / CONTROLLER on the mobile notice.
  Space chooses touch; remember the choice and provide an Options override.
  Detect Android, iPhone, iPad and coarse-pointer devices without excluding Apple.
- Surround surviving pieces with a faint orb and six coloured axial pull handles.
  Grab a side and drag along its beam; lock the selected axis until release.
  Keep far-side/depth handles touchable and fan overlapping handles apart.
  Centre dragging steers in the view plane; bonus dragging rolls on the floor.
- Show a grey rush threshold anchored at the initial touch. Retain existing
  thrust, coasting, speed limits, collisions and every difficulty rule.
- Add a circular whole-cube RECOUPLE button that dims when unavailable and reports
  loose pieces, active recovery, heat or cooldown. Request once per press.
- Add a settings cog, a TOUCH Help tab and diagram. Keep extra drag/depth thumb
  areas optional and off by default. Keep gameplay tuning console-only.
- Clear captured gestures on interruptions and pause on orientation changes or
  leaving fullscreen. Respect safe-area insets and retain non-fullscreen play.
  Cap touch drawing resolution at 1.25; start touch play while audio loads.
- Expose input mode, helper areas, touch thresholds and pixel-ratio tuning through
  the existing console configuration registry. Update release metadata and docs.

Validation: all 141 automated test groups and static checks pass; the touch Help
SVG was visually inspected. Tests cover axial and free pulls, rotated camera
bases, single-cell grabbing, rush/coast, simultaneous helpers, cancellation,
recouple availability, entry choices and saved modes. Real mobile hardware,
browser layout and performance playtesting remain outstanding; the browser
preview could not access the local game in this environment.


## 0.23.1 — Controls without difficulty switches

Based on published web v0.23.0 (`acbb831`).

- Split Help into KEYBOARD, CONTROLLER and OPTIONS tabs. Keep each control diagram
  with its action list and retain normal/bonus keyboard variants.
- Limit public Options to shaking/heat flashes, hit rotation shocks and portal
  white light. Remove public switches for body rotation, microgravity, the HEAT
  re-coupling restriction, shutters and culling. Their console commands and saved
  preferences remain intact.
- Keep tabs and the return button visible while the active panel scrolls. Support
  mouse clicks, keyboard arrows/Home/End and controller navigation; skip hidden
  panel controls and scroll only the active panel with the right stick.
- Put game rules/milestones in a disclosure below Keyboard controls, retain
  credits below the tabs, and remove inline gameplay-tuning examples from Help.
- Rename the separate reset menu RESTART / RETRY. Update documentation and the
  versioned startup import map.

Validation: static checks and all 128 automated test groups pass. New checks cover
actual Help construction, tab visibility/focus, normal/bonus diagrams, visual-only
option writes, preservation of console gameplay flags, pause restoration and
controller navigation/scroll routing. Browser layout and hardware playtesting
remain outstanding.


## 0.23.0 — Room to move

Based on published web v0.22.1 (`51e047b`).

- Add Xbox-style analog controller support in normal levels, bonus rounds and
  menus. LB re-couples, X is an alias, and RB rushes. Include a labeled Help map,
  saved controller/deadzone settings, neutral-input gates, and pause on disconnect.
  Controller-only start proceeds even when Web Audio needs a later click/key.
- Add `toplevel` / `top_level` queries and reset aliases, including
  `toplevel reset` and `reset top level`. Reset only the browser's highest-level
  record to 1, preserving score/escape records, preferences and current play.
- Ease CHANGE 1 shutters: one eligible gate per leg at level 7, two at 22, three
  at 36 and four at 50. At most two gates close simultaneously across the active
  scene. Select gates randomly and require the next event to use a different
  nearby revealed leg; wait if none is available. Add configurable counts,
  ramp endpoint, global simultaneous limit, open cooldown and no-repeat flag.
  Existing damage, immunity, warning/closure timing and minimum-level settings
  remain editable through the same console interface.
- Reduce the opening ghost map to four exterior edges per corridor: 200 segments
  for fifty legs. Add `preview_max_legs` (50), `preview_fade_after_legs` (2),
  near/far opacity controls and the saved `preview_outline` toggle. Keep the
  distant portal and full-route framing, with no upcoming gates in the overview.
- Show actual route progress as `LEG x/TOTAL` in the top-right timer.
- Check fresh deployed metadata before loading the game; replace a stale page
  once using a cache-busting release URL, without a reload loop. Version all
  module imports, stylesheet and fetched assets. Keep displayed version tied
  to the loaded build. Active games retain the dismissible update notice.
- Update README, controller controls, progression/configuration tables and
  release preparation instructions. No npm install or backend is required.

Validation: 124 automated test groups and static checks pass. Coverage includes
controller input/menu dispatch, saved record reset, shutter ramp/alternation and
simultaneous limits, cooldown/immunity, a complete 50-leg traversal with default
hazards and time limits, preview geometry/framing, startup cache behavior and
leg totals. The SVG controller map was inspected. Actual controller hardware,
Firefox playability, visual balance and GPU performance still need playtesting.


## 0.22.1 — A clearer personal best

Based on published web v0.22.0 (`022c348`).

- Replace HIGHEST LEVEL with **TOP LEVEL: <highest reached>/<level cap>** on
  the title screen, level result card and HUD records. Use the saved personal
  best and `BALANCE.levelCap`, currently 50.
- Explain in title/HUD record tooltips that the personal best is saved in this
  browser across runs. Preserve existing record behavior, including debug jumps.

Validation: static checks and display spot checks pass for saved records of 1,
7 and 50, including an alternate cap. Gameplay code is unchanged. No new tests
were added for this text change; the v0.22.0 baseline passed all 108 test groups.
The new label still needs browser playtesting.

## 0.22.0 — Change in the grid

Based on published web v0.21.0 (`34faa15`).

- Introduce **CHANGE ...** at **level 7**: **THE LASERS NOW OPEN AND CLOSE**.
  Register it as `change_1`, with its level, timing and damage tuning in
  `web/js/changes.mjs`. The live milestone registry sorts it into the progression
  and supplies the phase card and Help table, including console threshold changes.
- Seal the complete rotating laser square with an electric shutter. Default:
  four-second cycle, 0.4-second amber warning, 0.8 seconds closed, and a stable
  random timing offset per leg. Add a translucent sheet and electric arcs using
  reused geometry. Hidden hazards and turn-chamber safety retain their rules.
- On closed-shutter contact, remove 50% of remaining cells, rounded down and
  preserving the last cell. Detach cells as recoverable fragments. Allow one hit
  per grid per closure and grant 1.5 seconds of protection from all laser grids;
  ordinary beam damage cannot stack on the closed sheet. Preserve the leg timer
  and boundary hazards. Pause and Help freeze the shutter clock.
- Add generated closing BZZZT and reopening whoosh effects in Ogg and MP3, plus
  a reproducible Python/FFmpeg generator. Keep all 18 original sounds unchanged.
  Nearby legs emit one effect per transition; distant grids do not flood audio.
- Add saved `change_1` and `change_1_random_per_leg` booleans with Help switches
  and uniform console aliases. Expose the minimum level, interval, closed time,
  warning time, damage fraction and grid cooldown as validated numeric session
  settings. `test change_1` enables the hazards and starts the configured level
  with its introduction. Zero minimum activates from level 1.
- Set `auto_locate_min_level` to 0 by default: follow the cube from the beginning,
  retaining the whole-maze intro overview and its transition. Keep the camera
  threshold independent of SPACE and culling; set it to 3 to restore the old gate.
- Preserve the former star layout as pattern 1, add pattern 0 for no background
  stars, and default to pattern 2 with random spacing, varied sizes/brightness and
  subtle cool/warm hues. Reuse the fixed 1,600-point sky and buffers. Save the
  console-only `star_pattern` setting; leave the ending's own starfield intact.
- Alias `viewconfig`, `showconfig`, `showvars`, `viewvars`, `listvars` and
  `listconfig` to the live parameter listing. Show each value, friendly name and
  description directly from registered commands. Preserve long output in full
  and support mouse-wheel and Page Up / Page Down scrolling without changing
  settings during queries.
- Update the README, technical notes and complete level progression reference.
  Preserve the prominent live-game link, cube-letter logo and PyGame attribution.

Validation: **108 test groups and static checks pass**, with automatic JavaScript
module detection disabled. Coverage includes full-square collision, per-closure
hits and grid cooldown, configurable milestones, nearby sound events, generated
panel geometry, camera projection at early and late levels, preserved legacy
stars, sky switching/persistence, config aliases and scrolling. A deterministic
fifty-leg traversal with default hazards, spin, microgravity and shutters clears
the level with twelve cubes and over three seconds left on its tightest leg.
All four new audio files decode without clipping; the 36 original codec files are
unchanged. The new effects, camera behavior and sky still need browser playtesting.

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
