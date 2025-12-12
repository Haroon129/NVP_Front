import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// En Docker, probablemente será algo como: http://backend:5001/predict
// En local: http://127.0.0.1:5001/predict
const PREDICT_URL =
process.env.PREDICT_URL ?? "http://host.docker.internal:5001/predict";

export async function POST(req: NextRequest) {
    const requestId =
        (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No se recibió ninguna imagen", request_id: requestId },
                { status: 400 }
            );
        }

        // Aseguramos nombre + extensión para que el backend guarde bien
        const originalName = (file.name || "hand.jpg").trim();
        const hasExt = /\.[a-zA-Z0-9]+$/.test(originalName);
        const safeName = hasExt ? originalName : `${originalName}.jpg`;

        // Reenviamos como multipart/form-data al Flask
        const upstream = new FormData();
        upstream.append("nombre", safeName);
        upstream.append("imagen", file, safeName);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000); // 30s

        let res: Response;
        try {
            res = await fetch(PREDICT_URL, {
                method: "POST",
                body: upstream,
                signal: controller.signal,
                // NO pongas Content-Type manualmente; fetch lo define con el boundary correcto.
            });
        } finally {
            clearTimeout(timeout);
        }

        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
            ? await res.json().catch(() => null)
            : await res.text().catch(() => null);

        if (!res.ok) {
            console.error("[/api/classify] Upstream error:", {
                requestId,
                status: res.status,
                payload,
            });

            return NextResponse.json(
                {
                    error: "Error desde el backend /predict",
                    request_id: requestId,
                    upstream_status: res.status,
                    details: payload,
                },
                { status: res.status }
            );
        }

        // Backend puede devolver:
        // - { prediccion: "L", ... }
        // - o { prediccion: { _Foto__predicted_label: "L", ... }, ... }
        const rawPred = (payload as any)?.prediccion;
        const label =
            typeof rawPred === "string"
                ? rawPred
                : rawPred?.["_Foto__predicted_label"] ??
                rawPred?.predicted_label ??
                rawPred?.label ??
                null;

        return NextResponse.json({
            request_id: requestId,
            transcription: label ?? "Sin predicción",
            raw: payload, // útil para debug
            meta: {
                filename: safeName,
                size: file.size,
                type: file.type,
                predict_url: PREDICT_URL,
            },
        });
    } catch (err: any) {
        const message =
            err?.name === "AbortError"
                ? "Timeout llamando al backend /predict"
                : String(err?.message ?? err);

        console.error("[/api/classify] Internal error:", { requestId, message, err });

        return NextResponse.json(
            { error: "Error interno en /api/classify", request_id: requestId, details: message },
            { status: 500 }
        );
    }
}
