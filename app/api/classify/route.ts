import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PREDICT_URL = process.env.PREDICT_URL ?? "http://127.0.0.1:5001/predict";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
        }

        // Nombre único (lo trae el filename que tú generas en el frontend)
        const nombre = file.name;

        // Reenviamos como multipart/form-data al Flask
        const upstream = new FormData();
        upstream.append("nombre", nombre);
        upstream.append("imagen", file, nombre);

        const res = await fetch(PREDICT_URL, {
            method: "POST",
            body: upstream,
            // NO pongas Content-Type manualmente; fetch lo define con el boundary correcto.
        });

        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
            ? await res.json().catch(() => null)
            : await res.text().catch(() => null);

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: "Error desde el backend /predict",
                    status: res.status,
                    details: payload,
                },
                { status: res.status }
            );
        }

        // Flask devuelve { prediccion: ... } -> lo mapeamos para tu UI
        const prediccion = (payload as any)?.prediccion ?? null;

        return NextResponse.json({
            transcription: prediccion ?? "Sin predicción",
            raw: payload,
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { error: "Error interno en /api/classify", details: String(err?.message ?? err) },
            { status: 500 }
        );
    }
}
