import {
  HandLandmarker,
  ImageSegmenter,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const camera = document.getElementById("camera");
const output = document.getElementById("output");

const button = document.getElementById("startCamera");

const status = document.getElementById("status");
const gestureStatus = document.getElementById("gestureStatus");

const domainOverlay = document.getElementById("domainOverlay");
const domainVideo = document.getElementById("domainVideo");
const domainComposite = document.getElementById("domainComposite");
const domainFlash = document.getElementById("domainFlash");

const compositeCtx = domainComposite.getContext("2d");

let handLandmarker;
let imageSegmenter;

let gestureFrames = 0;
let gestureConfirmed = false;

let sukunaFrames = 0;
let sukunaConfirmed = false;

// Cancel gesture
let cancelFrames = 0;
let cancelConfirmed = false;

const REQUIRED_FRAMES = 10;
const CANCEL_REQUIRED_FRAMES = 6;

let domainActive = false;

// =========================
// DOMAIN VIDEOS
// =========================

const DOMAIN_VIDEOS = {
  gojo: "assets/videos/domain.mp4",
  sukuna: "assets/videos/sukuna.mp4",
};

// =========================
// PERSON POSITIONING
// =========================

const PERSON_SCALE = .75;
const PERSON_OFFSET_X = 0;
const PERSON_OFFSET_Y = .25;

button.addEventListener("click", startCamera);

/* =========================
   CAMERA
========================= */

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    camera.srcObject = stream;

    await camera.play();

    status.textContent = "Camera is running ✓";

    predictWebcam();
  } catch (error) {
    console.error(error);

    status.textContent = "Unable to access camera.";
  }
}

/* =========================
   MAIN LOOP
========================= */

async function predictWebcam() {
  if (!handLandmarker || !imageSegmenter) {
    requestAnimationFrame(predictWebcam);
    return;
  }

  if (camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(predictWebcam);
    return;
  }

  const timestamp = performance.now();

  const handResults = handLandmarker.detectForVideo(camera, timestamp);

  drawLandmarks(handResults);

  if (domainActive) {
    updateDomainComposite(timestamp);
  }

  requestAnimationFrame(predictWebcam);
}

/* =========================
   HAND LANDMARKS
========================= */

function drawLandmarks(results) {
  const ctx = output.getContext("2d");

  output.width = camera.videoWidth;
  output.height = camera.videoHeight;

  ctx.clearRect(0, 0, output.width, output.height);

  const hands = results.landmarks || [];

  // =====================================
  // NO HANDS
  // =====================================

  if (hands.length === 0) {
    gestureFrames = 0;
    gestureConfirmed = false;

    sukunaFrames = 0;
    sukunaConfirmed = false;

    if (!domainActive) {
      gestureStatus.textContent = "Gesture: Not detected";
    }

    return;
  }

  // =====================================
  // DOMAIN ACTIVE
  // ONLY CHECK CANCEL
  // =====================================

  if (domainActive) {
    // Cancel only needs ONE hand
    if (hands.length >= 1) {
      const cancelDetected = isCancelSign(hands[0]);

      handleCancelGesture(cancelDetected);
    }
  }

  // =====================================
  // DOMAIN NOT ACTIVE
  // CHECK GOJO / SUKUNA
  // =====================================
  else {
    // ---------------------------------
    // TWO HANDS = SUKUNA
    // ---------------------------------

    if (hands.length >= 2) {
      gestureFrames = 0;
      gestureConfirmed = false;

      const sukunaDetected = isSukunaSign(hands);

      handleSukunaGesture(sukunaDetected);
    }

    // ---------------------------------
    // ONE HAND = GOJO
    // ---------------------------------
    else if (hands.length === 1) {
      sukunaFrames = 0;
      sukunaConfirmed = false;

      const gojoDetected = isGojoSign(hands[0]);

      handleGojoGesture(gojoDetected);
    }
  }

  // =====================================
  // DRAW HAND LANDMARKS
  // =====================================

  for (const landmarks of hands) {
    for (const point of landmarks) {
      const x = point.x * output.width;

      const y = point.y * output.height;

      ctx.beginPath();

      ctx.arc(x, y, 5, 0, Math.PI * 2);

      ctx.fill();
    }

    drawConnections(ctx, landmarks);
  }
}

/* =========================
   GOJO GESTURE HANDLER
========================= */

