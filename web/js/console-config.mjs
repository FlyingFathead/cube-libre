export const CONFIG_COMMANDS=Object.freeze(['viewconfig','showconfig','showvars','viewvars','listvars','listconfig']);

// Descriptions enrich the command registry; they never decide which settings exist.
// Browser-owned settings may supply their own name and description alongside get/set.
const DETAILS=Object.freeze({
  damage:['Damage','Allow normal-level cell damage from boundaries and laser grids, including shutters.'],
  lasers:['Laser grids','Enable laser hazards, including electric shutters.'],
  bounds:['Boundary damage','Allow corridor boundaries to shave off exposed cells and trigger overheating.'],
  noclip:['Free boundary movement','Bypass corridor boundary damage, heat and collapsed-leg movement restrictions; laser hazards remain active.'],
  portal:['Portal activation','Allow the exit portal to absorb cells and finish the level.'],
  suction:['Portal suction','Pull the player body toward an active exit portal.'],
  route3d:['Three-dimensional routes','Introduce world-Y route segments from SPACE onward; changing this rebuilds the current route.'],
  shake:['Shaking and heat flashes','Show player heat tremors, heat flashes, bonus warning tremors and camera jolts.'],
  spin:['Player auto-rotation','Slowly tumble the surviving body across X/Y/Z in normal levels; rotated cells affect collision.'],
  rotation_shocks:['Hit rotation shocks','Apply a brief visual rotational recoil when the body takes a hit.'],
  portal_white_light:['Portal white light','Show a white halo that strengthens near the portal.'],
  culling:['Cull distant corridors','Limit rendered corridor detail; disabling this does not reveal or arm distant laser hazards.'],
  microgravity:['Microgravity propulsion','Use thrust, coasting and braking in normal levels; off restores direct movement.'],
  overheat_blocks_recoupling:['Overheating blocks re-coupling','Reject new re-coupling requests while hot once the configured HEAT level gate is satisfied.'],
  change_1:['CHANGE 1: electric shutters','Periodically close and reopen the entire laser square from change_1_min_level onward.'],
  change_1_random_per_leg:['Random shutter gates and legs','Randomize the eligible gate pool and closure groups/legs; off uses a deterministic selection.'],
  change_1_no_repeat_leg:['Prevent consecutive zaps in one leg','After a leg zaps, choose another nearby revealed leg for the next event. Wait if none is eligible. Default true.'],
  change_1_min_level:['Shutter introduction level','First shutter level, 0–50; 0 removes the level gate and introduces CHANGE at level 1.'],
  change_1_interval:['Shutter cycle interval','Seconds between successive closure groups, 0.5–60. A larger gate cooldown extends the effective interval.'],
  change_1_closed_seconds:['Shutter closed duration','Seconds fully closed per cycle, 0.05–30.'],
  change_1_warning_seconds:['Shutter warning duration','Seconds of amber warning before closure, 0–10; 0 disables the warning.'],
  change_1_damage_fraction:['Shutter damage fraction','Fraction of remaining cells lost on contact, 0–1; rounds down and preserves the last cell.'],
  change_1_gates_per_leg:['Shutter gates per leg','0: automatic level ramp; 1–5: force that many selected gates in each leg. Concurrent closures obey change_1_max_simultaneous.'],
  change_1_max_simultaneous:['Maximum simultaneous shutter gates','Maximum gates closed together across the active scene, 1–5; default 2. Selected gates take turns in bounded groups.'],
  change_1_start_gates:['Initial shutter count','Selected gates per leg at introduction, 1–5; default 1.'],
  change_1_max_gates:['Maximum shutter count','Selected gates per leg at the ramp endpoint, 1–5; default 4.'],
  change_1_ramp_end_level:['Shutter count ramp endpoint','Level where the maximum count is reached; default 50.'],
  change_1_gate_cooldown:['Open rest between shutter gates','Minimum seconds from one gate reopening to the next warning; default 1.2. Extends the cycle interval when necessary.'],
  change_1_damage_cooldown:['Grid damage cooldown','Seconds of protection from all laser grids after a shutter hit, 0–30; each shutter can hit once per closure.'],
  auto_locate_min_level:['Automatic camera tracking level','Follow the player at or above this level; 0 means always on. Integer 0–1000000; intro overviews remain.'],
  preview_outline:['Ghost route preview','Show four exterior corridor edges in the opening overview; gates stay hidden. Saved boolean.'],
  preview_max_legs:['Maximum preview legs','Limit the opening ghost outline to this many legs; 0 hides it. Default 50; session only. The camera and portal still frame the full route.'],
  preview_fade_after_legs:['Preview fade starts after','Keep this many near legs at full preview opacity, then fade gradually toward the end; default 2.'],
  preview_opacity:['Near preview opacity','Ghost outline opacity from 0 to 1; default 0.24.'],
  preview_far_opacity:['Far preview opacity fraction','Fraction of near opacity remaining at the far end, 0–1; default 0.12.'],
  star_pattern:['Background star pattern','0: no background stars; 1: original evenly spaced sky; 2: irregular stars with varied sizes, brightness and subtle hues.'],
  locate:['Manual camera tracking','Force the camera to follow the player; turning this off still allows automatic tracking.'],
  mute:['Mute audio','Silence music and sound effects.'],
  controller:['Controller input','Enable standard Xbox-style gamepads. Keyboard and touch controls remain available.'],
  controller_deadzone:['Controller stick deadzone','Ignore small stick deflections to prevent drift; range 0–0.8, default 0.18. Saved in this browser.'],
  level:['Current level','Start a level with level N or set level N; the current campaign cap is 50.'],
  top_level:['Saved top level','Highest level reached in this browser across runs. Query: toplevel / top_level. Reset to 1: toplevel reset / top_level reset / reset top level.'],
  score:['Run score','Set the current score with score N; non-negative whole number.'],
  cubes:['Surviving cells','Set the surviving cell count with cubes N, from 0 to 125.'],
});

export function describeConsoleConfig(settings,values) {
  const registry=new Map([...settings,...[...values].map(([key,get])=>[key,{get}])]);
  const rows=[...registry].sort(([a],[b])=>a.localeCompare(b)).map(([key,setting])=>{
    const value=setting.get();
    const details=Object.hasOwn(DETAILS,key)?DETAILS[key]:[];
    const name=setting.name||details[0]||key.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase());
    const description=setting.description||details[1]||`${typeof value==='boolean'?'Enable or disable':'Set'} ${name.toLowerCase()}.`;
    return `${key} | ${value} | ${name} | ${description}`;
  });
  return ['CONFIGURATION · CURRENT VALUES','Parameter | Value | Friendly name | Description',...rows,'',
    `${rows.length} parameters. Scroll with the mouse wheel or Page Up / Page Down.`,
    'Query: status <name> · Change: set <name> <value> (score/cubes: score N / cubes N; top_level: toplevel reset)',
    'Booleans: toggle <name>, or true/false, on/off, 1/0, enabled/disabled.'].join('\n');
}
