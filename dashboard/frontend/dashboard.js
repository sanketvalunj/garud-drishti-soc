const API="http://127.0.0.1:8000";

let prev=[];
let loading=false;

/* CLOCK */
function updateClock(){
 document.getElementById("clock").innerText=
 new Date().toLocaleTimeString();
}
setInterval(updateClock,1000);updateClock();

function updateTimestamp(){
 document.getElementById("updated").innerText=
 "Last updated: "+new Date().toLocaleTimeString();
}

/* RUN PIPELINE */
async function runPipeline(){
 try{
   const btn = event.target;
   if(btn){ btn.innerText="Running..."; }

   await fetch(`${API}/generate-playbooks-live`,{method:"POST"});

   if(btn){ btn.innerText="Run SOC Pipeline"; }

   loadData();
 }catch(e){
   console.log("pipeline failed");
 }
}

/* LOAD DATA */
async function loadData(){

 if(loading) return;
 loading=true;

 try{
   const inc=await fetch(`${API}/incidents`);
   const pb=await fetch(`${API}/playbooks`);
   const auto=await fetch(`${API}/automation`);

   render(
     (await inc.json()).incidents||[],
     (await pb.json()).playbooks||[],
     await auto.json()||[]
   );

 }catch(e){
   console.log("backend not reachable");
 }

 loading=false;
 updateTimestamp();
}

/* MAIN RENDER */
function render(incidents,playbooks,automation){

/* timestamp safety */
incidents.forEach(i=>{
 if(!i.timestamp) i.timestamp = Date.now();
});

/* KPI UPDATE */
document.getElementById("k1").innerText=incidents.length;
document.getElementById("k2").innerText=incidents.filter(i=>i.severity!="low").length;
document.getElementById("k3").innerText=incidents.filter(i=>i.severity=="high").length;
document.getElementById("k4").innerText=
automation.reduce((a,b)=>a+(b.actions_executed?.length||0),0);

/* INCIDENT LIST */
const box=document.getElementById("incidents");
box.innerHTML="";

incidents.forEach(i=>{

 const pb = playbooks.find(p=>p.incident_id===i.incident_id);

 let steps="";

 if(pb && pb.playbook?.steps){
   steps="<div class='playbook'><b>Playbook</b><ul>";
   pb.playbook.steps.forEach(s=>steps+=`<li>${s}</li>`);
   steps+="</ul></div>";
 }

 const div=document.createElement("div");
 div.className="incident "+i.severity;

 div.innerHTML=`<b>${i.incident_id}</b><br>
 <small>${i.summary||"Suspicious activity"}</small>
 <div class="risk"><div class="fill ${i.severity}" style="width:${(i.risk_score||0)*100}%"></div></div>
 ${steps}`;

 div.onclick=()=>div.classList.toggle("open");
 box.appendChild(div);
});

/* TIMELINE */
if(typeof renderTimeline==="function"){
 renderTimeline(incidents);
}

/* AUTOMATION PANEL */
const autoBox=document.getElementById("automation");
if(autoBox){
 autoBox.innerHTML="";

 automation.forEach(r=>{
   let html=`<div class="node"><b>${r.incident_id}</b><br>`;
   (r.actions_executed||[]).forEach(a=>{
     html+=`${a.action} → ${a.target} (${a.status})<br>`;
   });
   html+="</div>";
   autoBox.innerHTML+=html;
 });
}

/* DONUT */
drawDonut(incidents);

/* MITRE */
if(typeof renderMitre==="function"){
 renderMitre(incidents);
}

/* GRAPH */
if(typeof renderGraph==="function"){
 renderGraph(incidents);
}

}

/* DONUT CHART */
function drawDonut(inc){

let h=0,m=0,l=0;

inc.forEach(i=>{
 if(i.severity=="high")h++;
 else if(i.severity=="medium")m++;
 else l++;
});

const canvas=document.getElementById("donut");
if(!canvas) return;

const ctx=canvas.getContext("2d");
ctx.clearRect(0,0,200,200);

const data=[h,m,l];
const colors=["#f87171","#fbbf24","#34d399"];

let start=-Math.PI/2;
let total=h+m+l||1;

data.forEach((v,i)=>{
 const angle=(v/total)*Math.PI*2;
 ctx.beginPath();
 ctx.moveTo(100,100);
 ctx.arc(100,100,80,start,start+angle);
 ctx.fillStyle=colors[i];
 ctx.fill();
 start+=angle;
});

}

/* MITRE RENDER */
function renderMitre(incidents){

 const map=document.getElementById("mitre-map");
 if(!map) return;

 map.innerHTML="";

 if(!incidents.length){
   map.innerHTML="<small>No ATT&CK mapping yet</small>";
   return;
 }

 const grouped={};

 incidents.forEach(i=>{
   if(!i.mitre) return;

   i.mitre.forEach(m=>{
     if(!grouped[m.tactic]) grouped[m.tactic]=[];
     grouped[m.tactic].push(m.technique);
   });
 });

 Object.keys(grouped).forEach(tactic=>{
   const div=document.createElement("div");
   div.className="mitre-card";

   let techHTML="";
   grouped[tactic].forEach(t=>{
      techHTML+=`<div class="mitre-tech">• ${t}</div>`;
   });

   div.innerHTML=`<h5>${tactic}</h5>${techHTML}`;
   map.appendChild(div);
 });
}

/* GRAPH RENDER */
function renderGraph(incidents){

 const canvas=document.getElementById("attackGraph");
 if(!canvas) return;

 const ctx=canvas.getContext("2d");
 ctx.clearRect(0,0,canvas.width,canvas.height);

 const graphIncident = incidents.find(i=>i.graph);
 if(!graphIncident) return;

 const graph=graphIncident.graph;
 const nodes=graph.nodes||[];
 const edges=graph.edges||[];

 if(!nodes.length) return;

 const centerX=canvas.width/2;
 const centerY=canvas.height/2;
 const radius=90;

 const positions={};

 nodes.forEach((n,i)=>{
   const angle=(i/nodes.length)*Math.PI*2;
   positions[n]={
     x:centerX+Math.cos(angle)*radius,
     y:centerY+Math.sin(angle)*radius
   };
 });

 ctx.strokeStyle="#38bdf8";
 ctx.lineWidth=1.6;

 edges.forEach(e=>{
   const a=positions[e.from];
   const b=positions[e.to];
   if(!a||!b) return;

   ctx.beginPath();
   ctx.moveTo(a.x,a.y);
   ctx.lineTo(b.x,b.y);
   ctx.stroke();
 });

 nodes.forEach(n=>{
   const p=positions[n];

   ctx.beginPath();
   ctx.arc(p.x,p.y,14,0,Math.PI*2);
   ctx.fillStyle="#0f172a";
   ctx.fill();
   ctx.strokeStyle="#38bdf8";
   ctx.stroke();

   ctx.fillStyle="#e6edf7";
   ctx.font="12px Inter";
   ctx.textAlign="center";
   ctx.fillText(n,p.x,p.y+4);
 });
}

/* INITIAL LOAD */
loadData();
setInterval(loadData,10000);