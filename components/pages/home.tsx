"use client";

import { useCallback, useEffect, useState } from "react";
import { useCamera, CropBoxNorm } from "../camera/useCamera";
import { CameraView } from "../camera/CameraView";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Recuadro normalizado (0..1) que debe coincidir visualmente con el cuadro verde de CameraView
const ROI_BOX: CropBoxNorm = {
    x: 0.2,   // 20% desde la izquierda
    y: 0.125, // 12.5% desde arriba
    width: 0.6,
    height: 0.75,
};

export default function HomePage() {
    const {
        videoRef,
        isCameraOn,
        error: cameraError,
        startCamera,
        stopCamera,
        capturePhotoInBox,
    } = useCamera();

    const [isSending, setIsSending] = useState(false);
    const [transcription, setTranscription] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Limpia el objectURL anterior cuando cambie
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleToggleCamera = useCallback(() => {
        if (isCameraOn) {
            stopCamera();
        } else {
            void startCamera();
        }
    }, [isCameraOn, startCamera, stopCamera]);

    const handleCaptureAndSend = useCallback(async () => {
        setErrorMsg(null);
        setTranscription(null);

        try {
            if (!isCameraOn) {
                setErrorMsg("La cámara no está encendida.");
                return;
            }

            setIsSending(true);

            // 1) Capturamos SOLO el área del recuadro ROI
            const blob = await capturePhotoInBox(ROI_BOX);
            if (!blob) {
                setErrorMsg("No se pudo capturar la imagen. Inténtalo de nuevo.");
                setIsSending(false);
                return;
            }

            // 2) Mostramos preview (última mano capturada)
            const url = URL.createObjectURL(blob);
            setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
            });

            // 3) Enviamos al backend (igual que antes)
            const fileName = `hand_${Date.now()}.jpg`;
            const formData = new FormData();
            formData.append("file", blob, fileName);

            const res = await fetch("/api/classify", {
                method: "POST",
                body: formData,
            });

            const contentType = res.headers.get("content-type") ?? "";
            const payload = contentType.includes("application/json")
                ? await res.json().catch(() => null)
                : await res.text().catch(() => null);

            if (!res.ok) {
                console.error("Error /api/classify:", res.status, payload);
                setErrorMsg(
                    typeof payload === "object" && payload?.error
                        ? payload.error
                        : `Error al procesar la imagen (status ${res.status})`
                );
                setIsSending(false);
                return;
            }

            const transcriptionText =
                (payload as any)?.transcription ??
                (payload as any)?.prediccion ??
                "Sin resultados.";

            setTranscription(String(transcriptionText));
        } catch (err: any) {
            console.error(err);
            setErrorMsg(String(err?.message ?? "Error al procesar la imagen."));
        } finally {
            setIsSending(false);
        }
    }, [capturePhotoInBox, isCameraOn]);

    return (
        <div className="min-h-screen w-full bg-background">
            <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
                <header>
                    <h1 className="text-2xl font-semibold">Captura de mano</h1>
                    <p className="text-muted-foreground">
                        Coloca tu mano dentro del recuadro y pulsa{" "}
                        <span className="font-medium">“Capturar y enviar”</span>. Solo se
                        enviará al backend la parte del vídeo dentro del recuadro.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-8 items-start">
                    {/* Columna cámara */}
                    <div className="space-y-4">
                        <CameraView videoRef={videoRef} />

                        <div className="flex flex-wrap gap-3 items-center">
                            <Button variant={isCameraOn ? "outline" : "default"} onClick={handleToggleCamera}>
                                {isCameraOn ? "Apagar cámara" : "Encender cámara"}
                            </Button>

                            <Button
                                onClick={handleCaptureAndSend}
                                disabled={!isCameraOn || isSending}
                            >
                                {isSending ? "Enviando..." : "Capturar y enviar"}
                            </Button>

                            {cameraError && (
                                <span className="text-sm text-red-500">{cameraError}</span>
                            )}
                        </div>
                    </div>

                    {/* Columna resultado */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Última mano capturada</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Última captura"
                                        className="w-full rounded-md border object-contain max-h-64 bg-muted"
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Todavía no se ha capturado ninguna imagen.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Predicción</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {errorMsg ? (
                                    <p className="text-sm text-red-500">{errorMsg}</p>
                                ) : transcription ? (
                                    <p className="text-lg font-semibold">{transcription}</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Captura una mano para ver la predicción del modelo.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
