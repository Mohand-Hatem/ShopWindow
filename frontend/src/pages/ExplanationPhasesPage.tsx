import React, { useState, useMemo } from 'react';
import { PHASES_DATA } from '../data/phasesData';
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Clock,
  Compass,
} from 'lucide-react';

export const ExplanationPhasesPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePhaseNumber, setActivePhaseNumber] = useState<number>(1);

  const categories = [
    'All',
    'Foundation',
    'Core Caching',
    'Advanced Invalidation',
    'Resilience & Telemetry',
    'Full-Stack Integration',
  ];

  const filteredPhases = useMemo(() => {
    return PHASES_DATA.filter((p) => {
      const matchesCategory =
        selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch =
        searchQuery === '' ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.whatWeLearned.concept.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.whatWeLearned.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.problemSolving.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const scrollToPhase = (phaseNum: number) => {
    setActivePhaseNumber(phaseNum);
    const element = document.getElementById(`phase-${phaseNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-16 max-w-6xl mx-auto pb-24">
      {/* Hero Header */}
      <section className="space-y-6 pt-4 border-b border-frost pb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-zinc-950 border border-frost text-[#ff801f]">
          <Compass className="w-3.5 h-3.5 text-[#ff801f]" />
          <span>Curriculum Reference Manual — Phases 1 Through 20</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl text-white font-normal tracking-tight leading-tight">
          The Complete Caching Story.
        </h1>

        <p className="text-base sm:text-lg text-[#a1a4a5] leading-relaxed max-w-4xl">
          Follow the architectural evolution of ShopWindow chronologically from Phase 1 through Phase 20.
          Every phase represents a real engineering milestone: discovering a problem, engineering an intentional solution,
          measuring its empirical impact, and evolving toward a resilient production system.
        </p>

        {/* Narrative Progression Spine */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-frost text-xs font-mono flex flex-wrap items-center gap-2 text-zinc-300">
          <span className="text-[#ff801f] font-bold">The Engineering Spine:</span>
          <span>Problem</span>
          <span className="text-zinc-600">→</span>
          <span>Solution</span>
          <span className="text-zinc-600">→</span>
          <span>New Edge Case</span>
          <span className="text-zinc-600">→</span>
          <span>Optimization</span>
          <span className="text-zinc-600">→</span>
          <span>Empirical Proof</span>
          <span className="text-zinc-600">→</span>
          <span className="text-[#11ff99]">Production Reliability</span>
        </div>
      </section>

      {/* Visual Timeline Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#11ff99]" />
            Project Progression Timeline (Phases 1 – 20)
          </h2>
          <span className="text-xs font-mono text-[#a1a4a5]">Click any phase to jump</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {PHASES_DATA.map((p) => {
            const isActive = activePhaseNumber === p.phase;
            return (
              <button
                key={p.phase}
                onClick={() => scrollToPhase(p.phase)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                  isActive
                    ? 'bg-white text-black border-white shadow-ring font-bold'
                    : 'bg-[#000000] border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/60'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>P{p.phase}</span>
                  {p.phase === 20 && <span className="text-[#ff801f]">★</span>}
                </div>
                <div className="text-[10px] font-sans font-medium line-clamp-2 leading-tight">
                  {p.title}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky Filter & Search Control Bar */}
      <section className="sticky top-20 z-40 bg-[#000000]/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-frost shadow-ring flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-white text-black font-bold shadow-ring'
                  : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900 border border-frost'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-52 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#a1a4a5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-frost rounded-full pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff801f]"
          />
        </div>
      </section>

      {/* Ordered Phase Cards (1 to 20) */}
      <section className="space-y-12">
        {filteredPhases.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-950 border border-frost space-y-2">
            <p className="text-sm font-mono text-[#a1a4a5]">No phases match your search query "{searchQuery}".</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="text-xs font-mono text-[#ff801f] underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredPhases.map((phase) => {
            const hasPrev = phase.phase > 1;
            const hasNext = phase.phase < 20;

            return (
              <div
                key={phase.phase}
                id={`phase-${phase.phase}`}
                className="scroll-mt-36 p-6 sm:p-8 rounded-3xl bg-[#000000] border border-frost shadow-ring space-y-8 relative overflow-hidden transition-all duration-300 hover:border-zinc-700"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-frost pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-white text-black font-mono font-bold text-sm flex items-center justify-center shadow-ring">
                        {phase.phase}
                      </span>
                      <span className="px-3 py-0.5 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-[#ff801f]">
                        {phase.category}
                      </span>
                    </div>

                    <h2 className="font-display text-2xl sm:text-3xl text-white font-normal">
                      Phase {phase.phase} — {phase.title}
                    </h2>
                    <p className="text-xs sm:text-sm font-mono text-[#a1a4a5]">
                      {phase.tagline}
                    </p>
                  </div>

                  {/* Benchmark Delta Badge if applicable */}
                  {phase.metrics && (
                    <div className="p-3 bg-zinc-950 rounded-2xl border border-frost text-xs font-mono space-y-1 min-w-[200px]">
                      <div className="text-[10px] uppercase text-zinc-500 tracking-wider">Measured Impact</div>
                      <div className="text-[#11ff99] font-bold">{phase.metrics.delta}</div>
                    </div>
                  )}
                </div>

                {/* 6 Structured Educational Questions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs leading-relaxed">
                  {/* Question 1: What did we build? */}
                  <div className="p-5 rounded-2xl bg-zinc-950/70 border border-frost space-y-2">
                    <span className="text-[11px] font-mono text-[#ff801f] uppercase tracking-wider font-semibold block">
                      1. What did we build?
                    </span>
                    <p className="text-[#f0f0f0]">{phase.whatWeBuilt}</p>
                  </div>

                  {/* Question 2: What problem were we solving? */}
                  <div className="p-5 rounded-2xl bg-zinc-950/70 border border-frost space-y-2">
                    <span className="text-[11px] font-mono text-[#ff2047] uppercase tracking-wider font-semibold block">
                      2. What problem were we solving?
                    </span>
                    <p className="text-[#f0f0f0]">{phase.problemSolving}</p>
                  </div>

                  {/* Question 3: How does it work? */}
                  <div className="col-span-1 lg:col-span-2 p-5 rounded-2xl bg-zinc-950/70 border border-frost space-y-3">
                    <span className="text-[11px] font-mono text-[#3b9eff] uppercase tracking-wider font-semibold block">
                      3. How does it work technically?
                    </span>
                    <div className="space-y-1.5 font-mono text-zinc-300">
                      {phase.howItWorks.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2">
                          <span className="text-zinc-500">•</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Question 4: What did we learn? */}
                  <div className="p-5 rounded-2xl bg-zinc-950/70 border border-frost space-y-2">
                    <span className="text-[11px] font-mono text-[#11ff99] uppercase tracking-wider font-semibold block">
                      4. What did we learn? ({phase.whatWeLearned.concept})
                    </span>
                    <p className="text-[#f0f0f0]">{phase.whatWeLearned.explanation}</p>
                  </div>

                  {/* Question 5: What benefit did it give us? */}
                  <div className="p-5 rounded-2xl bg-zinc-950/70 border border-frost space-y-2">
                    <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider font-semibold block">
                      5. What practical benefit did it give us?
                    </span>
                    <p className="text-[#f0f0f0]">{phase.benefit}</p>
                  </div>

                  {/* Question 6: How does it connect to the next phase? */}
                  <div className="col-span-1 lg:col-span-2 p-5 rounded-2xl bg-gradient-to-r from-zinc-950 to-black border border-[#ff801f]/30 space-y-2">
                    <span className="text-[11px] font-mono text-[#ff801f] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5" /> 6. Connection to the Next Phase
                    </span>
                    <p className="text-zinc-300">{phase.nextConnection}</p>
                  </div>
                </div>

                {/* Card Navigation Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-frost-soft text-xs font-mono">
                  {hasPrev ? (
                    <button
                      onClick={() => scrollToPhase(phase.phase - 1)}
                      className="flex items-center gap-1 text-[#a1a4a5] hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous: Phase {phase.phase - 1}
                    </button>
                  ) : (
                    <span className="text-zinc-600">Curriculum Start</span>
                  )}

                  {hasNext ? (
                    <button
                      onClick={() => scrollToPhase(phase.phase + 1)}
                      className="flex items-center gap-1 text-[#ff801f] hover:underline transition-colors"
                    >
                      Next: Phase {phase.phase + 1} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[#11ff99] font-bold">Curriculum Complete ✓</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Final Wrap-up Card */}
      <section className="p-8 rounded-3xl bg-zinc-950 border border-frost text-center space-y-4">
        <h3 className="font-display text-2xl text-white">Full 20-Phase Curriculum Mastered</h3>
        <p className="text-xs text-[#a1a4a5] max-w-2xl mx-auto">
          You have reviewed all 20 phases of the ShopWindow caching laboratory. Now test the live application
          or inspect the empirical benchmarks in the laboratory.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href="/how-it-works"
            className="px-5 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring"
          >
            How It Works Manual
          </a>
          <a
            href="/benchmark"
            className="px-5 py-2.5 rounded-full text-xs font-semibold border border-frost text-[#a1a4a5] hover:text-white transition-colors"
          >
            Benchmark Lab
          </a>
        </div>
      </section>
    </div>
  );
};
