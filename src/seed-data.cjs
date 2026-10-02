// Original walkthrough samples; stored metadata and document content remain editable.
module.exports = [
  ['Attachment', 'Developmental psychology'],
  ['Classical Conditioning', 'Learning psychology'],
  ['Cognitive Dissonance', 'Social psychology'],
  ['Cognitive Reappraisal', 'Emotion regulation'],
  ['Working Memory', 'Cognitive psychology']
].map(([concept, topic]) => ({
  title: `DEMO - ${concept}`,
  filename: `DEMO - ${concept}.txt`,
  authors: ['PsyShelf demo'],
  categories: ['Other'],
  languages: ['English'],
  description: `Original educational example about ${concept.toLowerCase()}. Open its preview to read the concept, example and source reference.`,
  clinicalTopic: topic,
  audience: 'Students',
  collections: ['DEMO'],
  status: 'ready'
}));
