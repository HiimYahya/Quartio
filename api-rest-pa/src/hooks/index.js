const fs   = require('fs');
const path = require('path');

module.exports = (appEvents) => {
  fs.readdirSync(__dirname)
    .filter((file) => file.endsWith('.hook.js'))
    .sort()
    .forEach((file) => require(path.join(__dirname, file))(appEvents));
};
