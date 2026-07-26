import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function testModel(modelName) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Hello Gemini!',
                },
              ],
            },
          ],
        }),
      }
    );

    console.log(`Model ${modelName} -> Status:`, response.status);
    if (response.ok) {
      const data = await response.json();
      console.log(`[SUCCESS] ${modelName} output:`, data.candidates?.[0]?.content?.parts?.[0]?.text);
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  return false;
}

async function run() {
  await testModel('models/gemini-2.0-flash');
  await testModel('models/gemini-flash-latest');
  await testModel('models/gemini-2.0-flash-lite');
}

run();
