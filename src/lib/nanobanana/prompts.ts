import type { FaceAnalysisResult, HairstyleKey, OutputAspectRatio } from "./types";

/**
 * Catalog of supported hairstyles. The `promptTemplate` is consumed by
 * NanoBananaPRO to transform the subject's photo while preserving face
 * identity, lighting, and framing. The `scoringHints` feed back into the
 * match-score heuristic for face shapes.
 */
export type StyleDefinition = {
  key: HairstyleKey;
  name: string;
  description: string;
  promptTemplate: (ctx: { analysis?: FaceAnalysisResult }) => string;
  idealFaceShapes: string[];
  tips: string[];
};

const identityGuard = `Preserve the subject's facial features, skin tone, eye color, jawline, and expression exactly. Do not change the background. Natural studio lighting. Professional portrait quality. The output must look like the SAME person, only the hair is modified.`;

/**
 * Shared composition instructions appended to every style prompt so the
 * generated output is always a clean vertical phone-frame shot, ready for
 * mobile viewing and sharing without cropping.
 */
const PORTRAIT_FRAMING_BY_RATIO: Record<OutputAspectRatio, string> = {
  "9:16":
    "Compose the image as a vertical 9:16 phone-format portrait (1080x1920). Subject centered and fully visible from the top of the head to the collarbone, head-and-shoulders framing, slight negative space above the hair. No letterboxing, no black bars, no cropping of the top of the head.",
  "4:5":
    "Compose the image as a 4:5 portrait (1024x1280). Head-and-shoulders framing, subject centered, no cropping of the top of the head.",
  "1:1":
    "Compose the image as a 1:1 square. Tight head-and-shoulders framing, subject centered, no cropping of the top of the head.",
};

function portraitFraming(aspect: OutputAspectRatio): string {
  return PORTRAIT_FRAMING_BY_RATIO[aspect];
}

export const STYLE_CATALOG: Record<HairstyleKey, StyleDefinition> = {
  textured_crop: {
    key: "textured_crop",
    name: "Textured Crop",
    description: "Short, choppy top with tight sides — modern and low-maintenance.",
    promptTemplate: () => `Restyle the subject's hair into a modern textured crop: short tapered sides, slightly longer piecey top with visible texture and a natural fringe forward. Matte finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Round", "Diamond"],
    tips: ["Use matte clay for texture", "Keep sides tight for a clean look"],
  },
  mid_fade_quiff: {
    key: "mid_fade_quiff",
    name: "Mid Fade + Quiff",
    description: "Elevated quiff with a seamless mid-fade — sharp and versatile.",
    promptTemplate: () => `Restyle the subject's hair into a mid-fade with a voluminous quiff swept up and back. Clean skin fade fading mid-temple, longer top styled upward and slightly back. Polished finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Heart", "Oblong"],
    tips: ["Blow dry up and back", "Use pomade for hold and shine"],
  },
  side_part: {
    key: "side_part",
    name: "Side Part",
    description: "Timeless, structured part — professional and clean.",
    promptTemplate: () => `Restyle the subject's hair into a classic side part: defined part line on the heavier side, comb-swept hair with subtle shine, tapered sides, neat and professional. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Round", "Square"],
    tips: ["Use a fine comb for a defined part", "Light pomade for shine"],
  },
  brush_up: {
    key: "brush_up",
    name: "Brush Up",
    description: "Voluminous brushed-up top with tapered sides.",
    promptTemplate: () => `Restyle the subject's hair into a brush-up style: hair brushed straight upward with volume and slight backward sweep, tapered sides. Matte to satin finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Heart"],
    tips: ["Blow dry with a round brush", "Use a texturizing paste"],
  },
  crew_cut: {
    key: "crew_cut",
    name: "Crew Cut",
    description: "Classic, low-maintenance cut with slightly longer front.",
    promptTemplate: () => `Restyle the subject's hair into a classic crew cut: very short tapered sides and back, slightly longer top (about 1–2 cm) that can be styled forward or up. Natural finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Oblong"],
    tips: ["Easy daily styling", "Trim every 3–4 weeks to keep shape"],
  },
  pompadour: {
    key: "pompadour",
    name: "Pompadour",
    description: "Bold height and volume — high-fashion barbering.",
    promptTemplate: () => `Restyle the subject's hair into a pompadour: significant height and volume at the front swept upward and back, short tapered sides, glossy polished finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Heart"],
    tips: ["Requires length on top", "High-hold pomade essential"],
  },
  messy_fringe: {
    key: "messy_fringe",
    name: "Messy Fringe",
    description: "Forward-swept, textured fringe — youthful and relaxed.",
    promptTemplate: () => `Restyle the subject's hair into a messy fringe: longer top with a piecey textured fringe falling forward across the forehead, slightly tousled, tapered sides. Matte finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Oblong", "Diamond"],
    tips: ["Use sea salt spray for texture", "Air-dry for a natural look"],
  },
  longer_wavy: {
    key: "longer_wavy",
    name: "Longer Wavy",
    description: "Mid-length wavy style with natural movement.",
    promptTemplate: () => `Restyle the subject's hair into a longer wavy style: mid-length hair (ears covered) with natural waves and movement, soft volume, no visible fade. Lived-in finish. ${identityGuard}`,
    idealFaceShapes: ["Oval", "Square", "Oblong"],
    tips: ["Use a curl-enhancing cream", "Diffuse on low heat"],
  },
};

export const DEFAULT_STYLE_KEYS: HairstyleKey[] = [
  "textured_crop",
  "mid_fade_quiff",
  "side_part",
  "brush_up",
  "crew_cut",
  "pompadour",
  "messy_fringe",
  "longer_wavy",
];

export function buildPrompt(
  styleKey: HairstyleKey,
  analysis?: FaceAnalysisResult,
  aspectRatio: OutputAspectRatio = "9:16",
): string {
  const def = STYLE_CATALOG[styleKey];
  return `${def.promptTemplate({ analysis })} ${portraitFraming(aspectRatio)}`;
}
