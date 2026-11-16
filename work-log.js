// Turns a day's commits into a tidy, plain-text work log for the Summary button and
// Harvest notes. Deterministic on purpose: it only reorganizes what the commits say,
// it never adds anything. (LLM summaries invented work and ticket numbers.)

// Commit messages that say nothing on their own. Compared lowercased, trailing
// punctuation stripped.
const NOISE = new Set([
  'wip',
  'misc',
  'ditto',
  'ready',
  'stable',
  'almost there',
  'fix',
  'fixes',
  'style',
  'styles',
  'tweak',
  'tweaks',
  'typo',
  'gitignore',
  'cleanup',
  'clean up',
]);

const MERGE = /^merge (pull request|branch|remote-tracking branch|.+ into )/i;
const TICKET = /\bBH[-\s]?(\d+)\b/gi;

const titleCase = (text) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** All BugHerd ticket ids in a string, normalized to "BH16". */
const ticketsIn = (text) => [...String(text || '').matchAll(TICKET)].map((m) => `BH${m[1]}`);

/**
 * "hotfix/Sibling-bugs" → "Hotfix: Sibling Bugs", "feature/BH16-thumbs" → "Feature: Thumbs".
 * @param {string} branch
 */
function branchTitle(branch) {
  if (!branch || branch === 'other') return 'Other';
  const slash = branch.indexOf('/');
  const type = slash > 0 ? branch.slice(0, slash) : '';
  let subject = slash > 0 ? branch.slice(slash + 1) : branch;
  subject = subject.replace(TICKET, ' ').replace(/[-_/]+/g, ' ');
  subject = titleCase(subject.trim()) || titleCase(type);
  return type ? `${titleCase(type)}: ${subject}` : subject;
}

const isNoise = (message) =>
  NOISE.has(
    message
      .trim()
      .toLowerCase()
      .replace(/[.!…]+$/, '')
  );

/**
 * @param {Array<{ message: string, branch?: string }>} commits  In chronological order.
 * @param {{ maxWords?: number }} [options]  Cap on total words; extra bullets are cut
 *   and counted ("…and 4 more").
 * @returns {string}
 */
function formatWorkLog(commits, { maxWords = Infinity } = {}) {
  /** @type {Map<string, string[]>} branch → messages, in first-seen order */
  const byBranch = new Map();
  for (const commit of commits) {
    const message = String(commit.message || '').trim();
    if (!message || MERGE.test(message)) continue;
    const branch = commit.branch || 'other';
    if (!byBranch.has(branch)) byBranch.set(branch, []);
    byBranch.get(branch).push(message);
  }

  const sections = [];
  for (const [branch, messages] of byBranch) {
    // Drop noise and exact duplicates, but keep something if that's all there was.
    const seen = new Set();
    let kept = messages.filter((m) => {
      const key = m.toLowerCase();
      if (isNoise(m) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (kept.length === 0) kept = [...new Set(messages)];

    const tickets = [...new Set([...ticketsIn(branch), ...messages.flatMap(ticketsIn)])];
    const heading = `${branchTitle(branch)}${tickets.length ? ` - ${tickets.join(', ')}` : ''}`;
    sections.push({ heading, bullets: kept });
  }

  // Apply the word cap across the whole log.
  let words = 0;
  let dropped = 0;
  const lines = [];
  for (const section of sections) {
    const bullets = [];
    for (const bullet of section.bullets) {
      const count = bullet.split(/\s+/).length;
      if (words + count > maxWords && words > 0) {
        dropped++;
        continue;
      }
      words += count;
      bullets.push(`- ${bullet}`);
    }
    if (bullets.length) lines.push(`${section.heading}\n${bullets.join('\n')}`);
  }
  let log = lines.join('\n\n');
  if (dropped) log += `\n\n…and ${dropped} more`;
  return log;
}

module.exports = { formatWorkLog, branchTitle };
