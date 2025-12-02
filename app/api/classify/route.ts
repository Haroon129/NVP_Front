import { NextRequest, NextResponse } from "next/server";

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json(
            { error: "No se recibió ninguna imagen" },
            { status: 400 }
        );
    }

    await sleep(900);

    // mock de transcripción
    return NextResponse.json({
        transcription: "HOLA (mock)",
        meta: { filename: file.name, size: file.size, type: file.type },
    });
}
