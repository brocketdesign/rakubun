import { useNavigate } from 'react-router-dom';
import { Crown, Zap, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useCurrentPlan, type PlanId } from '../stores/subscriptionStore';

interface UpgradePromptProps {
  /** Feature name to display */
  feature: string;
  /** Minimum plan required to access this feature */
  requiredPlan: PlanId;
  /** Optional custom message */
  message?: string;
  /** Layout variant */
  variant?: 'inline' | 'card' | 'overlay';
  /** Children to render when feature IS accessible */
  children?: React.ReactNode;
}

const planHierarchy: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export function hasAccess(currentPlan: PlanId, requiredPlan: PlanId): boolean {
  return planHierarchy[currentPlan] >= planHierarchy[requiredPlan];
}

export default function UpgradePrompt({
  feature,
  requiredPlan,
  message,
  variant = 'card',
  children,
}: UpgradePromptProps) {
  const currentPlan = useCurrentPlan();
  const navigate = useNavigate();
  const { language } = useLanguage();

  // If user has access, render children
  if (hasAccess(currentPlan, requiredPlan)) {
    return <>{children}</>;
  }

  const planNames: Record<PlanId, Record<string, string>> = {
    free: { en: 'Free', ja: 'フリー' },
    basic: { en: 'Basic', ja: 'ベーシック' },
    premium: { en: 'Premium', ja: 'プレミアム' },
  };

  const requiredPlanName = planNames[requiredPlan][language] || planNames[requiredPlan].en;

  const defaultMessage = language === 'en'
    ? `${feature} requires the ${requiredPlanName} plan or higher.`
    : `${feature}には${requiredPlanName}プラン以上が必要です。`;

  const upgradeText = language === 'en' ? 'Upgrade Now' : 'アップグレード';
  const displayMessage = message || defaultMessage;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm text-amber-700 dark:text-amber-300 flex-1">{displayMessage}</span>
        <button
          onClick={() => navigate('/dashboard/billing')}
          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
        >
          {upgradeText}
        </button>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-rakubun-bg/60 backdrop-blur-sm rounded-2xl">
          <div className="text-center p-6 max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-heading font-semibold text-rakubun-text mb-2">
              {language === 'en' ? `Unlock ${feature}` : `${feature}をアンロック`}
            </h3>
            <p className="text-sm text-rakubun-text-secondary mb-4">{displayMessage}</p>
            <button
              onClick={() => navigate('/dashboard/billing')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {upgradeText}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: card variant
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/5 dark:to-orange-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
        <Crown className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-heading font-semibold text-rakubun-text mb-2">
        {language === 'en' ? `${feature} — Premium Feature` : `${feature} — プレミアム機能`}
      </h3>
      <p className="text-sm text-rakubun-text-secondary mb-4 max-w-md mx-auto">{displayMessage}</p>
      <button
        onClick={() => navigate('/dashboard/billing')}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm hover:shadow-md"
      >
        <Zap className="w-4 h-4" />
        {upgradeText}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Usage Meter Component ────────────────────────────────────────────────────

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number; // -1 = unlimited
  className?: string;
}

export function UsageMeter({ label, used, limit, className = '' }: UsageMeterProps) {
  const { language } = useLanguage();
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && used >= limit;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-rakubun-text-secondary">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-rakubun-text'}`}>
          {used}{isUnlimited ? '' : ` / ${limit}`}
          {isUnlimited && <span className="text-rakubun-text-secondary ml-1">({language === 'en' ? 'unlimited' : '無制限'})</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-rakubun-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-rakubun-accent'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
