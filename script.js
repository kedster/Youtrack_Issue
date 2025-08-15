// JS (core logic)
// You must include the Youtrack JS SDK or define the Youtrack class for this to work
const baseUrl = "https://trimech.youtrack.cloud/api/admin/customFieldSettings/customFields?fields=id,name,fieldType,projects(name)"; // Set your YouTrack base URL
const token = "perm-c2tlZGR5.NjUtNQ==.cgdsyZCEOh2PauJMt488tb9ZgihhYM"; // Set your YouTrack token
const yt = new Youtrack({ baseUrl, token });

function getCF(issue, name) {
    const cf = (issue.customFields || []).find(f => f.name === name);
    if (!cf) return undefined;
    if (Array.isArray(cf.value)) return cf.value.map(v => v.name).join(",");
    if (cf.value && cf.value.name) return cf.value.name;
    if (cf.value && cf.value.text) return cf.value.text;
    return cf.value;
}

function compare(a, b) {
    // Excel-style sort: DMS Sprint Number (asc numeric), RMS Responsibility (custom order), then issue ID (asc)
    const getSprint = (i) => +getCF(i, "DMS Sprint Number") || Infinity;
    const sA = getSprint(a), sB = getSprint(b);
    if (sA !== sB) return sA - sB;

    const order = ["Client","Trimech","Joint"];
    const rA = getCF(a, "DMS Responsibility") || "";
    const rB = getCF(b, "DMS Responsibility") || "";
    const iA = order.indexOf(rA), iB = order.indexOf(rB);
    if (iA !== iB) return iA - iB;

    const idA = parseInt((a.idReadable||"").split("-")[1], 10);
    const idB = parseInt((b.idReadable||"").split("-")[1], 10);
    return idA - idB;
}

async function init() {
    const projects = await yt.projects.all();
    const sel = document.getElementById("projectId") || document.getElementById("projectSelect");
    sel.innerHTML = '<option value="">Select a project</option>';
    projects.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.shortName;
        opt.textContent = p.name + (p.shortName ? ` (${p.shortName})` : "");
        sel.appendChild(opt);
    });
    sel.onchange = loadIssues;
}

async function loadIssues() {
    const sel = document.getElementById("projectId") || document.getElementById("projectSelect");
    const projectKey = sel.value;
    if (!projectKey) return;
    const q = `project: "${projectKey}"`;
    const fields = [
        "idReadable", "summary",
        "customFields(name,value(name),value(text))"
    ].join(",");
    const issues = await yt.issues.search(q, { fields });

    issues.sort(compare);

    const tbody = document.querySelector("#issuesTable tbody");
    tbody.innerHTML = "";
    for (const i of issues) {
        const tr = document.createElement("tr");
        const cells = [
            i.idReadable,
            i.summary,
            getCF(i, "DMS Action Type"),
            getCF(i, "DMS Action Stack"),
            getCF(i, "DMS Pillar"),
            getCF(i, "DMS Sprint Number"),
            getCF(i, "RMS Responsibility"),
        ];
        for (const c of cells) {
            const td = document.createElement("td");
            td.textContent = c ?? "";
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

init();