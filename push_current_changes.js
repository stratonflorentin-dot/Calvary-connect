const { execSync } = require('child_process');

try {
  console.log("Adding changes to git...");
  execSync('git add .');
  console.log("Changes added.");

  console.log("Committing changes...");
  try {
    const commitMsg = 'Fix driver_allowances not-null constraint violation error on manual payroll submission';
    const commitOut = execSync(`git commit -m "${commitMsg}"`).toString();
    console.log(commitOut);
  } catch (err) {
    if (err.stdout && err.stdout.toString().includes('nothing to commit')) {
      console.log("Nothing to commit, working tree clean.");
    } else {
      throw err;
    }
  }

  console.log("Pushing to GitHub...");
  const pushOut = execSync('git push').toString();
  console.log(pushOut);
  console.log("Successfully pushed changes!");
} catch (e) {
  console.error("Git error occurred:");
  console.error(e.stdout ? e.stdout.toString() : e.message);
  process.exit(1);
}
