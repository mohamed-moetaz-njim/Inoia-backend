import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Simple .env parser
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
      console.warn('No .env file found at', envPath);
      return;
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.error('Error loading .env:', error);
  }
}

loadEnv();

const apiKey = process.env.GEMINI_API_KEY;
const envModel = process.env.GEMINI_MODEL;

console.log('--- Gemini Diagnostic Script ---');
console.log(`API Key present: ${!!apiKey}`);
console.log(`GEMINI_MODEL in env: ${envModel || 'Not set'}`);

if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY is missing in .env');
  process.exit(1);
}

const modelsToTest = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3-flash-preview',
  'gemini-1.5-flash',
];

async function testModel(modelName: string) {
  console.log(`\nTesting model: ${modelName}...`);
  try {
    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent("Hello, how are you?");
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ SUCCESS: ${modelName}`);
    console.log(`Response preview: ${text.substring(0, 50)}...`);
    return true;
  } catch (error: any) {
    console.error(`❌ FAILED: ${modelName}`);
    console.error(`   Error Name: ${error.name}`);
    console.error(`   Message: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
    }
    return false;
  }
}

async function run() {
  console.log(`Testing models: ${modelsToTest.join(', ')}`);
  
  for (const model of modelsToTest) {
    await testModel(model);
  }
  
  console.log('\n--- Diagnostic Complete ---');
}

run();
