// 10003_fastload.js 
// v 2
// 2023-Nov-19 12:51:08

(()=>{if(!localStorage||!localStorage.getItem){return;}
let s={"WTNKdmJtbHpkR0V1WTI5dA==":18,"YVc1bWIzUmxZMmh1YjJ4dloza3VZMjl0":18,18:{p:18,v:[35,36,37,38,39],vt:[34]}}
let l=window.top.document.location;let pv=function(p,i,e){ps="00000"+p;ps=ps.substring(ps.length-5);vs="000000"+i;vs=vs.substring(vs.length-6);let vf="v0";if((/Mobi|Android/i.test(navigator.userAgent))||window.top.innerHeight<800){vf="v1";}
let f=ps+"/"+ps+"_"+vs+"/"+vf+"."+e;let u="https://s1.adzonestatic.com/stream2/"+f;gt(f,u);}
let gt=function(f,u){let w=Math.round(new Date().getTime()/1000/60/60/24/7);if(!localStorage.getItem("az-cache_"+f)||localStorage.getItem("az-cache_"+f)!=w||l.href.includes("az-cache")){localStorage.setItem("az-cache_"+f,w);fetch(u);}}
let u="https://s1.adzonestatic.com/c/10003_video-itt-fs-tag9.js?14";gt("tag",u);let d=l.hostname.replace("www.","");let is_safari=function(){let l=['iPad','iPhone','iPod','iPad','iOS','Mac'];for(let i in l){if(navigator.userAgent.includes(l[i])){return true;}}
return false;}
let di=s[btoa(btoa(d))];if(di){d=s[di];let p=d.p;let v=d.v;let vt=d.vt;for(let i in v){pv(p,v[i],"mp4");}
for(let i in vt){pv(p,vt[i],is_safari?"mp4":"webm");}}})()