function handleGojoGesture(gojoDetected) {
  if (domainActive) {
    return;
  }

  if (gojoDetected) {
    gestureFrames++;

    if (gestureFrames >= REQUIRED_FRAMES) {
      if (!gestureConfirmed) {
        gestureConfirmed = true;

        gestureStatus.textContent = "GOJO SIGN CONFIRMED ✓";

        console.log("🔥 GOJO SIGN CONFIRMED");

        activateDomainExpansion("gojo");
      }
    } else {
      const progress = Math.round((gestureFrames / REQUIRED_FRAMES) * 100);

      gestureStatus.textContent = `Detecting Gojo Sign... ${progress}%`;
    }
  } else {
    gestureFrames = 0;
    gestureConfirmed = false;

    if (!sukunaConfirmed) {
      gestureStatus.textContent = "Gesture: Not detected";
    }
  }
}

/* =========================
   SUKUNA GESTURE HANDLER
========================= */

function handleSukunaGesture(sukunaDetected) {
  if (domainActive) {
    return;
  }

  if (sukunaDetected) {
    sukunaFrames++;

    console.log("SUKUNA STABILITY:", sukunaFrames, "/", REQUIRED_FRAMES);

    if (sukunaFrames >= REQUIRED_FRAMES) {
      if (!sukunaConfirmed) {
        sukunaConfirmed = true;

        gestureStatus.textContent = "SUKUNA SIGN CONFIRMED ✓";

        console.log("🔥 SUKUNA SIGN CONFIRMED");

        activateDomainExpansion("sukuna");
      }
    } else {
      const progress = Math.round((sukunaFrames / REQUIRED_FRAMES) * 100);

      gestureStatus.textContent = `Detecting Sukuna Sign... ${progress}%`;
    }
  } else {
    sukunaFrames = 0;
    sukunaConfirmed = false;
  }
}

/* =========================
   HAND CONNECTIONS
========================= */

function drawConnections(ctx, landmarks) {
  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17],
  ];

  ctx.beginPath();

  for (const [start, end] of connections) {
    const x1 = landmarks[start].x * ctx.canvas.width;
    const y1 = landmarks[start].y * ctx.canvas.height;

    const x2 = landmarks[end].x * ctx.canvas.width;
    const y2 = landmarks[end].y * ctx.canvas.height;

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }

  ctx.stroke();
}

/* =========================
   HAND LANDMARKER
========================= */

async function createHandLandmarker(vision) {
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    },

    runningMode: "VIDEO",

    numHands: 2,
  });

  console.log("Hand Landmarker ready!");
}

/* =========================
   PERSON SEGMENTATION
========================= */

async function createImageSegmenter(vision) {
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
    },

    runningMode: "VIDEO",

    outputCategoryMask: true,

    outputConfidenceMasks: false,
  });

  console.log("Image Segmenter ready!");
}

/* =========================
   GEOMETRY
========================= */

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function angleBetween(a, b, c) {
  const ab = {
    x: a.x - b.x,
    y: a.y - b.y,
  };

  const cb = {
    x: c.x - b.x,
    y: c.y - b.y,
  };

  const dot = ab.x * cb.x + ab.y * cb.y;

  const magnitudeAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);

  const magnitudeCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);

  const cosine = dot / (magnitudeAB * magnitudeCB);

  const clampedCosine = Math.max(-1, Math.min(1, cosine));

  return Math.acos(clampedCosine) * (180 / Math.PI);
}

function getFingerAngle(landmarks, mcp, pip, dip, tip) {
  const angle1 = angleBetween(landmarks[mcp], landmarks[pip], landmarks[dip]);

  const angle2 = angleBetween(landmarks[pip], landmarks[dip], landmarks[tip]);

  return (angle1 + angle2) / 2;
}

/* =========================
   GOJO SIGN DETECTOR
========================= */

function isGojoSign(landmarks) {
  const indexAngle = getFingerAngle(landmarks, 5, 6, 7, 8);

  const middleAngle = getFingerAngle(landmarks, 9, 10, 11, 12);

  const ringAngle = getFingerAngle(landmarks, 13, 14, 15, 16);

  const pinkyAngle = getFingerAngle(landmarks, 17, 18, 19, 20);

  const indexCorrect = indexAngle >= 160;

  const middleCorrect = middleAngle >= 155;

  const ringCorrect = ringAngle >= 90 && ringAngle <= 135;

  const pinkyCorrect = pinkyAngle >= 90 && pinkyAngle <= 135;

  return indexCorrect && middleCorrect && ringCorrect && pinkyCorrect;
}

