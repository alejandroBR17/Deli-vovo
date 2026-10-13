let pending:Promise<void>|undefined;
export function reportAppInstallation() {
 if(pending)return pending;
 pending=(async()=>{
  try {
   if(localStorage.getItem('vovoh_install_reported_v1'))return;
   let sessionId=localStorage.getItem('vovoh_browser_session_id');
   if(!sessionId){sessionId='session-'+crypto.randomUUID();localStorage.setItem('vovoh_browser_session_id',sessionId);}
   const response=await fetch('/api/visits/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId}),signal:AbortSignal.timeout(10000)});
   if(response.ok)localStorage.setItem('vovoh_install_reported_v1','true');
  } catch { /* Retry on the next installed-app opening or online event. */ }
 })().finally(()=>{pending=undefined;});
 return pending;
}
