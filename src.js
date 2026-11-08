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
function avatar(p){
 const photo=p.photo&&(/^(https?:|data:|blob:)/.test(p.photo)||p.photo.startsWith(import.meta.env.BASE_URL)?p.photo:`${import.meta.env.BASE_URL}${p.photo.replace(/^\//,'')}`);
 return `<span class="portrait">${p.photo?`<img src="${esc(photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${portrait}</span>`:portrait}</span>`;
}
function personPicker(){
 const person=people.find(p=>p.id===selected);
 return `<div class="person-picker"><button class="focus picker-trigger" id="person-picker-trigger" popovertarget="person-picker-popup" aria-label="Выбрать родственника: ${esc(person.name)}">${avatar(person)}<strong>${esc(person.name)}</strong><svg class="picker-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button><div id="person-picker-popup" class="picker-popup" popover role="dialog" aria-label="Выбор родственника"><label class="picker-search-label" for="person-search">Найти родственника</label><input id="person-search" class="picker-search" type="search" placeholder="Поиск по имени или фамилии" autocomplete="off"><ul id="person-results" class="picker-results" aria-label="Родственники"></ul><p id="person-empty" class="picker-empty" role="status" hidden>Никого не найдено</p></div></div>`;
}
function setupPersonPicker(){
 const popup=document.querySelector('#person-picker-popup');
 const search=document.querySelector('#person-search');
 const results=document.querySelector('#person-results');
 const normalize=text=>text.toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
 const sorted=[...people].sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
 function filter(){
  const words=normalize(search.value).split(/\s+/).filter(Boolean);
  const matches=sorted.filter(p=>words.every(word=>normalize(p.name).includes(word)));
  results.innerHTML=matches.map(p=>`<li><button class="picker-option" data-choice="${esc(p.id)}" ${p.id===selected?'aria-current="true"':''}>${avatar(p)}<span>${esc(p.name)}</span>${p.id===selected?'<span class="picker-check" aria-hidden="true">✓</span>':''}</button></li>`).join('');
  document.querySelector('#person-empty').hidden=matches.length>0;
 }
 filter();search.addEventListener('input',filter);
 popup.addEventListener('beforetoggle',event=>{
  if(event.newState==='open'){search.value='';filter();}
 });
 popup.addEventListener('toggle',()=>{
  if(popup.matches(':popover-open'))search.focus();
 });
 results.addEventListener('click',event=>{
  const button=event.target.closest('[data-choice]');if(!button)return;
  if(selected===button.dataset.choice){popup.hidePopover();document.querySelector('#person-picker-trigger').focus();return;}
  const viewport=document.querySelector('#viewport');
  const canvas=viewport.getBoundingClientRect();
  const visibleCard=[...document.querySelectorAll('[data-person]')].find(el=>el.dataset.person===button.dataset.choice);
  const rect=visibleCard?.getBoundingClientRect();
  const origin=rect&&rect.top>=canvas.top&&rect.bottom<=canvas.bottom?{x:rect.left+rect.width/2-canvas.left,y:rect.top+rect.height/2-canvas.top}:{x:viewport.clientWidth/2,y:viewport.clientHeight/2+Math.min(120,viewport.clientHeight/4)};
  selected=button.dataset.choice;render(origin);
  document.querySelector('#person-picker-trigger').focus({preventScroll:true});
 });
 popup.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();popup.hidePopover();
   document.querySelector('#person-picker-trigger').focus();return;
  }
  const options=[...results.querySelectorAll('button')];
  const index=options.indexOf(document.activeElement);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const next=event.key==='ArrowDown'?Math.min(options.length-1,index+1):Math.max(0,index-1);
   options[next]?.focus();
  }
 });
}
function card(p){
 if(p.unknown)return `<div class="person unknown-person" data-node="${esc(p.id)}" role="img" aria-label="Неизвестный родитель"><span class="portrait">${portrait}</span></div>`;
 const [surname, givenName, ...patronymic]=p.name.trim().split(/\s+/);
 return `<button class="person ${p.id===selected&&!p.alias?'selected':''}" data-node="${esc(p.nodeId||p.id)}" data-person="${esc(p.id)}" aria-pressed="${p.id===selected}">${avatar(p)}<span class="person-name"><span class="person-surname">${esc(surname)}</span><span class="person-given-names"><span>${esc(givenName||'')}</span><span>${esc(patronymic.join(' '))}</span></span></span><span class="dates">${esc(lifeDates(p))}</span></button>`}
