window.MoldCloud=(()=>{
 const $=s=>document.querySelector(s);
 const cfg=window.MOLDFLOW_CONFIG||{},enabled=Boolean(cfg.supabaseUrl&&cfg.supabaseKey);
 let session=JSON.parse(localStorage.getItem('moldflowSession')||'null'),timer=null;
 const auth=$('#authBackdrop'),error=$('#authError'),status=$('#syncStatus');
 const headers=()=>({'Content-Type':'application/json','apikey':cfg.supabaseKey,'Authorization':`Bearer ${session?.access_token||cfg.supabaseKey}`});
 const setStatus=(text,state='')=>{status.textContent=text;status.className=`sync-status ${state}`};
 async function request(path,options={}){let r=await fetch(cfg.supabaseUrl+path,{...options,headers:{...headers(),...(options.headers||{})}});let body=await r.text(),json=body?JSON.parse(body):null;if(!r.ok)throw new Error(json?.msg||json?.message||json?.error_description||'Erreur réseau');return json}
 async function login(email,password,signup=false){error.textContent='';try{let path=signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password';session=await request(path,{method:'POST',body:JSON.stringify({email,password})});if(!session.access_token&&signup){error.textContent='Consultez votre e-mail pour confirmer le compte.';return}localStorage.setItem('moldflowSession',JSON.stringify(session));auth.classList.remove('open');setStatus('Connecté au cloud','online');let remote=await pull();window.dispatchEvent(new CustomEvent('moldflow-cloud-ready',{detail:remote}))}catch(e){error.textContent=e.message}}
 async function pull(){if(!enabled||!session)return null;try{let rows=await request('/rest/v1/moldflow_state?select=data&limit=1');setStatus('Synchronisé','online');return rows?.[0]?.data||null}catch(e){setStatus('Erreur de synchronisation','error');return null}}
 async function push(payload){if(!enabled||!session)return;clearTimeout(timer);timer=setTimeout(async()=>{try{setStatus('Synchronisation…');await request('/rest/v1/moldflow_state',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify({user_id:session.user.id,data:payload,updated_at:new Date().toISOString()})});setStatus('Synchronisé','online')}catch(e){setStatus('Hors connexion · sauvegarde locale','error')}},500)}
 function showLogin(){auth.classList.add('open')}
 async function start(localData){if(!enabled){setStatus('Mode local · cloud non configuré');return localData}if(!session){showLogin();return localData}let remote=await pull();return remote||localData}
 $('#authForm').onsubmit=e=>{e.preventDefault();let f=new FormData(e.target);login(f.get('email'),f.get('password'),false)};
 $('#signupBtn').onclick=()=>{let f=new FormData($('#authForm'));login(f.get('email'),f.get('password'),true)};
 $('#localModeBtn').onclick=()=>auth.classList.remove('open');
 return{start,push,showLogin,enabled};
})();
