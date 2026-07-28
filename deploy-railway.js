import https from 'https';

const token = '295a429e-60b0-4ce2-b2bd-90676657a42f';

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
  console.log('1. Fetching Railway workspaces...');
  const res = await graphql(`
    query {
      me {
        id
        email
        workspaces {
          id
          name
        }
      }
    }
  `);

  console.log('Workspaces response:', JSON.stringify(res, null, 2));

  const workspaceId = res.data?.me?.workspaces?.[0]?.id;
  if (!workspaceId) {
    console.error('No workspaceId found!');
    return;
  }

  console.log(`2. Creating Railway Project in Workspace ID ${workspaceId}...`);
  const projectRes = await graphql(`
    mutation ProjectCreate($workspaceId: String!) {
      projectCreate(input: { name: "scalemate", workspaceId: $workspaceId }) {
        id
        name
        services {
          edges {
            node {
              id
              name
            }
          }
        }
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `, { workspaceId });

  console.log('Project Create Response:', JSON.stringify(projectRes, null, 2));
}

run();
