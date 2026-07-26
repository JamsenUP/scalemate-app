import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    console.log('ListModels Status:', response.status);
    const data = await response.json();
    if (data.models) {
      console.log('Available models for generateContent:');
      data.models.forEach(m => {
        if (m.supportedGenerationMethods?.includes('generateContent')) {
          console.log('-', m.name);
        }
      });
    } else {
      console.log('No models returned:', data);
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
