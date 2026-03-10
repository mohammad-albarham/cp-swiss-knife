<svelte:head>
	<title>CP Swiss Knife — Competitive Programming in VS Code</title>
	<meta name="description" content="The ultimate unified toolkit for competitive programmers. Solve Codeforces problems, join contests, run local tests, and track your progress — all inside VS Code." />
</svelte:head>

<!-- Hero -->
<section class="relative flex flex-col items-center text-center px-4 pt-12 sm:pt-20 pb-16 overflow-hidden">
	<!-- Background glow -->
	<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>

	<div class="relative animate-float mb-8">
		<img src="{base}/logo.png" alt="CP Swiss Knife" class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shadow-2xl shadow-blue-500/20 ring-1 ring-white/10" />
	</div>

	<div class="relative animate-fade-in">
		<span class="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 ring-1 ring-blue-400/20">
			v0.2.3 — Now on Open VSX
		</span>
		<h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-3xl">
			Competitive Programming<br />
			<span class="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Swiss Knife</span>
		</h1>
		<p class="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
			Solve Codeforces problems, join contests, run local tests, and track your progress — all inside VS Code.
		</p>
	</div>

	<div class="relative flex flex-col sm:flex-row gap-4 mt-10 animate-slide-up" style="animation-delay: 0.2s;">
		<a
			href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 0 6 9l-3.5-2.5L0 8l6 4.5L24 2z"/><path d="M17.5 5.5 6 14.5l-3.5-2.5L0 14l6 4.5L24 7.5z"/><path d="M17.5 11 6 20l-3.5-2.5L0 19.5 6 24l18-13.5z"/></svg>
			VS Code Marketplace
		</a>
		<a
			href="https://open-vsx.org/extension/albarham/cp-swiss-knife"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-all ring-1 ring-slate-700 hover:ring-slate-600"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
			Open VSX Registry
		</a>
	</div>
</section>

<!-- Features -->
<section class="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
	<h2 class="text-center text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
		Everything You Need
	</h2>
	<p class="text-center text-slate-400 text-lg mb-12 max-w-xl mx-auto">
		A complete competitive programming workflow inside your editor.
	</p>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each features as feature, i (feature.title)}
			<div
				class="group relative rounded-2xl p-6 bg-slate-900/60 ring-1 ring-slate-800 hover:ring-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/5"
				style="animation: slide-up 0.5s ease-out {0.1 * i}s both;"
			>
				<div class="flex items-center justify-center w-11 h-11 rounded-xl mb-4 {feature.bg}">
					<span class="text-xl">{feature.icon}</span>
				</div>
				<h3 class="text-lg font-semibold text-white mb-2">{feature.title}</h3>
				<p class="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
			</div>
		{/each}
	</div>
</section>

<!-- Screenshots -->
<section class="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
	<h2 class="text-center text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
		See It in Action
	</h2>
	<p class="text-center text-slate-400 text-lg mb-12 max-w-xl mx-auto">
		Beautiful in-editor panels for every part of your workflow.
	</p>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		{#each screenshots as shot, i (shot.src)}
			<div
				class="group rounded-2xl overflow-hidden ring-1 ring-slate-800 bg-slate-900/40 transition-all duration-300 hover:ring-slate-700 hover:shadow-xl hover:shadow-blue-500/5"
				style="animation: slide-up 0.5s ease-out {0.15 * i}s both;"
			>
				<div class="aspect-[4/3] overflow-hidden">
					<img
						src={shot.src}
						alt={shot.alt}
						class="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
					/>
				</div>
				<div class="p-4">
					<h3 class="text-sm font-semibold text-white">{shot.title}</h3>
					<p class="text-xs text-slate-500 mt-1">{shot.caption}</p>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- Install / Quick Start -->
<section class="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
	<div class="rounded-2xl p-8 sm:p-12 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 ring-1 ring-slate-800 text-center">
		<h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
			Get Started in Seconds
		</h2>
		<p class="text-slate-400 text-lg mb-8 max-w-lg mx-auto">
			Install from your favorite marketplace, log in with your Codeforces handle, and start solving.
		</p>

		<div class="flex flex-col sm:flex-row justify-center gap-4">
			<a
				href="https://marketplace.visualstudio.com/items?itemName=albarham.cp-swiss-knife"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 0 6 9l-3.5-2.5L0 8l6 4.5L24 2z"/><path d="M17.5 5.5 6 14.5l-3.5-2.5L0 14l6 4.5L24 7.5z"/><path d="M17.5 11 6 20l-3.5-2.5L0 19.5 6 24l18-13.5z"/></svg>
				VS Code Marketplace
			</a>
			<a
				href="https://open-vsx.org/extension/albarham/cp-swiss-knife"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-all ring-1 ring-slate-700 hover:ring-slate-600"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
				Open VSX Registry
			</a>
			<a
				href="https://github.com/mohammad-albarham/cp-swiss-knife"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-all ring-1 ring-slate-700 hover:ring-slate-600"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 17.07 3.633 16.7 3.633 16.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>
				GitHub
			</a>
		</div>
	</div>
</section>

<!-- Developer -->
<section class="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-2">
	<div class="flex items-center justify-center gap-3 text-sm text-slate-500">
		<span>Built by</span>
		<a
			href="https://mohammad-albarham.github.io/"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 font-medium text-slate-300 hover:text-blue-400 transition-colors"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
			Mohammad Albarham
		</a>
	</div>
</section>
<script>
	import { base } from '$app/paths';
	const features = [
		{
			icon: '📚',
			title: 'Problem Explorer',
			description: 'Browse all problems by rating, tags, or status. Daily recommended problem based on your rating.',
			bg: 'bg-blue-500/10'
		},
		{
			icon: '🧪',
			title: 'Local Testing',
			description: 'Run sample tests locally with a dedicated results panel. Diff view, per-case pass/fail, and custom inputs.',
			bg: 'bg-emerald-500/10'
		},
		{
			icon: '🏆',
			title: 'Contest Explorer',
			description: 'Live contest listings with countdowns, standings, registration, and your per-problem performance.',
			bg: 'bg-amber-500/10'
		},
		{
			icon: '📊',
			title: 'Profile Dashboard',
			description: 'Rating history, solve streaks, solved problems browser, and submission analytics — all in the editor.',
			bg: 'bg-fuchsia-500/10'
		},
		{
			icon: '📝',
			title: 'Template Management',
			description: 'Built-in starters for 8 languages. Edit and reset templates with placeholder support.',
			bg: 'bg-cyan-500/10'
		},
		{
			icon: '🌐',
			title: 'Multi-Language Support',
			description: 'C++, Python, Java, Kotlin, Rust, Go, C#, and JavaScript. Compile with custom flags.',
			bg: 'bg-rose-500/10'
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
