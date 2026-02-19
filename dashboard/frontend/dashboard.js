const API="http://localhost:9000";

async function loadDashboard(){

    let health = await fetch(API+"/health").then(r=>r.json());

    document.getElementById("content").innerHTML=`
      <div class="card">
        <h3>Backend Status: ${health.status}</h3>
      </div>
    `;
}

async function loadIncidents(){

    let data = await fetch(API+"/incidents").then(r=>r.json());

    if(!data.length){
        document.getElementById("content").innerHTML=
        `<div class="card">No incidents yet</div>`;
        return;
    }

    let html="";

    data.forEach(i=>{
        html+=`
        <div class="card">
          <h3>${i.summary}</h3>
          <span class="badge ${i.severity}">${i.severity}</span>
          <p><b>Risk:</b> ${i.risk_score}</p>
          <p>${i.story}</p>
          <button onclick="showTimeline('${i.incident_id}')">View Timeline</button>
        </div>
        `;
    });

    document.getElementById("content").innerHTML=html;
}

async function loadPlaybooks(){

    let data = await fetch(API+"/playbooks").then(r=>r.json());

    if(!data.length){
        document.getElementById("content").innerHTML=
        `<div class="card">No playbooks generated</div>`;
        return;
    }

    let html="";

    data.forEach(p=>{
        html+=`
        <div class="card">
          <h3>Playbook</h3>
          <pre>${JSON.stringify(p,null,2)}</pre>
        </div>
        `;
    });

    document.getElementById("content").innerHTML=html;
}

async function runPipeline(){
    let r = await fetch(API+"/run",{method:"POST"}).then(r=>r.json());
    alert("Pipeline triggered");
}
