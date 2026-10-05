const fs = require("fs");

// This makes the read and save functions for a JSON file
function store(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");

  return {
    read: () => JSON.parse(fs.readFileSync(file)),
    write: (data) => fs.writeFileSync(file, JSON.stringify(data, null, 2)),
  };
}

// These are the files where the data is saved
exports.developers = store("developers.json");
exports.projects = store("projects.json");
