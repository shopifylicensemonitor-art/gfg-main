import { useEffect, useState } from 'react';

interface ConfettiPiece {
    id: number;
    x: number;
    color: string;
    size: number;
    isCircle: boolean;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface ConfettiProps {
    trigger: boolean;
    onComplete?: () => void;
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        if (trigger && !isActive) {
            setIsActive(true);
            const newPieces: ConfettiPiece[] = Array.from({ length: 60 }, (_, i) => ({
                id: i,
                x: Math.random() * 100, // percentage-based for responsiveness
                color: COLORS[i % COLORS.length],
                size: Math.random() * 8 + 4,
                isCircle: i % 2 === 0, // deterministic, no random in render
            }));

            setPieces(newPieces);

            setTimeout(() => {
                setPieces([]);
                setIsActive(false);
                onComplete?.();
            }, 3000);
        }
    }, [trigger, isActive, onComplete]);

    if (pieces.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="absolute animate-confetti-fall"
                    style={{
                        left: `${piece.x}%`,
                        top: -20,
                        width: piece.size,
                        height: piece.size,
                        backgroundColor: piece.color,
                        borderRadius: piece.isCircle ? '50%' : '0',
                    }}
                />
            ))}
        </div>
    );
}
