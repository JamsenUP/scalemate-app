import https from 'https';

const token = '295a429e-60b0-4ce2-b2bd-90676657a42f';
const projectId = '672dc334-aeee-4bc4-b65e-d5b14c563876';

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

async function check() {
  const res = await graphql(`
    query getServiceInstance($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        id
        serviceId
        environmentId
        startCommand
      }
    }
  `, { serviceId: "6cf1e3c0-81df-4622-b6c3-1fe665efadd6", environmentId: "6c92f56b-8e39-404a-a6af-7d1eb1c4d124" });

  console.log('ServiceInstance Details:', JSON.stringify(res, null, 2));
}

check();
