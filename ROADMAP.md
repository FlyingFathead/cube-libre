# Cube Libre: considerations and roadmap

This is a record of possible future design work, not a list of implemented
features or promised releases. The current campaign cap is 50 levels. The aim
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

## Playtest evidence and remaining questions

- The author reports playable Android touch controls up to about level 6.
- v0.24.1 fixes a reproduced false collapse death; that bug is separate from
  the intentional difficulty of navigating outside the grid.
- v0.25.0 introduces staged shutter rhythms at levels 4, 6, 7 and 8. Their new
  pacing and pitch cues still need human playtesting.
- A simulated level-50 route is traversable. Maintaining interest and readable
  difficulty across all fifty levels still requires actual playtest feedback.
- This Android report does not establish iPhone/iPad compatibility, comfort or
  performance; those devices still need testing.
