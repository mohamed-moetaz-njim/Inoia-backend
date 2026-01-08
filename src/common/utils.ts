export function generatePseudonym(): string {
  const adjectives = [
    'Happy',
    'Calm',
    'Brave',
    'Quiet',
    'Gentle',
    'Bright',
    'Wise',
    'Cool',
    'Warm',
    'Safe',
  ];
  const nouns = [
    'Panda',
    'Tiger',
    'Eagle',
    'Owl',
    'Fox',
    'Bear',
    'Wolf',
    'Lion',
    'Hawk',
    'Dove',
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000); // 4 digit number

  return `${adj}${noun}${num}`;
}
