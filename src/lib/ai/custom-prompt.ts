/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  TEST PROMPT  —  edición de peinado conservando la identidad         ║
 * ║                                                                      ║
 * ║  Objetivo:                                                           ║
 * ║    Que el modelo (OpenAI `images/edits` o Gemini image preview)      ║
 * ║    modifique SOLO el pelo y deje la cara, la piel, los ojos, las     ║
 * ║    gafas, el vello facial, la ropa y el fondo idénticos a la foto    ║
 * ║    original.                                                         ║
 * ║                                                                      ║
 * ║  Notas importantes:                                                  ║
 * ║    • Un peinado por imagen. Pedir un collage 2x2 hace que el modelo  ║
 * ║      se invente caras distintas en cada celda.                       ║
 * ║    • El placeholder `[HAIRSTYLE]` se sustituye por el peinado que    ║
 * ║      elijas (o por `a different popular hairstyle` si no se toca).   ║
 * ║    • Puedes editar el textarea del admin-test con el peinado que     ║
 * ║      quieras sin tocar este archivo.                                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const CUSTOM_HAIRSTYLE_PROMPT =
  `Photorealistic edit of the uploaded portrait. ` +
  `Change ONLY the hairstyle to: [HAIRSTYLE]. ` +
  `Keep the exact same person: same face shape, same skin tone, same eyes, ` +
  `same eyeglasses, same facial hair exactly as in the input (do NOT add or remove a beard), ` +
  `same clothing, same background, same lighting and same camera angle. ` +
  `Do not change identity. Do not stylize. Do not create a collage, grid or infographic. ` +
  `Output a single realistic edited photo of the same person with the new hairstyle only.`;

export const POPULAR_HAIRSTYLES: ReadonlyArray<string> = [
  "textured side part, medium length, natural dark brown",
  "modern low fade with short textured crop on top",
  "classic taper with side part, combed",
  "buzz cut, very short, even length",
  "messy curly top with low fade on the sides",
  "slicked back undercut, mid length",
  "pompadour, medium volume, matte finish",
  "french crop with short fringe",
];

export const CUSTOM_STYLE_NAME = "Hairstyle Edit (Test)";
