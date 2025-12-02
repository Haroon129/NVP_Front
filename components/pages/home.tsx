"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "@/components/camera/useCamera";
import { useHandTracking } from "@/components/camera/useHandTracking";
import { useCropPreview } from "@/components/camera/useCropPreview";
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
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    const { handDetected, handStable, boxPxRef } = useHandTracking(
        videoRef,
        overlayCanvasRef,
        isCameraOn
    );

    useCropPreview(videoRef, previewCanvasRef, boxPxRef, isCameraOn);

    const [transcription, setTranscription] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const cooldownUntilRef = useRef<number>(0);

    const handleToggleCamera = () => {
        if (isCameraOn) stopCamera();
        else startCamera();
    };

    const sendPhotoToBackend = useCallback(async () => {
        // 👇 aquí recortamos SOLO la mano
        const blob = await captureCroppedPhoto(boxPxRef.current, 512);
        if (!blob) return;

        setIsSending(true);
        setTranscription(null);

        const uniqueName = `hand-${Date.now()}-${crypto.randomUUID()}.jpg`;

        const formData = new FormData();
        formData.append("file", blob, uniqueName);

        try {
            const res = await fetch("/api/classify", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Error al procesar la imagen");

            const data = await res.json();
            setTranscription(data.transcription ?? "Sin resultados.");
        } catch (err) {
            console.error(err);
            setTranscription("Ocurrió un error al clasificar la imagen.");
        } finally {
            cooldownUntilRef.current = Date.now() + 2000;
            setIsSending(false);
        }
    }, [captureCroppedPhoto, boxPxRef]);

    // Inicia countdown al estar estable
    useEffect(() => {
        if (!isCameraOn) {
            setCountdown(null);
            return;
        }

        const now = Date.now();
        if (now < cooldownUntilRef.current) return;

        const busy = isSending || isTakingPhoto;
        if (busy) return;

        if (!handDetected || !handStable) {
            if (countdown !== null) setCountdown(null);
            return;
        }

        if (countdown === null) setCountdown(3);
    }, [isCameraOn, handDetected, handStable, isSending, isTakingPhoto, countdown]);

    useEffect(() => {
        if (countdown === null) return;
        if (countdown <= 0) {
            setCountdown(null);
            void sendPhotoToBackend();
            return;
        }

        const t = window.setTimeout(() => {
            setCountdown((c) => (c === null ? null : c - 1));
        }, 1000);

        return () => window.clearTimeout(t);
    }, [countdown, sendPhotoToBackend]);

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

                        <CropPreview previewCanvasRef={previewCanvasRef} />
                    </div>

                    <CameraControls isCameraOn={isCameraOn} onToggleCamera={handleToggleCamera} />
                </div>

                <TranscriptionBox text={transcription} isLoading={isSending} />
            </div>
        </main>
    );
}
