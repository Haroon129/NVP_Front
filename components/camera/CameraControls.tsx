"use client";

import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";

type Props = {
    isCameraOn: boolean;
    onToggleCamera: () => void;
};

export function CameraControls({ isCameraOn, onToggleCamera }: Props) {
    return (
        <div className="flex flex-col items-center gap-6">
            <Button
                variant="outline"
                size="icon"
                className="rounded-full h-20 w-20"
                onClick={onToggleCamera}
                aria-label={isCameraOn ? "Apagar cámara" : "Encender cámara"}
            >
                <Power className="h-8 w-8" />
            </Button>
            <span className="text-xs text-center">
                {isCameraOn ? "Apagar Cámara" : "Encender Cámara"}
            </span>
        </div>
    );
}
