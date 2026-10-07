'use strict';
const $=id=>document.getElementById(id);
const ui={
  browser:$('browserStatus'),permission:$('permissionStatus'),count:$('countStatus'),notice:$('notice'),
  start:$('startBtn'),stop:$('stopBtn'),latest:$('latestResult'),copy:$('copyBtn'),body:$('historyBody'),
  clear:$('clearBtn'),csv:$('csvBtn'),txt:$('txtBtn'),email:$('emailTo'),sms:$('smsTo'),
  subject:$('mailSubject'),employee:$('employeeName'),device:$('deviceName'),autoClear:$('autoClear'),
  saveSettings:$('saveSettingsBtn'),mail:$('mailBtn'),smsBtn:$('smsBtn'),share:$('shareBtn'),
  encPassword:$('encPassword'),encPassword2:$('encPassword2'),encryptShare:$('encryptShareBtn'),encryptSave:$('encryptSaveBtn')
};
const SETTINGS_KEY='qr-reader-send-settings-v1';
let scanner=null, scanning=false, historyItems=[], lastValue='', lastAt=0, pendingExternalSend=false;

function browserName(){const u=navigator.userAgent;if(/Edg\//.test(u))return'Edge';if(/CriOS/.test(u))return'Chrome (iOS)';if(/Chrome\//.test(u))return'Chrome';if(/FxiOS/.test(u))return'Firefox (iOS)';if(/Firefox\//.test(u))return'Firefox';if(/Safari\//.test(u))return'Safari';return'その他';}
function checkSupport(){const ok=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);ui.browser.textContent=ok?`${browserName()} / 対応`:`${browserName()} / 非対応`;if(!window.isSecureContext){message('安全な接続ではありません。スマホのカメラ利用にはHTTPSで開いてください。');ui.start.disabled=true;}else if(!ok){message('このブラウザはカメラAPIに対応していません。iPhoneはSafari、AndroidはChrome最新版を推奨します。');ui.start.disabled=true;}}
async function checkPermission(){if(!navigator.permissions){ui.permission.textContent='起動時に確認';return;}try{const p=await navigator.permissions.query({name:'camera'});const show=()=>ui.permission.textContent=({granted:'許可済み',denied:'拒否',prompt:'未許可'})[p.state]||p.state;show();p.onchange=show;}catch{ui.permission.textContent='起動時に確認';}}
function message(s){ui.notice.textContent=s;}

function loadSettings(){try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');ui.email.value=s.email||'';ui.sms.value=s.sms||'';ui.subject.value=s.subject||'QRコード読取データ';ui.employee.value=s.employee||'';ui.device.value=s.device||'';ui.autoClear.checked=s.autoClear!==false;}catch{ui.subject.value='QRコード読取データ';}}
function saveSettings(){const email=ui.email.value.trim(),sms=ui.sms.value.trim(),subject=ui.subject.value.trim()||'QRコード読取データ',employee=ui.employee.value.trim(),device=ui.device.value.trim();if(email&&!ui.email.checkValidity()){message('メールアドレスの形式を確認してください。');ui.email.focus();return false;}localStorage.setItem(SETTINGS_KEY,JSON.stringify({email,sms,subject,employee,device,autoClear:ui.autoClear.checked}));message('送信設定をこの端末に保存しました。');return true;}

async function startCamera(){if(scanning)return;if(typeof Html5Qrcode==='undefined'){message('QRライブラリを読み込めませんでした。インターネット接続を確認してください。');return;}try{scanner=scanner||new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>{const s=Math.floor(Math.min(w,h)*.7);return{width:s,height:s};}},onScan,()=>{});scanning=true;ui.start.disabled=true;ui.stop.disabled=false;ui.permission.textContent='許可済み';message('QRコードを枠内に映してください。連続読み取りできます。');}catch(e){ui.permission.textContent='利用不可';message('カメラを起動できません。カメラ権限・HTTPS・他アプリでのカメラ使用を確認してください。');console.error(e);}}
async function stopCamera(){if(!scanner||!scanning)return;try{await scanner.stop();}catch(e){console.error(e);}scanning=false;ui.start.disabled=false;ui.stop.disabled=true;message('カメラを停止しました。');}
function onScan(text){const now=Date.now();if(text===lastValue&&now-lastAt<2000)return;lastValue=text;lastAt=now;historyItems.push({time:new Date(),value:text});ui.latest.value=text;render();message(`読み取り成功：${historyItems.length}件保存中`);if(navigator.vibrate)navigator.vibrate(80);}
function render(){ui.count.textContent=`${historyItems.length}件`;const has=historyItems.length>0;ui.copy.disabled=!ui.latest.value;[ui.clear,ui.csv,ui.txt,ui.mail,ui.smsBtn,ui.share,ui.encryptShare,ui.encryptSave].forEach(b=>b.disabled=!has);if(!has){ui.body.innerHTML='<tr class="empty"><td colspan="4">まだデータがありません</td></tr>';return;}ui.body.replaceChildren(...historyItems.map((item,i)=>{const tr=document.createElement('tr');[String(i+1),formatDate(item.time),item.value].forEach((v,j)=>{const td=document.createElement('td');td.textContent=v;if(j===2)td.className='data';tr.appendChild(td);});const td=document.createElement('td');const b=document.createElement('button');b.textContent='削除';b.className='delete-row';b.addEventListener('click',()=>{historyItems.splice(i,1);if(!historyItems.length)ui.latest.value='';render();});td.appendChild(b);tr.appendChild(td);return tr;}));}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d);}
function buildMessage(){const lines=['QRコード読取データ',`社員名: ${ui.employee.value.trim()||'未設定'}`,`端末名: ${ui.device.value.trim()||'未設定'}`,`読取件数: ${historyItems.length}件`,''];historyItems.forEach((x,i)=>{lines.push(`${i+1}. ${x.value}`);lines.push(`   読取日時: ${formatDate(x.time)}`);});return lines.join('\r\n');}
function csvContent(){return '\uFEFF'+'社員名,端末名,No.,日時,データ\r\n'+historyItems.map((x,i)=>[ui.employee.value.trim(),ui.device.value.trim(),i+1,formatDate(x.time),x.value].map(csvCell).join(',')).join('\r\n');}
function csvFile(){return new File([csvContent()],`qr-history-${new Date().toISOString().slice(0,10)}.csv`,{type:'text/csv;charset=utf-8'});}
function clearAfterSendConfirm(){if(!ui.autoClear.checked||!historyItems.length)return;if(confirm('送信操作は完了しましたか？\n読み取り履歴をクリアしますか？')){historyItems=[];ui.latest.value='';render();message('送信後の読み取り履歴をクリアしました。');}}
function markExternalSend(){pendingExternalSend=true;}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pendingExternalSend){pendingExternalSend=false;setTimeout(clearAfterSendConfirm,250);}});
async function copyLatest(){try{await navigator.clipboard.writeText(ui.latest.value);message('最新の読み取り結果をコピーしました。');}catch{ui.latest.select();document.execCommand('copy');message('最新の読み取り結果をコピーしました。');}}
function csvCell(v){return '"'+String(v).replace(/"/g,'""')+'"';}
function download(type){if(!historyItems.length)return;let content,mime,ext;if(type==='csv'){content=csvContent();mime='text/csv;charset=utf-8';ext='csv';}else{content=historyItems.map((x,i)=>`${i+1}\t${formatDate(x.time)}\t${x.value}`).join('\r\n');mime='text/plain;charset=utf-8';ext='txt';}const blob=new Blob([content],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`qr-history-${new Date().toISOString().slice(0,10)}.${ext}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);message(`${ext.toUpperCase()}ファイルを出力しました。`);}

function sendMail(){if(!historyItems.length)return;if(!saveSettings())return;const to=ui.email.value.trim();if(!to){message('送信先メールアドレスを設定してください。');ui.email.focus();return;}const subject=ui.subject.value.trim()||'QRコード読取データ';const href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildMessage())}`;markExternalSend();window.location.href=href;}
function sendSms(){if(!historyItems.length)return;saveSettings();const to=ui.sms.value.trim();if(!to){message('SMS送信先電話番号を設定してください。');ui.sms.focus();return;}const body=encodeURIComponent(buildMessage());const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);markExternalSend();window.location.href=`sms:${encodeURIComponent(to)}${isiOS?'&':'?'}body=${body}`;}
async function shareData(){if(!historyItems.length)return;saveSettings();const file=csvFile();const base={title:ui.subject.value.trim()||'QRコード読取データ',text:buildMessage()};try{
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({...base,files:[file]});message('CSVファイルを添付して共有しました。');clearAfterSendConfirm();}
  else if(navigator.share){await navigator.share(base);message('この端末ではCSV添付共有に対応していないため、本文を共有しました。');clearAfterSendConfirm();}
  else{download('csv');message('共有機能に未対応のためCSVを保存しました。');}
}catch(e){if(e&&e.name!=='AbortError')message('共有できませんでした。CSV出力をご利用ください。');}}


const te=new TextEncoder();
function receiverUrl(){return new URL('../receiver/',location.href).href;}
const receiverUrlEl=document.getElementById('receiverUrl');if(receiverUrlEl)receiverUrlEl.textContent=receiverUrl();
function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);}
async function deriveAesKey(password,salt,iterations){
  const base=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},base,{name:'AES-GCM',length:256},false,['encrypt']);
}
async function makeEncryptedFile(){
  if(!window.crypto||!crypto.subtle)throw new Error('Web Crypto APIに対応していません');
  const p=ui.encPassword.value,p2=ui.encPassword2.value;
  if(p.length<10)throw new Error('暗号化パスワードは10文字以上にしてください。');
  if(p!==p2)throw new Error('確認用パスワードが一致しません。');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000;
  const key=await deriveAesKey(p,salt,iterations);
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,te.encode(csvContent())));
  const envelope={format:'QRSECURE',version:1,kdf:'PBKDF2-SHA-256',iterations,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};
  return new File([JSON.stringify(envelope)],`qr-secure-${new Date().toISOString().replace(/[:.]/g,'-')}.qrenc`,{type:'application/octet-stream'});
}
async function encryptAndShare(){
  try{
    const file=await makeEncryptedFile();
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({title:'暗号化QRデータ',text:`暗号化されたQRデータです。\n\n復号ページ：${receiverUrl()}\n\n添付の .qrenc ファイルを保存し、上記ページで選択して復号してください。\nパスワードは別経路で共有します。`,files:[file]});
      message('暗号化ファイルを共有しました。');clearAfterSendConfirm();
    }else{saveBlobFile(file);message('この端末ではファイル共有に未対応のため、暗号化ファイルを保存しました。');}
  }catch(e){if(e&&e.name!=='AbortError')message(e.message||'暗号化できませんでした。');}
}
async function encryptAndSave(){try{saveBlobFile(await makeEncryptedFile());message('暗号化ファイルを保存しました。');}catch(e){message(e.message||'暗号化できませんでした。');}}
function saveBlobFile(file){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}

ui.start.addEventListener('click',startCamera);ui.stop.addEventListener('click',stopCamera);ui.copy.addEventListener('click',copyLatest);
ui.csv.addEventListener('click',()=>download('csv'));ui.txt.addEventListener('click',()=>download('txt'));ui.saveSettings.addEventListener('click',saveSettings);ui.autoClear.addEventListener('change',saveSettings);
ui.mail.addEventListener('click',sendMail);ui.encryptShare.addEventListener('click',encryptAndShare);ui.encryptSave.addEventListener('click',encryptAndSave);ui.smsBtn.addEventListener('click',sendSms);ui.share.addEventListener('click',shareData);
ui.clear.addEventListener('click',()=>{if(confirm('読み取り履歴をすべて削除しますか？')){historyItems=[];ui.latest.value='';render();message('履歴を削除しました。');}});
window.addEventListener('pagehide',()=>{if(scanner&&scanning)scanner.stop().catch(()=>{});});
loadSettings();checkSupport();checkPermission();render();

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));}
