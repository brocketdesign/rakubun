import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Zap } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

const PricingSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(
        headerRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 80%',
            end: 'top 60%',
            scrub: 1,
          },
        }
      );

      // Cards animation
      const cards = cardsRef.current?.querySelectorAll('.pricing-card-item');
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 0.6,
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 85%',
              end: 'top 60%',
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const plans = t.pricing.plans.map((plan, i) => ({
    ...plan,
    highlighted: i === 1,
  }));

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative bg-rakubun-bg py-20 lg:py-28"
    >
      <div className="max-w-[1000px] mx-auto px-6 lg:px-8">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-[42px] font-heading font-bold text-rakubun-text">
            {t.pricing.headline}
          </h2>
          <p className="text-base lg:text-lg text-rakubun-text-secondary mt-4 max-w-xl mx-auto">
            {t.pricing.description}
          </p>
        </div>

        {/* Pricing Cards */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card-item ${
                plan.highlighted
                  ? 'pricing-card-highlighted'
                  : 'pricing-card'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-rakubun-accent text-white text-xs font-medium rounded-full">
                    <Zap className="w-3.5 h-3.5" />
                    {t.pricing.mostPopular}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-heading font-semibold text-rakubun-text">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl lg:text-4xl font-heading font-bold text-rakubun-text">
                    {plan.price}
                  </span>
                  <span className="text-sm text-rakubun-text-secondary">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-rakubun-text-secondary mt-2">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-rakubun-text"
                  >
                    <Check className="w-4 h-4 text-rakubun-accent flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
