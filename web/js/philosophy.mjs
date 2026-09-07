// Read the published copy of docs/PHILOSOPHY.md. Successful reads survive Help reopening.
const documents=new Map();

// The essay uses headings, paragraphs, emphasis and source links. Append text
// through the DOM so Markdown can never introduce executable HTML.
export function renderPhilosophy(document,body,markdown) {
  body.replaceChildren();
  for(const block of markdown.trim().split(/\r?\n\s*\r?\n/)) {
    const text=block.split(/\r?\n/).map(line=>line.trim()).join(' ');
    const heading=text.match(/^(#{1,4})\s+(.+)$/);
    const element=document.createElement(heading?`h${heading[1].length+2}`:'p');
    const content=heading?heading[2]:text;
    for(const part of content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)) {
      const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if(link) {
        const anchor=document.createElement('a');anchor.textContent=link[1];anchor.href=link[2];anchor.target='_blank';anchor.rel='noopener noreferrer';element.append(anchor);
      } else if(part.startsWith('**')&&part.endsWith('**')) {
        const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);element.append(strong);
      } else if(part.startsWith('*')&&part.endsWith('*')) {
        const em=document.createElement('em');em.textContent=part.slice(1,-1);element.append(em);
      } else element.append(part);
    }
    body.append(element);
  }
}

export function createPhilosophySection(document,url,{fetcher=globalThis.fetch,cache=documents}={}) {
  const body=document.createElement('article');body.className='philosophy-text';body.setAttribute('lang','en');
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Loading…';body.append(status);
  let loaded=false,pending=null;
  const load=()=>{
    if(loaded)return Promise.resolve();
    if(pending)return pending;
    body.replaceChildren(status);status.textContent='Loading…';body.setAttribute('aria-busy','true');
    const key=String(url);
    if(!cache.has(key)) {
      const request=(async()=>{
        const response=await fetcher(url,{cache:'no-cache',signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw Error('Could not load philosophy');
        const markdown=await response.text();if(!markdown.trim())throw Error('Empty philosophy');
        return markdown;
      })();
      cache.set(key,request);
      request.catch(()=>{if(cache.get(key)===request)cache.delete(key);});
    }
    pending=cache.get(key).then(markdown=>{
      renderPhilosophy(document,body,markdown);loaded=true;
    }).catch(()=>{
      status.textContent='Could not load the philosophy. You can try again or return to the game.';
      const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.addEventListener('click',load);
      body.replaceChildren(status,retry);
    }).finally(()=>{pending=null;body.setAttribute('aria-busy','false');});
    return pending;
  };
  return {id:'philosophy',label:'PHILOSOPHY',body,onSelect:load};
}
