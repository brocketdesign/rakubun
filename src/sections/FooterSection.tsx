import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n';

gsap.registerPlugin(ScrollTrigger);

const FooterSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: contentRef.current,
            start: 'top 85%',
            end: 'top 65%',
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const footerLinks: Record<string, string[]> = {};
  const categoryNames = Object.keys(t.footer.links);
  const categoryLabels = [t.footer.linkCategories.product, t.footer.linkCategories.company, t.footer.linkCategories.legal];
  categoryNames.forEach((key, i) => {
    footerLinks[categoryLabels[i]] = t.footer.links[key];
  });

  return (
    <footer
      ref={sectionRef}
      id="footer"
      className="relative bg-[#0E1116] text-white py-16 lg:py-20"
    >
      <div ref={contentRef} className="max-w-[1100px] mx-auto px-6 lg:px-8">
        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-[48px] font-heading font-bold">
            {t.footer.headline}
          </h2>
          <p className="text-base text-[#A9B3C2] mt-4 max-w-md mx-auto">
            {t.footer.description}
          </p>

          {/* Email Form */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mt-8">
            <input
              type="email"
              placeholder={t.footer.emailPlaceholder}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/50 focus:border-rakubun-accent transition-all"
            />
            <button className="btn-primary whitespace-nowrap">
              {t.footer.getStarted}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-white/10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="font-heading text-xl font-bold">RakuBun</span>
            <p className="text-sm text-[#A9B3C2] mt-2">
              {t.footer.brandDescription}
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-medium mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-[#A9B3C2] hover:text-white transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10">
          <p className="text-sm text-[#A9B3C2]">
            {t.footer.copyright.replace('{year}', String(new Date().getFullYear()))}
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-[#A9B3C2] hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-sm text-[#A9B3C2] hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="#"
              className="text-sm text-[#A9B3C2] hover:text-white transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
