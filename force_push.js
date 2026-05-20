const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log(execSync('git add .').toString());
  try {
    console.log(execSync('git commit -m "Update fixes for login/signup and role loading"').toString());
  } catch(e) {
    console.log('Nothing to commit');
  }
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
