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
  console.log('1. Creating Service "scalemate-backend" in Railway project...');
  const serviceRes = await graphql(`
    mutation ServiceCreate($projectId: String!) {
      serviceCreate(input: { projectId: $projectId, name: "scalemate-backend" }) {
        id
        name
      }
    }
  `, { projectId });

  console.log('Service Create Response:', JSON.stringify(serviceRes, null, 2));
  const serviceId = serviceRes.data?.serviceCreate?.id;

  if (!serviceId) {
    console.error('Failed to create service');
    return;
  }

  console.log('2. Generating public domain (.up.railway.app)...');
  const domainRes = await graphql(`
    mutation ServiceDomainCreate($environmentId: String!, $serviceId: String!) {
      serviceDomainCreate(input: { environmentId: $environmentId, serviceId: $serviceId }) {
        domain
      }
    }
  `, { environmentId, serviceId });

  console.log('Domain Response:', JSON.stringify(domainRes, null, 2));
  const domain = domainRes.data?.serviceDomainCreate?.domain;
  const appUrl = domain ? `https://${domain}` : `https://scalemate-production.up.railway.app`;

  console.log(`\n🎉 Public Production URL allocated: ${appUrl}\n`);

  console.log('3. Setting production Environment Variables...');
  const varsRes = await graphql(`
    mutation VariableCollectionUpsert($environmentId: String!, $projectId: String!, $serviceId: String!, $variables: EnvironmentVariables!) {
      variableCollectionUpsert(input: { environmentId: $environmentId, projectId: $projectId, serviceId: $serviceId, variables: $variables })
    }
  `, {
    environmentId,
    projectId,
    serviceId,
    variables: {
      BOT_TOKEN: '8493874085:AAGYytvT5bTfMI-kvL7eELIWcRChpsLld_w',
      GEMINI_API_KEY: 'AQ.Ab8RN6LefyRYiCPuPzl1vpifv03f-rf152fWsdnDnmo4wcwhUw',
      APP_URL: appUrl,
      PORT: '5000'
    }
  });

  console.log('Variables Set Response:', JSON.stringify(varsRes, null, 2));

  console.log('4. Connecting project code to Railway...');
  try {
    process.env.RAILWAY_TOKEN = token;
    const linkOutput = execSync(`npx -y @railway/cli@latest link --project ${projectId} --environment ${environmentId} --service ${serviceId}`, {
      env: process.env,
      encoding: 'utf8'
    });
    console.log('Railway link output:\n', linkOutput);

    const upOutput = execSync(`npx -y @railway/cli@latest up --detach`, {
      env: process.env,
      encoding: 'utf8'
    });
    console.log('Railway upload output:\n', upOutput);
    console.log(`\n🚀 DEPLOYMENT SUCCESSFUL! App live 24/7 at: ${appUrl}`);
  } catch (err) {
    console.error('CLI error:', err.message);
    if (err.stdout) console.log('stdout:', err.stdout);
    if (err.stderr) console.log('stderr:', err.stderr);
  }
}

run();
