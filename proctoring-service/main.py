

import asyncio
import base64
import json
import logging
import os
import time
from contextlib import asynccontextmanager

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proctoring-service")

# ---------------------------------------------------------------------------
# MediaPipe FaceLandmarker — loaded once at startup
# ---------------------------------------------------------------------------

# Path to the downloaded model file (must be in the same directory)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")

# We'll hold the FaceLandmarker instance in a module-level variable so it can
# be reused across WebSocket connections.
face_landmarker_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle for the FastAPI app."""
    global face_landmarker_instance
    logger.info("Loading MediaPipe FaceLandmarker model...")

    if not os.path.exists(MODEL_PATH):
        logger.error(
            "FaceLandmarker model not found at %s. "
            "Please download it from: "
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task",
            MODEL_PATH,
        )
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    options = vision.FaceLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    face_landmarker_instance = vision.FaceLandmarker.create_from_options(options)
    logger.info("MediaPipe FaceLandmarker loaded successfully.")
    yield
    # Cleanup
    if face_landmarker_instance:
        face_landmarker_instance.close()
    logger.info("Proctoring service shut down.")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(title="Procruit Proctoring Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Landmark Indices (MediaPipe Face Mesh 478 landmarks)
# ---------------------------------------------------------------------------
# Left eye corners
LEFT_EYE_INNER = 133   # Inner corner of the left eye
LEFT_EYE_OUTER = 33    # Outer corner of the left eye
LEFT_EYE_UPPER = 159   # Upper eyelid midpoint
LEFT_EYE_LOWER = 145   # Lower eyelid midpoint
LEFT_IRIS_CENTER = 468  # Center of the left iris

# Right eye corners
RIGHT_EYE_INNER = 362  # Inner corner of the right eye
RIGHT_EYE_OUTER = 263  # Outer corner of the right eye
RIGHT_EYE_UPPER = 386  # Upper eyelid midpoint
RIGHT_EYE_LOWER = 374  # Lower eyelid midpoint
RIGHT_IRIS_CENTER = 473 # Center of the right iris

# Gaze thresholds (tuned for typical webcam distances)
H_LEFT_THRESHOLD = 0.65    # Horizontal ratio above this → looking LEFT
H_RIGHT_THRESHOLD = 0.35   # Horizontal ratio below this → looking RIGHT
V_UP_THRESHOLD = 0.30      # Vertical ratio below this → looking UP
V_DOWN_THRESHOLD = 0.70    # Vertical ratio above this → looking DOWN


# ---------------------------------------------------------------------------
# Gaze Computation
# ---------------------------------------------------------------------------
def compute_gaze(landmarks, img_w: int, img_h: int) -> dict:
    """
    Compute gaze direction from MediaPipe FaceLandmarker landmarks.

    Parameters
    ----------
    landmarks : list of NormalizedLandmark
        The 478 facial landmarks from FaceLandmarker.
    img_w, img_h : int
        Dimensions of the source image.

    Returns
    -------
    dict with keys:
        gaze      : str  — "center", "left", "right", "up", or "down"
        h_ratio   : float — average horizontal iris position ratio
        v_ratio   : float — average vertical iris position ratio
    """
    # Check if we have enough landmarks for iris detection (need 478)
    if len(landmarks) < 474:
        return {"gaze": "unknown", "h_ratio": 0.5, "v_ratio": 0.5}

    # --- Helper: get (x, y) for a given landmark index ---
    def pt(idx):
        return (landmarks[idx].x * img_w, landmarks[idx].y * img_h)

    # ── LEFT EYE ──────────────────────────────────────────────────────
    l_inner = pt(LEFT_EYE_INNER)
    l_outer = pt(LEFT_EYE_OUTER)
    l_upper = pt(LEFT_EYE_UPPER)
    l_lower = pt(LEFT_EYE_LOWER)
    l_iris  = pt(LEFT_IRIS_CENTER)

    # Horizontal ratio for left eye
    l_h_denom = l_inner[0] - l_outer[0]
    l_h_ratio = (l_iris[0] - l_outer[0]) / l_h_denom if abs(l_h_denom) > 1e-6 else 0.5

    # Vertical ratio for left eye
    l_v_denom = l_lower[1] - l_upper[1]
    l_v_ratio = (l_iris[1] - l_upper[1]) / l_v_denom if abs(l_v_denom) > 1e-6 else 0.5

    # ── RIGHT EYE ─────────────────────────────────────────────────────
    r_inner = pt(RIGHT_EYE_INNER)
    r_outer = pt(RIGHT_EYE_OUTER)
    r_upper = pt(RIGHT_EYE_UPPER)
    r_lower = pt(RIGHT_EYE_LOWER)
    r_iris  = pt(RIGHT_IRIS_CENTER)

    # Horizontal ratio for right eye
    r_h_denom = r_outer[0] - r_inner[0]
    r_h_ratio = (r_iris[0] - r_inner[0]) / r_h_denom if abs(r_h_denom) > 1e-6 else 0.5

    # Vertical ratio for right eye
    r_v_denom = r_lower[1] - r_upper[1]
    r_v_ratio = (r_iris[1] - r_upper[1]) / r_v_denom if abs(r_v_denom) > 1e-6 else 0.5

    # ── AVERAGE BOTH EYES ─────────────────────────────────────────────
    avg_h = (l_h_ratio + r_h_ratio) / 2.0
    avg_v = (l_v_ratio + r_v_ratio) / 2.0

    # ── DETERMINE GAZE LABEL ──────────────────────────────────────────
    # Vertical extremes take priority (looking up/down is more suspicious)
    if avg_v < V_UP_THRESHOLD:
        gaze = "up"
    elif avg_v > V_DOWN_THRESHOLD:
        gaze = "down"
    elif avg_h < H_RIGHT_THRESHOLD:
        gaze = "right"
    elif avg_h > H_LEFT_THRESHOLD:
        gaze = "left"
    else:
        gaze = "center"

    return {
        "gaze": gaze,
        "h_ratio": round(avg_h, 3),
        "v_ratio": round(avg_v, 3),
    }


# ---------------------------------------------------------------------------
# WebSocket Endpoint — /ws/proctor
# ---------------------------------------------------------------------------
@app.websocket("/ws/proctor")
async def proctor_ws(ws: WebSocket):
    """
    WebSocket endpoint for real-time proctoring.

    Protocol
    --------
    Client sends JSON messages:
        { "type": "frame", "data": "<base64-encoded JPEG>" }

    Server responds with JSON:
        {
            "type": "gaze_result",
            "gaze": "center" | "left" | "right" | "up" | "down",
            "face_detected": true | false,
            "h_ratio": 0.512,
            "v_ratio": 0.481,
            "timestamp": 1709570400.123
        }
    """
    await ws.accept()
    logger.info("Proctoring WebSocket client connected.")

    try:
        while True:
            # Receive raw text message
            raw = await ws.receive_text()

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            if msg.get("type") != "frame":
                await ws.send_json({"type": "error", "detail": "Unknown message type"})
                continue

            frame_b64 = msg.get("data", "")
            if not frame_b64:
                logger.info("[Frame] Empty frame data received — skipping.")
                await ws.send_json({
                    "type": "gaze_result",
                    "gaze": "unknown",
                    "face_detected": False,
                    "timestamp": time.time(),
                })
                continue

            # ── Decode Base64 JPEG → OpenCV BGR image ─────────────────
            try:
                img_bytes = base64.b64decode(frame_b64)
                np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
                frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception as e:
                logger.warning("Frame decode error: %s", e)
                await ws.send_json({
                    "type": "gaze_result",
                    "gaze": "unknown",
                    "face_detected": False,
                    "timestamp": time.time(),
                })
                continue

            if frame_bgr is None:
                await ws.send_json({
                    "type": "gaze_result",
                    "gaze": "unknown",
                    "face_detected": False,
                    "timestamp": time.time(),
                })
                continue

            # ── Run MediaPipe FaceLandmarker (in thread to avoid blocking) ─
            img_h, img_w = frame_bgr.shape[:2]
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

            # Convert to MediaPipe Image format
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            # Run CPU-bound detection in a thread executor so the event loop
            # stays responsive for other WS messages.
            try:
                results = await asyncio.to_thread(
                    face_landmarker_instance.detect, mp_image
                )
            except Exception as det_err:
                logger.warning("[Frame] MediaPipe detect error: %s", det_err)
                await ws.send_json({
                    "type": "gaze_result",
                    "gaze": "unknown",
                    "face_detected": False,
                    "timestamp": time.time(),
                })
                continue

            if not results.face_landmarks:
                # No face detected in the frame
                logger.info("[Frame] No face detected in %dx%d frame.", img_w, img_h)
                await ws.send_json({
                    "type": "gaze_result",
                    "gaze": "away",
                    "face_detected": False,
                    "h_ratio": None,
                    "v_ratio": None,
                    "timestamp": time.time(),
                })
                continue

            # Use the first (and only) detected face
            face_landmarks = results.face_landmarks[0]
            gaze_info = compute_gaze(face_landmarks, img_w, img_h)

            logger.info(
                "[Frame] Gaze result: %s (h=%.3f, v=%.3f) | face_detected=True",
                gaze_info["gaze"], gaze_info["h_ratio"], gaze_info["v_ratio"],
            )

            await ws.send_json({
                "type": "gaze_result",
                "gaze": gaze_info["gaze"],
                "face_detected": True,
                "h_ratio": gaze_info["h_ratio"],
                "v_ratio": gaze_info["v_ratio"],
                "timestamp": time.time(),
            })

    except WebSocketDisconnect:
        logger.info("Proctoring WebSocket client disconnected.")
    except Exception as e:
        logger.error("Proctoring WebSocket error: %s", e)
        try:
            await ws.close(code=1011, reason=str(e))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "proctoring",
        "face_landmarker_loaded": face_landmarker_instance is not None,
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
