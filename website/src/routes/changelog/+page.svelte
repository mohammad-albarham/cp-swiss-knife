<script>
	import { base } from '$app/paths';
	let { data } = $props();

	const categoryMeta = {
		Added: { icon: '✦', color: 'emerald', label: 'Added' },
		Fixed: { icon: '⚡', color: 'amber', label: 'Fixed' },
		Changed: { icon: '↻', color: 'blue', label: 'Changed' },
		Removed: { icon: '✕', color: 'red', label: 'Removed' },
		Deprecated: { icon: '⚠', color: 'orange', label: 'Deprecated' },
		Security: { icon: '🔒', color: 'violet', label: 'Security' }
	};

	function getMeta(name) {
		return categoryMeta[name] || { icon: '•', color: 'slate', label: name };
	}

	function formatDate(dateStr) {
		try {
			return new Date(dateStr).toLocaleDateString('en-US', {
				year: 'numeric', month: 'long', day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}
</script>

<svelte:head>
	<title>Changelog — CP Swiss Knife</title>
	<meta name="description" content="Version history and release notes for CP Swiss Knife." />
</svelte:head>

<section class="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
	<!-- Header -->
	<div class="mb-16 text-center">
		<a href="{base}/" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors mb-8">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
			Back to Home
		</a>
		<h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">Changelog</h1>
		<p class="text-slate-400 text-lg">All notable changes to CP Swiss Knife, version by version.</p>
	</div>

	<!-- Timeline -->
	<div class="relative">
		<!-- Vertical timeline line -->
		<div class="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-500/40 via-slate-700/40 to-transparent hidden sm:block"></div>

		<div class="space-y-10">
			{#each data.versions as release, i (release.version)}
				<article
					class="relative sm:pl-14"
					style="animation: slide-up 0.5s ease-out {0.08 * i}s both;"
				>
					<!-- Timeline dot -->
					<div class="absolute left-0 top-1 hidden sm:flex items-center justify-center">
						{#if release.isLatest}
							<div class="w-[10px] h-[10px] rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
						{:else}
							<div class="w-[10px] h-[10px] rounded-full bg-slate-600 ring-4 ring-slate-800"></div>
						{/if}
					</div>

					<!-- Version card -->
					<div class="rounded-2xl border {release.isLatest ? 'border-blue-500/30 bg-blue-950/20' : 'border-slate-800 bg-slate-900/40'} p-6 sm:p-8 transition-all duration-300 hover:border-slate-700">
						<!-- Version header -->
						<div class="flex flex-wrap items-center gap-3 mb-5">
							<h2 class="text-2xl font-bold tracking-tight text-white">v{release.version}</h2>
							{#if release.isLatest}
								<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/20">Latest</span>
							{/if}
							<span class="text-sm text-slate-500 sm:ml-auto">{formatDate(release.date)}</span>
						</div>

						<!-- Categories -->
						<div class="space-y-5">
							{#each release.categories as category (category.name)}
								{@const meta = getMeta(category.name)}
								<div>
									<!-- Category badge -->
									<div class="flex items-center gap-2 mb-3">
										<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
											{meta.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : ''}
											{meta.color === 'amber' ? 'bg-amber-500/10 text-amber-400' : ''}
											{meta.color === 'blue' ? 'bg-blue-500/10 text-blue-400' : ''}
											{meta.color === 'red' ? 'bg-red-500/10 text-red-400' : ''}
											{meta.color === 'orange' ? 'bg-orange-500/10 text-orange-400' : ''}
											{meta.color === 'violet' ? 'bg-violet-500/10 text-violet-400' : ''}
											{meta.color === 'slate' ? 'bg-slate-500/10 text-slate-400' : ''}
										">
											<span>{meta.icon}</span>
											{meta.label}
										</span>
									</div>

									<!-- Items -->
									<ul class="space-y-2 ml-1">
										{#each category.items as item}
											<li class="flex gap-3 text-sm text-slate-300 leading-relaxed">
												<span class="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full
													{meta.color === 'emerald' ? 'bg-emerald-500/50' : ''}
													{meta.color === 'amber' ? 'bg-amber-500/50' : ''}
													{meta.color === 'blue' ? 'bg-blue-500/50' : ''}
													{meta.color === 'red' ? 'bg-red-500/50' : ''}
													{meta.color === 'orange' ? 'bg-orange-500/50' : ''}
													{meta.color === 'violet' ? 'bg-violet-500/50' : ''}
													{meta.color === 'slate' ? 'bg-slate-500/50' : ''}
												"></span>
												{item}
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>
