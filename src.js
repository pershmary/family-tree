import './style.css';
const app = document.querySelector('#app');
const portrait = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="23" r="10"/><path d="M13 55v-5c0-10 8-17 19-17s19 7 19 17v5"/></svg>`;
let people=[], selected='maria', scale=1;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s)) : 'Дата рождения не указана';
function card(p){return `<button class="person ${p.id===selected?'selected':''}" data-person="${esc(p.id)}" aria-pressed="${p.id===selected}"><span class="portrait">${p.photo?`<img src="${esc(p.photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${portrait}</span>`:portrait}</span><span class="person-name">${esc(p.name)}</span><span class="dates">${esc(date(p.birthDate))}${p.deathDate?`<br>Умер(ла) ${esc(date(p.deathDate))}`:p.deceased?`<br>Умер(ла) ${p.deathYear?esc(p.deathYear)+' г.':'— дата неизвестна'}`:''}</span><span class="person-tag">${p.id===selected?'Ключевое лицо':'Выбрать человека'}</span></button>`}
function layout(){
 const root=people.find(p=>p.id===selected), generations=new Map([[selected,0]]);
 // Direct ancestors and descendants are traversed independently to avoid adding cousins.
 function traverse(person,depth,ancestors,seen=new Set()){
  if(seen.has(person.id))return;const nextSeen=new Set(seen).add(person.id);
  const next=ancestors?people.filter(p=>person.parents.includes(p.id)):people.filter(p=>p.parents.includes(person.id));
  for(const p of next){if(nextSeen.has(p.id))continue;if(!generations.has(p.id))generations.set(p.id,depth);traverse(p,depth+(ancestors?-1:1),ancestors,nextSeen)}
 }
 traverse(root,-1,true);traverse(root,1,false);
 people.filter(p=>root.spouses.includes(p.id)||p.spouses.includes(root.id)||(p.id!==root.id&&p.parents.some(id=>root.parents.includes(id)))).forEach(p=>generations.set(p.id,0));
 const rows=[...new Set(generations.values())].sort((a,b)=>a-b);
 const html=rows.map(g=>{
  let row=people.filter(p=>generations.get(p.id)===g);
  // Keep spouses next to each other; remaining people stay at their generation.
  const ordered=[];for(const p of row){if(ordered.includes(p))continue;ordered.push(p);for(const s of row)if(!ordered.includes(s)&&(p.spouses.includes(s.id)||s.spouses.includes(p.id)))ordered.push(s)}
  return `<div class="generation" data-generation="${g}"><span class="generation-label">${g<0?g===-1?'Родители':'Предки':g>0?g===1?'Дети':'Потомки':'Ключевое лицо и близкие'}</span><div class="people-row">${ordered.map(card).join('')}</div></div>`;
 }).join('');
 return html;
}
function render(){app.innerHTML=`<header><a class="brand" href="./" aria-label="Першины — семейное древо"><span class="brand-symbol" aria-hidden="true">✳︎</span> Першины</a></header><main><section class="tree-section" aria-label="Интерактивное семейное древо"><div class="tree-toolbar"><div class="focus"><span class="status-dot"></span><div><span class="small-label">КЛЮЧЕВОЕ ЛИЦО</span><strong>${esc(people.find(p=>p.id===selected).name)}</strong></div></div><button class="reset" id="reset">↺ <span>Вернуться к Марии</span></button></div><div class="viewport" id="viewport" tabindex="0" aria-label="Древо. Прокручивайте для просмотра родственников"><div class="tree" id="tree" style="zoom:${scale}"><svg class="connections" id="connections" aria-hidden="true"></svg><div class="generations">${layout()}</div></div></div><div class="tree-bottom"><span><i class="legend-line"></i> Родство <i class="legend-line marriage"></i> Брак</span><span class="hint">Нажмите на человека, чтобы перестроить древо</span><div class="zoom"><button id="minus" aria-label="Уменьшить">−</button><output>${Math.round(scale*100)}%</output><button id="plus" aria-label="Увеличить">+</button></div></div></section></main>`;
 app.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.person;render()});
 document.querySelector('#reset').onclick=()=>{selected='maria';scale=1;render()};
 for(const [id,delta] of [['minus',-.1],['plus',.1]])document.getElementById(id).onclick=()=>{scale=Math.max(.5,Math.min(1.5,Math.round((scale+delta)*10)/10));render()};
 requestAnimationFrame(()=>{draw();const viewport=document.querySelector('#viewport'),active=document.querySelector('.person.selected');viewport.scrollLeft=Math.max(0,(active.offsetLeft+active.offsetWidth/2)*scale-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,active.offsetTop*scale-viewport.clientHeight/2+active.offsetHeight*scale/2)});
}
function draw(){const tree=document.querySelector('#tree'),svg=document.querySelector('#connections');if(!tree)return;const boxes=new Map([...tree.querySelectorAll('[data-person]')].map(el=>[el.dataset.person,{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}]));
 // Cards use the tree as their offset parent, keeping connections correct at every zoom.
 svg.setAttribute('width',tree.scrollWidth);svg.setAttribute('height',tree.scrollHeight);let paths='';const line=(d,cls='')=>{paths+=`<path d="${d}" class="${cls}"/>`};
 const paired=new Set();for(const p of people){const a=boxes.get(p.id);if(!a)continue;for(const id of p.spouses){const b=boxes.get(id),key=[p.id,id].sort().join(':');if(!b||a.y!==b.y||paired.has(key))continue;paired.add(key);const left=a.x<b.x?a:b,right=a.x<b.x?b:a;line(`M ${left.x+left.w} ${left.y+64} H ${right.x}`,'marriage-link')}
 const parents=p.parents.map(id=>boxes.get(id)).filter(b=>b&&b.y<a.y);if(parents.length){const x=parents.reduce((s,b)=>s+b.x+b.w/2,0)/parents.length;const y=Math.max(...parents.map(b=>b.y+b.h));for(const b of parents)line(`M ${b.x+b.w/2} ${b.y+b.h} V ${y+28} H ${x}`);line(`M ${x} ${y+28} V ${a.y-26} H ${a.x+a.w/2} V ${a.y}`)}}svg.innerHTML=paths;}
window.addEventListener('resize',()=>requestAnimationFrame(draw));
async function load(){const response=await fetch(`${import.meta.env.BASE_URL}people/index.json`);if(!response.ok)throw Error();const ids=await response.json();people=await Promise.all(ids.map(async id=>{const r=await fetch(`${import.meta.env.BASE_URL}people/${encodeURIComponent(id)}.json`);if(!r.ok)throw Error();return r.json()}));render()}
load().catch(()=>{app.innerHTML='<main><h1>Не удалось загрузить древо</h1><p>Проверьте файлы в public/people и обновите страницу.</p><button onclick="location.reload()">Повторить</button></main>'});
