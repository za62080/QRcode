'use strict';
const $=id=>document.getElementById(id);
const ui={browser:$('browserStatus'),permission:$('permissionStatus'),count:$('countStatus'),notice:$('notice'),camera:$('cameraBtn'),latest:$('latestResult'),copy:$('copyBtn'),body:$('historyBody'),clear:$('clearBtn'),csv:$('csvBtn'),encPassword:$('encPassword'),encPassword2:$('encPassword2'),encryptShare:$('encryptShareBtn'),encryptSave:$('encryptSaveBtn'),continuousRegistration:$('continuousRegistration'),allowDuplicates:$('allowDuplicates'),autoClear:$('autoClear'),accept:$('acceptBtn'),pendingStatus:$('pendingStatus'),userProfile:$('userProfile'),profileName:$('profileName'),addProfile:$('addProfile'),deleteProfile:$('deleteProfile'),pauseSeconds:$('pauseSeconds')};
let scanner=null,scanning=false,historyItems=[],lastAcceptedAt=0,pending=null,pendingTimer=null,lastDetected='',lastDetectedAt=0;
const SETTINGS_KEY='qr-secure-settings-v2';
const PROFILES_KEY='qr-secure-user-profiles-v1';
let profiles=[];
function readProfiles(){try{const v=JSON.parse(localStorage.getItem(PROFILES_KEY)||'[]');profiles=Array.isArray(v)?v.filter(x=>x&&typeof x.name==='string'&&Number.isFinite(x.seconds)).slice(0,10):[];}catch{profiles=[];}renderProfiles();}
function renderProfiles(){ui.userProfile.replaceChildren(new Option('ゲスト','guest'),...profiles.map(x=>new Option(x.name,x.name)));ui.userProfile.value='guest';ui.pauseSeconds.value='1.8';ui.deleteProfile.disabled=true;}
function selectProfile(){const name=ui.userProfile.value;const p=profiles.find(x=>x.name===name);ui.pauseSeconds.value=p?String(p.seconds):'1.8';ui.deleteProfile.disabled=!p;}
function pauseDuration(){const n=Number(ui.pauseSeconds.value);return Number.isFinite(n)?Math.max(0.3,Math.min(60,n)):1.8;}
function storeDuration(){const n=pauseDuration();ui.pauseSeconds.value=String(n);const p=profiles.find(x=>x.name===ui.userProfile.value);if(p){p.seconds=n;localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));}}
ui.userProfile.onchange=()=>{cancelPending();selectProfile();};
ui.pauseSeconds.onchange=storeDuration;
ui.addProfile.onclick=()=>{const name=ui.profileName.value.trim();if(!name){message('ユーザー名を入力してください。');return;}if(name==='ゲスト'||profiles.some(x=>x.name===name)){message('そのユーザー名は使用できません。');return;}if(profiles.length>=10){message('登録できるユーザーは最大10人です。');return;}profiles.push({name,seconds:1.8});localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));renderProfiles();ui.userProfile.value=name;selectProfile();ui.profileName.value='';};
ui.deleteProfile.onclick=()=>{const name=ui.userProfile.value;if(name==='guest')return;if(!confirm(name+' を削除しますか？'))return;profiles=profiles.filter(x=>x.name!==name);localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));renderProfiles();};
function message(s){ui.notice.textContent=s;}
function browserName(){const u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/CriOS/.test(u))return'Chrome (iOS)';if(/Chrome\//.test(u))return'Chrome';if(/Safari\//.test(u))return'Safari';return'その他';}
function checkSupport(){const ok=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);ui.browser.textContent=ok?`${browserName()} / 対応`:`${browserName()} / 非対応`;if(!window.isSecureContext||!ok)ui.camera.disabled=true;}
async function checkPermission(){try{const p=await navigator.permissions.query({name:'camera'});ui.permission.textContent=({granted:'許可済み',denied:'拒否',prompt:'未許可'})[p.state]||p.state;}catch{ui.permission.textContent='起動時に確認';}}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');ui.allowDuplicates.checked=!!s.allowDuplicates;ui.continuousRegistration.checked=!!s.continuousRegistration;ui.autoClear.checked=s.autoClear!==false;}catch{}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify({continuousRegistration:ui.continuousRegistration.checked,allowDuplicates:ui.allowDuplicates.checked,autoClear:ui.autoClear.checked}));}
function updateCameraButton(){ui.camera.textContent=scanning?'カメラ停止':'カメラ起動';ui.camera.classList.toggle('camera-on',scanning);ui.camera.classList.toggle('camera-off',!scanning);}
async function startCamera(){if(scanning)return;if(typeof Html5Qrcode==='undefined'){message('QRライブラリを読み込めませんでした。');return;}
 try{scanner=scanner||new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>{const z=Math.floor(Math.min(w,h)*.7);return{width:z,height:z};}},onScan,()=>{});scanning=true;updateCameraButton();ui.permission.textContent='許可済み';message('QRコードを枠内に映してください。');}
 catch(e){message('カメラを起動できません。権限・HTTPSを確認してください。');}}
