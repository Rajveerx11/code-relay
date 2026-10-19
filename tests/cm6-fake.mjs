// Deliberately small API fake; real library coverage lives in cm6-browser.mjs.
export function cm6Fake({link='cmView',lineBreak='\n'}={}) {
 const element=cls=>({id:'',isConnected:true,classList:{contains:value=>value===cls},getClientRects:()=>[{width:400,height:200}],
  getAttribute:name=>cls==='cm-content' && name==='contenteditable'?'true':null,
  get isContentEditable(){return this.getAttribute('contenteditable')?.toLowerCase()==='true';},
  hasAttribute:()=>false,matches:()=>false,closest:()=>wrapper,contains:node=>node===content});
 const wrapper=element('cm-editor'),content=element('cm-content');
 wrapper.querySelectorAll=()=>[content];wrapper.querySelector=()=>content;
 const text=value=>({length:value.length,toString:()=>value});
 class View {
  static editable={};
  static findFromDOM=()=>view;
  constructor(){this.dom=wrapper;this.contentDOM=content;this.writes=0;this.set('abcXYZdef',6,3);}
  set(value,anchor=6,head=3){this.state={doc:text(value),readOnly:false,lineBreak,toText:value=>text(value.split(lineBreak).join('\n')),
   facet:()=>true,selection:{ranges:[{from:Math.min(anchor,head),to:Math.max(anchor,head),anchor,head}]}};}
  dispatch(spec){this.writes++;const r=this.state.selection.ranges[0];
   let value=this.state.doc.toString();
   if(spec.changes){const {from,to,insert}=spec.changes;value=value.slice(0,from)+insert.toString()+value.slice(to);}
   this.set(value,spec.selection?.anchor??r.anchor,spec.selection?.head??spec.selection?.anchor??r.head);
  }
 }
 let view=new View();
 const attach=()=>{if(link==='cmView')content.cmView={rootView:{view}};else content.cmTile={root:{view}};};attach();
 return {wrapper,content,get view(){return view;},replaceOwner(){view=new View();attach();},
  document:{title:'Practice',querySelector:()=>null,querySelectorAll:selector=>selector==='iframe, frame'?[]:selector.includes('.cm-editor')?[wrapper]:[]}};
}
