// This loads the packages and the database file
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./db");

// This sets up the server
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// This is the rule for GitHub usernames and the saved GitHub results
const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const githubCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

// This gets all the projects
app.get("/api/projects", (req, res) => {
  res.json(db.projects.read());
});

// This adds a new project
app.post("/api/projects", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Project name is required" });

  const projects = db.projects.read();
  const project = {
    id: Date.now(),
    name,
    description: String(req.body.description || "").trim(),
  };
  projects.push(project);
  db.projects.write(projects);
  res.json(project);
});

// This edits the project name and description
app.put("/api/projects/:id", (req, res) => {
  const projects = db.projects.read();
  const project = projects.find((p) => p.id == req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Project name is required" });

  project.name = name;
  project.description = (req.body.description || "").trim();
  db.projects.write(projects);
  res.json(project);
});

// This deletes a project and its developers
app.delete("/api/projects/:id", (req, res) => {
  const projects = db.projects.read().filter((p) => p.id != req.params.id);
  db.projects.write(projects);

  const developers = db.developers.read().filter((d) => d.projectId != req.params.id);
  db.developers.write(developers);

  res.json({ message: "Project deleted" });
});

// This gets the developers or only the ones in one project
app.get("/api/developers", (req, res) => {
  const developers = db.developers.read();
  if (req.query.projectId) {
    return res.json(developers.filter((d) => d.projectId == req.query.projectId));
  }
  res.json(developers);
});

// This adds a developer to a project
app.post("/api/developers", async (req, res) => {
  if (!req.body.projectId) return res.status(400).json({ error: "Project is required" });

  const project = db.projects.read().find((p) => p.id == req.body.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const github = await checkGitHubUser(req.body.github);
  if (!github.ok) return res.status(github.status).json({ error: github.error });

  const developers = db.developers.read();
  // This checks if the developer is already in the project
  const username = github.user.username;
  const alreadyMember = developers.some(
    (d) => d.projectId == req.body.projectId && (d.github || "").toLowerCase() === username.toLowerCase()
  );
  if (alreadyMember) {
    return res.status(409).json({ error: "@" + username + " is already in this project" });
  }

  const developer = {
    id: Date.now(),
    name: (req.body.name || "").trim() || github.user.name || "",
    role: (req.body.role || "").trim(),
    github: username,
    projectId: project.id,
  };
  developers.push(developer);
  db.developers.write(developers);
  res.json(developer);
});

// This edits the developer name and role
app.put("/api/developers/:id", (req, res) => {
  const developers = db.developers.read();
  const developer = developers.find((d) => d.id == req.params.id);
  if (!developer) return res.status(404).json({ error: "Developer not found" });

  // This stops the GitHub username from being changed
  if (req.body.github !== undefined) {
    const github = String(req.body.github).trim().replace(/^@/, "");
    if (github.toLowerCase() !== (developer.github || "").toLowerCase()) {
      return res.status(400).json({
        error: "GitHub username can't be changed; remove the developer and add the new one",
      });
    }
  }

  if (req.body.name !== undefined) developer.name = String(req.body.name).trim();
  if (req.body.role !== undefined) developer.role = String(req.body.role).trim();
  db.developers.write(developers);
  res.json(developer);
});

// This removes a developer
app.delete("/api/developers/:id", (req, res) => {
  const developers = db.developers.read().filter((d) => d.id != req.params.id);
  db.developers.write(developers);
  res.json({ message: "Developer deleted" });
});

// This looks up a user on GitHub
app.get("/api/lookup", async (req, res) => {
  const github = await checkGitHubUser(req.query.username);
  if (!github.ok) return res.status(github.status).json({ error: github.error });
  res.json(github.user);
});

// This checks if the GitHub user exists
async function checkGitHubUser(input) {
  const username = String(input || "").trim().replace(/^@/, "");
  if (!username) return { ok: false, status: 400, error: "GitHub username is required" };
  if (!GITHUB_USERNAME.test(username)) return { ok: false, status: 400, error: "Not a valid GitHub username" };

  // This uses the saved result if it is not old yet
  const key = username.toLowerCase();
  const cached = githubCache.get(key);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.result;

  // This asks GitHub for the user
  let result;
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;

    const response = await axios.get("https://api.github.com/users/" + username, { headers });
    result = {
      ok: true,
      user: {
        username: response.data.login,
        name: response.data.name,
        location: response.data.location,
        avatar: response.data.avatar_url,
        profile: response.data.html_url,
      },
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      result = { ok: false, status: 404, error: "No GitHub user named " + username };
    } else {
      return { ok: false, status: 503, error: "Couldn't reach GitHub right now. Try again in a bit." };
    }
  }

  // This saves the result for next time
  githubCache.set(key, { time: Date.now(), result });
  return result;
}

// This starts the server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
