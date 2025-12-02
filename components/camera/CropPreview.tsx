"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
};

export function CropPreview({ previewCanvasRef }: Props) {
    return (
        <Card className="mt-4">
            <CardHeader className="py-4">
                <CardTitle className="text-base">Área que se enviará al backend</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="flex items-center gap-4">
                    <canvas
                        ref={previewCanvasRef}
                        className="rounded-lg border bg-muted"
                    />
                    <p className="text-sm text-muted-foreground">
                        Este recorte es exactamente lo que se enviará (sin guardar nada en el navegador).
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
