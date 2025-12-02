"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Camera, Power } from "lucide-react";

type Props = {
    isCameraOn: boolean;
    isTakingPhoto: boolean;
    onToggleCamera: () => void;
    onTakePhoto: () => void;
};

export function CameraControls({
    isCameraOn,
    isTakingPhoto,
    onToggleCamera,
    onTakePhoto,
}: Props) {
    return (
        <div className="flex flex-col items-center gap-6">
            <Button
                variant="outline"
                size="icon"
                className="rounded-full h-20 w-20"
                onClick={onToggleCamera}
            >
                <Power className="h-8 w-8" />
            </Button>
            <span className="text-xs text-center">Encender Cámara</span>

            <Button
                variant="outline"
                size="icon"
                className="rounded-full h-20 w-20"
                onClick={onTakePhoto}
                disabled={!isCameraOn || isTakingPhoto}
            >
                {isTakingPhoto ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                    <Camera className="h-8 w-8" />
                )}
            </Button>
            <span className="text-xs text-center">Hacer Foto</span>
        </div>
    );
}
