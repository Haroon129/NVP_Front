"use client";

import React from "react";

type Props = {
    videoRef: React.RefObject<HTMLVideoElement | null>;
};

export function CameraView({ videoRef }: Props) {
    return (
        <div className="relative w-full aspect-video border rounded-xl bg-muted overflow-hidden">
            {/* Vídeo de la cámara */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
            />

            {/* Recuadro donde el usuario debe poner la mano */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-emerald-400 rounded-xl w-3/5 h-3/4 bg-black/10" />
            </div>
        </div>
    );
}
