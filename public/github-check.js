// This is the rule for GitHub usernames
const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

// This makes text safe to put in the page
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// This checks the GitHub username while the user types
function attachGitHubCheck({ input, status, submit, nameInput }) {
  const cache = new Map();
  let timer;
  let verified = "";
  let autofilledName = "";

  const typed = () => input.value.trim().replace(/^@/, "");
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();

  // This turns the add button on or off
  function updateSubmit() {
    submit.disabled = !verified || !same(verified, typed());
  }

  // This shows the check result under the input
  function show(state, html) {
    status.className = "gh-status" + (state ? " " + state : "");
    status.innerHTML = html;
    input.classList.toggle("is-valid", state === "ok");
    input.classList.toggle("is-invalid", state === "bad" || state === "error");
    window.lucide?.createIcons();
  }

  // This shows an error message
  function showProblem(message, notFound) {
    verified = "";
    const icon = notFound ? "circle-x" : "triangle-alert";
    show(notFound ? "bad" : "error", `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`);
    updateSubmit();
  }

  // This asks the server about the username
  function lookup(username) {
    const key = username.toLowerCase();

    if (!cache.has(key)) {
      const request = fetch("/api/lookup?username=" + encodeURIComponent(username))
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok) return { ok: true, user: data };

          const notFound = res.status === 404 || res.status === 400;
          if (!notFound) cache.delete(key);
          return { ok: false, notFound, error: data.error || "Couldn't check GitHub" };
        })
        .catch(() => {
          cache.delete(key);
          return { ok: false, notFound: false, error: "Couldn't reach the server" };
        });
      cache.set(key, request);
    }

    return cache.get(key);
  }

  // This shows the GitHub user that was found
  function showUser(user) {
    verified = user.username;
    const details = [user.name, user.location].filter(Boolean).map(escapeHtml).join(" · ");

    show("ok", `
      <img class="avatar avatar-xs" src="${escapeHtml(user.avatar)}" alt="" />
      <span><a class="gh-profile" href="${escapeHtml(user.profile)}" target="_blank" rel="noopener"
               title="Open GitHub profile">@${escapeHtml(user.username)}</a>${details ? " · " + details : ""}</span>
      <i data-lucide="circle-check"></i>`);

    // This fills in the name from GitHub
    if (nameInput && user.name && (!nameInput.value.trim() || nameInput.value === autofilledName)) {
      nameInput.value = user.name;
      autofilledName = user.name;
    }
    updateSubmit();
  }

  // This runs every time the user types
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const username = typed();
    updateSubmit();

    // This clears the name from the last user
    if (nameInput && autofilledName && nameInput.value === autofilledName) {
      nameInput.value = "";
      autofilledName = "";
    }

    if (!username) return show("", "");
    if (!GITHUB_USERNAME.test(username)) return showProblem("Not a valid GitHub username", true);

    show("checking", `<i data-lucide="loader-circle" class="spin"></i><span>Checking GitHub…</span>`);

    // This waits until the user stops typing before checking
    timer = setTimeout(async () => {
      const result = await lookup(username);
      if (typed() !== username) return;

      if (result.ok) showUser(result.user);
      else showProblem(result.error, result.notFound);
    }, 500);
  });

  updateSubmit();

  // These are the functions the dashboard uses
  return {
    username: () => verified,
    fail: (message) => showProblem(message, true),
    reset() {
      clearTimeout(timer);
      verified = "";
      autofilledName = "";
      show("", "");
      updateSubmit();
    },
  };
}
