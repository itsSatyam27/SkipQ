import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, query, where, orderBy, documentId, limit, startAfter, getCountFromServer, runTransaction, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebase = initializeApp(window.SKIPQ_FIREBASE_CONFIG);
const auth = getAuth(firebase), db = getFirestore(firebase), root = document.querySelector('#app');
const state = { user:null, section:'Overview', rows:[], cursor:null, previous:[], page:1, hasMore:false, filter:'all', search:'', counts:{}, loading:false, error:'', success:'', generation:0 };
const pageCache = new Map();
const cacheKey = () => JSON.stringify([state.section,state.filter,state.page]);
const paths = {Overview:'sellerRequests',Users:'users','Seller requests':'sellerRequests',Blocked:'users',Strikes:'users',Canteens:'canteens',Orders:'orders',History:'adminAudit'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({Overview:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',Users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>','Seller requests':'<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9h18M9 21v-7h6v7"/>',Strikes:'<path d="M12 3 2 21h20ZM12 9v5m0 3h.01"/>',Blocked:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',Canteens:'<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9h18M9 21v-7h6v7"/>',Orders:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',History:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'})[name] || '<path d="M4 12h16M12 4v16"/>'}</svg>`;
const date = value => value?.toDate ? value.toDate().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
const blocked = row => row.banStatus === 'perm_ban' || (row.banStatus === 'temp_ban' && row.banUntil?.toMillis() > Date.now());
const who = r => `<div class="who"><span class="av">${esc((r.name||r.email||'?')[0])}</span><div><strong>${esc(r.name||'Unnamed')}</strong><small>${esc(r.email)}</small></div></div>`;
const badge = (text, color='') => `<span class="badge ${color}">${esc(text || 'Unknown')}</span>`;
const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value || 0));
const failure = error => error.code === 'permission-denied' ? 'Access denied. Check the published admin rules and your admin account.' : error.message || 'Could not load data. Try again.';
const adminApi = window.SKIPQ_FIREBASE_CONFIG.adminApiUrl;

async function offboardAccount({userId,reason,sellerAction,successorUid}) {
  if (!adminApi) throw new Error('Admin API URL is not configured.');
  const token = await state.user.getIdToken();
  const response = await fetch(`${adminApi.replace(/\/$/,'')}/admin/offboard-user`, {
    method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({userId,reason,sellerAction,successorUid}), redirect:'error'
  });
  const result = await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.message || `Offboarding failed (HTTP ${response.status}).`);
  return result;
}