/* =========================
   SUKUNA SIGN DETECTOR
========================= */

function isSukunaSign(hands) {
  // Sukuna requires both hands
  if (!hands || hands.length !== 2) {
    return false;
  }

  const left = hands[0];
  const right = hands[1];

  // =========================
  // INDEX FINGERS
  // =========================

  const leftIndexAngle = getFingerAngle(left, 5, 6, 7, 8);

  const rightIndexAngle = getFingerAngle(right, 5, 6, 7, 8);

  // Much more forgiving
  const indexesExtended = leftIndexAngle >= 130 && rightIndexAngle >= 130;

  // =========================
  // INDEX FINGERTIPS
  // =========================

  const fingertipDistance = distance(left[8], right[8]);

  // Much larger tolerance
  const fingertipsClose = fingertipDistance <= 0.25;

  // =========================
  // OTHER FINGERS
  // =========================

  const leftMiddleAngle = getFingerAngle(left, 9, 10, 11, 12);

  const leftRingAngle = getFingerAngle(left, 13, 14, 15, 16);

  const leftPinkyAngle = getFingerAngle(left, 17, 18, 19, 20);

  const rightMiddleAngle = getFingerAngle(right, 9, 10, 11, 12);

  const rightRingAngle = getFingerAngle(right, 13, 14, 15, 16);

  const rightPinkyAngle = getFingerAngle(right, 17, 18, 19, 20);

  // Very forgiving:
  // fingers just need to be somewhat bent
  const fingersBent =
    leftMiddleAngle <= 165 &&
    leftRingAngle <= 165 &&
    leftPinkyAngle <= 165 &&
    rightMiddleAngle <= 165 &&
    rightRingAngle <= 165 &&
    rightPinkyAngle <= 165;

  // =========================
  // FINAL CHECK
  // =========================

  return indexesExtended && fingertipsClose && fingersBent;
}

/* =========================
   CANCEL SIGN DETECTOR
========================= */

function isCancelSign(landmarks) {
  const indexAngle = getFingerAngle(
    landmarks,
    5,
    6,
    7,
    8
  );

  const middleAngle = getFingerAngle(
    landmarks,
    9,
    10,
    11,
    12
  );

  const ringAngle = getFingerAngle(
    landmarks,
    13,
    14,
    15,
    16
  );

  const pinkyAngle = getFingerAngle(
    landmarks,
    17,
    18,
    19,
    20
  );

  // Open palm
  return (
    indexAngle >= 145 &&
    middleAngle >= 145 &&
    ringAngle >= 145 &&
    pinkyAngle >= 145
  );
}

/* =========================
   CANCEL GESTURE HANDLER
========================= */

function handleCancelGesture(cancelDetected) {
  if (!domainActive) {
    return;
  }

  if (cancelDetected) {
    cancelFrames++;

    console.log(
      "🖐️ CANCEL STABILITY:",
      cancelFrames,
      "/",
      CANCEL_REQUIRED_FRAMES
    );

    if (
      cancelFrames >=
      CANCEL_REQUIRED_FRAMES
    ) {
      if (!cancelConfirmed) {
        cancelConfirmed = true;

        gestureStatus.textContent =
          "DOMAIN CANCELLED ✓";

        console.log(
          "🖐️ DOMAIN CANCELLED"
        );

        cancelDomain();
      }
    } else {
      const progress = Math.round(
        (cancelFrames /
          CANCEL_REQUIRED_FRAMES) *
          100
      );

      gestureStatus.textContent =
        `Canceling Domain... ${progress}%`;
    }
  } else {
    cancelFrames = 0;
    cancelConfirmed = false;
  }
}

/* =========================
   DOMAIN ACTIVATION
========================= */

function activateDomainExpansion(domain) {
  if (domainActive) {
    return;
  }

  if (!DOMAIN_VIDEOS[domain]) {
    console.error("Unknown domain:", domain);

    return;
  }

  domainActive = true;

  console.log("🔥 ACTIVATING DOMAIN:", domain);

  // --------------------------------
  // SET VIDEO
  // --------------------------------

  domainVideo.src = DOMAIN_VIDEOS[domain];

  domainVideo.load();

  // --------------------------------
  // ACTIVATION FLASH
  // --------------------------------

  domainFlash.classList.remove("active");

  void domainFlash.offsetWidth;

  domainFlash.classList.add("active");

  // --------------------------------
  // SHOW DOMAIN
  // --------------------------------

  domainOverlay.classList.add("active");

  // --------------------------------
  // START VIDEO
  // --------------------------------

  domainVideo.currentTime = 0;

  domainVideo.play().catch((error) => {
    console.error("Video playback failed:", error);
  });
}

