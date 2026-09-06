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
  change_1_random_per_leg:['Shutter timing per leg','Use a stable random phase per corridor leg; off synchronizes shutter timing.'],
  change_1_min_level:['Shutter introduction level','First shutter level, 0–50; 0 removes the level gate and introduces CHANGE at level 1.'],
  change_1_interval:['Shutter cycle interval','Seconds between closures, 0.5–60; must exceed closed duration plus warning.'],
  change_1_closed_seconds:['Shutter closed duration','Seconds fully closed per cycle, 0.05–30.'],
  change_1_warning_seconds:['Shutter warning duration','Seconds of amber warning before closure, 0–10; 0 disables the warning.'],
  change_1_damage_fraction:['Shutter damage fraction','Fraction of remaining cells lost on contact, 0–1; rounds down and preserves the last cell.'],
  change_1_damage_cooldown:['Grid damage cooldown','Seconds of protection from all laser grids after a shutter hit, 0–30; each shutter can hit once per closure.'],
  auto_locate_min_level:['Automatic camera tracking level','Follow the player at or above this level; 0 means always on. Integer 0–1000000; intro overviews remain.'],
  star_pattern:['Background star pattern','0: no background stars; 1: original evenly spaced sky; 2: irregular stars with varied sizes, brightness and subtle hues.'],
  locate:['Manual camera tracking','Force the camera to follow the player; turning this off still allows automatic tracking.'],
  mute:['Mute audio','Silence music and sound effects.'],
  level:['Current level','Start a level with level N or set level N; the current campaign cap is 50.'],
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
    'Query: status <name> · Change: set <name> <value> (score/cubes: score N / cubes N)',
    'Booleans: toggle <name>, or true/false, on/off, 1/0, enabled/disabled.'].join('\n');
}
