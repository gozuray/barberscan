/**
 * Shared Clerk theming. OAuth providers (Google, Apple) are listed first as
 * block buttons when you enable them in the Clerk Dashboard:
 * Configure → User & authentication → Social connections
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0B0B0C",
    colorBackground: "#FAF7F1",
    borderRadius: "0.9rem",
    fontFamily: "var(--font-sans)",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
};
