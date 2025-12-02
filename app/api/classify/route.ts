import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json(
            { error: "No se recibió ninguna imagen" },
            { status: 400 }
        );
    }

    const originalName = file.name;

    const fakeTranscription = `Ejemplo de transcripción para la imagen ${originalName}`;

    return NextResponse.json({ transcription: fakeTranscription });
}
