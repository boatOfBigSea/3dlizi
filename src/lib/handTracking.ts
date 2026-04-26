// MediaPipe configuration and vision task
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult
} from "@mediapipe/tasks-vision";

let landmarker: HandLandmarker | null = null;
let runningMode: "IMAGE" | "VIDEO" = "VIDEO";

export const initializeHandLandmarker = async () => {
  if (landmarker) return landmarker;
  
  // Use local files from the public folder for offline support
  const vision = await FilesetResolver.forVisionTasks("/wasm");
  
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `/models/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 1
  });
  
  return landmarker;
};

export const detectHandOpenness = (results: HandLandmarkerResult): number | null => {
  if (!results.landmarks || results.landmarks.length === 0) {
    return null; // No hands detected
  }

  const landmarks = results.landmarks[0];
  
  // Specific landmarks
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];
  const tips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky
  
  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  };
  
  const palmLength = getDistance(wrist, middleMCP);
  if (palmLength === 0) return 0;

  let totalTipDistance = 0;
  for (const tipIdx of tips) {
    totalTipDistance += getDistance(wrist, landmarks[tipIdx]);
  }
  
  const avgTipDistance = totalTipDistance / tips.length;
  
  // Ratio of avg fingertip distance to palm length.
  // ~1.2 or below is usually a closed fist.
  // ~2.2 or higher is usually an open hand.
  const ratio = avgTipDistance / palmLength;
  
  // Normalize ratio to [0, 1] range for openness
  const minRatio = 1.3;
  const maxRatio = 2.4;
  
  let openness = (ratio - minRatio) / (maxRatio - minRatio);
  openness = Math.max(0, Math.min(1, openness));
  
  return openness;
};
