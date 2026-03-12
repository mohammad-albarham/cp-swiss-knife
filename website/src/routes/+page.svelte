<svelte:head>
	<title>CP Swiss Knife — Competitive Programming in VS Code</title>
	<meta name="description" content="The ultimate unified toolkit for competitive programmers. Solve Codeforces problems, join contests, run local tests, and track your progress — all inside VS Code." />
</svelte:head>

<div class="flex flex-col items-center justify-center w-full max-w-6xl mx-auto text-center mt-12 sm:mt-20 space-y-16 animate-fade-in">
	
	<!-- Hero Section: Restored Bold Style -->
	<div class="space-y-8 relative">
		<!-- Background glow -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none"></div>

		<div class="inline-flex items-center justify-center p-4 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 ring-1 ring-white/10 shadow-2xl mb-4 animate-float">
			<img src="{base}/logo.png" alt="CP Swiss Knife Logo" class="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-contain drop-shadow-2xl" />
		</div>
		
		<div class="space-y-4">
			<span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 ring-1 ring-blue-400/20">
				v0.3.0 — Now on Marketplace & Open VSX
			</span>
			<h1 class="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-white to-slate-400 leading-tight">
				CP Swiss Knife
			</h1>
		</div>
		
		<p class="text-xl sm:text-2xl text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed">
			The ultimate VS Code extension for <span class="text-blue-400 font-bold border-b-2 border-blue-500/30">Codeforces</span>. Solve problems, run tests, and join contests without ever leaving your editor.
		</p>
	</div>

	<!-- Primary Actions: Restored Bold Buttons -->
	<div class="flex flex-col sm:flex-row gap-5 justify-center items-center w-full max-w-4xl px-4 animate-slide-up" style="animation-delay: 0.2s;">
		<a 
			href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife" 
			target="_blank" rel="noopener noreferrer"
			class="group w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
		>
			<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 0 6 9l-3.5-2.5L0 8l6 4.5L24 2z"/><path d="M17.5 5.5 6 14.5l-3.5-2.5L0 14l6 4.5L24 7.5z"/><path d="M17.5 11 6 20l-3.5-2.5L0 19.5 6 24l18-13.5z"/></svg>
			Marketplace
		</a>
		<a 
			href="https://open-vsx.org/extension/albarham/cp-swiss-knife" 
			target="_blank" rel="noopener noreferrer"
			class="w-full sm:w-auto px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold shadow-xl ring-1 ring-white/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
		>
			<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
			Open VSX
		</a>
		<a 
			href="https://github.com/mohammad-albarham/cp-swiss-knife" 
			target="_blank" rel="noopener noreferrer"
			class="w-full sm:w-auto px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold shadow-xl ring-1 ring-white/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
		>
			<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 17.07 3.633 16.7 3.633 16.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>
			GitHub
		</a>
	</div>

	<!-- Features Grid: Modern Content in Bold Container -->
	<section class="w-full py-16 animate-slide-up" style="animation-delay: 0.4s;">
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
			{#each features as feature, i (feature.title)}
				<div
					class="group relative rounded-3xl p-8 bg-slate-900/40 backdrop-blur-sm ring-1 ring-slate-800 hover:ring-blue-500/50 transition-all duration-300 hover:bg-slate-900/60"
				>
					<div class="flex items-center justify-center w-14 h-14 rounded-2xl mb-6 {feature.bg} ring-1 ring-white/5 shadow-inner">
						<span class="text-2xl">{feature.icon}</span>
					</div>
					<h3 class="text-xl font-bold text-white mb-3">{feature.title}</h3>
					<p class="text-slate-400 leading-relaxed text-sm">{feature.description}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Screenshots: Cinematic Gallery -->
	<section class="w-full py-16 animate-slide-up" style="animation-delay: 0.6s;">
		<h2 class="text-3xl font-bold text-white mb-12">See the Power</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
			{#each screenshots as shot, i (shot.src)}
				<div
					class="group rounded-3xl overflow-hidden ring-1 ring-slate-800 bg-slate-900/40 transition-all duration-500 hover:ring-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10"
				>
					<div class="aspect-[4/3] overflow-hidden">
						<img
							src={shot.src}
							alt={shot.alt}
							class="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
						/>
					</div>
					<div class="p-6 text-left">
						<h3 class="text-base font-bold text-white">{shot.title}</h3>
						<p class="text-xs text-slate-500 mt-2 leading-relaxed">{shot.caption}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Footer -->
	<footer class="w-full py-12 border-t border-slate-800/50 mt-16 pb-20">
		<div class="flex flex-col items-center gap-4 text-sm text-slate-500">
			<p>Built with ❤️ by <a href="https://mohammad-albarham.github.io/" target="_blank" class="text-slate-300 hover:text-blue-400 font-semibold transition-colors">Mohammad Albarham</a></p>
			<p>&copy; 2026 CP Swiss Knife. Open Source under MIT License.</p>
		</div>
	</footer>
</div>

<script>
	import { base } from '$app/paths';
	const features = [
		{
			icon: '📚',
			title: 'Problem Explorer',
			description: 'Browse all problems by rating, tags, or status. Daily recommended problem based on your rating.',
			bg: 'bg-blue-500/10 text-blue-400'
		},
		{
			icon: '🧪',
			title: 'Local Testing',
			description: 'Run sample tests locally with a dedicated results panel. Diff view, per-case pass/fail, and custom inputs.',
			bg: 'bg-emerald-500/10 text-emerald-400'
		},
		{
			icon: '🏆',
			title: 'Contest Explorer',
			description: 'Live contest listings with countdowns, standings, registration, and your per-problem performance.',
			bg: 'bg-amber-500/10 text-amber-400'
		},
		{
			icon: '📊',
			title: 'Profile Dashboard',
			description: 'Rating history, solve streaks, solved problems browser, and submission analytics — all in the editor.',
			bg: 'bg-fuchsia-500/10 text-fuchsia-400'
		},
		{
			icon: '📝',
			title: 'Template Management',
			description: 'Built-in starters for 8 languages. Edit and reset templates with placeholder support.',
			bg: 'bg-cyan-500/10 text-cyan-400'
		},
		{
			icon: '🌐',
			title: 'Multi-Language Support',
			description: 'C++, Python, Java, Kotlin, Rust, Go, C#, and JavaScript. Compile with custom flags.',
			bg: 'bg-rose-500/10 text-rose-400'
		}
	];

	const screenshots = [
		{
			src: `${base}/screenshots/profile.png`,
			alt: 'User Profile Dashboard',
			title: 'Profile Dashboard',
			caption: 'Rating, streaks, and submission analytics at a glance'
		},
		{
			src: `${base}/screenshots/problem_test_example.png`,
			alt: 'Local Testing Results',
			title: 'Local Testing',
			caption: 'Per-case results with diff view and custom inputs'
		},
		{
			src: `${base}/screenshots/solved_problems.png`,
			alt: 'Solved Problems Browser',
			title: 'Solved Problems',
			caption: 'Searchable, filterable solved problems with charts'
		}
	];
</script>