async function stopCamera(){cancelPending();if(scanner&&scanning){await scanner.stop().catch(()=>{});scanning=false;}updateCameraButton();}
function cancelPending(){if(pendingTimer)clearTimeout(pendingTimer);pendingTimer=null;pending=null;ui.accept.disabled=true;ui.latest.value='';ui.pendingStatus.textContent='次のQRコードを待っています';}
function onScan(text){
 if(pending)return;
 if(!ui.allowDuplicates.checked&&historyItems.some(x=>x.value===text))return;
 const now=Date.now();if(text===lastDetected&&now-lastDetectedAt<1900)return;
 lastDetected=text;lastDetectedAt=now;
 if(ui.continuousRegistration.checked){commit({value:text,time:new Date(now)});return;}
 pending={value:text,time:new Date(now)};
 ui.latest.value=text;ui.accept.disabled=false;ui.pendingStatus.textContent=`${pauseDuration()}秒以内に「保存」を押してください`; 
 // 停止中はスキャン解析を受け付けず、表示中の映像も静止させる。
 const video=document.querySelector('#reader video');if(video)video.pause();
 pendingTimer=setTimeout(()=>{cancelPending();if(scanning){const v=document.querySelector('#reader video');if(v)v.play().catch(()=>{});}},Math.round(pauseDuration()*1000));
}
function commit(item){
 if(!ui.allowDuplicates.checked&&historyItems.some(x=>x.value===item.value)){message('登録済みのQRです。');return;}
 const id=historyItems.length?Math.max(...historyItems.map(x=>x.id))+1:1;
 historyItems.push({id,...item});lastAcceptedAt=Date.now();render();
 message(`保存しました：${historyItems.length}件`);if(navigator.vibrate)navigator.vibrate(80);
}
function resolvePending(){if(!pending)return;const item=pending;cancelPending();commit(item);if(scanning){const v=document.querySelector('#reader video');if(v)v.play().catch(()=>{});}}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d);}
function render(){ui.count.textContent=`${historyItems.length}件`;const has=historyItems.length>0;[ui.clear,ui.csv,ui.encryptShare,ui.encryptSave].forEach(b=>b.disabled=!has);ui.copy.disabled=!ui.latest.value;if(!has){ui.body.innerHTML='<tr class="empty"><td colspan="4">まだデータがありません</td></tr>';return;}ui.body.replaceChildren(...historyItems.map((x,i)=>{const tr=document.createElement('tr');[x.id,x.value,formatDate(x.time)].forEach((v,j)=>{const td=document.createElement('td');td.textContent=v;if(j===1)td.className='data';tr.appendChild(td);});const td=document.createElement('td'),b=document.createElement('button');b.textContent='削除';b.className='delete-row';b.onclick=()=>{historyItems.splice(i,1);render();};td.appendChild(b);tr.appendChild(td);return tr;}));}
function csvCell(v){return '"'+String(v).replace(/"/g,'""')+'"';}
function csvContent(){return '\uFEFF識別番号,QRコードデータ,読取日時\r\n'+historyItems.map(x=>[x.id,x.value,formatDate(x.time)].map(csvCell).join(',')).join('\r\n');}
function downloadCsv(){const f=new File([csvContent()],`qr-data-${new Date().toISOString().slice(0,10)}.csv`,{type:'text/csv;charset=utf-8'});saveBlobFile(f);message('3項目CSVを保存しました。');}
const te=new TextEncoder();function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);}function receiverUrl(){return new URL('../receiver/',location.href).href;}
async function deriveAesKey(p,salt,it){const base=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:it},base,{name:'AES-GCM',length:256},false,['encrypt']);}
async function makeEncryptedFile(){const p=ui.encPassword.value;if(p.length<10)throw new Error('暗号化パスワードは10文字以上にしてください。');if(p!==ui.encPassword2.value)throw new Error('確認用パスワードが一致しません。');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000,key=await deriveAesKey(p,salt,iterations),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,te.encode(csvContent()))),env={format:'QRSECURE',version:1,kdf:'PBKDF2-SHA-256',iterations,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};return new File([JSON.stringify(env)],`qr-secure-${new Date().toISOString().replace(/[:.]/g,'-')}.qrenc`,{type:'application/octet-stream'});}
function saveBlobFile(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function encryptAndSave(){try{const f=await makeEncryptedFile();saveBlobFile(f);message(`暗号化ファイル「${f.name}」を保存しました。通常は端末のダウンロードにあります。Yahoo!メールではこのファイルを添付してください。`);}catch(e){message(e.message||'暗号化できませんでした。');}}
async function encryptAndShare(){try{const f=await makeEncryptedFile();if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({title:'暗号化QRデータ',text:`QR Secure暗号化データです。復号ページ: ${receiverUrl()}\nパスワードは別経路で共有します。`,files:[f]});message('共有先へ暗号化ファイルを渡しました。実際のメール送信は共有先アプリで行ってください。');}else{saveBlobFile(f);message('この端末では .qrenc の直接共有に対応していません。ファイルを保存しました。Yahoo!メールから手動で添付してください。');}}catch(e){if(e?.name!=='AbortError')message(e.message||'共有できませんでした。');}}
async function copyLatest(){try{await navigator.clipboard.writeText(ui.latest.value);message('コピーしました。');}catch{}}
ui.camera.onclick=()=>scanning?stopCamera():startCamera();ui.copy.onclick=copyLatest;ui.csv.onclick=downloadCsv;ui.encryptSave.onclick=encryptAndSave;ui.encryptShare.onclick=encryptAndShare;ui.accept.onclick=resolvePending;ui.allowDuplicates.onchange=saveSettings;ui.continuousRegistration.onchange=()=>{saveSettings();if(ui.continuousRegistration.checked&&pending)resolvePending();};ui.autoClear.onchange=saveSettings;ui.clear.onclick=()=>{if(confirm('読み取り履歴をすべて削除しますか？')){historyItems=[];cancelPending();lastAcceptedAt=0,pending=null,lastDetected='',lastDetectedAt=0;render();message('履歴を削除しました。');}};
const r=$('receiverUrl');if(r)r.textContent=receiverUrl();loadSettings();readProfiles();checkSupport();checkPermission();render();updateCameraButton();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));
