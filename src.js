import './style.css';
const app = document.querySelector('#app');
const portrait = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="23" r="10"/><path d="M13 55v-5c0-10 8-17 19-17s19 7 19 17v5"/></svg>`;
let people=[], selected='maria', scale=1, visibleFamilies=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s)) : 'Дата рождения не указана';
const shortDate=s=>s ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(s)) : '??.??.????';
function lifeDates(p){
 if(p.deathDate||p.deceased){
  const end=p.deathDate?shortDate(p.deathDate):`??.??.${p.deathYear||'????'}`;
  return `${shortDate(p.birthDate)}-${end}`;
 }
 return date(p.birthDate);
}
function card(p){
 if(p.unknown)return `<div class="person unknown-person" data-node="${esc(p.id)}" role="img" aria-label="Неизвестный родитель"><span class="portrait">${portrait}</span></div>`;
 return `<button class="person ${p.id===selected?'selected':''}" data-node="${esc(p.id)}" data-person="${esc(p.id)}" aria-pressed="${p.id===selected}"><span class="portrait">${p.photo?`<img src="${esc(p.photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${portrait}</span>`:portrait}</span><span class="person-name">${esc(p.name)}</span><span class="dates">${esc(lifeDates(p))}</span></button>`}
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
 // Complete each visible child's parental pair, including an anonymous partner.
 const nodes=new Map(people.map(p=>[p.id,p]));
 visibleFamilies=[];
 const families=new Map();
 for(const child of people){
  if(!generations.has(child.id)||!child.parents.length)continue;
  const parents=[...child.parents];
  if(parents.length===1){
   const id=`unknown-parent-${parents[0]}`;
   nodes.set(id,{id,unknown:true});parents.unshift(id);
  }
  const generation=generations.get(child.id)-1;
  for(const id of parents)if(!generations.has(id))generations.set(id,generation);
  const key=[...parents].sort().join(':');
  if(!families.has(key))families.set(key,{key,parents,children:[]});
  families.get(key).children.push(child.id);
 }
 visibleFamilies=[...families.values()];
 const rows=[...new Set(generations.values())].sort((a,b)=>a-b);
 const orderedRows=new Map();
 for(const g of rows){
  let row=[...generations.keys()].filter(id=>generations.get(id)===g);
  const previous=orderedRows.get(g-1);
  if(previous)row.sort((a,b)=>{
   const rank=id=>{const family=visibleFamilies.find(f=>f.children.includes(id));return family?family.parents.reduce((sum,p)=>sum+previous.indexOf(p),0)/family.parents.length:Infinity};
   return rank(a)-rank(b);
  });
  const ordered=[];
  for(const id of row){
   if(ordered.includes(id)||nodes.get(id).unknown)continue;
   const unknown=`unknown-parent-${id}`;
   if(row.includes(unknown)&&!ordered.includes(unknown))ordered.push(unknown);
   ordered.push(id);
   for(const spouse of nodes.get(id).spouses||[])if(row.includes(spouse)&&!ordered.includes(spouse))ordered.push(spouse);
  }
  orderedRows.set(g,ordered);
 }
 return rows.map(g=>{
  const groups=[];
  for(const id of orderedRows.get(g)){
   const person=nodes.get(id);
   const family=visibleFamilies.find(f=>f.children.includes(id));
   const partner=person.unknown?id.replace('unknown-parent-',''):null;
   const partnerFamily=partner?visibleFamilies.find(f=>f.children.includes(partner)):null;
   const key=family?.key||partnerFamily?.key;
   const previous=groups.at(-1);
   const paired=previous?.ids.some(other=>person.spouses?.includes(other)||other===`unknown-parent-${id}`);
   if(previous&&(previous.key===key||paired))previous.ids.push(id);
   else groups.push({key,ids:[id]});
  }
  return `<div class="generation" data-generation="${g}"><div class="people-row">${groups.map(group=>`<div class="family-group">${group.ids.map(id=>card(nodes.get(id))).join('')}</div>`).join('')}</div></div>`;
 }).join('');
}

function render(origin=null){app.innerHTML=`<header><a class="brand" href="./" aria-label="Семейный архив"><span class="brand-symbol" aria-hidden="true">✳︎</span> Семейный архив</a></header><main><section class="tree-section" aria-label="Интерактивное семейное древо"><div class="tree-toolbar"><div class="focus"><span class="status-dot"></span><div><strong>${esc(people.find(p=>p.id===selected).name)}</strong></div></div><button class="reset" id="reset">↺ <span>Вернуться к Марии</span></button></div><div class="viewport" id="viewport" tabindex="0" aria-label="Древо. Прокручивайте для просмотра родственников"><div class="tree" id="tree" style="zoom:${scale}"><svg class="connections" id="connections" aria-hidden="true"></svg><div class="generations">${layout()}</div></div></div><div class="tree-bottom"><span><i class="legend-line"></i> Родство <i class="legend-line marriage"></i> Брак</span><span class="hint">Нажмите на человека, чтобы перестроить древо</span><div class="zoom"><button id="minus" aria-label="Уменьшить">−</button><output>${Math.round(scale*100)}%</output><button id="plus" aria-label="Увеличить">+</button></div></div></section></main>`;
 app.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{
  if(selected===b.dataset.person)return;
  const viewport=document.querySelector('#viewport').getBoundingClientRect(),card=b.getBoundingClientRect();
  const origin={x:card.left+card.width/2-viewport.left,y:card.top+card.height/2-viewport.top};
  selected=b.dataset.person;render(origin);
 });
 document.querySelector('#reset').onclick=()=>{selected='maria';scale=1;render()};
 for(const [id,delta] of [['minus',-.1],['plus',.1]])document.getElementById(id).onclick=()=>{scale=Math.max(.5,Math.min(1.5,Math.round((scale+delta)*10)/10));render()};
 requestAnimationFrame(()=>positionSelection(origin));
}
// Extra canvas space allows even the first/last card to be centered.
function positionSelection(origin=null){
 const viewport=document.querySelector('#viewport');
 const tree=document.querySelector('#tree');
 const active=document.querySelector('.person.selected');
 if(!viewport||!tree||!active)return;
 const familyCounts=new Map();
 for(const family of visibleFamilies){
  const child=document.querySelector(`[data-person="${family.children[0]}"]`);
  const generation=child?.closest('[data-generation]').dataset.generation;
  familyCounts.set(generation,(familyCounts.get(generation)||0)+1);
 }
 tree.style.setProperty('--generation-gap',`${Math.max(100,...[...familyCounts.values()].map(n=>n*18+48))}px`);
 tree.style.padding=`${viewport.clientHeight/2/scale}px ${viewport.clientWidth/2/scale}px`;
 draw();
 const canvas=viewport.getBoundingClientRect();
 const card=active.getBoundingClientRect();
 const left=viewport.scrollLeft+card.left+card.width/2-(canvas.left+viewport.clientLeft+viewport.clientWidth/2);
 const top=viewport.scrollTop+card.top+card.height/2-(canvas.top+viewport.clientTop+viewport.clientHeight/2);
 if(origin&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  viewport.scrollTo({left:left+viewport.clientWidth/2-origin.x,top:top+viewport.clientHeight/2-origin.y,behavior:'instant'});
  viewport.scrollTo({left,top,behavior:'smooth'});
 }else viewport.scrollTo({left,top,behavior:'instant'});
}
function draw(){
 const tree=document.querySelector('#tree'),svg=document.querySelector('#connections');if(!tree)return;
 const boxes=new Map([...tree.querySelectorAll('[data-node]')].map(el=>[el.dataset.node,{x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}]));
 svg.setAttribute('width',tree.offsetWidth);svg.setAttribute('height',tree.offsetHeight);
 const branches=[],marriages=[],paired=new Set();
 const snap=n=>Math.floor(n)+.5;
 function union(ids){
  const key=[...ids].sort().join(':');
  const pair=ids.map(id=>boxes.get(id)).filter(Boolean).sort((a,b)=>a.x-b.x);
  if(pair.length!==2||pair[0].y!==pair[1].y)return null;
  const [left,right]=pair,y=snap(left.y+64),x=snap((left.x+left.w+right.x)/2);
  if(!paired.has(key)){
   paired.add(key);marriages.push(`<path class="marriage-link" data-union="${esc(key)}" d="M ${snap(left.x+left.w)} ${y} H ${snap(right.x)}"/>`);
  }
  return {x,y};
 }
 const laneCounts=new Map();
 for(const family of visibleFamilies){
  const origin=union(family.parents);if(!origin)continue;
  const children=family.children.map(id=>boxes.get(id)).filter(Boolean);if(!children.length)continue;
  const childTop=Math.min(...children.map(c=>c.y));
  const lane=laneCounts.get(childTop)||0;laneCounts.set(childTop,lane+1);
  const bus=snap(childTop-28-lane*18);
  const kinship=[];
  const centers=children.map(c=>snap(c.x+c.w/2));
  kinship.push(`M ${origin.x} ${origin.y} V ${bus}`);
  kinship.push(`M ${Math.min(origin.x,...centers)} ${bus} H ${Math.max(origin.x,...centers)}`);
  for(const child of children)kinship.push(`M ${snap(child.x+child.w/2)} ${bus} V ${snap(child.y)}`);
  const d=[...new Set(kinship)].join(' ');
  // A white underlay makes crossings between separate families unambiguous.
  branches.push(`<g data-family="${esc(family.key)}"><path class="branch-underlay" d="${d}"/><path class="kinship-link" d="${d}"/></g>`);
 }
 // Couples without visible children still have a marriage line.
 for(const p of people)for(const id of p.spouses)if(boxes.has(p.id)&&boxes.has(id))union([p.id,id]);
 svg.innerHTML=branches.join('')+marriages.join('');
}
window.addEventListener('resize',()=>requestAnimationFrame(()=>positionSelection()));
async function load(){const response=await fetch(`${import.meta.env.BASE_URL}people/index.json`);if(!response.ok)throw Error();const ids=await response.json();people=await Promise.all(ids.map(async id=>{const r=await fetch(`${import.meta.env.BASE_URL}people/${encodeURIComponent(id)}.json`);if(!r.ok)throw Error();return r.json()}));render()}
load().catch(()=>{app.innerHTML='<main><h1>Не удалось загрузить древо</h1><p>Проверьте файлы в public/people и обновите страницу.</p><button onclick="location.reload()">Повторить</button></main>'});
