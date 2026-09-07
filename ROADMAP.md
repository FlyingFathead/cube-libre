# Cube Libre: considerations and roadmap

This records considered design work and decisions that have since been implemented.
Unimplemented proposals are marked explicitly; they are not promised releases. The default campaign now ends at 20; the original 50-level variant is retained in configuration. The aim
is to sustain interest through new rules, rhythms and decisions as the journey
gets harder, while preserving the feeling that arriving in one piece is unlikely.

## Corrected in web 0.29.3: Recouple batch loss

One Recouple press handles all currently recoverable blocks at the existing
loss rate. Rejected blocks grey out, become dark wireframes, fall and fade;
they must not remain eligible for another attempt. Fresh damage is eligible.
Recovery rules now live in `web/js/recoupling.mjs`, with regression checks for
the batch result, availability, all input methods and the existing cooldown.

## Adopted for web 0.29.0: Panic recovery

**Status: implemented.** The original Android disorientation report led to this
optional rescue. The author expanded it to work throughout a normal leg,
including difficult laser situations while still inside the field.

- V, Xbox B or the bottom-left PANIC circle activates it. Matching Recouple
  remains bottom-right on desktop and both mobile touch layouts.
- A disintegrating-cube icon sits inside the circle, with PANIC underneath.
  Since v0.29.1, circle and labels pulse orange-red on overheating or in the
  final 10 seconds, only while usable. Recouple does the same in its last-chance
  window. COOLDOWN shows whole seconds; unavailable controls never pulse.
  Desktop has a dedicated action HUD and visible keyboard/controller labels.
- **PANIC RECOVERY REQUESTED** accompanies a white tractor beam pulling the
  existing cube into laser prison bars at the start of its furthest physically
  reached leg. The scene stays live. The bars open toward the next route section.
- The 2.75-second pull/confinement/opening freezes hazards and the fresh leg
  timer. Movement and countdown resume when the forward bars are open.
  Only the returned junction is temporarily exempt from collapse death; old
  pipes stay sealed, and the chamber closes after forward departure.
- On arrival, use normal lossy Recouple for still-recoverable loose fragments,
  with its existing quota. Continue an accepted request once. No new full body,
  bonus points or replacement of the level-entry body.
- Since v0.29.1, optional `panic_penalty` defaults false. If enabled in the
  console, each accepted use deducts `panic_score_penalty_percent` (default 5)
  from the current run score, rounded to whole points. Both settings are session
  only. The deduction is saved immediately with the existing entrance body;
  all-time records remain unchanged. No charge for refused requests.
- ALLOW PANIC BUTTON defaults on. Saved `panic_show_inactive` defaults true;
  false hides the button until 3 seconds outside or earlier overheating.
  V/B remain usable while hidden. Separate session variables tune the outside
  delay and default 30-second cooldown. Pause and Help freeze recall/cooldown.
- A zap/whoosh leads into two sustained DEEE–DAAAHH calls, swelling then
  dropping in pitch like a passing space ambulance. Mute and pause apply.

Automated checks cover geometry and return safety throughout both campaigns.
Difficulty balance, touch layout comfort and the sound need device playtesting.

## Adopted for web 0.26.0: LOSS and the route ahead

**Status: implemented in the v0.26.0 package.** These ideas moved beyond the
consideration stage at the author's request.

- Faint exterior outlines show up to three upcoming legs during play, with
  separate console distance, opacity and fade settings. Distant hazards remain
  undisclosed. This improves route readability without implementing a rescue.
- **LOSS ...** starts at level 44. Portals carry the surviving body forward;
  retries restore the exact level-entry shape. Bonus bodies stay separate.
- Missing assembly forms grey out, tremble and depart unrecoverably with an
  electronic engine wind-down. The real body gradually loses colour from 44 to 50.
- Clearing 50 retains the ascension and adds a lingering thank-you sequence
  against white, before the statistics prompt.

