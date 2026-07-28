import https from 'https';
import { execSync } from 'child_process';

const token = '295a429e-60b0-4ce2-b2bd-90676657a42f';
const projectId = '672dc334-aeee-4bc4-b65e-d5b14c563876';
const environmentId = '6c92f56b-8e39-404a-a6af-7d1eb1c4d124';

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const req = https.request('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Generating Railway Project Token...');
  const res = await graphql(`
    mutation ProjectTokenCreate($projectId: String!, $environmentId: String!) {
      projectTokenCreate(input: { projectId: $projectId, environmentId: $environmentId, name: "cli-deploy" })
    }
  `, { projectId, environmentId });

  console.log('Project Token Response:', JSON.stringify(res, null, 2));

  const projectToken = res.data?.projectTokenCreate;
  if (projectToken) {
    console.log(`Generated Project Token successfully! Token starts with: ${projectToken.substring(0, 10)}...`);
    console.log('Deploying code via Railway CLI using Project Token...');
    try {
      const output = execSync(`cmd.exe /c "set RAILWAY_TOKEN=${projectToken}&& npx -y @railway/cli@latest up --service scalemate-backend --environment production --detach"`, {
        encoding: 'utf8'
      });
      console.log('Deploy Output:\n', output);
      console.log(`\n🎉 SUCCESS! Project uploaded and 24/7 deployment started on Railway!`);
      console.log(`URL: https://scalemate-backend-production.up.railway.app`);
    } catch (err) {
      console.error('CLI Error:', err.message);
      if (err.stdout) console.log('stdout:', err.stdout);
      if (err.stderr) console.log('stderr:', err.stderr);
    }
  }
}

run();
