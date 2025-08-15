// JS (core logic)
// You must include the Youtrack JS SDK or define the Youtrack class for this to work
const baseUrl = "https://trimech.youtrack.cloud/api/admin/customFieldSettings/customFields?fields=id,name,fieldType,projects(name)"; // Set your YouTrack base URL
const token = context.env.youtrackapi;

export async function onRequest(context) {
  const token = context.env.youtrackapi;
  return new Response(`Secret: ${token}`);
}

        let currentIssues = [];

        // YouTrack API wrapper similar to your original script
        class Youtrack {
            constructor({ baseUrl, token }) {
                this.baseUrl = baseUrl;
                this.token = token;
            }

            async makeRequest(endpoint, options = {}) {
                const url = `${this.baseUrl}${endpoint}`;
                const headers = {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers: headers,
                    ...options
                });

                if (!response.ok) {
                    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
                }

                return await response.json();
            }

            get projects() {
                return {
                    all: async () => {
                        return await this.makeRequest('/admin/projects?fields=shortName,name');
                    }
                };
            }

            get issues() {
                return {
                    search: async (query, options = {}) => {
                        const params = new URLSearchParams({
                            query: query,
                            fields: options.fields || 'idReadable,summary'
                        });
                        return await this.makeRequest(`/issues?${params.toString()}`);
                    }
                };
            }
        }

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
            // Excel-style sort: DMS Sprint Number (asc numeric), DMS Responsibility (custom order), then issue ID (asc)
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

        function showStatus(message, type = 'info') {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        }

        function clearStatus() {
            document.getElementById('status').innerHTML = '';
        }

        async function loadProjects() {
            try {
                showStatus('Loading projects...', 'loading');
                
                // Use the actual YouTrack API call like in your original script
                const projects = await yt.projects.all();

                const select = document.getElementById('projectId');
                select.innerHTML = '<option value="">Select a project</option>';
                
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.shortName;
                    option.textContent = `${project.name}${project.shortName ? ` (${project.shortName})` : ''}`;
                    select.appendChild(option);
                });

                select.addEventListener('change', function() {
                    const fetchBtn = document.getElementById('fetchBtn');
                    fetchBtn.disabled = !this.value;
                    
                    if (!this.value) {
                        document.getElementById('issuesTable').style.display = 'none';
                        document.getElementById('downloadBtn').disabled = true;
                    }
                });

                clearStatus();
                
            } catch (error) {
                showStatus(`Error loading projects: ${error.message}`, 'error');
            }
        }

        async function fetchIssues() {
            const projectId = document.getElementById('projectId').value;
            if (!projectId) {
                showStatus('Please select a project first', 'error');
                return;
            }

            try {
                showStatus('Fetching issues...', 'loading');
                
                // Use the actual YouTrack API call like in your original script
                const query = `project: "${projectId}"`;
                const fields = [
                    "idReadable", "summary",
                    "customFields(name,value(name),value(text))"
                ].join(",");
                
                const issues = await yt.issues.search(query, { fields });
                issues.sort(compare);
                currentIssues = issues;

                displayIssues(issues);
                clearStatus();
                showStatus(`Found ${issues.length} issues`, 'success');
                
                document.getElementById('downloadBtn').disabled = false;

            } catch (error) {
                showStatus(`Error fetching issues: ${error.message}`, 'error');
            }
        }

        function displayIssues(issues) {
            const tbody = document.querySelector('#issuesTable tbody');
            tbody.innerHTML = '';

            issues.forEach(issue => {
                const row = document.createElement('tr');
                const cells = [
                    issue.idReadable,
                    issue.summary,
                    getCF(issue, "DMS Action Type") || '',
                    getCF(issue, "DMS Action Stack") || '',
                    getCF(issue, "DMS Pillar") || '',
                    getCF(issue, "DMS Sprint Number") || '',
                    getCF(issue, "DMS Responsibility") || ''
                ];

                cells.forEach(cellData => {
                    const cell = document.createElement('td');
                    cell.textContent = cellData;
                    row.appendChild(cell);
                });

                tbody.appendChild(row);
            });

            document.getElementById('issuesTable').style.display = 'table';
        }

        function downloadReport() {
            if (currentIssues.length === 0) {
                showStatus('No issues to download', 'error');
                return;
            }

            const projectId = document.getElementById('projectId').value;
            const projectName = document.querySelector('#projectId option:checked').textContent;
            const timestamp = new Date().toLocaleString();

            // Generate HTML report
            const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>YouTrack Issues Report - ${projectName}</title>
    <style>
        body {
            font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
            background: #f4f8fb;
            color: #222;
            margin: 0;
            padding: 20px;
        }
        .header {
            background: linear-gradient(90deg, #1976d2 60%, #2196f3 100%);
            color: #fff;
            padding: 2rem 1rem;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .info {
            background: #fff;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #1976d2;
            color: #fff;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: #f5f5f5;
        }
        tr:hover {
            background: #e3f2fd;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>YouTrack Issues Report</h1>
        <h2>${projectName}</h2>
    </div>
    
    <div class="info">
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Total Issues:</strong> ${currentIssues.length}</p>
        <p><strong>Project:</strong> ${projectName}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Summary</th>
                <th>Action Type</th>
                <th>Action Stack</th>
                <th>Pillar</th>
                <th>Sprint Number</th>
                <th>Responsibility</th>
            </tr>
        </thead>
        <tbody>
            ${currentIssues.map(issue => `
                <tr>
                    <td>${issue.idReadable}</td>
                    <td>${issue.summary}</td>
                    <td>${getCF(issue, "DMS Action Type") || ''}</td>
                    <td>${getCF(issue, "DMS Action Stack") || ''}</td>
                    <td>${getCF(issue, "DMS Pillar") || ''}</td>
                    <td>${getCF(issue, "DMS Sprint Number") || ''}</td>
                    <td>${getCF(issue, "DMS Responsibility") || ''}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="footer">
        <p>Report generated by YouTrack Issue Reporter</p>
    </div>
</body>
</html>`;

            // Create and download the file
            const blob = new Blob([htmlReport], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `youtrack-report-${projectId}-${new Date().toISOString().slice(0, 10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showStatus('Report downloaded successfully!', 'success');
        }

        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            loadProjects();
        });