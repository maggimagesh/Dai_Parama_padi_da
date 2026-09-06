import type { Metadata } from "next";
import { PuzzleGame } from "@/components/puzzle/puzzle-game";

export const metadata: Metadata = {
  title: "Scene puzzle",
  description: "Capture a scene, slide eight photo tiles into place, and beat your personal best time.",
  openGraph: { title: "Scene puzzle · Peripheral", description: "Your camera. Eight pieces. One perfect picture." },
};

export default function PuzzlePage() {
  return <PuzzleGame />;
}
