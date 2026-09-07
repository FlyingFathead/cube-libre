import {VISUAL_EFFECTS} from './config.mjs';
// Visual options stay separate from the explicitly offered gameplay rescue options.
export const HELP_VISUAL_OPTIONS=Object.freeze([
  {key:'shake',label:'Shaking and heat flashes',storage:'cube-libre-shake-v1'},
  {key:'rotation_shocks',label:'Hit rotation shocks',storage:'cube-libre-rotation-shocks-v1'},
  {key:'portal_white_light',label:'Portal white light',storage:'cube-libre-portal-white-light-v1'},
]);

export function createHelpTabs(document,sections,initial='keyboard') {
  const root=document.createElement('div');root.className='help-tabs';
  const list=document.createElement('div');list.className='help-tab-list';list.setAttribute('role','tablist');list.setAttribute('aria-label','Help sections');
  const content=document.createElement('div');content.className='help-panels';
  const tabs=[],panels=[];
  const select=(index,focus=false)=>{
    tabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;panels[i].hidden=!active;});
    panels[index].scrollTop=0;if(focus)tabs[index].focus({preventScroll:true});
    sections[index].onSelect?.();
  };
  sections.forEach(({id,label,body},index)=>{
    const tab=document.createElement('button');tab.type='button';tab.id=`help-tab-${id}`;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`help-panel-${id}`);
    const panel=document.createElement('section');panel.id=`help-panel-${id}`;panel.className='help-panel';panel.tabIndex=0;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.append(body);
    tabs.push(tab);panels.push(panel);list.append(tab);content.append(panel);
    tab.addEventListener('click',()=>select(index));
    tab.addEventListener('keydown',event=>{
      const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
      if(next===null)return;event.preventDefault();select(next,true);
    });
  });
  root.append(list,content);select(Math.max(0,sections.findIndex(s=>s.id===initial)));return root;
}

export function createVisualOptions(document,game,write) {
  const body=document.createElement('div'),heading=document.createElement('h3');heading.textContent='VISUAL EFFECTS';body.append(heading);
  const intro=document.createElement('p');intro.textContent='Adjust motion and lighting effects for comfortable play.';body.append(intro);
  for(const {key,label,storage} of HELP_VISUAL_OPTIONS) {
    const row=document.createElement('label');row.className='shake-setting';
    const input=document.createElement('input');input.type='checkbox';input.checked=game.flags[key];input.dataset.setting=key;
    input.addEventListener('change',()=>{game.command(`set ${key} ${input.checked}`);write(storage,game.flags[key]);});
    row.append(input,label);body.append(row);
  }
  const rescue=document.createElement('h3');rescue.textContent='RESCUE';body.append(rescue);
  const row=document.createElement('label');row.className='shake-setting';
  const input=document.createElement('input');input.type='checkbox';input.checked=game.flags.panic;input.dataset.setting='panic';
  input.addEventListener('change',()=>{game.command(`set panic ${input.checked}`);write('cube-libre-panic-v1',game.flags.panic);});
  row.append(input,'ALLOW PANIC BUTTON');body.append(row);
  const note=document.createElement('p');note.textContent=`Return to the start of your reached leg with your surviving cubes and a fresh timer. The tractor beam also requests normal Recouple for recoverable loose pieces. Available throughout a normal leg, with a ${game.panicCooldownSeconds}-second cooldown. On by default. Score penalty: ${game.flags.panic_penalty?`${game.panicScorePenaltyPercent}% of this run per use, rounded to whole points`:'off'}. All-time records stay unchanged; the penalty is console-configurable and off by default.`;body.append(note);
  const backupRow=document.createElement('label');backupRow.className='shake-setting';
  const backup=document.createElement('input');backup.type='checkbox';backup.checked=game.flags.backup_cubes_enabled;backup.dataset.setting='backup_cubes_enabled';
  backup.addEventListener('change',()=>{game.command(`set backup_cubes_enabled ${backup.checked}`);write('cube-libre-backup-cubes-enabled-v1',game.flags.backup_cubes_enabled);});
  backupRow.append(backup,'BACKUP CUBES ENABLED');body.append(backupRow);
  const backupNote=document.createElement('p');backupNote.textContent=`On by default. Collect every bonus piece to earn a full replacement cube.${game.flags.backup_flawless_levels?' Exiting a normal level with all 125 pieces intact also earns one.':''} Spend one during reassembly to restart at your last reached leg. Disabling this keeps your reserve but stops earning and spending it.`;body.append(backupNote);
  return body;
}

export function createOptionsReset(document,game,mobile,write,refresh) {
  const section=document.createElement('section'),button=document.createElement('button'),note=document.createElement('p');
  button.type='button';button.textContent='Reset to defaults';button.dataset.action='reset-options';
  note.textContent='Restore the options in this panel. Your saved run, scores and Backup Cubes are kept.';
  button.addEventListener('click',()=>{
    mobile.setMode(0);mobile.setHelpers(false);mobile.orientation?.release();
    const defaults={shake:VISUAL_EFFECTS.shakingEnabled,rotation_shocks:VISUAL_EFFECTS.rotationShocks,portal_white_light:VISUAL_EFFECTS.portalWhiteLight,panic:true,backup_cubes_enabled:true};
    for(const [key,value] of Object.entries(defaults)) {
      game.command(`set ${key} ${value}`);write(`cube-libre-${key.replaceAll('_','-')}-v1`,value);
    }
    refresh();
  });
  section.append(button,note);return section;
}
