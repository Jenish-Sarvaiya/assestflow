import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white selection:bg-primary-500 selection:text-white">
      <div className="glass-card max-w-lg w-full p-8 rounded-2xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600"></div>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
          AssetFlow
        </h1>
        <p className="text-slate-400 text-base leading-relaxed">
          Enterprise Asset & Resource Management System. Scaffolding complete and ready for development.
        </p>
        <div className="inline-flex items-center space-x-2 text-xs font-semibold px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Phase 0 Ready</span>
        </div>
      </div>
    </div>
  );
}

export default App;
