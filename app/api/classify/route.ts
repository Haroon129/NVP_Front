import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Pon la URL del backend en una env var para no hardcodear.
// Ejemplos:
// - local:    http://localhost:5000/predict
// - docker:   http://backend:5000/predict (si tu servicio se llama backend en docker-compose)
const PREDICT_URL = process.env.PREDICT_URL ?? "http://localhost:5000/predict";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No se recibió ninguna imagen" },
                { status: 400 }
            );
        }

        // Convertimos a base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Nombre único (si ya lo estás generando en el front, file.name ya lo traerá)
        const nombre = file.name;

        // Enviamos al backend Flask como JSON
        const res = await fetch(PREDICT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // Ojo: aquí enviamos base64. El backend debe decodificarlo.
            body: JSON.stringify({
                nombre,
                imagen: base64,
            }),
        });

        const text = await res.text();
        let data: any = null;
        try {
            data = JSON.parse(text);
        } catch {
            // si Flask devuelve HTML/error, lo devolvemos tal cual
        }

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: "Error desde el backend /predict",
                    status: res.status,
                    details: data ?? text,
                },
                { status: res.status }
            );
        }

        // Tu Flask devuelve: { prediccion: ... }
        // Para no romper tu UI actual, lo mapeo a "transcription".
        const prediccion = data?.prediccion ?? null;

        return NextResponse.json({
            transcription: prediccion ?? "Sin predicción",
            raw: data, // opcional: útil para debug
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { error: "Error interno en /api/classify", details: String(err?.message ?? err) },
            { status: 500 }
        );
    }
}
