import { z } from "zod";
export const storyInput = z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(5000), source: z.string().trim().max(1000).default("") });
