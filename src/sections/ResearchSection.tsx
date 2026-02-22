import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TrendingUp, ArrowRight, Hash } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface ResearchSectionProps {
  className?: string;
}

const ResearchSection = ({ className = '' }: ResearchSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const topicsRef = useRef<HTMLDivElement>(null);
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
        { x: '60vw', scale: 0.96, opacity: 0 },
        { x: 0, scale: 1, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        textRef.current,
        { x: '-40vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        photoRef.current,
        { x: '8vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.1
      );

      // Topic chips stagger
      const chips = topicsRef.current?.querySelectorAll('.topic-chip');
      if (chips) {
        scrollTl.fromTo(
          chips,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.02, ease: 'none' },
          0.15
        );
      }

      // SETTLE (30% - 70%) - hold

      // EXIT (70% - 100%)
      scrollTl.fromTo(
        textRef.current,
        { x: 0, opacity: 1 },
        { x: '-12vw', opacity: 0.25, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        cardRef.current,
        { y: 0, opacity: 1 },
        { y: '-10vh', opacity: 0.25, ease: 'power2.in' },
        0.7
      );

      if (chips) {
        scrollTl.fromTo(
          chips,
          { y: 0, opacity: 1 },
          { y: '-3vh', opacity: 0, ease: 'power2.in' },
          0.75
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const topics = [
    { label: t.research.topics[0], active: true },
    { label: t.research.topics[1], active: false },
    { label: t.research.topics[2], active: false },
    { label: t.research.topics[3], active: false },
    { label: t.research.topics[4], active: false },
  ];

  return (
    <section
      ref={sectionRef}
      className={`section-pinned bg-rakubun-bg ${className}`}
      style={{
        background: 'linear-gradient(225deg, #F6F7F9 0%, #E9EDF3 100%)',
      }}
    >
      {/* Text Block - Left */}
      <div
        ref={textRef}
        className="absolute left-[5vw] lg:left-[7vw] top-[15vh] lg:top-[34vh] w-[90vw] lg:w-[26vw] z-10"
      >
        <span className="eyebrow">{t.research.eyebrow}</span>
        <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text mt-3 leading-tight">
          {t.research.headline}
        </h2>
        <p className="text-base text-rakubun-text-secondary mt-4 leading-relaxed">
          {t.research.description}
        </p>
        <a
          href="#"
          className="rakubun-link inline-flex items-center gap-1.5 mt-4 text-sm"
        >
          {t.research.link}
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Card - Center/Right */}
      <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[5vw]">
        <div
          ref={cardRef}
          className="rakubun-card w-[92vw] lg:w-[60vw] max-w-[900px] h-[50vh] lg:h-[55vh] relative overflow-hidden mt-[25vh] lg:mt-0"
        >
          <div className="absolute inset-0 flex">
            {/* Left: Topics UI */}
            <div
              ref={topicsRef}
              className="w-[45%] h-full p-6 lg:p-8 flex flex-col justify-center"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-rakubun-accent" />
                <span className="font-medium text-rakubun-text">
                  {t.research.trendingInNiche}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <div
                    key={topic.label}
                    className={`topic-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-all ${
                      topic.active
                        ? 'bg-rakubun-accent/10 text-rakubun-accent border border-rakubun-accent/30'
                        : 'bg-white text-rakubun-text-secondary border border-black/5'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    {topic.label}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-black/5">
                <p className="text-xs text-rakubun-text-secondary">
                  {t.research.sources}
                </p>
              </div>
            </div>

            {/* Right: Photo */}
            <div ref={photoRef} className="flex-1 h-full relative">
              <img
                src="/images/research_workspace.jpg"
                alt="Overhead workspace"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResearchSection;
