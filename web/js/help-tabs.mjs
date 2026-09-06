// Public options are deliberately limited to effects with no simulation/route impact.
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
  return body;
}
