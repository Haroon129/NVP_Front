"use client";

import { useState } from "react";
import { useCamera } from "@/components/camera/useCamera";
import { CameraView } from "@/components/camera/CameraView";
import { CameraControls } from "@/components/camera/CameraControls";
import { TranscriptionBox } from "@/components/textBox/TranscriptionBox";

export default function HomePage() {
    const {
        videoRef,
        isCameraOn,
        isTakingPhoto,
        startCamera,
        stopCamera,
        capturePhoto,
    } = useCamera();

    const [transcription, setTranscription] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const handleToggleCamera = () => {
        if (isCameraOn) stopCamera();
        else startCamera();
    };

    const handleTakePhoto = async () => {
        const blob = await capturePhoto();
        if (!blob) return;

        setIsSending(true);
        setTranscription(null);

        const uniqueName = `sign-${Date.now()}-${crypto.randomUUID()}.jpg`;

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
            setIsSending(false);
        }
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-5xl">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8 items-start">
                    
                    <CameraView videoRef={videoRef} />

                    <CameraControls
                        isCameraOn={isCameraOn}
                        isTakingPhoto={isTakingPhoto || isSending}
                        onToggleCamera={handleToggleCamera}
                        onTakePhoto={handleTakePhoto}
                    />
                </div>

                <TranscriptionBox text={transcription} isLoading={isSending} />
            </div>
        </main>
    );
}
