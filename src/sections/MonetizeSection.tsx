import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TrendingUp, DollarSign, ArrowRight, BarChart3 } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface MonetizeSectionProps {
  className?: string;
}

const MonetizeSection = ({ className = '' }: MonetizeSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
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

      scrollTl.fromTo(
        dashboardRef.current,
        { y: '4vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.15
      );

      scrollTl.fromTo(
        microCardRef.current,
        { y: '6vh', scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, ease: 'none' },
        0.2
      );

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

      scrollTl.fromTo(
        microCardRef.current,
        { y: 0, opacity: 1 },
        { y: '8vh', opacity: 0, ease: 'power2.in' },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`section-pinned bg-gradient-to-br from-rakubun-bg to-rakubun-bg-secondary ${className}`}
    >
      {/* Text Block - Left */}
      <div
        ref={textRef}
        className="absolute left-[5vw] lg:left-[7vw] top-[15vh] lg:top-[34vh] w-[90vw] lg:w-[26vw] z-10"
      >
        <span className="eyebrow">{t.monetize.eyebrow}</span>
        <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text mt-3 leading-tight">
          {t.monetize.headline}
        </h2>
        <p className="text-base text-rakubun-text-secondary mt-4 leading-relaxed">
          {t.monetize.description}
        </p>
        <a
          href="#"
          className="rakubun-link inline-flex items-center gap-1.5 mt-4 text-sm"
        >
          {t.monetize.link}
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Card - Center/Right */}
      <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[5vw]">
        <div
          ref={cardRef}
          className="rakubun-card w-[92vw] lg:w-[60vw] max-w-[900px] h-[50vh] lg:h-[55vh] relative overflow-hidden mt-[25vh] lg:mt-0"
        >
          <div className="absolute inset-0 flex flex-col-reverse md:flex-row">
            {/* Left: Photo */}
            <div ref={photoRef} className="hidden md:block w-[55%] h-full relative">
              <img
                src="/images/monetize_workspace.jpg"
                alt="Analytics dashboard"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {/* Right: Revenue Dashboard */}
            <div
              ref={dashboardRef}
              className="w-full md:flex-1 h-full p-4 sm:p-6 lg:p-8 flex flex-col justify-center overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-rakubun-accent" />
                <span className="font-medium text-rakubun-text">
                  {t.monetize.revenueDashboard}
                </span>
              </div>

              {/* Mini Chart */}
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4">
                <div className="flex items-end justify-between h-32 gap-2">
                  {[
                    { height: 40, value: '$120' },
                    { height: 65, value: '$195' },
                    { height: 45, value: '$135' },
                    { height: 80, value: '$240' },
                    { height: 55, value: '$165' },
                    { height: 70, value: '$210' },
                    { height: 85, value: '$255' }
                  ].map((data, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end items-center gap-1 group h-full"
                    >
                      <span className="text-[10px] font-medium text-rakubun-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                        {data.value}
                      </span>
                      <div className="w-full bg-black/5 dark:bg-white/5 rounded-t-lg relative overflow-hidden h-24">
                        <div
                          className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500 ${
                            i === 6 ? 'bg-rakubun-accent' : 'bg-rakubun-border group-hover:bg-rakubun-accent/50'
                          }`}
                          style={{ height: `${data.height}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-rakubun-text-secondary px-1">
                  {t.monetize.weekDays.map((day, i) => (
                    <span key={i}>{day}</span>
                  ))}
                </div>
              </div>

              {/* Payout Micro Card */}
              <div
                ref={microCardRef}
                className="micro-card mt-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-rakubun-text-secondary">
                    {t.monetize.estimatedMonthly}
                  </p>
                  <p className="text-lg font-semibold text-rakubun-text">
                    $1,247.00
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1 text-green-600 dark:text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+12.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MonetizeSection;
