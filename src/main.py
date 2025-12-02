import streamlit as st
import cv2
import numpy as np
import mediapipe as mp
import av
import os
import time
from datetime import datetime
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase

SAVE_DIR = "capturas"
os.makedirs(SAVE_DIR, exist_ok=True)

st.title("Captura de manos con estilo fotográfico en blanco y negro")

# ---------- ESTADO GLOBAL ----------
if "last_frame" not in st.session_state:
    st.session_state.last_frame = None

if "capture_request" not in st.session_state:
    st.session_state.capture_request = False


# ---------- FUNCIONES ----------
def request_capture():
    st.session_state.capture_request = True


def process_and_save_image(frame):
    TARGET_SIZE = 28

    # 1) Recorte centrado (bounding box fijo)
    h, w, _ = frame.shape
    factor = 0.8  # entre 0 y 1, 1 significa recorte completo
    size = int(min(w, h) * factor)
    x1 = (w - size) // 2
    y1 = (h - size) // 2
    crop = frame[y1:y1+size, x1:x1+size]


    # 2) Reescalado
    resized = cv2.resize(crop, (TARGET_SIZE, TARGET_SIZE), interpolation=cv2.INTER_AREA)

    # 3) --- Estilo fotográfico en blanco y negro ---
    # Convertir a gris
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Mejorar contraste
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Suavizado con preservación de bordes
    smooth = cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)

    # Normalización
    final_img = cv2.normalize(smooth, None, 0, 255, cv2.NORM_MINMAX)

    # 4) Guardar
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{SAVE_DIR}/mano_{timestamp}.jpg"
    cv2.imwrite(filename, final_img)

    return filename


# ---------- PROCESADOR DE VIDEO ----------
class VideoProcessor(VideoProcessorBase):
    def __init__(self):
        self.mp_hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6
        )
        self.last_landmarks = None
        self.still_start = None
        self.motion_threshold = 0.005
        self.required_still_time = 2.0

    def is_hand_still(self, landmarks):
        if self.last_landmarks is None:
            self.last_landmarks = landmarks
            return False

        diffs = np.abs(np.array(landmarks) - np.array(self.last_landmarks))
        motion = np.mean(diffs)

        self.last_landmarks = landmarks
        return motion < self.motion_threshold

    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")

        # Guardamos frame global
        st.session_state.last_frame = img.copy()

        # Solo detección para saber si está quieta (no recortamos aquí)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self.mp_hands.process(img_rgb)

        if results.multi_hand_landmarks:
            hand = results.multi_hand_landmarks[0]
            landmarks = [(lm.x, lm.y, lm.z) for lm in hand.landmark]

            # Dibujar solo para debug
            h, w, _ = img.shape
            xs = [lm.x for lm in hand.landmark]
            ys = [lm.y for lm in hand.landmark]
            x1 = int(min(xs) * w)
            y1 = int(min(ys) * h)
            x2 = int(max(xs) * w)
            y2 = int(max(ys) * h)

            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Detectar mano quieta
            if self.is_hand_still(landmarks):
                if self.still_start is None:
                    self.still_start = time.time()
                else:
                    if time.time() - self.still_start >= self.required_still_time:
                        if st.session_state.last_frame is not None:
                            filepath = process_and_save_image(st.session_state.last_frame)
                            print(f"Auto-captura guardada en: {filepath}")
                        self.still_start = None
            else:
                self.still_start = None

        return av.VideoFrame.from_ndarray(img, format="bgr24")


# ---------- UI ----------
st.write("La app captura automáticamente cuando la mano está quieta 2s.")
st.write("O usa el botón para capturar manualmente.")

# Bloquear botón si no hay frame
ready = st.session_state.last_frame is not None
st.button("📸 Capturar", on_click=request_capture, disabled=not ready)

webrtc_ctx = webrtc_streamer(
    key="handcam",
    video_processor_factory=VideoProcessor,
    media_stream_constraints={"video": True, "audio": False},
)

# Ejecutar captura manual
if st.session_state.capture_request:
    if st.session_state.last_frame is None:
        st.warning("Aún no hay imagen disponible. Espera un momento.")
    else:
        filepath = process_and_save_image(st.session_state.last_frame)
        st.success(f"Imagen guardada en {filepath}")

    st.session_state.capture_request = False
