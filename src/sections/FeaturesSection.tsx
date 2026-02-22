import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Search,
  TrendingUp,
  Upload,
  Bell,
  Image,
  Code,
} from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

const FeaturesSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(
        headerRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: 1,
          },
        }
      );

      // Cards animation
      const cards = cardsRef.current?.querySelectorAll('.feature-card');
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            duration: 0.6,
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 85%',
              end: 'top 55%',
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const icons = [Search, TrendingUp, Upload, Bell, Image, Code];

  const features = t.features.items.map((item, i) => ({
    icon: icons[i],
    title: item.title,
    description: item.description,
  }));

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative bg-rakubun-bg py-20 lg:py-28"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text">
            {t.features.headline}
          </h2>
          <p className="text-base lg:text-lg text-rakubun-text-secondary mt-4 max-w-xl mx-auto">
            {t.features.description}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6"
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="feature-card rakubun-card-hover cursor-pointer"
            >
              <div className="w-12 h-12 bg-rakubun-accent/10 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-rakubun-accent" />
              </div>
              <h3 className="text-lg font-heading font-semibold text-rakubun-text mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-rakubun-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
