"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
    text: string | null;
    isLoading?: boolean;
};

export function TranscriptionBox({ text, isLoading }: Props) {
    return (
        <Card className="mt-6 w-full">
            <CardHeader>
                <CardTitle>Transcripción Lenguaje de Signos a Texto</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Procesando imagen…</p>
                ) : text ? (
                    <p className="text-lg">{text}</p>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Aún no hay transcripción. Haz una foto para empezar.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