Late-game balance and the emotional timing need human playtesting. The jail-node
return mechanic above was subsequently implemented in v0.29.0.

## Returning players: strict LOSS or a merciful fresh body?

**Status: alternative considered, not implemented.** The v0.27.0 Continue
feature saves the exact level-entry body, including its missing pieces, score
and run progress. Returning during LOSS currently follows the same rules as
retrying that level; closing the browser does not refill the body to 125.

The author also sees value in a more forgiving alternative: save the reached
level but let a returning player rebuild a full body. This would offer a brief
respite during the nerve-wracking final levels. Deliberately revisiting the game
could then bypass permanent loss, so the same behavior can be read as either
an exploit or an intentional act of mercy.

Consider after playtesting:

- Keep exact-body Continue as the default, or intentionally allow the reprieve?
- If offered separately, should it be an explicit mercy option or a different run mode?
- How should the game explain its effect on LOSS and any score comparisons?
- Would that breathing room help people finish without weakening the meaning of
  the incomplete reassembly and the ending?

No full-body Continue override or public difficulty checkbox is included now.
The separate jail-node rescue is implemented as Panic recovery in v0.29.0.

## Adopted for web 0.28.0: the twenty-level journey

**Status: implemented.** Default new runs now end at 20, with the original
50-level variant retained in console/configuration. Time and entropy reach the
same final limits sooner; fading starts at 10, HEAT at 15 and LOSS at exit 16.
This aims to concentrate the existing content and make the journey inviting to
attempt without removing its late pressure. Existing saves retain their mode.

The shared ending gains a silent arrival before the existing starfield scene
and two extra seconds holding the final star. In v0.28.1, the author replaced
the rotating outline with a completely blank white hold of the same 3.3-second
duration after playtesting, and added 2.5 seconds to the view of the stars and
horizon after the cube departs, bringing that hold to 5.7 seconds. Physical and
saved pieces remain unchanged.
In v0.28.2, the author added a metaphysical ocean wave to that white arrival:
faint monochrome contours and a soft surf-like noise sweep wash past the view,
then dissolve back to white before ascension. No cube outline returns.
These presentation choices preserve the complete ascension arc.

## Playtest evidence and remaining questions

- The author reports playable Android touch controls up to about level 6.
- v0.24.1 fixes a reproduced false collapse death; that bug is separate from
  the intentional difficulty of navigating outside the grid.
- v0.25.0 introduces staged shutter rhythms at levels 4, 6, 7 and 8. Their new
  pacing and pitch cues still need human playtesting.
- Simulated final routes in both variants are traversable. Maintaining interest
  and readable difficulty across the default twenty levels, particularly under
  campaign LOSS, still requires actual playtest feedback. The original fifty-level
  journey remains available for developers to compare.
- This Android report does not establish iPhone/iPad compatibility, comfort or
  performance; those devices still need testing.

## Beyond ascension: YOU HAVE DESCENDED

**Status: humorous thought experiment, not a serious proposal at present; not implemented.**
The author feels the ascension arc already works beautifully as a complete ending.
This records a playful possibility, not an intention to undo that arc or promise
a sequel. If revisited someday, an optional continuation could
pick up after the current ending and reverse its direction: **YOU HAVE DESCENDED**.
The cube returns from above in a violent atmospheric re-entry, with the author
citing the feeling of a Helldivers 2 drop as a visual reference.

The next chapter could overturn the rules and expectations built by the first
journey. Ascension need not be the last word; the return could introduce new
mechanics and meanings instead of simply adding more procedural corridors.
Whether the body returns whole, remains grey and incomplete, or changes form
is undecided. So are the trigger, level numbering, difficulty, save transitions,
and the placement of any continuation relative to the thank-you segment.

No descent sequence, post-ending level or automatic continuation is implemented.
The complete 20-level ending, and the original 50-level variant's ending, remain
intact. This is a possibility for a future chapter, not a release commitment.
