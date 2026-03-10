<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	let { children } = $props();
</script>

<div class="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col pt-16 sm:pt-24 lg:pt-32 selection:bg-blue-500/30">
	<main class="flex-grow flex flex-col items-center px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto">
		{@render children()}
	</main>
	
	<footer class="w-full mt-24 py-12 border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
			<div class="flex items-center gap-3">
				<img src="{base}/logo.png" alt="CP Swiss Knife Logo" class="w-8 h-8 rounded-md shadow-sm" onerror={(e) => { const target = e.currentTarget as HTMLImageElement; target.src='https://raw.githubusercontent.com/mohammad-albarham/cp-swiss-knife/main/media/icon.png'; }} />
				<span class="text-slate-300 font-medium tracking-tight">CP Swiss Knife</span>
			</div>
			
			<nav class="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium text-slate-400">
				<a href="{base}/" class="hover:text-blue-400 transition-colors">Home</a>
				<a href="https://github.com/mohammad-albarham/cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="hover:text-amber-400 transition-colors">GitHub Source</a>
				<a href="{base}/changelog" class="hover:text-emerald-400 transition-colors">Changelog</a>
				<a href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="hover:text-fuchsia-400 transition-colors">VS Code Marketplace</a>
			</nav>
			
			<div class="text-sm text-slate-500">
				&copy; {new Date().getFullYear()} Mohammad Albarham
			</div>
		</div>
	</footer>
</div>
