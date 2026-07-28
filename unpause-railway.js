import https from 'https';
import { execSync } from 'child_process';

const token = '295a429e-60b0-4ce2-b2bd-90676657a42f';
const projectId = '672dc334-aeee-4bc4-b65e-d5b14c563876';
const environmentId = '6c92f56b-8e39-404a-a6af-7d1eb1c4d124';
const serviceId = '6cf1e3c0-81df-4622-b6c3-1fe665efadd6';

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
  console.log('Unpausing Railway service deployments...');
  const unpauseRes = await graphql(`
    mutation serviceInstanceUpdate($environmentId: String!, $serviceId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(environmentId: $environmentId, serviceId: $serviceId, input: $input)
    }
  `, {
    environmentId,
    serviceId,
    input: {
      autoDeploys: true
    }
  });

  console.log('Unpause response:', JSON.stringify(unpauseRes, null, 2));

  console.log('Generating Railway Project Token...');
  const tokenRes = await graphql(`
    mutation ProjectTokenCreate($projectId: String!, $environmentId: String!) {
      projectTokenCreate(input: { projectId: $projectId, environmentId: $environmentId, name: "cli-deploy" })
    }
  `, { projectId, environmentId });

  const projectToken = tokenRes.data?.projectTokenCreate;
  if (projectToken) {
    console.log(`Token created! Uploading project via CLI...`);
    try {
      const output = execSync(`cmd.exe /c "set RAILWAY_TOKEN=${projectToken}&& npx -y @railway/cli@latest up --service scalemate-backend --detach"`, {
        encoding: 'utf-8',
        cwd: process.cwd()
      });
      console.log('Deploy Output:\n', output);
    } catch (e) {
      console.error('CLI Error:', e.message);
      if (e.stdout) console.log('stdout:', e.stdout);
      if (e.stderr) console.log('stderr:', e.stderr);
    }
  }
}

run();
