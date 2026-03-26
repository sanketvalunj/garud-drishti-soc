async function loadDashboard(){

    let health = await fetch(API+"/health").then(r=>r.json());

    document.getElementById("content").innerHTML=`
      <div class="card">
        <h3>Backend Status: ${health.status}</h3>
      </div>
    `;
}