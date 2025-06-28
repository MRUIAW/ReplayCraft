import { Vector3 } from "@minecraft/server";

function normalize(vector: Vector3) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length,
    };
}
export function calculateFallRatio(velocity: Vector3) {
    const yDelta = velocity.y;

    if (yDelta < 0) {
        const direction = normalize(velocity);
        const yDir = direction.y;
        return 1 - Math.pow(-yDir, 1.5);
    }

    return 1;
}
