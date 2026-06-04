import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));

function load(filename: string): string {
  return readFileSync(join(dir, filename), 'utf-8').trim();
}

const loaded = {
  baseIdentity: load('base-identity.md'),
  outputRules: load('output-rules.md'),
  datasetContext: load('dataset-context.md'),
  personaAnalyst: load('persona-analyst.md'),
  personaSoloq: load('persona-soloq.md'),
  personaLowelo: load('persona-lowelo.md'),
};

const personaMap: Record<string, string> = {
  'Profi Esports Analyst': loaded.personaAnalyst,
  'Challenger Soloq Spieler': loaded.personaSoloq,
  'Leidenschaftlicher Low Elo Spieler': loaded.personaLowelo,
};

export function buildSystemPrompt(persona: string): string {
  const personaText = personaMap[persona] ?? loaded.personaAnalyst;
  return [loaded.baseIdentity, personaText, loaded.datasetContext, loaded.outputRules].join(
    '\n\n---\n\n'
  );
}