function login(message='') {
  root.innerHTML = `<main class="login"><div class="brand"><img class="brand-icon" src="./icon.png" alt=""><span>SkipQ <small>admin</small></span></div><div class="eyebrow">CAMPUS OPERATIONS</div><h1>A clearer view of your campus.</h1><p>Manage seller requests, accounts and canteens from one secure workspace.</p>${message?`<p class="error" role="alert">${esc(message)}</p>`:''}<button id="login">Continue with Google</button><small>Access is limited to authorized administrators. Your student, faculty or seller account does not grant admin access.</small></main>`;
  document.querySelector('#login').onclick = async () => { try { const provider = new GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'}); await signInWithPopup(auth,provider); } catch(error) { login(failure(error)); } };
}
function shell() {
  root.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand"><img class="brand-icon" src="./icon.png" alt=""><span class="brand-name">SkipQ</span><span class="admin-tag">admin</span></div><div class="workspace-label">WORKSPACE</div><nav class="nav" aria-label="Admin sections">${Object.keys(paths).map(name=>`<button data-nav="${esc(name)}" class="${state.section===name?'active':''}" ${state.section===name?'aria-current="page"':''}>${icon(name)}${esc(name)}${name==='Seller requests'&&state.counts.pending?`<em class="pill">${state.counts.pending}</em>`:''}</button>`).join('')}</nav><div class="sidebar-footer"><strong>Silver Oak University</strong><br>Campus operations workspace<br><br>Owner access · Firebase protected</div></aside><main class="main"><header class="topbar"><small>Workspace / <strong>${esc(state.section)}</strong>${state.section!=='Overview'?'<span class="kbd">/ to search</span>':''}</small><div class="identity"><div class="avatar">${esc((state.user.displayName || 'A')[0])}</div><div class="email"><strong>${esc(state.user.displayName || 'Administrator')}</strong><small>${esc(state.user.email)}</small></div><button class="secondary" id="logout">Sign out</button></div></header><div class="page-heading ${state.section==='Overview'?'overview-heading':''}"><div><div class="eyebrow">CAMPUS OPERATIONS</div><h1>${state.section==='Overview'?'Your campus, <span>at a glance.</span>':esc(state.section)}</h1><p>${esc(({Overview:'The people and activity behind every pickup.',Users:'Registered accounts across your campus.','Seller requests':'Review canteens before they start accepting orders.',Blocked:'Review restrictions and restore access when appropriate.',Strikes:'Recorded pickup strikes for students and faculty, with current account restrictions.',Canteens:'Registered counters and their current availability.',Orders:'View pickup and payment activity. PINs stay private.',History:'A permanent record of administrative actions.'})[state.section])}</p></div><button class="secondary" id="refresh" ${state.loading?'disabled':''}>${state.loading?'Loading…':'Refresh data'}</button></div>${state.error?`<div class="notice" role="alert">${esc(state.error)}</div>`:''}${state.success?`<div class="notice success" role="status">${esc(state.success)}</div>`:''}<div id="content" aria-busy="${state.loading}"></div></main></div>`;
  document.querySelectorAll('[data-nav]').forEach(button => button.onclick=()=>{state.section=button.dataset.nav;state.filter='all';state.search='';resetPage();load(false);});
  document.querySelector('#logout').onclick=()=>signOut(auth);
  document.querySelector('#refresh').onclick=()=>load();
  renderContent();
  bindOffboarding();
}
const count = async (...constraints) => (await getCountFromServer(query(collection(db,constraints.shift()),...constraints))).data().count;
async function loadCounts() {
  const now = Timestamp.fromMillis(Date.now()-86400000);
  const pairs=await Promise.all([['users',count('users')],['student',count('users',where('userType','==','student'))],['faculty',count('users',where('userType','==','faculty'))],['seller',count('users',where('userType','==','seller'))],['active',count('users',where('lastActiveAt','>=',now))],['pending',count('sellerRequests',where('status','==','PENDING'))],['blocked',count('users',where('banStatus','==','perm_ban'))],['departed',count('users',where('universityStatus','==','LEFT'))],['orders',count('orders',where('orderStatus','in',['Preparing','Ready for Pickup']))]].map(async([key,promise])=>[key,await promise]));
  return Object.fromEntries(pairs);
}
function resetPage(){state.cursor=null;state.previous=[];state.page=1;state.rows=[];state.hasMore=false;}
async function load(force=true){
  const generation=++state.generation;
  if(force)pageCache.clear();
  const key=cacheKey(), cached=pageCache.get(key);
  if(cached && Date.now()-cached.at<60000){Object.assign(state,cached.data);state.loading=false;state.error='';shell();return;}
  state.loading=true;state.error='';shell();
  try {
    if(state.section==='Overview') { const [counts,rows]=await Promise.all([loadCounts(),getDocs(query(collection(db,'sellerRequests'),where('status','==','PENDING'),limit(6)))]);if(generation!==state.generation)return;state.counts=counts;state.rows=rows.docs.map(d=>({...d.data(),id:d.id})); }
    else {let filters=[];
      if(state.section==='Strikes') filters.push(where('unclaimedOrderCount','>',0),where('userType',state.filter==='all'?'in':'==',state.filter==='all'?['student','faculty']:state.filter));if(state.section==='Blocked')filters.push(where('banStatus','in',['temp_ban','perm_ban']));
      if(state.section==='Users'&&state.filter==='LEFT')filters.push(where('universityStatus','==','LEFT'));
      else if(state.section==='Users'&&state.filter!=='all')filters.push(where('userType','==',state.filter));
      if(state.section==='Seller requests'&&state.filter!=='all')filters.push(where('status','==',state.filter));
      if(state.section==='Orders'&&state.filter!=='all')filters.push(where('orderStatus','==',state.filter));
      const sort=state.section==='History'?'createdAt':state.section==='Strikes'?'unclaimedOrderCount':documentId();
      filters.push(orderBy(sort,['History','Strikes'].includes(state.section)?'desc':'asc'));if(state.cursor)filters.push(startAfter(state.cursor));filters.push(limit(51));
      const result=await getDocs(query(collection(db,paths[state.section]),...filters));if(generation!==state.generation)return;state.hasMore=result.docs.length>50;state.rows=result.docs.slice(0,50).map(d=>({...d.data(),id:d.id}));state.last=result.docs[Math.min(49,result.docs.length-1)];
      if(['Users','Blocked'].includes(state.section)) {
        const enriched=await Promise.all(state.rows.map(async row=>{
          if(row.userType!=='seller')return row;
          const [approval,request]=await Promise.all([getDoc(doc(db,'sellerApprovals',row.id)),getDoc(doc(db,'sellerRequests',row.id))]);
          return {...row,sellerApproval:row.universityStatus==='LEFT'?'Left university':approval.data()?.approved===true?'Approved':request.exists()?request.data().status==='REJECTED'?'Rejected':request.data().status==='PENDING'?'Pending':request.data().status==='LEFT_UNIVERSITY'?'Left university':'Not approved':'Not requested'};
        }));
        if(generation!==state.generation)return;state.rows=enriched;
      }
    }
  } catch(error){if(generation!==state.generation)return;state.error=failure(error);state.rows=[];} finally{if(generation===state.generation){state.loading=false;if(!state.error)pageCache.set(key,{at:Date.now(),data:{rows:state.rows,counts:state.counts,hasMore:state.hasMore,last:state.last}});shell();}}
}
function stat(title,value,description,type){return `<article class="stat"><div class="stat-head">${esc(title)}<span class="stat-icon">${icon(type)}</span></div><strong class="${value==null?'sk':''}">${value??'—'}</strong><small>${esc(description)}</small></article>`;}
function renderContent(){
  const content=document.querySelector('#content');
  if(state.section==='Overview'){
    const c=state.counts,total=c.users||0;
    content.innerHTML=`<div class="stats">${stat('Total users',c.users,'All registered accounts','Users')}${stat('Active in 24 hours',c.active,'Recorded app activity','History')}${stat('Registered sellers',c.seller,'Includes pending approval','Canteens')}${stat('Active orders',c.orders,'Preparing or ready for pickup','Orders')}</div><div class="grid"><section class="panel"><div class="panel-heading"><div><h2>Your campus community</h2><p>Account types across the platform</p></div>${badge('Silver Oak University')}</div>${[['Students','student'],['Faculty & staff','faculty'],['Sellers','seller']].map(([label,key])=>`<div class="role-row"><div class="role-line"><span>${label}</span><strong>${c[key]??'—'}</strong></div><div class="track"><div class="fill ${key}" style="width:${total?(c[key]/total*100):0}%"></div></div></div>`).join('')}<p class="list-note">Activity tracking begins with the updated app. This is not a live online count.</p></section><section class="panel"><h2>Needs your attention</h2><div class="quick"><span>Pending seller requests</span><b>${c.pending??'—'}</b></div><div class="quick"><span>Permanent account blocks</span><b>${c.blocked??'—'}</b></div><div class="quick"><span>Left university</span><button class="inline-link" data-open="Users" data-users-filter="LEFT">${c.departed??'—'} · View accounts →</button></div><div class="quick"><span>Seller onboarding</span><button class="inline-link" data-open="Seller requests">Review requests →</button></div></section></div><section class="panel"><div class="panel-heading"><div><h2>Seller approval queue</h2><p>Up to six pending requests</p></div><button class="inline-link" data-open="Seller requests">View all requests →</button></div>${table(state.rows,'Seller requests')}</section>`;
  }else{
    const choices=state.section==='Strikes'?['all','student','faculty']:state.section==='Users'?['all','student','faculty','seller','LEFT']:state.section==='Seller requests'?['all','PENDING','APPROVED','REJECTED','LEFT_UNIVERSITY']:state.section==='Orders'?['all','Preparing','Ready for Pickup','Completed','Cancelled','Abandoned']:[];
    content.innerHTML=`<section class="panel"><div class="toolbar"><input id="search" aria-label="Search current page" placeholder="Search this page…" value="${esc(state.search)}">${choices.length?`<select id="filter" aria-label="Filter records">${choices.map(v=>`<option value="${esc(v)}" ${v===state.filter?'selected':''}>${v==='all'?'All records':v==='LEFT'?'Left university':v==='LEFT_UNIVERSITY'?'Left university':esc(v)}</option>`).join('')}</select>`:''}<button class="secondary" id="export">Export CSV</button></div>${state.section==='Strikes'?'<p class="list-note">Counts come from recorded account strikes. An abandoned order alone does not prove a strike was issued. Unblocking an account does not clear its strike count.</p>':''}<div id="table"></div><div class="pagination"><span>Page ${state.page} · up to 50 records per page</span><div class="actions"><button class="secondary" id="previous" ${state.page===1||state.loading?'disabled':''}>Previous</button><button class="secondary" id="next" ${!state.hasMore||state.loading?'disabled':''}>Next</button></div></div></section>`;
    document.querySelector('#export').onclick=exportCsv;renderTable();document.querySelector('#search').oninput=e=>{state.search=e.target.value;renderTable();};
    const filter=document.querySelector('#filter');if(filter)filter.onchange=e=>{state.filter=e.target.value;resetPage();load();};
    document.querySelector('#next').onclick=()=>{state.previous.push(state.cursor);state.cursor=state.last;state.page++;load();};
    document.querySelector('#previous').onclick=()=>{state.cursor=state.previous.pop();state.page--;load();};
  }
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.section=b.dataset.open;state.filter=b.dataset.usersFilter||'all';resetPage();load(false);});bindActions();
}
function renderTable(){const term=state.search.toLowerCase();const rows=state.rows.filter(r=>(state.section!=='Strikes'||(['student','faculty'].includes(r.userType)&&Number.isSafeInteger(r.unclaimedOrderCount)&&r.unclaimedOrderCount>0))&&[r.name,r.email,r.phone,r.stallName,r.shopName,r.buyerName,r.id,r.status,r.action,r.universityStatus,r.sellerApproval].join(' ').toLowerCase().includes(term));document.querySelector('#table').innerHTML=table(rows,state.section);bindActions();bindOffboarding();}
function table(rows,section){
  if(!rows.length){const empty=({Users:['No matching accounts','Try another search or filter.'],Strikes:['No recorded strikes','Students and faculty with one or more strikes will appear here.'],Blocked:['No blocked accounts','Temporary and permanent blocks will be listed here.'],'Seller requests':['No pending requests','New seller sign-ups will appear here for approval.'],Canteens:['No canteens found','Registered counters will appear here.'],Orders:['No orders yet','Pickup and payment activity will appear here.'],History:['No actions yet','Administrative actions will appear here.']})[section]||['No records','Try another search.'];return `<div class="empty" role="status">${state.loading?'<div class="skel"><i></i><i></i><i></i><i></i></div>':`<strong>${esc(empty[0])}</strong><span>${esc(empty[1])}</span>`}</div>`;}
  const headers=({Strikes:['Account','Role','Recorded strikes','Restriction','Restricted until','Reason'],Users:['Account','Role','Phone','Account status','Seller approval','Last activity','Actions'],Blocked:['Account','Role','Phone','Account status','Seller approval','Last activity','Actions'],'Seller requests':['Canteen','Seller UID','Campus','Status','Actions'],Canteens:['Canteen','Campus','Owner UID','Status','Menu'],Orders:['Order','Customer / canteen','Amount','Order status','Payment','Created'],History:['When','Action','Record','Admin UID','Reason']})[section];
  return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{
    let cells;
    if(section==='Strikes') {
      const recorded=Number.isSafeInteger(r.unclaimedOrderCount)&&r.unclaimedOrderCount>=0;
      const restriction=r.banStatus==='perm_ban'?'Permanently blocked':blocked(r)?'Temporarily blocked':r.banStatus==='temp_ban'?'Block expired':'No active block';
      cells=[who(r),badge(r.userType),recorded?badge(String(r.unclaimedOrderCount),r.unclaimedOrderCount>0?'amber':'green'):badge('Not recorded'),badge(restriction,blocked(r)?'red':'green'),r.banStatus==='perm_ban'?'Permanent':r.banUntil?esc(date(r.banUntil)):'Not applicable',esc(r.banReason||'No reason recorded')];
    }

    if(section==='Users'||section==='Blocked'){
      const left=r.universityStatus==='LEFT';
      const accountStatus=left?'Left university':blocked(r)?r.banStatus:r.banStatus==='temp_ban'?'Expired block':'Active';
      const statusColor=left?'amber':blocked(r)?'red':'green';
      const sellerStatus=r.sellerApproval||'Unknown';
      const accountMenu=r.id===state.user.uid||left?'':menu([
        blocked(r)?action('active','Unblock',r.id):action('temp_ban','Temporary block',r.id)+action('perm_ban','Permanent block',r.id),
        `<button data-offboard="${esc(r.id)}" class="danger">Mark left</button>`
      ],`Actions for ${r.name||r.email||r.id}`,r.id);
      cells=[who(r),badge(r.userType),esc(r.phone||'—'),badge(accountStatus,statusColor)+`<small>${esc(left?r.leftUniversityReason||'':r.banReason||'')}${left&&r.leftUniversityAt?' · '+esc(date(r.leftUniversityAt)):r.banUntil?' · '+esc(date(r.banUntil)):''}</small>`,r.userType==='seller'?badge(sellerStatus,sellerStatus==='Approved'?'green':sellerStatus==='Rejected'?'red':sellerStatus==='Left university'?'amber':'amber'):'Not applicable',esc(date(r.lastActiveAt)),r.id===state.user.uid?'Owner account':left?'Offboarded':accountMenu];
    }
    if(section==='Seller requests')cells=[`<strong>${esc(r.stallName)}</strong><small>${esc(r.location)} · ${esc(r.upiId||'Cash only')}</small>`,esc(r.userId||r.id),esc(r.universityId),badge(r.status,r.status==='APPROVED'?'green':r.status==='REJECTED'?'red':'amber'),r.status==='LEFT_UNIVERSITY'?'Account offboarded':menu([r.status!=='APPROVED'?action('APPROVED','Approve',r.id):'',r.status!=='REJECTED'?action('REJECTED',r.status==='APPROVED'?'Revoke access':'Reject',r.id):''],`Actions for ${r.stallName||r.id}`,r.id)];
    if(section==='Canteens')cells=[`<strong>${esc(r.name)}</strong><small>${esc(r.location)}</small>`,esc(r.universityId),esc(r.ownerId),badge(r.status,r.status==='Open'?'green':''),`${(r.menu||[]).length} dishes`];
    if(section==='Orders')cells=[esc(r.id),`<strong>${esc(r.buyerName)}</strong><small>${esc(r.shopName)}</small>`,money(r.totalAmount),badge(r.orderStatus),`${esc(r.paymentMethod)}<small>${esc(r.paymentStatus)}</small>`,esc(date(r.createdAt))];
    if(section==='History')cells=[esc(date(r.createdAt)),badge(r.action==='LEFT_UNIVERSITY'?'Left university':r.action),`${esc(r.targetType)}<small>${esc(r.targetId)}</small>`,esc(r.actorUid),esc(r.reason)];
    return `<tr>${cells.map(x=>`<td>${x}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function action(kind,label,id){return `<button data-action="${kind}" data-id="${esc(id)}" class="${kind==='perm_ban'||kind==='REJECTED'?'danger':'secondary'}">${esc(label)}</button>`;}
function menu(items,label,id){const actions=items.filter(Boolean);if(!actions.length)return '';const menuId=`row-actions-${String(id).replace(/[^A-Za-z0-9_-]/g,'_')}`;return `<div class="row-menu"><button type="button" class="row-menu-trigger" data-menu-toggle="${esc(menuId)}" aria-label="${esc(label)}" aria-controls="${esc(menuId)}" aria-expanded="false" title="Actions"><span aria-hidden="true">⋮</span></button><div class="row-menu-items" id="${esc(menuId)}" popover>${actions.join('')}</div></div>`;}
let pendingAction=null;
function bindActions(){document.querySelectorAll('[data-menu-toggle]').forEach(button=>{const popover=document.getElementById(button.dataset.menuToggle);if(popover.dataset.toggleBound!=='true'){popover.addEventListener('toggle',event=>button.setAttribute('aria-expanded',event.newState==='open'?'true':'false'));popover.dataset.toggleBound='true';}button.onclick=()=>{if(popover.matches(':popover-open')){popover.hidePopover();return;}document.querySelectorAll('.row-menu-items:popover-open').forEach(open=>open.hidePopover());popover.showPopover();const rect=button.getBoundingClientRect();const bounds=popover.getBoundingClientRect();popover.style.top=`${Math.max(12,Math.min(rect.bottom+6,window.innerHeight-bounds.height-12))}px`;popover.style.left=`${Math.max(12,Math.min(rect.right-bounds.width,window.innerWidth-bounds.width-12))}px`;};});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{b.closest('.row-menu-items')?.hidePopover();pendingAction={action:b.dataset.action,id:b.dataset.id};document.querySelector('#action-title').textContent=b.textContent;document.querySelector('#action-description').textContent=`Apply this action to ${b.dataset.id}? This is recorded in the action history.`;document.querySelector('#reason').value='';document.querySelector('#action-error').textContent='';document.querySelector('#confirm-action').disabled=false;document.querySelector('#duration').hidden=document.querySelector('#duration-label').hidden=b.dataset.action!=='temp_ban';document.querySelector('#action-dialog').showModal();});}
let offboardTarget=null;
const sellerFields=document.querySelector('#seller-offboard-fields');
const sellerActionSelect=document.querySelector('#seller-action');
const successorSelect=document.querySelector('#successor');
function updateSellerOffboardForm(){
  const transferring=sellerActionSelect.value==='transfer';
  document.querySelector('#successor-label').hidden=successorSelect.hidden=!transferring;
  successorSelect.required=transferring;
  document.querySelector('#seller-action-note').textContent=transferring
    ?'The canteen will remain open under the selected approved seller. Existing orders must be resolved first.'
    :'The canteen will be closed. Existing orders must be resolved first.';
}
async function loadSuccessors(target){
  const candidates=await getDocs(query(collection(db,'users'),where('universityId','==',target.universityId),where('userType','==','seller'),where('banStatus','==','active'),limit(100)));
  const eligible=await Promise.all(candidates.docs.filter(candidate=>candidate.id!==target.id&&candidate.data().universityStatus!=='LEFT').map(async candidate=>{
    const approval=await getDoc(doc(db,'sellerApprovals',candidate.id));
    return approval.data()?.approved===true?{id:candidate.id,name:candidate.data().name||candidate.data().stallName||candidate.id,email:candidate.data().email||''}:null;
  }));
  return eligible.filter(Boolean);
}
function bindOffboarding(){
  document.querySelectorAll('[data-offboard]').forEach(button=>button.onclick=async()=>{
    button.closest('.row-menu-items')?.hidePopover();
    offboardTarget=state.rows.find(row=>row.id===button.dataset.offboard);
    if(!offboardTarget)return;
    const dialog=document.querySelector('#offboard-dialog'),submit=document.querySelector('#confirm-offboard');
    const isSeller=offboardTarget.userType==='seller';
    document.querySelector('#offboard-account').textContent=`${offboardTarget.name||'Account'} · ${offboardTarget.email||offboardTarget.id}. Resolve active orders before offboarding.`;
    document.querySelector('#offboard-reason').value='';
    document.querySelector('#offboard-error').textContent='';
    sellerFields.hidden=!isSeller;
    sellerActionSelect.value='close';
    successorSelect.innerHTML='';
    successorSelect.hidden=true;
    document.querySelector('#successor-label').hidden=true;
    submit.disabled=true;
    dialog.showModal();
    try{
      if(isSeller){
        const successors=await loadSuccessors(offboardTarget);
        const transferOption=sellerActionSelect.querySelector('option[value="transfer"]');
        transferOption.hidden=!successors.length;
        successorSelect.innerHTML=successors.map(candidate=>`<option value="${esc(candidate.id)}">${esc(candidate.name)}${candidate.email?` · ${esc(candidate.email)}`:''}</option>`).join('');
      }
      updateSellerOffboardForm();
    }catch(error){document.querySelector('#offboard-error').textContent=failure(error);}
    finally{submit.disabled=false;}
  });
}
sellerActionSelect.onchange=updateSellerOffboardForm;
document.querySelector('#cancel-offboard').onclick=()=>document.querySelector('#offboard-dialog').close();
document.querySelector('#offboard-form').onsubmit=async event=>{
  event.preventDefault();
  if(!offboardTarget)return;
  const reason=document.querySelector('#offboard-reason').value.trim();
  if(!reason)return;
  const submit=document.querySelector('#confirm-offboard');
  submit.disabled=true;
  document.querySelector('#offboard-error').textContent='';
  try{
    const isSeller=offboardTarget.userType==='seller';
    const sellerAction=isSeller?sellerActionSelect.value:undefined;
    await offboardAccount({userId:offboardTarget.id,reason,sellerAction,successorUid:sellerAction==='transfer'?successorSelect.value:undefined});
    document.querySelector('#offboard-dialog').close();
    state.success=`${offboardTarget.name||offboardTarget.email||'Account'} marked as left university. Account history was preserved.`;
    state.section='Users';
    state.filter='all';
    state.search='';
    resetPage();
    await load();
  }catch(error){document.querySelector('#offboard-error').textContent=failure(error);}
  finally{submit.disabled=false;}
};
document.querySelector('#cancel-action').onclick=()=>document.querySelector('#action-dialog').close();
document.querySelector('#action-form').onsubmit=async e=>{
  e.preventDefault();const reason=document.querySelector('#reason').value.trim();if(!reason)return;const selected=pendingAction;const user=state.user;if(!selected||!user)return;
  const button=document.querySelector('#confirm-action');button.disabled=true;
  try{const seller=['APPROVED','REJECTED'].includes(selected.action);const type=seller?'sellerRequests':'users';const target=doc(db,type,selected.id),log=doc(collection(db,'adminAudit'));
    await runTransaction(db,async tx=>{const snapshot=await tx.get(target);if(!snapshot.exists())throw new Error('Record no longer exists. Refresh and try again.');
      if(seller){const profile=await tx.get(doc(db,'users',selected.id));if(!profile.exists()||profile.data().userType!=='seller')throw new Error('A completed seller profile is required.');if(selected.action==='APPROVED'&&blocked(profile.data()))throw new Error('Unblock the seller account before approving it.');
        tx.update(target,{status:selected.action,reviewedBy:user.uid,reviewReason:reason,updatedAt:serverTimestamp(),adminActionId:log.id});tx.set(doc(db,'sellerApprovals',selected.id),{approved:selected.action==='APPROVED',reviewedBy:user.uid,updatedAt:serverTimestamp(),adminActionId:log.id});
      }else tx.update(target,{banStatus:selected.action,banUntil:selected.action==='temp_ban'?Timestamp.fromMillis(Date.now()+Number(document.querySelector('#duration').value)*3600000):null,banReason:reason,updatedAt:serverTimestamp(),adminActionId:log.id});
      tx.set(log,{actorUid:user.uid,targetType:type,targetId:selected.id,action:selected.action,reason,createdAt:serverTimestamp()});
    });document.querySelector('#action-dialog').close();await load();
  }catch(error){document.querySelector('#action-error').textContent=failure(error);}finally{button.disabled=false;}
};
onAuthStateChanged(auth,async user=>{
  ++state.generation;pageCache.clear();document.querySelector('#action-dialog').close();document.querySelector('#offboard-dialog').close();state.user=null;state.rows=[];state.counts={};
  if(!user){login();return;}
  try{if(!user.emailVerified)throw new Error('A verified Google account is required.');const access=await getDoc(doc(db,'admins',user.uid));if(!access.exists()||access.data().enabled!==true){await signOut(auth);login('This account is not an authorized administrator. Use the registered owner account.');return;}state.user=user;state.section='Overview';state.filter='all';resetPage();await load();}catch(error){await signOut(auth);login(failure(error));}
});

function exportCsv(){
  const t=document.querySelector('#table table');if(!t)return;
  const rows=[...t.rows].map(r=>[...r.cells].map(c=>c.innerText.replace(/\s*\n\s*/g,' · ').trim()));
  const last=rows[0]?.[rows[0].length-1]?.toLowerCase();const trim=last==='actions'||last==='menu'&&false;
  const csv=rows.map(r=>(trim?r.slice(0,-1):r).map(v=>`"${(/^[=+\-@]/.test(v)?"'"+v:v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`skipq-${state.section.toLowerCase().replace(/\s+/g,'-')}-p${state.page}.csv`;a.click();URL.revokeObjectURL(a.href);
}
document.addEventListener('keydown',e=>{const el=document.activeElement;if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(el?.tagName)){const s=document.querySelector('#search');if(s){e.preventDefault();s.focus();}}});