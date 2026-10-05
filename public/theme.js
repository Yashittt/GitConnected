// This checks if the computer is using dark mode
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

// This gets the theme the user picked before
function savedTheme() {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

// This sets the theme on the page
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// This switches between light and dark mode
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("theme", next);
  } catch {}
  applyTheme(next);
}

// This sets the theme when the page loads
applyTheme(savedTheme() || (systemDark.matches ? "dark" : "light"));

// This follows the computer theme if the user did not pick one
systemDark.addEventListener("change", (e) => {
  if (!savedTheme()) applyTheme(e.matches ? "dark" : "light");
});
