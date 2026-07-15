export interface PostFormData {
  title: string;
  description?: string;
  date?: string;       // YYYY-MM-DD
  modified?: string;   // YYYY-MM-DD
  image?: string;
  alt?: string;
  imageWidth?: number;
  imageHeight?: number;
  keywords?: string[];
  priority?: number;
  draft?: boolean;
  body: string;
}

function needsQuoting(value: string): boolean {
  return /[":#&\[\]{\}|,>!%]/.test(value) || (value.includes("'") && value.includes(" "));
}

function yamlValue(value: string): string {
  if (needsQuoting(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function assemblePost(data: PostFormData): string {
  const lines: string[] = ['---'];
  lines.push(`title: ${yamlValue(data.title)}`);
  if (data.description) lines.push(`description: ${yamlValue(data.description)}`);
  if (data.date) lines.push(`date: ${data.date}`);
  if (data.modified) lines.push(`modified: ${data.modified}`);
  if (data.image) lines.push(`image: ${data.image}`);
  if (data.alt) lines.push(`alt: ${yamlValue(data.alt)}`);
  if (data.imageWidth) lines.push(`imageWidth: ${data.imageWidth}`);
  if (data.imageHeight) lines.push(`imageHeight: ${data.imageHeight}`);
  if (data.keywords && data.keywords.length > 0) {
    lines.push('keywords:');
    for (const kw of data.keywords) lines.push(`  - ${yamlValue(kw)}`);
  }
  if (data.priority !== undefined) lines.push(`priority: ${data.priority}`);
  if (data.draft !== undefined && data.draft !== false) lines.push(`draft: ${data.draft}`);
  lines.push('---');
  lines.push(data.body);
  return lines.join('\n');
}
