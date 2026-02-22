import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Calendar, Clock, Image, Link2, FileCode } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface AutoPublishSectionProps {
  className?: string;
}

const AutoPublishSection = ({ className = '' }: AutoPublishSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
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
        calendarRef.current,
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
        { y: '8vh', opacity: 0, ease: 'power2.in' },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const features = [
    { icon: Image, label: t.autoPublish.autoImages },
    { icon: Link2, label: t.autoPublish.internalLinks },
    { icon: FileCode, label: t.autoPublish.seoMeta },
  ];

  // Calendar days
  const days = t.autoPublish.calendarDays;
  const dates = Array.from({ length: 28 }, (_, i) => i + 1);
  const highlightedDates = [5, 12, 19, 26];

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
        <span className="eyebrow">{t.autoPublish.eyebrow}</span>
        <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text mt-3 leading-tight">
          {t.autoPublish.headline}
        </h2>
        <p className="text-base text-rakubun-text-secondary mt-4 leading-relaxed">
          {t.autoPublish.description}
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
            {/* Left: Calendar UI */}
            <div
              ref={calendarRef}
              className="w-[45%] h-full p-6 lg:p-8 flex flex-col justify-center"
            >
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-rakubun-accent" />
                <span className="font-medium text-rakubun-text">
                  {t.autoPublish.publishingSchedule}
                </span>
              </div>

              {/* Mini Calendar */}
              <div className="bg-white rounded-2xl border border-black/5 p-4">
                <div className="text-sm font-medium text-rakubun-text mb-3">
                  {t.autoPublish.calendarMonth}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {days.map((day) => (
                    <div
                      key={day}
                      className="text-xs text-rakubun-text-secondary py-1"
                    >
                      {day}
                    </div>
                  ))}
                  {dates.map((date) => (
                    <div
                      key={date}
                      className={`text-xs py-1.5 rounded-lg ${
                        highlightedDates.includes(date)
                          ? 'bg-rakubun-accent text-white'
                          : 'text-rakubun-text hover:bg-gray-50'
                      }`}
                    >
                      {date}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduled Micro Card */}
              <div
                ref={microCardRef}
                className="micro-card mt-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-rakubun-accent/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-rakubun-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-rakubun-text">
                    {t.autoPublish.nextSchedule}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary">
                    {t.autoPublish.nextArticle}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Photo */}
            <div ref={photoRef} className="flex-1 h-full relative">
              <img
                src="/images/schedule_workspace.jpg"
                alt="Desk with clock"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutoPublishSection;
