const { execSync } = require('child_process');

try {
  console.log(execSync('git add .').toString());
  try {
    console.log(execSync('git commit -m "Provide standard sidebar layout to DRIVER role"').toString());
  } catch(e) {
    console.log('Nothing to commit');
  }
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
