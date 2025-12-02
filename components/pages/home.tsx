"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "@/components/camera/useCamera";
import { useHandTracking } from "@/components/camera/useHandTracking";
import { CameraView } from "@/components/camera/CameraView";
import { CameraControls } from "@/components/camera/CameraControls";
import { HandStatus } from "@/components/camera/HandStatus";
import { CropPreview } from "@/components/camera/CropPreview";
import { TranscriptionBox } from "@/components/textBox/TranscriptionBox";

export default function HomePage() {
    const {
        videoRef,
        isCameraOn,
        isTakingPhoto,
        startCamera,
        stopCamera,
        captureCroppedPhoto,
    } = useCamera();

    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const { handDetected, handStable, handSessionId, boxPxRef } = useHandTracking(
        videoRef,
        overlayCanvasRef,
        isCameraOn
    );

    const [transcription, setTranscription] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [lastCaptureUrl, setLastCaptureUrl] = useState<string | null>(null);
    const lastCaptureUrlRef = useRef<string | null>(null);

    // Para no capturar dos veces en la misma “mano”
    const capturedSessionRef = useRef<number>(0);

    // Limpieza de objectURL para no “filtrar” memoria
    useEffect(() => {
        return () => {
            if (lastCaptureUrlRef.current) URL.revokeObjectURL(lastCaptureUrlRef.current);
        };
    }, []);

    const handleToggleCamera = () => {
        if (isCameraOn) stopCamera();
        else startCamera();
    };

    const sendPhotoToBackend = useCallback(async () => {
        const blob = await captureCroppedPhoto(boxPxRef.current, 512);
        if (!blob) return;

        // ✅ Congelar preview con ESTA captura (la misma enviada)
        const nextUrl = URL.createObjectURL(blob);
        if (lastCaptureUrlRef.current) URL.revokeObjectURL(lastCaptureUrlRef.current);
        lastCaptureUrlRef.current = nextUrl;
        setLastCaptureUrl(nextUrl);

        setIsSending(true);
        setTranscription(null);

        const uniqueName = `hand-${Date.now()}-${crypto.randomUUID()}.jpg`;
        const formData = new FormData();
        formData.append("file", blob, uniqueName);

        try {
            const res = await fetch("/api/classify", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Error al procesar la imagen");
            const data = await res.json();
            setTranscription(data.transcription ?? "Sin resultados.");
        } catch (err) {
            console.error(err);
            setTranscription("Ocurrió un error al clasificar la imagen.");
        } finally {
            setIsSending(false);
        }
    }, [captureCroppedPhoto, boxPxRef]);

    // ✅ Armar countdown SOLO si hay mano NUEVA (handSessionId) y aún no capturada
    useEffect(() => {
        if (!isCameraOn) {
            setCountdown(null);
            return;
        }

        const busy = isSending || isTakingPhoto;
        if (busy) return;

        // si no hay mano / no estable, cancelamos countdown
        if (!handDetected || !handStable) {
            if (countdown !== null) setCountdown(null);
            return;
        }

        // ✅ si esta sesión ya fue capturada, NO hacemos nada
        if (handSessionId !== 0 && capturedSessionRef.current === handSessionId) {
            if (countdown !== null) setCountdown(null);
            return;
        }

        if (countdown === null) setCountdown(3);
    }, [isCameraOn, handDetected, handStable, handSessionId, isSending, isTakingPhoto, countdown]);

    useEffect(() => {
        if (countdown === null) return;

        if (countdown <= 0) {
            setCountdown(null);

            // ✅ marcamos esta sesión como “capturada” antes de enviar (evita dobles disparos)
            capturedSessionRef.current = handSessionId;

            void sendPhotoToBackend();
            return;
        }

        const t = window.setTimeout(() => {
            setCountdown((c) => (c === null ? null : c - 1));
        }, 1000);

        return () => window.clearTimeout(t);
    }, [countdown, sendPhotoToBackend, handSessionId]);

    const busy = isSending || isTakingPhoto;

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-5xl">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8 items-start">
                    <div>
                        <CameraView videoRef={videoRef} overlayCanvasRef={overlayCanvasRef} />

                        <HandStatus
                            isCameraOn={isCameraOn}
                            handDetected={handDetected}
                            handStable={handStable}
                            countdown={countdown}
                            isBusy={busy}
                        />

                        <CropPreview lastCaptureUrl={lastCaptureUrl} />
                    </div>

                    <CameraControls isCameraOn={isCameraOn} onToggleCamera={handleToggleCamera} />
                </div>

                <TranscriptionBox text={transcription} isLoading={isSending} />
            </div>
        </main>
    );
}
