const { normalizeList } = require('./library-utils.cjs');

const METADATA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'authors', 'categories', 'languages', 'description'],
  properties: {
    title: { type: 'string', description: 'Resource title, or an empty string when unknown.' },
    authors: { type: 'array', items: { type: 'string' }, description: 'Verified authors or creators.' },
    categories: { type: 'array', items: { type: 'string' }, description: 'One or more useful resource categories.' },
    languages: { type: 'array', items: { type: 'string' }, description: 'Languages present in the resource.' },
    description: { type: 'string', description: 'A factual description of no more than two concise sentences.' }
  }
};

const CORRECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'explanation'],
  properties: {
    decision: { type: 'string', enum: ['accept', 'reject'], description: 'Whether the correction should be applied.' },
    explanation: { type: 'string', description: 'A brief evidence-based reason for the decision.' }
  }
};

/** Keeps only catalog fields that are relevant to an agent request. */
function compactResource(resource) {
  const { title, authors, categories, languages, description } = resource;
  return { title, authors, categories, languages, description };
}

/** Builds the bounded prompt for the metadata-analysis agent. */
function buildMetadataMessages(resource, excerpt = '') {
  return [
    {
      role: 'system',
      content: 'You are a careful multilingual metadata librarian for a psychologist. Prefer accuracy over completeness. Never invent missing facts.'
    },
    {
      role: 'user',
      content: `Analyze this professional psychology-library resource. Use the JSON schema exactly. Leave uncertain fields empty and mention uncertainty in the description. Useful categories include Book, URL, Music, Podcast, Art, Series, Movie, Scientific article, Video, Course, Presentation, and Spreadsheet.\n\nSchema:\n${JSON.stringify(METADATA_SCHEMA)}\n\nExisting entry:\n${JSON.stringify(compactResource(resource))}\n\nReadable excerpt:\n${excerpt}`
    }
  ];
}

/** Builds the bounded prompt for reviewing an owner-requested correction. */
function buildCorrectionMessages(resource, requestedChanges, reason = '') {
  return [
    {
      role: 'system',
      content: 'You are a cautious multilingual correction reviewer for a professional psychology library. Never fabricate evidence.'
    },
    {
      role: 'user',
      content: `Review this metadata correction using the JSON schema exactly. Accept reasonable owner corrections unless the current data is demonstrably more accurate. When evidence is insufficient, accept the correction and identify it as owner-supplied.\n\nSchema:\n${JSON.stringify(CORRECTION_SCHEMA)}\n\nCurrent:\n${JSON.stringify(compactResource(resource))}\n\nRequested:\n${JSON.stringify(requestedChanges)}\n\nOwner reason:\n${reason || 'Not provided'}`
    }
  ];
}

/** Builds a catalog-grounded conversation prompt with minimal resource fields. */
function buildChatMessages(resources, message) {
  return [
    {
      role: 'system',
      content: 'Answer questions about a personal professional psychology library. Use only the supplied catalog. If it does not contain the answer, say so. Reply in the user’s language and cite resource titles in quotation marks.'
    },
    {
      role: 'user',
      content: `Question: ${message}\n\nCatalog:\n${JSON.stringify(resources.map(compactResource))}`
    }
  ];
}

/** Parses a model response after removing optional thinking and code fences. */
function parseStructuredResponse(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*|\s*```$/g, '')
    .trim();
  const value = JSON.parse(cleaned);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The local model returned an invalid object.');
  return value;
}

/** Validates metadata output and safely falls back to the existing resource. */
function validateMetadataResponse(text, resource) {
  const value = parseStructuredResponse(text);
  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : resource.title,
    authors: Array.isArray(value.authors) ? normalizeList(value.authors) : resource.authors,
    categories: Array.isArray(value.categories) && value.categories.length ? normalizeList(value.categories) : resource.categories,
    languages: Array.isArray(value.languages) ? normalizeList(value.languages) : resource.languages,
    description: typeof value.description === 'string' && value.description.trim() ? value.description.trim() : resource.description
  };
}

/** Validates correction-review output against the accepted decisions. */
function validateCorrectionResponse(text) {
  const value = parseStructuredResponse(text);
  if (!['accept', 'reject'].includes(value.decision)) throw new Error('The local model returned an invalid correction decision.');
  return {
    decision: value.decision,
    explanation: typeof value.explanation === 'string' && value.explanation.trim()
      ? value.explanation.trim()
      : 'The local agent completed its review.'
  };
}

module.exports = {
  CORRECTION_SCHEMA,
  METADATA_SCHEMA,
  buildChatMessages,
  buildCorrectionMessages,
  buildMetadataMessages,
  compactResource,
  parseStructuredResponse,
  validateCorrectionResponse,
  validateMetadataResponse
};
