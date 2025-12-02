"use client";

import { Badge } from "@/components/ui/badge";

type Props = {
    isCameraOn: boolean;
    handDetected: boolean;
    handStable: boolean;
    countdown: number | null;
    isBusy: boolean;
};

export function HandStatus({
    isCameraOn,
    handDetected,
    handStable,
    countdown,
    isBusy,
}: Props) {
    let text = "Enciende la cámara.";
    let variant: "default" | "secondary" | "destructive" = "secondary";

    if (isCameraOn) {
        if (isBusy) {
            text = "Enviando y procesando…";
            variant = "default";
        } else if (!handDetected) {
            text = "Coloca la mano en el encuadre.";
            variant = "secondary";
        } else if (countdown !== null) {
            text = `Mantén la mano quieta… foto en ${countdown}s`;
            variant = "default";
        } else if (!handStable) {
            text = "Mantén la mano quieta para capturar.";
            variant = "secondary";
        } else {
            text = "Mano estable detectada.";
            variant = "default";
        }
    }

    return (
        <div className="mt-3 flex items-center gap-2">
            <Badge variant={variant}>{text}</Badge>
        </div>
    );
}
