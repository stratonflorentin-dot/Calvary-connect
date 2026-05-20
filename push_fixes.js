const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Run git commands
  console.log(execSync('git add .').toString());
  console.log(execSync('git commit -m "Fix variable name collisions for isLoading in dashboard pages"').toString());
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
