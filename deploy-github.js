import https from 'https';
import { execSync } from 'child_process';

const token = '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';
const username = 'JamsenUP';

async function pushToRepo(repoName) {
  const cloneUrl = `https://${token}@github.com/${username}/${repoName}.git`;
  console.log(`Attempting git push to https://github.com/${username}/${repoName}.git ...`);

  try {
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch (e) {}

    execSync(`git remote add origin ${cloneUrl}`);
    execSync('git add .');
    try {
      execSync('git commit -m "auto-deploy updates"', { stdio: 'ignore' });
    } catch (e) {}
    execSync('git branch -M main');
    const pushOutput = execSync('git push -u origin main --force', { encoding: 'utf8' });
    console.log(`SUCCESS! Code pushed to GitHub: https://github.com/${username}/${repoName}`);
    return true;
  } catch (pushErr) {
    console.error(`Push to ${repoName} failed:`, pushErr.message);
    return false;
  }
}

async function run() {
  let ok = await pushToRepo('scalemate');
  if (!ok) {
    console.log('Retrying with scalemate-app...');
    await pushToRepo('scalemate-app');
  }
}

run();
