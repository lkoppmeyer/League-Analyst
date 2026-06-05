import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const personaDir = join(dir, 'personas');

function read(path: string): string {
  return readFileSync(path, 'utf-8');
}

// Minimal frontmatter parser: supports a leading "---" block with key: value lines.
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

export type Persona = {
  id: string;
  label: string;
  order: number;
  body: string;
};

// Globals that apply to every persona, loaded once at startup.
const core = read(join(dir, 'core.md')).trim();
const dataset = read(join(dir, 'dataset.md')).trim();
export const preanalysisPrompt = read(join(dir, 'preanalysis.md')).trim();
export const contextFilterPrompt = read(join(dir, 'contextfilter.md')).trim();
export const timelineAnalysisPrompt = read(join(dir, 'timelineanalysis.md')).trim();
export const laneScorePrompt = read(join(dir, 'lanescore.md')).trim();

// Personas are loaded dynamically from the personas/ folder.
const personas: Persona[] = readdirSync(personaDir)
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const { meta, body } = parseFrontmatter(read(join(personaDir, file)));
    const id = file.replace(/\.md$/, '');
    return {
      id,
      label: meta.label || id,
      order: meta.order ? Number(meta.order) : 999,
      body,
    };
  })
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

const personaById = new Map(personas.map((p) => [p.id, p]));

/** Personas exposed to the frontend for the selection dropdown. */
export function listPersonas(): Array<{ id: string; label: string }> {
  return personas.map(({ id, label }) => ({ id, label }));
}

/** Assemble the full system prompt: persona + core rules + dataset guide + optional context blocks. */
export function buildSystemPrompt(
  personaId: string,
  champContext = '',
  viewerContext = '',
  preAnalysis = '',
): string {
  const persona = personaById.get(personaId) ?? personas[0];
  const parts = [persona.body, core, dataset];
  if (champContext.trim()) parts.push(champContext.trim());
  if (viewerContext.trim()) parts.push(viewerContext.trim());
  if (preAnalysis.trim()) parts.push(`## Voranalyse dieses Spiels\n\n${preAnalysis.trim()}`);
  return parts.join('\n\n---\n\n');
}
