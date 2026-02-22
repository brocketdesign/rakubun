import { useLanguage } from '../i18n';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-rakubun-text-secondary hover:text-rakubun-text hover:bg-black/5 transition-all duration-200"
      aria-label={language === 'en' ? 'Switch to Japanese' : '英語に切り替え'}
      title={language === 'en' ? '日本語に切り替え' : 'Switch to English'}
    >
      <Globe className="w-4 h-4" />
      <span>{language === 'en' ? 'JA' : 'EN'}</span>
    </button>
  );
};

export default LanguageSwitcher;
