// The answer for an image record: the edited answer if there is one, otherwise derived from the short name.
type Named = { category: string; shortName: string };
export function defaultAnswer(r: Named) { return r.category === "fishing_site" ? `This is ${r.shortName}.` : `This is the ${r.shortName}.`; }
export function imageAnswer(r: Named & { answer?: string | null }) { return r.answer?.trim() || defaultAnswer(r); }
