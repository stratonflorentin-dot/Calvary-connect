const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log(execSync('git add .').toString());
  try {
    console.log(execSync('git commit -m "Fix signup 406 error by securely verifying invitations with a server action (bypasses RLS)"').toString());
  } catch(e) {
    console.log('Nothing to commit');
  }
  console.log(execSync('git push').toString());
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
