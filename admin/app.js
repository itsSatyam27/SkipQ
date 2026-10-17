import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, query, where, orderBy, documentId, limit, startAfter, getCountFromServer, runTransaction, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebase = initializeApp(window.SKIPQ_FIREBASE_CONFIG);
const auth = getAuth(firebase), db = getFirestore(firebase), root = document.querySelector('#app');
const state = { user:null, section:'Overview', rows:[], cursor:null, previous:[], page:1, hasMore:false, filter:'all', search:'', counts:{}, loading:false, error:'', generation:0 };
const paths = {Overview:'sellerRequests',Users:'users','Seller requests':'sellerRequests',Blocked:'users',Canteens:'canteens',Orders:'orders',History:'adminAudit'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({Overview:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',Users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>','Seller requests':'<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9h18M9 21v-7h6v7"/>',Blocked:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',Canteens:'<path d="M4 9v12h16V9M3 9l2-6h14l2 6M3 9h18M9 21v-7h6v7"/>',Orders:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',History:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'})[name] || '<path d="M4 12h16M12 4v16"/>'}</svg>`;
const date = value => value?.toDate ? value.toDate().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
const blocked = row => row.banStatus === 'perm_ban' || (row.banStatus === 'temp_ban' && row.banUntil?.toMillis() > Date.now());
const badge = (text, color='') => `<span class="badge ${color}">${esc(text || 'Unknown')}</span>`;
const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value || 0));
const failure = error => error.code === 'permission-denied' ? 'Access denied. Check the published admin rules and your admin account.' : error.message || 'Could not load data. Try again.';

function login(message='') {
  root.innerHTML = `<main class="login"><div class="brand">${icon('Overview')}<span>SkipQ Admin</span></div><div class="eyebrow">CAMPUS OPERATIONS</div><h1>A clearer view of your campus.</h1><p>Manage seller requests, accounts and canteens from one secure workspace.</p>${message?`<p class="error" role="alert">${esc(message)}</p>`:''}<button id="login">Continue with Google</button><small>Access is limited to authorized administrators. Your student, faculty or seller account does not grant admin access.</small></main>`;
  document.querySelector('#login').onclick = async () => { try { const provider = new GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'}); await signInWithPopup(auth,provider); } catch(error) { login(failure(error)); } };
}
function shell() {
  root.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand">${icon('Overview')}<span>SkipQ<span style="color:#6f8bab;font-size:11px;margin-left:8px">ADMIN</span></span></div><div class="workspace-label">WORKSPACE</div><nav class="nav" aria-label="Admin sections">${Object.keys(paths).map(name=>`<button data-nav="${esc(name)}" class="${state.section===name?'active':''}" ${state.section===name?'aria-current="page"':''}>${icon(name)}${esc(name)}</button>`).join('')}</nav><div class="sidebar-footer">Silver Oak University<br>Campus operations workspace<br><br>Owner access · Firebase protected</div></aside><main class="main"><header class="topbar"><small>Workspace / <strong>${esc(state.section)}</strong></small><div class="identity"><div class="avatar">${esc((state.user.displayName || 'A')[0])}</div><div class="email"><strong>${esc(state.user.displayName || 'Administrator')}</strong><small>${esc(state.user.email)}</small></div><button class="secondary" id="logout">Sign out</button></div></header><div class="page-heading"><div><div class="eyebrow">CAMPUS OPERATIONS</div><h1>${state.section==='Overview'?'Your campus, at a glance.':esc(state.section)}</h1><p>${esc(({Overview:'The people and activity behind every pickup.',Users:'Registered accounts across your campus.','Seller requests':'Review canteens before they start accepting orders.',Blocked:'Review restrictions and restore access when appropriate.',Canteens:'Registered counters and their current availability.',Orders:'View pickup and payment activity. PINs stay private.',History:'A permanent record of administrative actions.'})[state.section])}</p></div><button class="secondary" id="refresh" ${state.loading?'disabled':''}>${state.loading?'Loading…':'Refresh data'}</button></div>${state.error?`<div class="notice" role="alert">${esc(state.error)}</div>`:''}<div id="content" aria-busy="${state.loading}"></div></main></div>`;
  document.querySelectorAll('[data-nav]').forEach(button => button.onclick=()=>{state.section=button.dataset.nav;state.filter='all';state.search='';resetPage();load();});
  document.querySelector('#logout').onclick=()=>signOut(auth);
  document.querySelector('#refresh').onclick=()=>load();
  renderContent();
}
const count = async (...constraints) => (await getCountFromServer(query(collection(db,constraints.shift()),...constraints))).data().count;
async function loadCounts() {
  const now = Timestamp.fromMillis(Date.now()-86400000);
  const pairs=await Promise.all([['users',count('users')],['student',count('users',where('userType','==','student'))],['faculty',count('users',where('userType','==','faculty'))],['seller',count('users',where('userType','==','seller'))],['active',count('users',where('lastActiveAt','>=',now))],['pending',count('sellerRequests',where('status','==','PENDING'))],['blocked',count('users',where('banStatus','==','perm_ban'))],['orders',count('orders',where('orderStatus','in',['Preparing','Ready for Pickup']))]].map(async([key,promise])=>[key,await promise]));
  return Object.fromEntries(pairs);
}
function resetPage(){state.cursor=null;state.previous=[];state.page=1;}
async function load(){
  const generation=++state.generation;state.loading=true;state.error='';shell();
  try {
    if(state.section==='Overview') { const [counts,rows]=await Promise.all([loadCounts(),getDocs(query(collection(db,'sellerRequests'),where('status','==','PENDING'),limit(6)))]);if(generation!==state.generation)return;state.counts=counts;state.rows=rows.docs.map(d=>({...d.data(),id:d.id})); }
    else {let filters=[];if(state.section==='Blocked')filters.push(where('banStatus','in',['temp_ban','perm_ban']));
      if(state.section==='Users'&&state.filter!=='all')filters.push(where('userType','==',state.filter));
      if(state.section==='Seller requests'&&state.filter!=='all')filters.push(where('status','==',state.filter));
      if(state.section==='Orders'&&state.filter!=='all')filters.push(where('orderStatus','==',state.filter));
      const sort=state.section==='History'?'createdAt':documentId();
      filters.push(orderBy(sort,state.section==='History'?'desc':'asc'));if(state.cursor)filters.push(startAfter(state.cursor));filters.push(limit(51));
      const result=await getDocs(query(collection(db,paths[state.section]),...filters));if(generation!==state.generation)return;state.hasMore=result.docs.length>50;state.rows=result.docs.slice(0,50).map(d=>({...d.data(),id:d.id}));state.last=result.docs[Math.min(49,result.docs.length-1)]; }
  } catch(error){if(generation!==state.generation)return;state.error=failure(error);state.rows=[];} finally{if(generation===state.generation){state.loading=false;shell();}}
}
function stat(title,value,description,type){return `<article class="stat"><div class="stat-head">${esc(title)}<span class="stat-icon">${icon(type)}</span></div><strong>${value??'—'}</strong><small>${esc(description)}</small></article>`;}
function renderContent(){
  const content=document.querySelector('#content');
  if(state.section==='Overview'){
    const c=state.counts,total=c.users||0;
    content.innerHTML=`<div class="stats">${stat('Total users',c.users,'All registered accounts','Users')}${stat('Active in 24 hours',c.active,'Recorded app activity','History')}${stat('Registered sellers',c.seller,'Includes pending approval','Canteens')}${stat('Active orders',c.orders,'Preparing or ready for pickup','Orders')}</div><div class="grid"><section class="panel"><div class="panel-heading"><div><h2>Your campus community</h2><p>Account types across the platform</p></div>${badge('Silver Oak University')}</div>${[['Students','student'],['Faculty & staff','faculty'],['Sellers','seller']].map(([label,key])=>`<div class="role-row"><div class="role-line"><span>${label}</span><strong>${c[key]??'—'}</strong></div><div class="track"><div class="fill ${key}" style="width:${total?(c[key]/total*100):0}%"></div></div></div>`).join('')}<p class="list-note">Activity tracking begins with the updated app. This is not a live online count.</p></section><section class="panel"><h2>Needs your attention</h2><div class="quick"><span>Pending seller requests</span><b>${c.pending??'—'}</b></div><div class="quick"><span>Permanent account blocks</span><b>${c.blocked??'—'}</b></div><div class="quick"><span>Seller onboarding</span><button class="inline-link" data-open="Seller requests">Review requests →</button></div></section></div><section class="panel"><div class="panel-heading"><div><h2>Seller approval queue</h2><p>Up to six pending requests</p></div><button class="inline-link" data-open="Seller requests">View all requests →</button></div>${table(state.rows,'Seller requests')}</section>`;
  }else{
    const choices=state.section==='Users'?['all','student','faculty','seller']:state.section==='Seller requests'?['all','PENDING','APPROVED','REJECTED']:state.section==='Orders'?['all','Preparing','Ready for Pickup','Completed','Cancelled','Abandoned']:[];
    content.innerHTML=`<section class="panel"><div class="toolbar"><input id="search" aria-label="Search current page" placeholder="Search this page…" value="${esc(state.search)}">${choices.length?`<select id="filter" aria-label="Filter records">${choices.map(v=>`<option value="${esc(v)}" ${v===state.filter?'selected':''}>${v==='all'?'All records':esc(v)}</option>`).join('')}</select>`:''}</div><div id="table"></div><div class="pagination"><span>Page ${state.page} · up to 50 records per page</span><div class="actions"><button class="secondary" id="previous" ${state.page===1||state.loading?'disabled':''}>Previous</button><button class="secondary" id="next" ${!state.hasMore||state.loading?'disabled':''}>Next</button></div></div></section>`;
    renderTable();document.querySelector('#search').oninput=e=>{state.search=e.target.value;renderTable();};
    const filter=document.querySelector('#filter');if(filter)filter.onchange=e=>{state.filter=e.target.value;resetPage();load();};
    document.querySelector('#next').onclick=()=>{state.previous.push(state.cursor);state.cursor=state.last;state.page++;load();};
    document.querySelector('#previous').onclick=()=>{state.cursor=state.previous.pop();state.page--;load();};
  }
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.section=b.dataset.open;state.filter='all';resetPage();load();});bindActions();
}
function renderTable(){const term=state.search.toLowerCase();const rows=state.rows.filter(r=>[r.name,r.email,r.phone,r.stallName,r.shopName,r.buyerName,r.id,r.status,r.action].join(' ').toLowerCase().includes(term));document.querySelector('#table').innerHTML=table(rows,state.section);bindActions();}
function table(rows,section){
  if(!rows.length)return `<div class="empty">${state.loading?'Loading records…':'No records to display.'}</div>`;
  const headers=({Users:['Account','Role','Phone','Status','Last activity','Actions'],Blocked:['Account','Role','Phone','Status','Last activity','Actions'],'Seller requests':['Canteen','Seller UID','Campus','Status','Actions'],Canteens:['Canteen','Campus','Owner UID','Status','Menu'],Orders:['Order','Customer / canteen','Amount','Order status','Payment','Created'],History:['When','Action','Record','Admin UID','Reason']})[section];
  return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{
    let cells;
    if(section==='Users'||section==='Blocked')cells=[`<strong>${esc(r.name||'Unnamed')}</strong><small>${esc(r.email)}</small>`,badge(r.userType),esc(r.phone||'—'),badge(blocked(r)?r.banStatus:r.banStatus==='temp_ban'?'Expired block':'Active',blocked(r)?'red':'green')+`<small>${esc(r.banReason||'')}${r.banUntil?' · '+esc(date(r.banUntil)):''}</small>`,esc(date(r.lastActiveAt)),r.id===state.user.uid?'Owner account':`<div class="actions">${blocked(r)?action('active','Unblock',r.id):action('temp_ban','Temporary block',r.id)+action('perm_ban','Permanent block',r.id)}</div>`];
    if(section==='Seller requests')cells=[`<strong>${esc(r.stallName)}</strong><small>${esc(r.location)} · ${esc(r.upiId||'Cash only')}</small>`,esc(r.userId||r.id),esc(r.universityId),badge(r.status,r.status==='APPROVED'?'green':r.status==='REJECTED'?'red':'amber'),`<div class="actions">${r.status!=='APPROVED'?action('APPROVED','Approve',r.id):''}${r.status!=='REJECTED'?action('REJECTED',r.status==='APPROVED'?'Revoke access':'Reject',r.id):''}</div>`];
    if(section==='Canteens')cells=[`<strong>${esc(r.name)}</strong><small>${esc(r.location)}</small>`,esc(r.universityId),esc(r.ownerId),badge(r.status,r.status==='Open'?'green':''),`${(r.menu||[]).length} dishes`];
    if(section==='Orders')cells=[esc(r.id),`<strong>${esc(r.buyerName)}</strong><small>${esc(r.shopName)}</small>`,money(r.totalAmount),badge(r.orderStatus),`${esc(r.paymentMethod)}<small>${esc(r.paymentStatus)}</small>`,esc(date(r.createdAt))];
    if(section==='History')cells=[esc(date(r.createdAt)),badge(r.action),`${esc(r.targetType)}<small>${esc(r.targetId)}</small>`,esc(r.actorUid),esc(r.reason)];
    return `<tr>${cells.map(x=>`<td>${x}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function action(kind,label,id){return `<button data-action="${kind}" data-id="${esc(id)}" class="${kind==='perm_ban'||kind==='REJECTED'?'danger':'secondary'}">${esc(label)}</button>`;}
let pendingAction=null;
function bindActions(){document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{pendingAction={action:b.dataset.action,id:b.dataset.id};document.querySelector('#action-title').textContent=b.textContent;document.querySelector('#action-description').textContent=`Apply this action to ${b.dataset.id}? This is recorded in the action history.`;document.querySelector('#reason').value='';document.querySelector('#action-error').textContent='';document.querySelector('#confirm-action').disabled=false;document.querySelector('#duration').hidden=document.querySelector('#duration-label').hidden=b.dataset.action!=='temp_ban';document.querySelector('#action-dialog').showModal();});}
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
  ++state.generation;document.querySelector('#action-dialog').close();state.user=null;state.rows=[];state.counts={};
  if(!user){login();return;}
  try{if(!user.emailVerified)throw new Error('A verified Google account is required.');const access=await getDoc(doc(db,'admins',user.uid));if(!access.exists()||access.data().enabled!==true){await signOut(auth);login('This account is not an authorized administrator. Use the registered owner account.');return;}state.user=user;state.section='Overview';state.filter='all';resetPage();await load();}catch(error){await signOut(auth);login(failure(error));}
});
