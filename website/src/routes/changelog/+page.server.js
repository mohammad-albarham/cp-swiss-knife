import fs from 'fs';
import path from 'path';

export async function load() {
	// Read the changelog from the root directory relative to where the build is running
	const changelogPath = path.resolve('../CHANGELOG.md');
	let content = 'Changelog not found.';
	
	try {
		content = fs.readFileSync(changelogPath, 'utf8');
	} catch (e) {
		console.warn('Could not read CHANGELOG.md from', changelogPath);
	}

	return {
		changelog: content
	};
}
