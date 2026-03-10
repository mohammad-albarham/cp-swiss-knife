import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Parse CHANGELOG.md into structured version entries.
 * Each entry: { version, date, isLatest, categories: [{ name, items }] }
 */
function parseChangelog(raw) {
	const versions = [];
	let current = null;
	let currentCategory = null;

	for (const line of raw.split('\n')) {
		// Match version headings like: ## [0.2.2] - 2026-03-08
		const versionMatch = line.match(/^## \[(.+?)\]\s*-\s*(.+)/);
		if (versionMatch) {
			current = { version: versionMatch[1], date: versionMatch[2].trim(), categories: [] };
			versions.push(current);
			currentCategory = null;
			continue;
		}

		// Match category headings like: ### Added, ### Fixed
		const categoryMatch = line.match(/^### (.+)/);
		if (categoryMatch && current) {
			currentCategory = { name: categoryMatch[1].trim(), items: [] };
			current.categories.push(currentCategory);
			continue;
		}

		// Match list items
		const itemMatch = line.match(/^- (.+)/);
		if (itemMatch && currentCategory) {
			currentCategory.items.push(itemMatch[1].trim());
		}
	}

	if (versions.length > 0) versions[0].isLatest = true;
	return versions;
}

export function load() {
	const changelogPath = resolve('..', 'CHANGELOG.md');
	const raw = readFileSync(changelogPath, 'utf-8');
	const versions = parseChangelog(raw);
	return { versions };
}
