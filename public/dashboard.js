// This gets the project id from the link
const currentProjectId = new URLSearchParams(location.search).get("project");
const $ = (id) => document.getElementById(id);

// These keep the open project and the developer being edited
let currentProject = null;
let currentDevelopers = [];
let editingDeveloperId = null;

// This makes text safe to put in the page
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// This gets the GitHub profile picture
function avatarUrl(username) {
  return "https://github.com/" + encodeURIComponent(username) + ".png?size=80";
}

// This adds an s when there is more than one
function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

// This shows a small message at the bottom
function toast(message) {
  const el = $("toast");
  el.querySelector("span").textContent = message;
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

// This asks the user before deleting something
function confirmDelete(title, text) {
  const dialog = $("confirmDialog");
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  dialog.returnValue = "";
  dialog.showModal();

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
  });
}

// This gets data from the server
async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

// This shows the projects in the sidebar
function renderNav(projects) {
  $("navOverview").classList.toggle("active", !currentProjectId);

  if (!projects.length) {
    $("navProjects").innerHTML = `<div class="muted" style="padding: 4px 8px; font-size: 13px">No projects yet</div>`;
    return;
  }

  $("navProjects").innerHTML = projects
    .map(
      (p) =>
        `<div class="nav-item">
           <a href="?project=${p.id}" class="${p.id == currentProjectId ? "active" : ""}">
             <i data-lucide="folder"></i><span>${esc(p.name)}</span>
           </a>
           <button class="icon-btn icon-btn-sm danger nav-delete" title="Delete project"
                   aria-label="Delete ${esc(p.name)}" onclick="deleteProject(${p.id})"><i data-lucide="trash-2"></i></button>
         </div>`
    )
    .join("");
}

// This shows all the projects as cards
async function loadProjects() {
  const [projects, developers] = await Promise.all([
    getJson("/api/projects"),
    getJson("/api/developers"),
  ]);
  renderNav(projects);

  if (!projects.length) {
    $("projects").innerHTML = `
      <div class="card empty" style="grid-column: 1 / -1">
        <div class="empty-icon"><i data-lucide="folder-plus"></i></div>
        <h3>No projects yet</h3>
        <p>Create your first project to start adding developers.</p>
        <button class="btn btn-primary" onclick="openNewProject()"><i data-lucide="plus"></i> New Project</button>
      </div>`;
  } else {
    const cards = projects
      .map((p) => {
        const count = developers.filter((d) => d.projectId == p.id).length;
        return `
          <div class="card project-card">
            <div class="project-card-top">
              <div class="project-icon"><i data-lucide="folder"></i></div>
              <button class="icon-btn danger" title="Delete project" aria-label="Delete ${esc(p.name)}"
                      onclick="deleteProject(${p.id})"><i data-lucide="trash-2"></i></button>
            </div>
            <h3><a class="stretched" href="?project=${p.id}">${esc(p.name)}</a></h3>
            ${p.description ? `<p class="description">${esc(p.description)}</p>` : ""}
            <div class="meta"><i data-lucide="users"></i> ${plural(count, "member")}</div>
          </div>`;
      })
      .join("");

    const addButton = `
      <button class="add-card" onclick="openNewProject()" title="New Project" aria-label="New Project">
        <i data-lucide="plus"></i>
      </button>`;

    $("projects").innerHTML = cards + addButton;
  }
  window.lucide?.createIcons();
}

// This opens the new project form
function openNewProject() {
  $("newProjectForm").reset();
  $("newProjectDialog").showModal();
}

// This deletes a project
async function deleteProject(id) {
  const ok = await confirmDelete("Delete this project?", "The project will be removed. This can't be undone.");
  if (!ok) return;

  await fetch("/api/projects/" + id, { method: "DELETE" });

  if (id == currentProjectId) {
    location.href = "dashboard.html";
  } else if (currentProjectId) {
    toast("Project deleted");
    renderNav(await getJson("/api/projects"));
    window.lucide?.createIcons();
  } else {
    toast("Project deleted");
    loadProjects();
  }
}

// This loads the page of one project
async function loadProjectDetail() {
  const projects = await getJson("/api/projects");
  renderNav(projects);

  const project = projects.find((p) => p.id == currentProjectId);
  if (!project) {
    $("projectTitle").textContent = "Project not found";
    $("projectMeta").textContent = "It may have been deleted.";
    document.querySelector("#projectDetailView .content-grid").hidden = true;
    $("projectActions").hidden = true;
    window.lucide?.createIcons();
    return;
  }

  showProject(project);
  await loadDevelopers();
}

// This shows the project name and description
function showProject(project) {
  currentProject = project;
  $("projectTitle").textContent = project.name;
  $("projectDescriptionText").textContent = project.description || "";
  $("projectDescriptionText").hidden = !project.description;
  document.title = project.name + " · GitConnected";
}

// This opens the edit project form
function openEditProject() {
  $("editProjectName").value = currentProject.name;
  $("editProjectDescription").value = currentProject.description || "";
  $("editProjectDialog").showModal();
}

