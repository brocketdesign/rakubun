import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, FileText, Layout, Search } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface AnalysisSectionProps {
  className?: string;
}

const AnalysisSection = ({ className = '' }: AnalysisSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const microCardRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        },
      });

      // ENTRANCE (0% - 30%)
      scrollTl.fromTo(
        cardRef.current,
        { x: '-60vw', scale: 0.96, opacity: 0 },
        { x: 0, scale: 1, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        textRef.current,
        { x: '40vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        photoRef.current,
        { x: '-8vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.1
      );

      scrollTl.fromTo(
        microCardRef.current,
        { y: '-6vh', scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, ease: 'none' },
        0.15
      );

      // SETTLE (30% - 70%) - hold

      // EXIT (70% - 100%)
      scrollTl.fromTo(
        textRef.current,
        { x: 0, opacity: 1 },
        { x: '12vw', opacity: 0.25, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        cardRef.current,
        { y: 0, opacity: 1 },
        { y: '-10vh', opacity: 0.25, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        microCardRef.current,
        { y: 0, opacity: 1 },
        { y: '-6vh', opacity: 0, ease: 'power2.in' },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const features = [
    { icon: FileText, label: t.analysis.toneMatch },
    { icon: Layout, label: t.analysis.structureMap },
    { icon: Search, label: t.analysis.gapDetection },
  ];

  return (
    <section
      ref={sectionRef}
      className={`section-pinned bg-rakubun-bg dot-grid ${className}`}
    >
      {/* Text Block - Right */}
      <div
        ref={textRef}
        className="absolute right-[5vw] lg:right-[7vw] top-[15vh] lg:top-[34vh] w-[90vw] lg:w-[26vw] z-10 text-left"
      >
        <span className="eyebrow">{t.analysis.eyebrow}</span>
        <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text mt-3 leading-tight">
          {t.analysis.headline}
        </h2>
        <p className="text-base text-rakubun-text-secondary mt-4 leading-relaxed">
          {t.analysis.description}
        </p>

        {/* Feature List */}
        <div className="flex flex-wrap gap-3 mt-6">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-black/5"
            >
              <feature.icon className="w-4 h-4 text-rakubun-accent" />
              <span className="text-sm text-rakubun-text">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Card - Center/Left */}
      <div className="absolute inset-0 flex items-center justify-center lg:justify-start lg:pl-[5vw]">
        <div
          ref={cardRef}
          className="rakubun-card w-[92vw] lg:w-[60vw] max-w-[900px] h-[50vh] lg:h-[55vh] relative overflow-hidden mt-[25vh] lg:mt-0"
        >
          <div className="absolute inset-0 flex">
            {/* Left: Photo */}
            <div ref={photoRef} className="w-[55%] h-full relative">
              <img
                src="/images/analysis_workspace.jpg"
                alt="Person working"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Analysis Micro Card */}
              <div
                ref={microCardRef}
                className="micro-card absolute right-[-15%] top-[18%] w-[200px]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-rakubun-accent" />
                  <span className="text-sm font-medium text-rakubun-text">
                    {t.analysis.analysisReport}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rakubun-text-secondary">
                      {t.analysis.toneMatch}
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="w-[92%] h-full bg-rakubun-accent rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rakubun-text-secondary">
                      {t.analysis.structure}
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="w-[88%] h-full bg-rakubun-accent rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rakubun-text-secondary">
                      {t.analysis.seoScore}
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="w-[85%] h-full bg-green-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Empty space for balance */}
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisSection;
