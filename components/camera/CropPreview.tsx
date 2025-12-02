"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
    lastCaptureUrl: string | null;
};

export function CropPreview({ lastCaptureUrl }: Props) {
    return (
        <Card className="mt-4">
            <CardHeader className="py-4">
                <CardTitle className="text-base">Última mano enviada al backend</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                {lastCaptureUrl ? (
                    <div className="flex items-center gap-4">
                        <img
                            src={lastCaptureUrl}
                            alt="Última mano capturada"
                            className="h-[220px] w-[220px] rounded-lg border object-cover bg-muted"
                        />
                        <p className="text-sm text-muted-foreground">
                            Esta imagen es la última que se recortó y se envió. No se guarda en disco,
                            solo está en memoria para previsualización.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Aún no hay ninguna captura enviada.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