function layout(){
 const root=people.find(p=>p.id===selected), generations=new Map([[selected,0]]);
 const byId=new Map(people.map(p=>[p.id,p]));
 const parentOrder=p=>p.parents.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>(a.gender==='male'?0:1)-(b.gender==='male'?0:1));
 const ancestryPath=new Map([[root.id,'']]);
 function markAncestors(person,path,seen=new Set()){
  if(seen.has(person.id))return;
  const next=new Set(seen).add(person.id);
  for(const parent of parentOrder(person)){
   const branch=path+(parent.gender==='male'?'0':'1');
   if(!ancestryPath.has(parent.id)||branch<ancestryPath.get(parent.id))ancestryPath.set(parent.id,branch);
   markAncestors(parent,branch,next);
  }
 }
 markAncestors(root,'');
 // Direct ancestors and descendants are traversed independently to avoid adding cousins.
 function traverse(person,depth,ancestors,seen=new Set()){
  if(seen.has(person.id))return;const nextSeen=new Set(seen).add(person.id);
  const next=ancestors?parentOrder(person):people.filter(p=>p.parents.includes(person.id));
  for(const p of next){if(nextSeen.has(p.id))continue;if(!generations.has(p.id))generations.set(p.id,depth);traverse(p,depth+(ancestors?-1:1),ancestors,nextSeen)}
 }
 traverse(root,-1,true);traverse(root,1,false);
 const spouses=people.filter(p=>root.spouses.includes(p.id)||p.spouses.includes(root.id));
 for(const spouse of spouses){generations.set(spouse.id,0);traverse(spouse,1,false);}
 people.filter(p=>p.id!==root.id&&p.parents.some(id=>root.parents.includes(id))).forEach(p=>generations.set(p.id,0));
 // Only the chosen person's own ancestors get expanded. Added partners never
 // recursively introduce their parents, siblings or other ancestral branches.
 const eligibleChildren=new Set(generations.keys());
 for(const spouse of spouses)if(!ancestryPath.has(spouse.id))eligibleChildren.delete(spouse.id);
 // Complete each visible child's parental pair, including an anonymous partner.
 const nodes=new Map(people.map(p=>[p.id,p]));
 visibleFamilies=[];
 const families=new Map();
 for(const child of people){
  if(!eligibleChildren.has(child.id)||!child.parents.length)continue;
  const parents=parentOrder(child).map(p=>p.id);
  if(parents.length===1){
   const id=`unknown-parent-${parents[0]}`;
   nodes.set(id,{id,unknown:true,gender:byId.get(parents[0]).gender==='male'?'female':'male'});
   if(byId.get(parents[0]).gender==='male')parents.push(id);else parents.unshift(id);
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
  if(g<0)row.sort((a,b)=>{
   const aPath=ancestryPath.get(a),bPath=ancestryPath.get(b);
   if(aPath!==undefined&&bPath!==undefined)return aPath.localeCompare(bPath);
   const partnerPath=id=>{
    const family=visibleFamilies.find(f=>f.parents.includes(id));
    const partner=family?.parents.find(p=>p!==id);
    return ancestryPath.get(partner)||'';
   };
   return (aPath??partnerPath(a)).localeCompare(bPath??partnerPath(b));
  });
  if(previous&&g>=0)row.sort((a,b)=>{
   const rank=id=>{const family=visibleFamilies.find(f=>f.children.includes(id));return family?family.parents.reduce((sum,p)=>sum+previous.indexOf(p),0)/family.parents.length:Infinity};
   return rank(a)-rank(b);
  });
  const ordered=[];
  for(const id of row){
   if(ordered.includes(id)||nodes.get(id).unknown)continue;
   const spouseIds=(nodes.get(id).spouses||[]).filter(other=>row.includes(other)&&!ordered.includes(other));
   const malePartner=nodes.get(id).gender==='female'?spouseIds.find(other=>nodes.get(other).gender==='male'):null;
   if(malePartner)ordered.push(malePartner);
   const unknown=`unknown-parent-${id}`;
   // An anonymous partner is placed on the opposite parental side.
   if(row.includes(unknown)&&nodes.get(unknown).gender==='male')ordered.push(unknown);
   ordered.push(id);
   const duplicateForUnknown=row.includes(unknown)&&nodes.get(unknown).gender==='female'&&spouseIds.length;
   if(row.includes(unknown)&&nodes.get(unknown).gender==='female'&&!duplicateForUnknown)ordered.push(unknown);
   for(const spouse of spouseIds)if(!ordered.includes(spouse))ordered.push(spouse);
   if(duplicateForUnknown){
    // Repeat the same known parent for a second union instead of drawing a
    // marriage line through the first partner's card.
    const alias=`${id}--unknown-union`;
    nodes.set(alias,{...nodes.get(id),nodeId:alias,alias:true});
    ordered.push(alias,unknown);
    const family=visibleFamilies.find(f=>f.parents.includes(id)&&f.parents.includes(unknown));
    if(family)family.parentNodes=family.parents.map(p=>p===id?alias:p);
   }
  }
  if(g===0){
   // The focus row follows navigation order; ancestor rows retain father/mother order.
   const prefix=[];
   const anonymous=`unknown-parent-${root.id}`;
   const aliases=ordered.filter(id=>nodes.get(id).alias&&nodes.get(id).id===root.id);
   if(aliases.length&&ordered.includes(anonymous))prefix.push(...aliases,anonymous);
   prefix.push(...spouses.map(p=>p.id).filter(id=>ordered.includes(id)));
   if(!prefix.includes(anonymous)&&ordered.includes(anonymous))prefix.push(anonymous);
   prefix.push(root.id);
   const rest=ordered.filter(id=>!prefix.includes(id));
   ordered.splice(0,ordered.length,...prefix,...rest);
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

function render(origin=null){app.innerHTML=`<header><a class="brand" href="./" aria-label="Семейный архив"><span class="brand-symbol" aria-hidden="true">✳︎</span> Семейный архив</a>${personPicker()}</header><main><section class="tree-section" aria-label="Интерактивное семейное древо"><div class="viewport" id="viewport" tabindex="0" aria-label="Древо. Прокручивайте для просмотра родственников"><div class="tree" id="tree" style="zoom:${scale}"><svg class="connections" id="connections" aria-hidden="true"></svg><div class="generations">${layout()}</div></div></div><div class="tree-bottom"><span><i class="legend-line"></i> Родство <i class="legend-line marriage"></i> Брак</span><span class="hint">Нажмите на человека, чтобы перестроить древо</span><div class="zoom"><button id="minus" aria-label="Уменьшить">−</button><output>${Math.round(scale*100)}%</output><button id="plus" aria-label="Увеличить">+</button></div></div></section></main>`;
 setupPersonPicker();
 app.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{
  if(selected===b.dataset.person)return;
  const viewport=document.querySelector('#viewport').getBoundingClientRect(),card=b.getBoundingClientRect();
  const origin={x:card.left+card.width/2-viewport.left,y:card.top+card.height/2-viewport.top};
  selected=b.dataset.person;render(origin);
 });
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
 function union(ids,nodeIds=ids){
  const key=[...ids].sort().join(':');
  const pair=nodeIds.map(id=>boxes.get(id)).filter(Boolean).sort((a,b)=>a.x-b.x);
  if(pair.length!==2||pair[0].y!==pair[1].y)return null;
  const [left,right]=pair,y=snap(left.y+64),x=snap((left.x+left.w+right.x)/2);
  if(!paired.has(key)){
   paired.add(key);marriages.push(`<path class="marriage-link" data-union="${esc(key)}" d="M ${snap(left.x+left.w)} ${y} H ${snap(right.x)}"/>`);
  }
  return {x,y};
 }
 const laneCounts=new Map();
 for(const family of visibleFamilies){
  const origin=union(family.parents,family.parentNodes);if(!origin)continue;
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
async function load(){const response=await fetch(`${import.meta.env.BASE_URL}people/index.json?v=${__PEOPLE_VERSION__}`);if(!response.ok)throw Error();const ids=await response.json();people=await Promise.all(ids.map(async id=>{const r=await fetch(`${import.meta.env.BASE_URL}people/${encodeURIComponent(id)}.json?v=${__PEOPLE_VERSION__}`);if(!r.ok)throw Error();return r.json()}));render()}
load().catch(()=>{app.innerHTML='<main><h1>Не удалось загрузить древо</h1><p>Проверьте файлы в public/people и обновите страницу.</p><button onclick="location.reload()">Повторить</button></main>'});
