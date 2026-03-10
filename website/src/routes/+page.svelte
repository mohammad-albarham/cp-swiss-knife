<script lang="ts">
  import { base } from '$app/paths';
</script>

<div class="flex flex-col items-center justify-center w-full max-w-4xl mx-auto text-center mt-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
  
  <div class="space-y-6">
    <div class="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 ring-1 ring-white/10 shadow-2xl mb-4">
      <img src="{base}/logo.png" alt="CP Swiss Knife Logo" class="w-24 h-24 sm:w-32 sm:h-32 rounded-xl object-contain drop-shadow-xl" onerror={(e) => { const target = e.currentTarget as HTMLImageElement; target.src='https://raw.githubusercontent.com/mohammad-albarham/cp-swiss-knife/main/media/icon.png'; }} />
    </div>
    
    <h1 class="text-5xl sm:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-white to-slate-400">
      CP Swiss Knife
    </h1>
    
    <p class="text-xl sm:text-2xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
      The ultimate VS Code extension for <span class="text-blue-400 font-semibold">Codeforces</span>. Solve problems, run tests, and join contests without ever leaving your editor.
    </p>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
    <a 
      href="vscode:extension/albarham.cp-swiss-knife" 
      class="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 13.5l-2.5-1.5L20 9.5V17l-5 3v-7.5l2.5 1.5L20 12v1.5zM4 17V9.5L9 12l2.5-1.5L9 9l-2.5 1.5L4 12v5l2.5-1.5L9 17v-7.5l-5-3L9 3.5 18.5 9l-5 3 2.5 1.5 5-3L11.5 5 4 9.5v5l7.5 4.5 9.5-5.5V9.5l-9.5-5.5L2 9.5v5l9.5 5.5 9.5-5.5v-1z"/></svg>
      Install for VS Code
    </a>
    <a 
      href="https://open-vsx.org/extension/albarham/cp-swiss-knife" 
      target="_blank" rel="noopener noreferrer"
      class="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold shadow-lg ring-1 ring-white/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
      Open VSX
    </a>
    <a 
      href="https://github.com/mohammad-albarham/cp-swiss-knife" 
      target="_blank" rel="noopener noreferrer"
      class="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold shadow-lg ring-1 ring-white/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
      GitHub
    </a>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-16 text-left">
    <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-xl hover:border-slate-700 transition-colors">
      <div class="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-3">Solve & Submit</h3>
      <p class="text-slate-400 leading-relaxed">Browse Codeforces problems directly in VS Code. Write your solution and submit it to the judge without switching to your browser.</p>
    </div>
    
    <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-xl hover:border-slate-700 transition-colors">
      <div class="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center mb-6">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-3">Built-in Local Testing</h3>
      <p class="text-slate-400 leading-relaxed">Automatically extract sample cases from problems and run them locally with one click. Add custom test cases easily.</p>
    </div>
    
    <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-xl hover:border-slate-700 transition-colors">
      <div class="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-3">Live Contests</h3>
      <p class="text-slate-400 leading-relaxed">Join upcoming and running contests. View the problemset, track your submissions, and monitor the standings in real-time.</p>
    </div>
    
    <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-xl hover:border-slate-700 transition-colors">
      <div class="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center mb-6">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-3">Track Progress</h3>
      <p class="text-slate-400 leading-relaxed">View your Codeforces rating history chart, solve streaks, and solved problems directly from your personalized profile view.</p>
    </div>
  </div>
</div>
