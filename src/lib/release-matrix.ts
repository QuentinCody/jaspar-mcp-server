type Base = "A" | "C" | "G" | "T";
export interface ReleaseMatrix {
  matrix_id: string;
  name: string;
  width: number;
  pfm: Record<Base, string[]>;
  raw_jaspar: string;
}

/** Select an exact version; keep the provider's count spelling and raw record. */
export function selectReleaseMatrix(text: string, matrixId: string): ReleaseMatrix | null {
  const records = text.split(/(?=^>)/m).filter(record => record.trim());
  if (!records.length) throw new Error("Invalid JASPAR release file: expected matrix records");
  let selected: ReleaseMatrix | null = null;
  const ids = new Set<string>();
  for (const raw of records) {
    const record = parseMatrix(raw);
    if (ids.has(record.matrix_id)) throw new Error(`Duplicate matrix ${record.matrix_id} in release file`);
    ids.add(record.matrix_id);
    if (record.matrix_id === matrixId) selected = record;
  }
  return selected;
}

function parseMatrix(raw: string): ReleaseMatrix {
  const [header, ...rows] = raw.split(/\r?\n/).filter(line => line.trim());
  const matchHeader = header.match(/^>(MA\d+\.[1-9]\d*)\s+(.+)$/);
  if (!matchHeader || rows.length !== 4) throw new Error("Invalid JASPAR matrix header or row count");
  const pfm: Partial<Record<Base, string[]>> = {};
  for (const row of rows) {
    const match = row.match(/^([ACGT])\s*\[\s*(.*?)\s*\]\s*$/);
    if (!match) throw new Error("Invalid JASPAR base row");
    const base = match[1] as Base;
    if (pfm[base]) throw new Error("Duplicate JASPAR base row");
    const values = match[2].split(/\s+/);
    if (values.some(value => !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) {
      throw new Error("Invalid JASPAR count: expected finite non-negative values");
    }
    pfm[base] = values;
  }
  const { A, C, G, T } = pfm;
  if (!A || !C || !G || !T || [C, G, T].some(row => row.length !== A.length)) throw new Error("JASPAR base rows must have equal non-zero widths");
  return { matrix_id: matchHeader[1], name: matchHeader[2], width: A.length, pfm: { A, C, G, T }, raw_jaspar: raw };
}
