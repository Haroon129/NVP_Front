"use client";

import { cn } from "@/lib/utils";

type Props = {
    videoRef: React.RefObject<HTMLVideoElement>;
};

export function CameraView({ videoRef }: Props) {
    return (
        <div className="w-full aspect-video border rounded-xl flex items-center justify-center bg-muted">
            <video
                ref={videoRef}
                className="w-full h-full object-cover rounded-xl"
                autoPlay
                playsInline
                muted
            />
        </div>
    );
}
