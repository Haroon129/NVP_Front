# HandSign Capture (Next.js) — Camera + Hand Bounding Box + Auto Capture

Aplicación web en **Next.js (App Router)** que:
- Abre la **cámara** y solicita permisos.
- Detecta la **mano en tiempo real** con **MediaPipe Tasks Vision**.
- Dibuja un **cuadro (bounding box)** alrededor de la mano.
- Cuando la mano está **quieta**, inicia una **cuenta regresiva de 3s** y toma una foto automáticamente.
- **Recorta** la imagen para enviar **solo el área de la mano** al backend.
- Muestra un preview congelado de la **última mano enviada** (sin guardar archivos en el navegador).
- Espera una respuesta de backend (mock) para mostrar una “transcripción/clasificación”.

> Nota: El frontend **no guarda** imágenes. Solo genera un `Blob` en memoria para enviarlo al backend. El preview se renderiza desde un `ObjectURL` temporal (revocado cuando se reemplaza).

---

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **TailwindCSS**
- **shadcn/ui**
- **@mediapipe/tasks-vision** (HandLandmarker)

---

## Requisitos

- Docker y Docker Compose instalados
- `next.config.js` debe incluir:
  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = { output: "standalone" };
  module.exports = nextConfig;
````

---

## Ejecutar con Docker (Recomendado)

### Levantar en modo producción

```bash
docker compose up --build
```

Abrir:

* [http://localhost:3000](http://localhost:3000)

### Parar contenedores

```bash
docker compose down
```

---

## Ejecutar en local (sin Docker)

### Instalar dependencias

```bash
npm install
```

### Dev server

```bash
npm run dev
```

Abrir:

* [http://localhost:3000](http://localhost:3000)

### Build + Start (producción local)

```bash
npm run build
npm run start
```

---

## Estructura del Proyecto

```txt
app/
  page.tsx
  api/
    classify/
      route.ts

components/
  camera/
    useCamera.ts
    useHandTracking.ts
    CameraView.tsx
    CameraControls.tsx
    HandStatus.tsx
  CropPreview.tsx
  TranscriptionBox.tsx

Dockerfile
docker-compose.yml
next.config.js
```

---

## ¿Cómo funciona?

### 1) Cámara

Se gestiona con el hook:

* `components/camera/useCamera.ts`

Responsabilidades:

* Solicitar permisos (`getUserMedia`)
* Encender/apagar cámara
* Capturar frame
* Capturar **recorte** (bbox) y devolver `Blob JPG`

### 2) Detección de mano + Bounding Box (overlay)

Se gestiona con:

* `components/camera/useHandTracking.ts`

Responsabilidades:

* Cargar `HandLandmarker` de MediaPipe Tasks Vision
* Ejecutar detección en un loop con `requestAnimationFrame`
* Calcular bounding box con landmarks
* Dibujar el rectángulo sobre un `<canvas>` superpuesto al video
* Determinar si la mano está “quieta” (estabilidad)
* Generar `handSessionId` para controlar “nueva mano”:

  * Se incrementa cuando pasa de “no hay mano” → “hay mano”
  * Esto evita capturar múltiples veces la misma mano en pantalla

### 3) Captura automática (3 segundos)

Lo orquesta `app/page.tsx`:

* Si `handDetected && handStable` y **esta sesión no fue capturada**:

  * inicia `countdown = 3`
  * cuando llega a `0` → recorta con `captureCroppedPhoto(boxPxRef.current)` y envía

### 4) Preview congelado de la última mano enviada

En `app/page.tsx`:

* Al capturar un `Blob`, se crea `URL.createObjectURL(blob)`
* Se renderiza en el componente:

  * `components/CropPreview.tsx`
* Se revoca el URL anterior para evitar fugas de memoria:

  * `URL.revokeObjectURL(prevUrl)`

✅ El preview **solo cambia** cuando se captura una **nueva mano** (nuevo `handSessionId`).

### 5) Backend mock (por ahora)

Endpoint:

* `app/api/classify/route.ts`

Hoy:

* Recibe `multipart/form-data` con la imagen `file`
* Simula “inferencia” con una espera artificial
* Devuelve una respuesta `JSON` con un campo `transcription`

Más adelante:

* Se reemplaza para que lo procese tu backend real (Python, Node, etc.)
* El backend decidirá si guarda, clasifica, sube a S3, etc.

---

## Flujo de UI (Resumen)

1. Usuario enciende cámara
2. Aparece la mano en el encuadre
3. Se dibuja el cuadro alrededor
4. Cuando la mano está quieta:

   * “Mantén la mano quieta… foto en 3s”
5. Se captura automáticamente
6. Se envía el recorte al backend
7. Se congela el preview con la última mano enviada
8. Se muestra la transcripción retornada
9. Se permite una nueva captura solo cuando:

   * La mano desaparece del encuadre y vuelve a aparecer

---

## Ajustes rápidos (Tuning)

Los parámetros más importantes están en `useHandTracking.ts`:

* `MOVE_THRESHOLD`

  * Más bajo = exige más quietud (menos tolerancia a movimiento)

* `STABLE_FRAMES_NEEDED`

  * Más alto = más tiempo quieta antes de iniciar captura

* `pad` (padding del bbox)

  * Aumenta o reduce el margen alrededor de la mano

* `maxDim` (en `captureCroppedPhoto`)

  * Controla resolución máxima del recorte enviado (por defecto 512)

---

## Errores comunes / Tips

### “INFO: Created TensorFlow Lite XNNPACK delegate for CPU.”

No es error, es log informativo de inicialización.

### Si no detecta la mano

* Asegúrate de tener buena iluminación
* Acerca la mano al centro del encuadre
* Revisa permisos de cámara en el navegador


