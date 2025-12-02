"use client";

type Props = {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
};

export function CameraView({ videoRef, overlayCanvasRef }: Props) {
    return (
        <div className="relative w-full aspect-video border rounded-xl bg-muted overflow-hidden">
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
            />

            <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
            />
        </div>
    );
}
