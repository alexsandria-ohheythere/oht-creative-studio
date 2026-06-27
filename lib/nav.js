// The six-section IA. Sub-items render as expandable children under the parent.
// `key` is used for the route segment: /[brand]/<key> and /[brand]/<key>/<childKey>.
// Editable in one place — add a section or sub-item here and the sidebar updates.

export const NAV_SECTIONS = [
  {
    key: 'brain',
    label: 'Brand Brain',
    blurb: 'Everything about the brand',
    color: '#EE268C', // pink
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    blurb: 'Every marketing initiative',
    color: '#FFAEF1', // lavender
  },
  {
    key: 'content',
    label: 'Content',
    blurb: 'Idea to finished asset',
    color: '#64BC46', // green
    children: [
      { key: 'ideas', label: 'Ideas' },
      { key: 'briefs', label: 'Briefs' },
      { key: 'production', label: 'Production' },
      { key: 'assets', label: 'Assets' },
    ],
  },
  {
    key: 'publishing',
    label: 'Publishing',
    blurb: 'Schedule & distribute',
    color: '#AED8FF', // blue
    children: [
      { key: 'calendar', label: 'Calendar' },
      { key: 'channels', label: 'Channels' },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    blurb: "What's working & why",
    color: '#DDEE26', // lime
    children: [
      { key: 'performance', label: 'Performance' },
      { key: 'audience', label: 'Audience' },
      { key: 'competitors', label: 'Competitors', soon: true }, // phase 2
    ],
  },
  {
    key: 'strategist',
    label: 'AI Strategist',
    blurb: 'Learns from everything',
    color: '#DDEE26', // lime
    accent: true, // rendered as the flagship
  },
];