// This shows the developers in the project
async function loadDevelopers() {
  const developers = await getJson("/api/developers?projectId=" + encodeURIComponent(currentProjectId));
  currentDevelopers = developers;
  $("projectMeta").textContent = plural(developers.length, "Member");

  if (!developers.length) {
    $("developers").innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="users"></i></div>
        <h3>No members yet</h3>
        <p>Add a developer using the form on the right.</p>
      </div>`;
    window.lucide?.createIcons();
    return;
  }

  const rows = developers
    .map(
      (d) => `
        <tr>
          <td>
            <div class="person">
              <img class="avatar" src="${avatarUrl(d.github)}" alt="" loading="lazy"
                   onerror="this.style.visibility='hidden'" />
              <div>
                <strong>${esc(d.name || d.github)}</strong>
                <a href="https://github.com/${encodeURIComponent(d.github)}" target="_blank" rel="noopener">@${esc(d.github)}</a>
              </div>
            </div>
          </td>
          <td class="hide-sm"><span class="badge">${esc(d.role)}</span></td>
          <td class="actions">
            <button class="icon-btn" onclick="openEditDeveloper(${d.id})"
                    title="Edit" aria-label="Edit ${esc(d.name || d.github)}"><i data-lucide="pencil"></i></button>
            <button class="icon-btn danger" title="Remove" aria-label="Remove ${esc(d.name || d.github)}"
                    onclick="deleteDeveloper(${d.id})"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`
    )
    .join("");

  $("developers").innerHTML = `
    <table class="table">
      <thead><tr><th>Developer</th><th class="hide-sm">Role</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  window.lucide?.createIcons();
}

// This removes a developer from the project
async function deleteDeveloper(id) {
  const ok = await confirmDelete("Remove this developer?", "They will be removed from the project.");
  if (!ok) return;

  await fetch("/api/developers/" + id, { method: "DELETE" });
  toast("Developer removed");
  loadDevelopers();
}

// This opens the edit developer form
function openEditDeveloper(id) {
  const d = currentDevelopers.find((dev) => dev.id == id);
  if (!d) return;

  editingDeveloperId = id;
  const profile = "https://github.com/" + encodeURIComponent(d.github);

  $("editDevAvatar").style.visibility = "";
  $("editDevAvatar").src = avatarUrl(d.github);
  $("editDevHeading").textContent = d.name || "@" + d.github;
  $("editDevUsername").textContent = "@" + d.github;
  $("editDevGithubLink").textContent = "@" + d.github;
  $("editDevGithubLink").href = profile;
  $("editDevName").value = d.name || "";
  $("editDevRole").value = d.role || "";
  $("editDevError").hidden = true;
  $("editDevSave").disabled = false;
  $("editDeveloperDialog").showModal();
}

// This checks the GitHub username in the add developer form
const githubCheck =
  currentProjectId &&
  attachGitHubCheck({ input: $("github"), status: $("githubStatus"), submit: $("addSubmit"), nameInput: $("name") });

// This saves the new project
$("newProjectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("projectName").value.trim();
  const description = $("projectDescription").value.trim();
  if (!name) return;

  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const project = await res.json();
  $("newProjectDialog").close();
  location.href = "?project=" + project.id;
});

// This saves the project changes
$("editProjectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch("/api/projects/" + currentProjectId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: $("editProjectName").value.trim(),
      description: $("editProjectDescription").value.trim(),
    }),
  });

  if (!res.ok) {
    toast("Could not save — is the server up to date? Restart it.");
    return;
  }

  $("editProjectDialog").close();
  showProject(await res.json());
  renderNav(await getJson("/api/projects"));
  window.lucide?.createIcons();
  toast("Project Updated");
});

// This adds the developer to the project
$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("addSubmit").disabled = true;

  const res = await fetch("/api/developers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: $("name").value.trim(),
      role: $("role").value.trim(),
      github: githubCheck.username(),
      projectId: currentProjectId,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    githubCheck.fail(data.error || "Couldn't add this developer");
    return;
  }

  e.target.reset();
  githubCheck.reset();
  toast((data.name || "@" + data.github) + " added");
  loadDevelopers();
});

// This saves the developer changes
$("editDeveloperForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("editDevSave").disabled = true;

  const res = await fetch("/api/developers/" + editingDeveloperId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: $("editDevName").value.trim(), role: $("editDevRole").value.trim() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    $("editDevError").textContent = data.error || "Couldn't save changes";
    $("editDevError").hidden = false;
    $("editDevSave").disabled = false;
    return;
  }

  const saved = await res.json();
  $("editDeveloperDialog").close();
  toast((saved.name || "@" + saved.github) + " Updated");
  loadDevelopers();
});

// This shows the right page when it opens
const view = currentProjectId ? $("projectDetailView") : $("projectListView");
view.hidden = false;
window.lucide?.createIcons();

if (currentProjectId) loadProjectDetail();
else loadProjects();
