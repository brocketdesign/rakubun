import { useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface HeroSectionProps {
  className?: string;
}

const HeroSection = ({ className = '' }: HeroSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const microCardRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Load animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      // Card entrance
      tl.fromTo(
        cardRef.current,
        { y: '10vh', scale: 0.96, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.9 }
      );

      // Headline words
      const words = headlineRef.current?.querySelectorAll('.word');
      if (words) {
        tl.fromTo(
          words,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.03, duration: 0.6 },
          '-=0.5'
        );
      }

      // Photo
      tl.fromTo(
        photoRef.current,
        { x: '6vw', opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8 },
        '-=0.6'
      );

      // Micro card
      tl.fromTo(
        microCardRef.current,
        { y: '3vh', scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.6 },
        '-=0.4'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Scroll animation
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            // Reset to visible when scrolling back to top
            gsap.set(cardRef.current, { y: 0, scale: 1, opacity: 1 });
            gsap.set(headlineRef.current, { x: 0, opacity: 1 });
            gsap.set(photoRef.current, { x: 0, opacity: 1 });
            gsap.set(microCardRef.current, { y: 0, opacity: 1 });
          },
        },
      });

      // EXIT (70% - 100%)
      scrollTl.fromTo(
        cardRef.current,
        { y: 0, scale: 1, opacity: 1 },
        { y: '-18vh', scale: 0.96, opacity: 0.25, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        headlineRef.current,
        { x: 0, opacity: 1 },
        { x: '-10vw', opacity: 0.2, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        photoRef.current,
        { x: 0, opacity: 1 },
        { x: '10vw', opacity: 0.2, ease: 'power2.in' },
        0.7
      );

      scrollTl.fromTo(
        microCardRef.current,
        { y: 0, opacity: 1 },
        { y: '8vh', opacity: 0, ease: 'power2.in' },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const headlineWords = t.hero.headline.split(' ');

  return (
    <section
      ref={sectionRef}
      className={`section-pinned bg-rakubun-bg dot-grid ${className}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Main Hero Card */}
        <div
          ref={cardRef}
          className="rakubun-card w-[92vw] lg:w-[78vw] max-w-[1180px] h-[75vh] lg:h-[62vh] relative overflow-hidden"
        >
          {/* Content Area */}
          <div className="absolute inset-0 flex flex-col lg:flex-row">
            {/* Left: Text Content */}
            <div className="flex-1 p-6 lg:p-10 lg:pl-[6%] flex flex-col justify-center">
              <div ref={headlineRef} className="space-y-4 lg:space-y-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[52px] font-heading font-bold text-rakubun-text leading-tight">
                  {headlineWords.map((word, i) => (
                    <span key={i} className="word inline-block mr-[0.3em]">
                      {word}
                    </span>
                  ))}
                </h1>

                <p className="text-base lg:text-lg text-rakubun-text-secondary max-w-md leading-relaxed">
                  {t.hero.description}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button className="btn-primary">
                    {t.hero.ctaPrimary}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button className="btn-secondary">{t.hero.ctaSecondary}</button>
                </div>

                <div className="flex items-center gap-4 pt-2 text-xs text-rakubun-text-secondary">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    {t.hero.badgeFree}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    {t.hero.badgeNoCreditCard}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Photo */}
            <div className="hidden lg:block relative w-[50%] h-full">
              <div
                ref={photoRef}
                className="absolute left-0 top-[10%] w-full h-[80%] rounded-[22px] overflow-hidden"
              >
                <img
                  src="/images/hero_workspace.jpg"
                  alt="Modern workspace"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Status Micro Card */}
              <div
                ref={microCardRef}
                className="micro-card absolute left-[-8%] bottom-[12%] w-[180px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium text-rakubun-text">
                      {t.hero.siteConnected}
                    </p>
                    <p className="text-xs text-rakubun-text-secondary">
                      myblog.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