/* =========================
   CANCEL DOMAIN
========================= */

function cancelDomain() {
  if (!domainActive) {
    return;
  }

  console.log("❌ STOPPING DOMAIN");

  // Stop video
  domainVideo.pause();

  // Reset video
  domainVideo.currentTime = 0;

  // Hide domain
  domainOverlay.classList.remove(
    "active"
  );

  // Reset everything after fade
  setTimeout(() => {
    domainActive = false;

    gestureFrames = 0;
    gestureConfirmed = false;

    sukunaFrames = 0;
    sukunaConfirmed = false;

    cancelFrames = 0;
    cancelConfirmed = false;

    gestureStatus.textContent =
      "Gesture: Not detected";
  }, 500);
}

/* =========================
   COMPOSITE
========================= */

function updateDomainComposite(timestamp) {
  if (!imageSegmenter || !camera.videoWidth || !camera.videoHeight) {
    return;
  }

  domainComposite.width = window.innerWidth;

  domainComposite.height = window.innerHeight;

  const result = imageSegmenter.segmentForVideo(camera, timestamp);

  if (!result.categoryMask) {
    return;
  }

  drawPersonWithMask(result.categoryMask);
}

/* =========================
   DRAW PERSON
========================= */

function drawPersonWithMask(mask) {
  const maskWidth = mask.width;
  const maskHeight = mask.height;

  const maskData = mask.getAsUint8Array();

  // Create temporary mask canvas
  const maskCanvas = document.createElement("canvas");

  maskCanvas.width = maskWidth;
  maskCanvas.height = maskHeight;

  const maskCtx = maskCanvas.getContext("2d");

  const maskImage = maskCtx.createImageData(maskWidth, maskHeight);

  for (let i = 0; i < maskData.length; i++) {
    const value = maskData[i];
    const index = i * 4;

    // Person = 0
    if (value === 0) {
      maskImage.data[index] = 255;
      maskImage.data[index + 1] = 255;
      maskImage.data[index + 2] = 255;
      maskImage.data[index + 3] = 255;
    } else {
      maskImage.data[index] = 0;
      maskImage.data[index + 1] = 0;
      maskImage.data[index + 2] = 0;
      maskImage.data[index + 3] = 0;
    }
  }

  maskCtx.putImageData(maskImage, 0, 0);

  // Clear previous frame
  compositeCtx.clearRect(0, 0, domainComposite.width, domainComposite.height);

  compositeCtx.globalCompositeOperation = "source-over";

  const canvasWidth = domainComposite.width;

  const canvasHeight = domainComposite.height;

  const cameraWidth = camera.videoWidth;

  const cameraHeight = camera.videoHeight;

  const scale =
    Math.max(canvasWidth / cameraWidth, canvasHeight / cameraHeight) *
    PERSON_SCALE;

  const drawWidth = cameraWidth * scale;

  const drawHeight = cameraHeight * scale;

  const offsetX = (canvasWidth - drawWidth) / 2 + PERSON_OFFSET_X;

  const offsetY = (canvasHeight - drawHeight) / 2 + PERSON_OFFSET_Y;

  // Draw camera
  compositeCtx.drawImage(camera, offsetX, offsetY, drawWidth, drawHeight);

  // Keep only person
  compositeCtx.globalCompositeOperation = "destination-in";

  compositeCtx.drawImage(maskCanvas, offsetX, offsetY, drawWidth, drawHeight);

  compositeCtx.globalCompositeOperation = "source-over";
}

/* =========================
   VIDEO END
========================= */

domainVideo.addEventListener("ended", () => {
  // Fade domain away
  domainOverlay.classList.remove("active");

  // Keep composite alive during fade
  setTimeout(() => {
    domainActive = false;

    gestureConfirmed = false;
    gestureFrames = 0;

    sukunaConfirmed = false;
    sukunaFrames = 0;

    cancelConfirmed = false;
    cancelFrames = 0;

    gestureStatus.textContent = "Gesture: Not detected";
  }, 500);
});

/* =========================
   INITIALIZE
========================= */

async function initialize() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    await createHandLandmarker(vision);

    await createImageSegmenter(vision);

    console.log("All AI models ready!");
  } catch (error) {
    console.error("Model initialization failed:", error);

    status.textContent = "AI models failed to load.";
  }
}

initialize();
