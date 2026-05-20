const { execSync } = require('child_process');

try {
  console.log('--- GIT STATUS ---');
  console.log(execSync('git status').toString());
  
  console.log('--- GIT ADD ---');
  console.log(execSync('git add .').toString());
  
  console.log('--- GIT COMMIT ---');
  try {
    console.log(execSync('git commit -m "Auto-fix user status to active upon successful login and during signup link"').toString());
  } catch(e) {
    console.log('Nothing to commit');
  }
  
  console.log('--- GIT PUSH ---');
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
