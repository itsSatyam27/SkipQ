// Trusted local operator utility. Firebase CLI credentials stay in memory.
const {getGlobalDefaultAccount,getAccessToken}=require('firebase-tools/lib/auth');
async function main(){
  const [project,email,apply]=process.argv.slice(2);
  if(!project||!email||!email.includes('@'))throw new Error('Usage: node scripts/bootstrap-admin.cjs PROJECT OWNER_EMAIL [--apply]');
  const account=getGlobalDefaultAccount();if(!account)throw new Error('Run firebase login first.');
  const token=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
  const request=async(url,method,body)=>{const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(`Firebase admin request failed (${response.status}). Check operator project permissions.`);return response.json();};
  const result=await request(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:lookup`,'POST',{email:[email.toLowerCase()]});
  const user=result.users?.find(u=>u.email?.toLowerCase()===email.toLowerCase());
  if(!user||!user.emailVerified||user.disabled||!user.providerUserInfo?.some(p=>p.providerId==='google.com'))throw new Error('Owner must first sign in with Google to this Firebase project and have a verified, enabled account.');
  if(apply!=='--apply'){console.log(`Verified owner account found: ${user.localId}. Re-run with --apply to grant admin access.`);return;}
  await request(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/admins/${encodeURIComponent(user.localId)}`,'PATCH',{fields:{enabled:{booleanValue:true},email:{stringValue:email.toLowerCase()},role:{stringValue:'owner'}}});
  console.log('Owner admin access configured.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
