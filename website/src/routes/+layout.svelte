<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	let { children } = $props();
</script>

<!-- Navbar -->
<nav class="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-lg">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
		<a href="{base}/" class="flex items-center gap-2.5 group">
			<img src="{base}/logo.png" alt="CP Swiss Knife" class="w-8 h-8 rounded-md shadow-sm transition-transform group-hover:scale-105" />
			<span class="text-lg font-semibold tracking-tight text-slate-100">CP Swiss Knife</span>
		</a>

		<div class="flex items-center gap-6">
			<a href="{base}/" class="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Home</a>
			<a href="{base}/changelog" class="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">Changelog</a>
			<a href="https://github.com/mohammad-albarham/cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">GitHub</a>
			<a
				href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife"
				target="_blank"
				rel="noopener noreferrer"
				class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
			>
				Install Extension
			</a>
		</div>
	</div>
</nav>

<div class="min-h-screen flex flex-col pt-16">
	<main class="flex-grow">
		{@render children()}
	</main>

	<footer class="w-full mt-24 py-12 border-t border-slate-800/60 bg-slate-950/50 backdrop-blur-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
			<div class="flex items-center gap-3">
				<img src="{base}/logo.png" alt="CP Swiss Knife Logo" class="w-8 h-8 rounded-md shadow-sm" />
				<span class="text-slate-300 font-medium tracking-tight">CP Swiss Knife</span>
			</div>

			<nav class="flex flex-wrap justify-center gap-8 text-sm font-medium text-slate-400">
				<a href="{base}/" class="hover:text-blue-400 transition-colors">Home</a>
				<a href="{base}/changelog" class="hover:text-emerald-400 transition-colors">Changelog</a>
				<a href="https://github.com/mohammad-albarham/cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="hover:text-amber-400 transition-colors">GitHub</a>
				<a href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="hover:text-fuchsia-400 transition-colors">VS Code Marketplace</a>
				<a href="https://open-vsx.org/extension/albarham/cp-swiss-knife" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 transition-colors">Open VSX</a>
			</nav>

			<div class="text-sm text-slate-500">
				&copy; {new Date().getFullYear()} Mohammad Albarham
			</div>
		</div>
	</footer>
</div>
