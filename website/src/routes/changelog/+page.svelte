<script lang="ts">
	import { marked } from 'marked';
	import { page } from '$app/state';
	
	let { data } = $props();
	
	// Convert markdown to HTML directly using derived state
	const renderedChangelog = $derived(marked.parse(data.changelog));
</script>

<div class="w-full max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
	<div class="mb-10 text-center">
		<h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 mb-4">Changelog</h1>
		<p class="text-slate-400">Track all updates and improvements to CP Swiss Knife.</p>
	</div>
	
	<div class="prose prose-invert prose-slate prose-emerald max-w-none 
		prose-h2:text-2xl prose-h2:border-b prose-h2:border-slate-800 prose-h2:pb-2 prose-h2:mt-12
		prose-h3:text-xl prose-h3:text-emerald-400
		prose-a:text-blue-400 hover:prose-a:text-blue-300
		prose-strong:text-white
		bg-slate-900/50 backdrop-blur border border-slate-800 p-8 sm:p-12 rounded-2xl shadow-xl">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderedChangelog}
	</div>
</div>
