import https from 'https';
import fs from 'fs';

const token = '295a429e-60b0-4ce2-b2bd-90676657a42f';
const projectId = '672dc334-aeee-4bc4-b65e-d5b14c563876';
const environmentId = '6c92f56b-8e39-404a-a6af-7d1eb1c4d124';
const serviceId = '6cf1e3c0-81df-4622-b6c3-1fe665efadd6';

const filePath = 'project.tar.gz';

async function upload() {
  console.log('Reading project.tar.gz...');
  const fileData = fs.readFileSync(filePath);
  console.log(`File size: ${fileData.length} bytes`);

  const url = `https://backboard.railway.app/project/${projectId}/environment/${environmentId}/service/${serviceId}/up`;

  console.log(`Uploading directly to Railway API endpoint: ${url}`);

  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-tar',
      'Content-Length': fileData.length
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`Upload Status Code: ${res.statusCode}`);
      console.log(`Response Body: ${body}`);
      if (res.statusCode === 200) {
        console.log('\n🎉 SUCCESS! Project uploaded and 24/7 deployment started on Railway!');
      }
    });
  });

  req.on('error', (err) => {
    console.error('Upload Error:', err);
  });

  req.write(fileData);
  req.end();
}

upload();
