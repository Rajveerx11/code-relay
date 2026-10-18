// Test-only Chrome API bridge; never referenced by the manifest or production popup; not web-accessible.
window.chrome={
 tabs:{query:async()=>[{id:1,url:parent.location.href}]},
 permissions:{contains:async()=>true,request:async()=>true},
 scripting:{executeScript:async({func,args})=>[parent.executeForTest(func,args)]},
};
Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>{if(parent.clipboardFails)throw Error('test permission denied');return parent.sampleCode;}}});
