import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Lock, Link2, ExternalLink } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

interface ConnectSectionProps {
  className?: string;
}

const ConnectSection = ({ className = '' }: ConnectSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
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
        uiRef.current,
        { y: '4vh', opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.15
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
        photoRef.current,
        { x: 0, opacity: 1 },
        { x: '10vw', opacity: 0.2, ease: 'power2.in' },
        0.7
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
        <span className="eyebrow">{t.connect.eyebrow}</span>
        <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text mt-3 leading-tight">
          {t.connect.headline}
        </h2>
        <p className="text-base text-rakubun-text-secondary mt-4 leading-relaxed">
          {t.connect.description}
        </p>
        <a
          href="#"
          className="rakubun-link inline-flex items-center gap-1.5 mt-4 text-sm"
        >
          {t.connect.link}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Card - Center/Right */}
      <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[5vw]">
        <div
          ref={cardRef}
          className="rakubun-card w-[92vw] lg:w-[60vw] max-w-[900px] h-[50vh] lg:h-[55vh] relative overflow-hidden mt-[25vh] lg:mt-0"
        >
          <div className="absolute inset-0 flex flex-col md:flex-row">
            {/* Left: Connection UI */}
            <div
              ref={uiRef}
              className="w-full md:w-[45%] h-1/2 md:h-full p-4 sm:p-6 lg:p-8 flex flex-col justify-center overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rakubun-text">
                  <Link2 className="w-5 h-5 text-rakubun-accent" />
                  <span className="font-medium">{t.connect.connectWordPress}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-rakubun-text-secondary mb-1.5 block">
                      {t.connect.siteUrl}
                    </label>
                    <div className="rakubun-input text-sm py-2.5">
                      https://myblog.com
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-rakubun-text-secondary mb-1.5 block">
                      {t.connect.applicationPassword}
                    </label>
                    <div className="rakubun-input text-sm py-2.5 flex items-center justify-between">
                      <span className="text-rakubun-text-secondary">
                        ••••••••••••••••
                      </span>
                      <Lock className="w-4 h-4 text-rakubun-text-secondary" />
                    </div>
                  </div>

                  <button className="btn-primary w-full text-sm mt-2">
                    {t.connect.connectSite}
                  </button>
                </div>

                {/* Secure Badge */}
                <div className="flex items-center gap-2 pt-2">
                  <Lock className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-rakubun-text-secondary">
                    {t.connect.encryptedSecure}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Photo */}
            <div ref={photoRef} className="flex-1 h-1/2 md:h-full relative">
              <img
                src="/images/connect_workspace.jpg"
                alt="Typing on laptop"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConnectSection;
