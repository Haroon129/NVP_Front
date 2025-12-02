"use client";

type Props = {
    videoRef: React.RefObject<HTMLVideoElement>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
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

            {/* Canvas overlay (rectángulo mano) */}
            <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
            />
        </div>
    );
}
