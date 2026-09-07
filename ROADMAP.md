# Cube Libre: considerations and roadmap

This records considered design work and decisions that have since been implemented.
Unimplemented proposals are marked explicitly; they are not promised releases. The default campaign now ends at 20; the original 50-level variant is retained in configuration. The aim
is to sustain interest through new rules, rhythms and decisions as the journey
gets harder, while preserving the feeling that arriving in one piece is unlikely.

## Optional panic / return-to-corridor mechanic

**Status: considered, not implemented.** Recorded from the author's Android
playtest feedback on 2026-09-07. There is currently no panic button, rescue
teleport, automatic pullback or console setting for this proposal.

The author reports that the touch beta is playable through roughly level 6.
One difficulty is losing track of the grid after drifting into open space and
being unable to find a way back. This may also affect desktop play. For now,
that disorientation remains part of the game.

The possible addition is a panic button that becomes available after the player
has spent long enough outside the grid. The author clarified the destination
and presentation as follows:

1. Pull the surviving collective back to the **collapsed leg's connection node**.
2. Enclose the player in **prison-bar beams** at that node for a short confinement.
3. Open the bars **toward the next leg**, releasing the player forward into the maze.

This is a return to the previous leg's jail, with a visible confinement/release
sequence. The connection node becomes a deliberate temporary return chamber.
It must allow that sequence to play without the existing collapsed-section
collision instantly killing the returned player. The old corridor stays
collapsed; the forward opening provides the way out.

Questions to settle before implementation:

- **Trigger:** how long outside the grid before the button appears? Should
  availability depend on the level, overheating, or both?
- **Return chamber:** how long does confinement last, and how do the bars open?
  Define how the temporary chamber interacts with the existing sealed node,
  nearby hazards and the transition back to normal movement.
- **Consequence:** confinement is the proposed jail experience. Any additional
  score, time, cube cost, cooldown or use limit remains undecided.
- **Clock and progress:** decide what happens to the current leg timer, collapse
  history and progress. Returning must not become an accidental unlimited timer
  reset or a way to skip the maze.
- **Input and presentation:** how does a newly appearing button stay reachable
  on touch, keyboard and controller without obscuring the cube or RECOUPLE?
  A deliberate press is the initial idea; automatic rescue is not specified.
- **Tuning:** if adopted, define an enable flag, activation threshold and other
  settled parameters in the shared console configuration registry.

The intended destination and prison-bar release are recorded above. Trigger
threshold, confinement duration, additional costs and release date remain
undecided. Revisit those details after further mobile and desktop playtesting,
especially on longer routes.

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
return mechanic above remains considered, **not implemented**.

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
The earlier jail-node rescue proposal is also still unimplemented.

## Adopted for web 0.28.0: the twenty-level journey

**Status: implemented.** Default new runs now end at 20, with the original
50-level variant retained in console/configuration. Time and entropy reach the
same final limits sooner; fading starts at 10, HEAT at 15 and LOSS at exit 16.
This aims to concentrate the existing content and make the journey inviting to
attempt without removing its late pressure. Existing saves retain their mode.

The shared ending gains a silent, slowly rotating intact outline on white,
a single brief flash into the existing starfield scene, and two extra seconds
holding the final star. The outline changes no physical or saved pieces.
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
