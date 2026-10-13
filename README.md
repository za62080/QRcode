'use strict';
const $=id=>document.getElementById(id);
const ui={browser:$('browserStatus'),permission:$('permissionStatus'),count:$('countStatus'),notice:$('notice'),camera:$('cameraBtn'),latest:$('latestResult'),copy:$('copyBtn'),body:$('historyBody'),clear:$('clearBtn'),csv:$('csvBtn'),encPassword:$('encPassword'),encPassword2:$('encPassword2'),encryptShare:$('encryptShareBtn'),encryptSave:$('encryptSaveBtn'),continuousRegistration:$('continuousRegistration'),allowDuplicates:$('allowDuplicates'),autoClear:$('autoClear'),accept:$('acceptBtn'),pendingStatus:$('pendingStatus'),userProfile:$('userProfile'),releaseFreeze:$('releaseFreezeBtn'),pauseSeconds:$('pauseSeconds')};
let scanner=null,scanning=false,historyItems=[],lastAcceptedAt=0,pending=null,pendingTimer=null,lastDetected='',lastDetectedAt=0;
const SETTINGS_KEY='qr-secure-settings-v2';
const PROFILES_KEY='qr-secure-user-profiles-v1';
let profiles=[];
function readProfiles(){try{const v=JSON.parse(localStorage.getItem(PROFILES_KEY)||'[]');profiles=Array.isArray(v)?v.filter(x=>x&&typeof x.name==='string'&&Number.isFinite(x.seconds)).slice(0,10):[];}catch{profiles=[];}renderProfiles();}
function renderProfiles(){ui.userProfile.replaceChildren(new Option('ゲスト','guest'),...profiles.map(x=>new Option(x.name,x.name)));ui.userProfile.value='guest';ui.pauseSeconds.value='10';}
function selectProfile(){const name=ui.userProfile.value;const p=profiles.find(x=>x.name===name);ui.pauseSeconds.value=p?String(p.seconds):'10';}
function pauseDuration(){const n=Number(ui.pauseSeconds.value);return Number.isFinite(n)?Math.max(0.3,Math.min(60,n)):10;}
function storeDuration(){const n=pauseDuration();ui.pauseSeconds.value=String(n);const p=profiles.find(x=>x.name===ui.userProfile.value);if(p){p.seconds=n;localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));}}
ui.userProfile.onchange=()=>{cancelPending();selectProfile();};
ui.pauseSeconds.onchange=storeDuration;
function message(s){ui.notice.textContent=s;}
function browserName(){const u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/CriOS/.test(u))return'Chrome (iOS)';if(/Chrome\//.test(u))return'Chrome';if(/Safari\//.test(u))return'Safari';return'その他';}
function checkSupport(){const ok=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);if(!window.isSecureContext||!ok)ui.camera.disabled=true;}
async function checkPermission(){try{const p=await navigator.permissions.query({name:'camera'});}catch{}}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');ui.allowDuplicates.checked=!!s.allowDuplicates;ui.continuousRegistration.checked=!!s.continuousRegistration;ui.autoClear.checked=s.autoClear!==false;}catch{}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify({continuousRegistration:ui.continuousRegistration.checked,allowDuplicates:ui.allowDuplicates.checked,autoClear:ui.autoClear.checked}));}
function updateCameraButton(){ui.camera.textContent=scanning?'カメラ停止':'カメラ起動';ui.camera.classList.toggle('camera-on',scanning);ui.camera.classList.toggle('camera-off',!scanning);}
async function startCamera(){if(scanning)return;if(typeof Html5Qrcode==='undefined'){message('QRライブラリを読み込めませんでした。');return;}
 try{scanner=scanner||new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>{const z=Math.floor(Math.min(w,h)*.7);return{width:z,height:z};}},onScan,()=>{});scanning=true;updateCameraButton();}
 catch(e){message('カメラを起動できません。権限・HTTPSを確認してください。');}}
