const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Try deleting the script if it exists
  if (fs.existsSync('fix_isloading.js')) {
    fs.unlinkSync('fix_isloading.js');
  }

  // Run git commands
  console.log(execSync('git add .').toString());
  console.log(execSync('git commit -m "Fix Access Denied flash by waiting for isLoading in role checks across all dashboard pages"').toString());
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
