import fs from 'fs';
import path from 'path';
import https from 'https';

const setupOffline = async () => {
  const publicDir = path.resolve(process.cwd(), 'public');
  const modelsDir = path.join(publicDir, 'models');
  const wasmDir = path.join(publicDir, 'wasm');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
  if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir);
  if (!fs.existsSync(wasmDir)) fs.mkdirSync(wasmDir);

  // Copy wasm files
  const sourceWasm = path.resolve(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm');
  const wasmFiles = fs.readdirSync(sourceWasm);
  for (const file of wasmFiles) {
    fs.copyFileSync(path.join(sourceWasm, file), path.join(wasmDir, file));
  }
  console.log('WASM files copied to public/wasm');

  // Download model
  const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const modelPath = path.join(modelsDir, 'hand_landmarker.task');
  
  if (!fs.existsSync(modelPath)) {
    console.log('Downloading hand landmarker model...');
    await new Promise((resolve, reject) => {
      https.get(modelUrl, (res) => {
        const fileStream = fs.createWriteStream(modelPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log('Model downloaded successfully!');
          resolve(true);
        });
      }).on('error', (err) => {
        console.error('Error downloading model:', err);
        reject(err);
      });
    });
  } else {
    console.log('Model already exists at public/models/hand_landmarker.task');
  }
};

setupOffline().catch(console.error);
