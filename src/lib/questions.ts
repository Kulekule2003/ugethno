// Allowed image questions. Fish and fishing-site images ask different things.
export const FISH_QUESTIONS = ["What fish is this?", "Can you identify this fish?", "What species is shown here?"];
export const SITE_QUESTIONS = ["What place is this?", "Where is this?", "Can you identify this location?"];
export const IMAGE_QUESTIONS = [...FISH_QUESTIONS, ...SITE_QUESTIONS];
export function questionsFor(category: string) { return category === "fishing_site" ? SITE_QUESTIONS : FISH_QUESTIONS; }
