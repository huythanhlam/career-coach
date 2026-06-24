/**
 * Editorial agent system prompts. The canonical strings now live in
 * src/config/blogPrompts.ts so the in-app admin authoring flow (frontend) and
 * this CI pipeline share one source of truth. Re-exported here so the existing
 * `../prompts.ts` imports in the agents keep working unchanged.
 */
export { blogPersona, ideatorSystem, writerSystem, editorSystem } from "../../src/config/blogPrompts.ts";
