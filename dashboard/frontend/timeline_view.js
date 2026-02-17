/*
 Garud-Drishti Timeline Renderer
 Handles chronological incident visualization
*/

function renderTimeline(incidents){

 const container = document.getElementById("timeline");
 if(!container) return;

 container.innerHTML = "";

 if(!incidents || !incidents.length){
    container.innerHTML = "<small>No activity yet</small>";
    return;
 }

 // Sort by timestamp ascending
 incidents = incidents.slice().sort((a,b)=>{
    return new Date(a.timestamp) - new Date(b.timestamp);
 });

 incidents.forEach((inc, index)=>{

    const div = document.createElement("div");
    div.className = "timeline-item";

    // Severity dot color
    let color = "#34d399"; // low
    if(inc.severity === "medium") color = "#fbbf24";
    if(inc.severity === "high") color = "#f87171";

    const time = new Date(inc.timestamp).toLocaleTimeString();

    div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
            <div style="
                width:10px;height:10px;border-radius:50%;
                background:${color};
                box-shadow:0 0 6px ${color};
            "></div>

            <div>
                <div style="font-size:12px;color:#8aa0bf">${time}</div>
                <div style="font-size:13px">
                    <b>${inc.incident_id}</b> — ${inc.summary || "Suspicious activity"}
                </div>
            </div>
        </div>
    `;

    // Animate new entries
    if(index === incidents.length - 1){
        div.style.opacity = 0;
        setTimeout(()=>{
            div.style.transition = "0.5s";
            div.style.opacity = 1;
        }, 50);
    }

    container.appendChild(div);
 });

}