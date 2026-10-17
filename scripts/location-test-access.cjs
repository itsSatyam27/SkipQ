// Trusted local operator utility; credentials never leave Google's project APIs.
const {getGlobalDefaultAccount,getAccessToken}=require('firebase-tools/lib/auth');
async function main(){
  const [project,email,mode]=process.argv.slice(2);
  if(!project||!email)throw new Error('Usage: node scripts/location-test-access.cjs PROJECT EMAIL [--apply|--revoke]');
  const account=getGlobalDefaultAccount();if(!account)throw new Error('Sign into Firebase CLI first.');
  const token=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
  const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:lookup`,{method:'POST',headers,body:JSON.stringify({email:[email.toLowerCase()]})});
  if(!response.ok)throw new Error(`Account lookup failed (${response.status}).`);
  const user=(await response.json()).users?.find(u=>u.email?.toLowerCase()===email.toLowerCase());
  if(!user||!user.emailVerified||user.disabled)throw new Error('An existing verified enabled account is required.');
  if(!['--apply','--revoke'].includes(mode)){console.log('Test account verified. Use --apply for 24 hours or --revoke.');return;}
  const expiresAt=new Date(Date.now()+(mode==='--apply'?86400000:0)).toISOString();
  const result=await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/locationTestAccess/${encodeURIComponent(user.localId)}`,{method:'PATCH',headers,body:JSON.stringify({fields:{enabled:{booleanValue:mode==='--apply'},expiresAt:{timestampValue:expiresAt}}})});
  if(!result.ok)throw new Error(`Test grant write failed (${result.status}).`);
  console.log(mode==='--apply'?`Location test access enabled until ${expiresAt}`:'Location test access revoked.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
