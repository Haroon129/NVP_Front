"use client";

import { useCallback, useEffect, useState } from "react";
import { useCamera, CropBoxNorm } from "../camera/useCamera";
import { CameraView } from "../camera/CameraView";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Recuadro normalizado (0..1) que debe coincidir visualmente con el cuadro verde de CameraView
const ROI_BOX: CropBoxNorm = {
    x: 0.2, // 20% desde la izquierda
    y: 0.125, // 12.5% desde arriba
    width: 0.6,
    height: 0.75,
};

// Ruta del API de entrenamiento en el front (tú crearás /api/train-sample)
const TRAIN_API_PATH = "/api/train-sample";

export default function TrainingPage() {
    const { videoRef, isCameraOn, error: cameraError, startCamera, stopCamera, capturePhotoInBox } =
        useCamera();

    const [isSending, setIsSending] = useState(false);
    const [transcription, setTranscription] = useState<string | null>(null);
    const [porcentaje, setPorcentaje] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [lastBlob, setLastBlob] = useState<Blob | null>(null);
    const [trainingStatus, setTrainingStatus] = useState<string | null>(null);

    const [showCorrectionInput, setShowCorrectionInput] = useState(false);
    const [correctionValue, setCorrectionValue] = useState("");

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
        setPorcentaje(null);
        setTrainingStatus(null);
        setShowCorrectionInput(false);
        setCorrectionValue("");
        setLastBlob(null);

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

            setLastBlob(blob);

            // 2) Preview de la captura
            const url = URL.createObjectURL(blob);
            setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
            });

            // 3) Enviamos a /api/classify para predecir
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
                    typeof payload === "object" && (payload as any)?.error
                        ? (payload as any).error
                        : `Error al procesar la imagen (status ${res.status})`
                );
                setIsSending(false);
                return;
            }

            // 4) Predicción (número)
            const transcriptionText =
                (payload as any)?.transcription ?? (payload as any)?.prediccion ?? "Sin resultados.";
            setTranscription(String(transcriptionText));

            // 5) Score / porcentaje (ej: 0.6 -> 60.0%)
            const rawScore =
                (payload as any)?.score ??
                (payload as any)?.confidence ??
                (payload as any)?.porcentaje ??
                (payload as any)?.probability ??
                null;

            let pctStr: string | null = null;

            if (typeof rawScore === "number") {
                const value = rawScore <= 1 ? rawScore * 100 : rawScore;
                pctStr = `${value.toFixed(1)}%`;
            } else if (typeof rawScore === "string") {
                const n = parseFloat(rawScore);
                if (!Number.isNaN(n)) {
                    const value = n <= 1 ? n * 100 : n;
                    pctStr = `${value.toFixed(1)}%`;
                }
            }

            setPorcentaje(pctStr);
        } catch (err: any) {
            console.error(err);
            setErrorMsg(String(err?.message ?? "Error al procesar la imagen."));
        } finally {
            setIsSending(false);
        }
    }, [capturePhotoInBox, isCameraOn]);

    // Enviar muestra de entrenamiento (usa el número que toque)
    const sendTrainingSample = useCallback(
        async (label: string) => {
            setErrorMsg(null);
            setTrainingStatus(null);

            const trimmed = label.trim();
            if (!trimmed) {
                setErrorMsg("Debes indicar un número para entrenar.");
                return;
            }
            if (!lastBlob) {
                setErrorMsg("No hay ninguna imagen capturada para enviar al entrenamiento.");
                return;
            }

            try {
                setIsSending(true);

                const fileName = `${trimmed}_${Date.now()}.jpg`; // el valor va en el nombre
                const fd = new FormData();
                fd.append("file", lastBlob, fileName);
                // Campo adicional por si el backend quiere leerlo directamente
                fd.append("label", trimmed);

                const res = await fetch(TRAIN_API_PATH, {
                    method: "POST",
                    body: fd,
                });

                const contentType = res.headers.get("content-type") ?? "";
                const payload = contentType.includes("application/json")
                    ? await res.json().catch(() => null)
                    : await res.text().catch(() => null);

                if (!res.ok) {
                    console.error("Error entrenamiento:", res.status, payload);
                    setErrorMsg(
                        typeof payload === "object" && (payload as any)?.error
                            ? (payload as any).error
                            : `Error al guardar la muestra de entrenamiento (status ${res.status})`
                    );
                    return;
                }

                setTrainingStatus("Muestra de entrenamiento guardada correctamente.");
            } catch (err: any) {
                console.error(err);
                setErrorMsg(String(err?.message ?? "Error al guardar la muestra de entrenamiento."));
            } finally {
                setIsSending(false);
            }
        },
        [lastBlob]
    );

    const handleConfirmYes = useCallback(() => {
        if (!transcription) {
            setErrorMsg("No hay predicción disponible.");
            return;
        }
        // Envía con el número obtenido de la predicción
        void sendTrainingSample(transcription);
    }, [transcription, sendTrainingSample]);

    const handleConfirmNo = useCallback(() => {
        setShowCorrectionInput(true);
    }, []);

    const handleSendCorrection = useCallback(() => {
        if (!correctionValue.trim()) {
            setErrorMsg("Debes escribir un número para la corrección.");
            return;
        }
        void sendTrainingSample(correctionValue);
    }, [correctionValue, sendTrainingSample]);

    return (
        <div className="min-h-screen w-full bg-background">
            <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
                <header>
                    <h1 className="text-2xl font-semibold">Entrenamiento del modelo</h1>
                    <p className="text-muted-foreground">
                        Captura la mano, revisa la predicción y confirma si es correcta. Si no lo es, escribe
                        el número correcto para guardar la muestra etiquetada.
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

                            <Button onClick={handleCaptureAndSend} disabled={!isCameraOn || isSending}>
                                {isSending ? "Procesando..." : "Capturar y predecir"}
                            </Button>

                            {cameraError && <span className="text-sm text-red-500">{cameraError}</span>}
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Confirmar etiqueta para entrenamiento</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {transcription ? (
                                    <>
                                        <p className="text-sm">
                                            ¿Es correcto este número para la imagen capturada?{" "}
                                            <span className="font-semibold">{transcription}</span>
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                variant="default"
                                                onClick={handleConfirmYes}
                                                disabled={!lastBlob || isSending}
                                            >
                                                Sí, guardar con este número
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleConfirmNo}
                                                disabled={!lastBlob || isSending}
                                            >
                                                No, corregir número
                                            </Button>
                                        </div>

                                        {showCorrectionInput && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    Número correcto para esta imagen
                                                </label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        value={correctionValue}
                                                        onChange={(e) => setCorrectionValue(e.target.value)}
                                                        placeholder="Escribe el número correcto"
                                                        className="w-32"
                                                    />
                                                    <Button
                                                        variant="secondary"
                                                        onClick={handleSendCorrection}
                                                        disabled={isSending}
                                                    >
                                                        Enviar corrección
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {trainingStatus && (
                                            <p className="text-sm text-emerald-600">{trainingStatus}</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Primero captura una mano y obtén una predicción para poder entrenar el modelo.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>





                    {/* Columna resultado y entrenamiento */}
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

                        <Card>
                            <CardHeader>
                                <CardTitle>Porcentaje acertado</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {errorMsg ? (
                                    <p className="text-sm text-red-500">{errorMsg}</p>
                                ) : porcentaje ? (
                                    <p className="text-lg font-semibold">{porcentaje}</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Captura una mano para ver el porcentaje de confianza del modelo.
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
