'use strict';
const $=id=>document.getElementById(id),fileEl=$('file'),passEl=$('password'),btn=$('decrypt'),notice=$('notice'),result=$('result'),save=$('save'),clear=$('clear'),info=$('fileInfo');
let csv='',filename='decrypted-qr-data.csv',selectedFile=null;const td=new TextDecoder();
function msg(s){notice.textContent=s;} function fromB64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function setFile(f){selectedFile=f;info.textContent=f?`${f.name} (${Math.ceil(f.size/1024)} KB)`:'ファイル未選択';btn.disabled=!f;csv='';result.value='';save.disabled=true;clear.disabled=true;msg('');}
fileEl.addEventListener('change',()=>setFile(fileEl.files[0]));
const dz=$('dropZone');['dragenter','dragover'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.add('over');}));['dragleave','drop'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.remove('over');}));dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)setFile(f);});
async function decryptFile(){try{
 const f=selectedFile||fileEl.files[0];if(!f)throw new Error('暗号化ファイルを選択してください。');const p=passEl.value;if(!p)throw new Error('パスワードを入力してください。');
 let e;try{e=JSON.parse(await f.text());}catch{throw new Error('暗号化ファイルの形式が正しくありません。');}
 if(e.format!=='QRSECURE'||e.version!==1||e.kdf!=='PBKDF2-SHA-256'||e.cipher!=='AES-256-GCM')throw new Error('対応していない暗号化ファイルです。');
 if(!Number.isInteger(e.iterations)||e.iterations<100000||e.iterations>2000000)throw new Error('暗号化パラメータが不正です。');
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:fromB64(e.salt),iterations:e.iterations},base,{name:'AES-GCM',length:256},false,['decrypt']);
 let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(e.iv),tagLength:128},key,fromB64(e.data));}catch{throw new Error('復号できません。パスワードが違うか、ファイルが破損・改ざんされています。');}
 csv=td.decode(plain);result.value=csv;filename=f.name.replace(/\.qrenc$/i,'')+'.csv';save.disabled=false;clear.disabled=false;msg('復号に成功しました。内容を確認してCSV保存できます。');
}catch(e){csv='';result.value='';save.disabled=true;msg(e.message||'復号できませんでした。');}}
btn.addEventListener('click',decryptFile);
save.addEventListener('click',()=>{if(!csv)return;const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('復号したCSVを保存しました。');});
clear.addEventListener('click',()=>{csv='';result.value='';passEl.value='';fileEl.value='';selectedFile=null;info.textContent='ファイル未選択';btn.disabled=true;save.disabled=true;clear.disabled=true;msg('復号データを画面から消去しました。');});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(()=>{}));}