async function stopCamera(){cancelPending();if(scanner&&scanning){await scanner.stop().catch(()=>{});scanning=false;}updateCameraButton();}
function cancelPending(){if(pendingTimer)clearTimeout(pendingTimer);pendingTimer=null;pending=null;ui.accept.disabled=true;ui.releaseFreeze.disabled=true;ui.latest.value='';}
function onScan(text){
 if(pending)return;
 if(!(ui.allowDuplicates.checked&&ui.continuousRegistration.checked)&&historyItems.some(x=>x.value===text))return;
 const now=Date.now();if(text===lastDetected&&now-lastDetectedAt<1900)return;
 lastDetected=text;lastDetectedAt=now;
 if(ui.continuousRegistration.checked){commit({value:text,time:new Date(now)});return;}
 pending={value:text,time:new Date(now)};
 ui.latest.value=text;ui.accept.disabled=ui.continuousRegistration.checked;ui.releaseFreeze.disabled=ui.continuousRegistration.checked; 
 // 停止中はスキャン解析を受け付けず、表示中の映像も静止させる。
 const video=document.querySelector('#reader video');if(video)video.pause();
 pendingTimer=setTimeout(()=>{cancelPending();if(scanning){const v=document.querySelector('#reader video');if(v)v.play().catch(()=>{});}},Math.round(pauseDuration()*1000));
}
function commit(item){
 if(!(ui.allowDuplicates.checked&&ui.continuousRegistration.checked)&&historyItems.some(x=>x.value===item.value)){message('登録済みのQRです。');return;}
 const id=historyItems.length?Math.max(...historyItems.map(x=>x.id))+1:1;
 historyItems.push({id,...item});lastAcceptedAt=Date.now();render();
 message(`保存しました：${historyItems.length}件`);if(navigator.vibrate)navigator.vibrate(80);
}
function releaseFreeze(){if(!pending)return;cancelPending();if(scanning){const v=document.querySelector('#reader video');if(v)v.play().catch(()=>{});}message('保存せずに読み取りを再開しました。');}
function resolvePending(){if(!pending)return;const item=pending;cancelPending();commit(item);if(scanning){const v=document.querySelector('#reader video');if(v)v.play().catch(()=>{});}}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d);}
function render(){const has=historyItems.length>0;[ui.clear,ui.csv,ui.encryptShare,ui.encryptSave].forEach(b=>b.disabled=!has);if(!has){ui.body.innerHTML='<tr class="empty"><td colspan="4">まだデータがありません</td></tr>';return;}ui.body.replaceChildren(...historyItems.map((x,i)=>{const tr=document.createElement('tr');[x.id,x.value,formatDate(x.time)].forEach((v,j)=>{const td=document.createElement('td');td.textContent=v;if(j===1)td.className='data';tr.appendChild(td);});const td=document.createElement('td'),b=document.createElement('button');b.textContent='削除';b.className='delete-row';b.onclick=()=>{historyItems.splice(i,1);render();};td.appendChild(b);tr.appendChild(td);return tr;}));}
function csvCell(v){return '"'+String(v).replace(/"/g,'""')+'"';}
function csvContent(){return '\uFEFF識別番号,QRコードデータ,読取日時\r\n'+historyItems.map(x=>[x.id,x.value,formatDate(x.time)].map(csvCell).join(',')).join('\r\n');}
function downloadCsv(){const f=new File([csvContent()],`qr-data-${new Date().toISOString().slice(0,10)}.csv`,{type:'text/csv;charset=utf-8'});saveBlobFile(f);showDownloadLocation('csvLocation',f.name);message('CSVのダウンロードを開始しました。');}
const te=new TextEncoder();function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);}function receiverUrl(){return new URL('../receiver/',location.href).href;}
async function deriveAesKey(p,salt,it){const base=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:it},base,{name:'AES-GCM',length:256},false,['encrypt']);}
async function makeEncryptedFile(){const p=ui.encPassword.value;if(p.length<10)throw new Error('暗号化パスワードは10文字以上にしてください。');if(p!==ui.encPassword2.value)throw new Error('確認用パスワードが一致しません。');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000,key=await deriveAesKey(p,salt,iterations),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,te.encode(csvContent()))),env={format:'QRSECURE',version:1,kdf:'PBKDF2-SHA-256',iterations,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};return new File([JSON.stringify(env)],`qr-secure-${new Date().toISOString().replace(/[:.]/g,'-')}.qrenc`,{type:'application/octet-stream'});}
function saveBlobFile(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function showDownloadLocation(id,name){
 const el=$(id);
 if(el)el.textContent=`ファイル名：${name} ／ 保存先：通常は端末の「ダウンロード」フォルダー（正確な保存場所はブラウザのダウンロード履歴で確認してください）`;
}
async function encryptAndSave(){try{const f=await makeEncryptedFile();saveBlobFile(f);showDownloadLocation('encryptedLocation',f.name);message('暗号化ファイルのダウンロードを開始しました。');}catch(e){message(e.message||'暗号化できませんでした。');}}
async function encryptAndShare(){
 const label=$('shareEmailLabel'),address=$('shareEmail'),help=$('shareHelp');
 label.hidden=false;
 if(!address.value.trim()){help.textContent='送信先メールアドレスを入力後、もう一度「② 暗号化ファイルを共有」を押してください。';address.focus();return;}
 if(!address.checkValidity()){help.textContent='有効なメールアドレスを入力してください。';address.focus();return;}
 const recipient=address.value.trim();
 try{
  const f=await makeEncryptedFile();
  const shareText=`送信先メールアドレス：${recipient}\\nQR Secure暗号化データです。\\n復号ページ：${receiverUrl()}\\nパスワードは別経路で共有してください。`;
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){
   await navigator.share({title:`暗号化QRデータ（宛先：${recipient}）`,text:shareText,files:[f]});
   help.textContent=`共有画面へ渡しました。宛先 ${recipient} は本文に記載されています。メールアプリの宛先欄は送信前に確認してください。`;
  }else{
   saveBlobFile(f);showDownloadLocation('encryptedLocation',f.name);
   help.textContent=`ファイルをダウンロードしました。メールアプリで ${recipient} 宛にファイルを添付して送信してください。`;
  }
 }catch(e){if(e?.name!=='AbortError')help.textContent=e.message||'共有できませんでした。';}
}
async function copyLatest(){try{await navigator.clipboard.writeText(ui.latest.value);message('コピーしました。');}catch{}}
ui.camera.onclick=()=>scanning?stopCamera():startCamera();
$('exitAppBtn').onclick=async()=>{
 if(!confirm('アプリのカメラを停止し、終了画面に移りますか？'))return;
 await stopCamera();
 document.querySelector('main').innerHTML='<section class="panel" style="text-align:center"><h1>アプリを終了しました</h1><p>カメラを停止しました。このタブを閉じてください。</p><button type="button" onclick="location.reload()">再起動</button></section>';
 window.close();
};ui.csv.onclick=downloadCsv;ui.encryptSave.onclick=encryptAndSave;ui.encryptShare.onclick=encryptAndShare;ui.accept.onclick=resolvePending;ui.releaseFreeze.onclick=releaseFreeze;ui.allowDuplicates.onchange=()=>{saveSettings();if(pending)releaseFreeze();};ui.continuousRegistration.onchange=()=>{saveSettings();if(pending){releaseFreeze();}ui.accept.disabled=true;ui.releaseFreeze.disabled=true;};ui.autoClear.onchange=saveSettings;ui.clear.onclick=()=>{if(confirm('読み取り履歴をすべて削除しますか？')){historyItems=[];cancelPending();lastAcceptedAt=0,pending=null,lastDetected='',lastDetectedAt=0;render();message('履歴を削除しました。');}};
const r=$('receiverUrl');if(r)r.textContent=receiverUrl();loadSettings();readProfiles();checkSupport();checkPermission();render();updateCameraButton();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));
