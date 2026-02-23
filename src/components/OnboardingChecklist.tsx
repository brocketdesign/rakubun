import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Globe,
  FileText,
  CalendarDays,
  Timer,
  ChevronDown,
  ChevronUp,
  X,
  PartyPopper,
  ArrowRight,
  Rocket,
  Info,
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { useSites } from '../stores/sitesStore';
import { useArticles } from '../stores/articlesStore';
import { useSchedules } from '../stores/schedulesStore';
import { useCronJobs } from '../stores/cronJobsStore';
import { useOnboarding, onboardingActions, type OnboardingStep } from '../stores/onboardingStore';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface StepConfig {
  id: OnboardingStep['id'];
  icon: React.ElementType;
  title: { en: string; ja: string };
  description: { en: string; ja: string };
  tooltip: { en: string; ja: string };
  path: string;
  cta: { en: string; ja: string };
  color: string;
  completedColor: string;
}

const stepsConfig: StepConfig[] = [
  {
    id: 'add-site',
    icon: Globe,
    title: {
      en: 'Connect your WordPress site',
      ja: 'WordPressサイトを接続',
    },
    description: {
      en: 'Add your first WordPress site to start generating and publishing articles automatically.',
      ja: '最初のWordPressサイトを追加して、記事の自動生成と公開を始めましょう。',
    },
    tooltip: {
      en: 'Go to Sites → Click "Add Site" → Enter your WordPress URL and Application Password to connect.',
      ja: 'サイト → 「サイト追加」をクリック → WordPress URLとアプリケーションパスワードを入力して接続します。',
    },
    path: '/dashboard/sites',
    cta: { en: 'Add Site', ja: 'サイトを追加' },
    color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
    completedColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
  {
    id: 'create-article',
    icon: FileText,
    title: {
      en: 'Create your first article',
      ja: '最初の記事を作成',
    },
    description: {
      en: 'Generate an AI-powered article with images, SEO optimization, and your brand voice.',
      ja: 'AI搭載の記事を生成しましょう。画像、SEO最適化、ブランドボイスが含まれます。',
    },
    tooltip: {
      en: 'Go to Articles → Click "New Article" → Enter a topic and let AI generate a complete article for you.',
      ja: '記事 → 「新しい記事」をクリック → トピックを入力し、AIが完全な記事を生成します。',
    },
    path: '/dashboard/articles?new=true',
    cta: { en: 'Create Article', ja: '記事を作成' },
    color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
    completedColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
  {
    id: 'create-schedule',
    icon: CalendarDays,
    title: {
      en: 'Set up a publishing schedule',
      ja: '公開スケジュールを設定',
    },
    description: {
      en: 'Plan your content calendar by scheduling topics with dates and times for consistent publishing.',
      ja: 'トピックに日時を設定して、一貫した公開のためのコンテンツカレンダーを計画しましょう。',
    },
    tooltip: {
      en: 'Go to Scheduler → Select a site → Add topics with dates and times → Save your schedule.',
      ja: 'スケジューラー → サイトを選択 → 日時付きのトピックを追加 → スケジュールを保存します。',
    },
    path: '/dashboard/scheduler',
    cta: { en: 'Create Schedule', ja: 'スケジュールを作成' },
    color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
    completedColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
  {
    id: 'create-cron-job',
    icon: Timer,
    title: {
      en: 'Automate with a cron job',
      ja: 'Cronジョブで自動化',
    },
    description: {
      en: 'Set up automatic article generation on a recurring schedule — publish on autopilot.',
      ja: '定期スケジュールで記事を自動生成 — オートパイロットで公開しましょう。',
    },
    tooltip: {
      en: 'Go to Cron Jobs → Select a site → Configure days, times, and article settings → Activate the job.',
      ja: 'Cronジョブ → サイトを選択 → 曜日、時間、記事設定を構成 → ジョブを有効化します。',
    },
    path: '/dashboard/cron-scheduler',
    cta: { en: 'Set Up Cron Job', ja: 'Cronジョブを設定' },
    color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10',
    completedColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
];

export default function OnboardingChecklist() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const onboarding = useOnboarding();
  const sites = useSites();
  const articles = useArticles();
  const schedules = useSchedules();
  const cronJobs = useCronJobs();
  const [expanded, setExpanded] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  // Reactively sync step completion from real store data
  useEffect(() => {
    onboardingActions.updateStepCompletion('add-site', sites.length > 0);
  }, [sites.length]);

  useEffect(() => {
    onboardingActions.updateStepCompletion('create-article', articles.length > 0);
  }, [articles.length]);

  useEffect(() => {
    onboardingActions.updateStepCompletion('create-schedule', schedules.length > 0);
  }, [schedules.length]);

  useEffect(() => {
    onboardingActions.updateStepCompletion('create-cron-job', cronJobs.length > 0);
  }, [cronJobs.length]);

  // Show confetti animation when all steps are complete
  useEffect(() => {
    if (onboardingActions.isAllComplete() && !showConfetti) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [onboarding.steps]);

  // Don't render if dismissed
  if (onboarding.dismissed) return null;

  const completedCount = onboardingActions.getCompletedCount();
  const totalCount = onboardingActions.getTotalCount();
  const progressPercent = (completedCount / totalCount) * 100;
  const allComplete = onboardingActions.isAllComplete();

  return (
    <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors duration-300 ${
            allComplete
              ? 'bg-emerald-50 dark:bg-emerald-500/10'
              : 'bg-gradient-to-br from-rakubun-accent/10 to-blue-500/10'
          }`}>
            {allComplete ? (
              <PartyPopper className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Rocket className="w-5 h-5 text-rakubun-accent" />
            )}
          </div>
          <div>
            <h3 className="font-heading font-semibold text-rakubun-text text-sm">
              {allComplete
                ? (language === 'en' ? 'Setup Complete!' : 'セットアップ完了！')
                : (language === 'en' ? 'Getting Started' : 'はじめましょう')
              }
            </h3>
            <p className="text-xs text-rakubun-text-secondary mt-0.5">
              {allComplete
                ? (language === 'en'
                    ? 'You\'re all set to use RakuBun!'
                    : 'RakuBunを使う準備ができました！')
                : (language === 'en'
                    ? `${completedCount} of ${totalCount} steps completed`
                    : `${totalCount}ステップ中${completedCount}完了`)
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress indicator badge */}
          {!allComplete && (
            <span className="text-[10px] font-bold text-rakubun-accent bg-rakubun-accent/10 px-2 py-0.5 rounded-full">
              {Math.round(progressPercent)}%
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onboardingActions.dismiss();
            }}
            className="p-1 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
            title={language === 'en' ? 'Dismiss' : '閉じる'}
          >
            <X className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pb-1">
        <div className="h-1.5 bg-rakubun-bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              allComplete
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-rakubun-accent to-blue-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-4 pt-3 space-y-1">
          {stepsConfig.map((stepConfig, index) => {
            const stepState = onboarding.steps.find((s) => s.id === stepConfig.id);
            const isCompleted = stepState?.completed ?? false;

            return (
              <div
                key={stepConfig.id}
                className={`group relative flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isCompleted
                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5'
                    : 'hover:bg-rakubun-bg/50'
                }`}
              >
                {/* Step Number / Check */}
                <div className="relative mt-0.5 shrink-0">
                  {isCompleted ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center transition-all duration-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-rakubun-border bg-rakubun-surface flex items-center justify-center group-hover:border-rakubun-accent/50 transition-colors">
                      <span className="text-xs font-bold text-rakubun-text-secondary group-hover:text-rakubun-accent transition-colors">
                        {index + 1}
                      </span>
                    </div>
                  )}
                  {/* Connector line */}
                  {index < stepsConfig.length - 1 && (
                    <div className={`absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-4 transition-colors ${
                      isCompleted ? 'bg-emerald-200 dark:bg-emerald-500/30' : 'bg-rakubun-border'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${isCompleted ? stepConfig.completedColor : stepConfig.color}`}>
                      <stepConfig.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-sm font-medium transition-colors ${
                      isCompleted
                        ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-300 dark:decoration-emerald-600'
                        : 'text-rakubun-text'
                    }`}>
                      {stepConfig.title[language]}
                    </span>
                    {/* Tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 rounded-full text-rakubun-text-secondary/60 hover:text-rakubun-text-secondary transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        <p>{stepConfig.tooltip[language]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${
                    isCompleted ? 'text-emerald-600/60 dark:text-emerald-400/60' : 'text-rakubun-text-secondary'
                  }`}>
                    {stepConfig.description[language]}
                  </p>
                  {/* CTA Button */}
                  {!isCompleted && (
                    <button
                      onClick={() => navigate(stepConfig.path)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rakubun-accent hover:text-rakubun-accent/80 transition-colors group/btn"
                    >
                      {stepConfig.cta[language]}
                      <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                    </button>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0 mt-1">
                  {isCompleted ? (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-full">
                      {language === 'en' ? 'Done' : '完了'}
                    </span>
                  ) : (
                    <Circle className="w-4 h-4 text-rakubun-border" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Completion celebration */}
          {allComplete && showConfetti && (
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center animate-in fade-in-0 zoom-in-95 duration-500">
              <PartyPopper className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {language === 'en' ? 'Congratulations! 🎉' : 'おめでとうございます！🎉'}
              </p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/60 mt-1">
                {language === 'en'
                  ? 'You\'ve completed all the setup steps. RakuBun is ready to go!'
                  : 'すべてのセットアップステップを完了しました。RakuBunの準備ができました！'}
              </p>
            </div>
          )}

          {/* Dismiss link */}
          {allComplete && !showConfetti && (
            <div className="mt-2 text-center">
              <button
                onClick={() => onboardingActions.dismiss()}
                className="text-xs text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
              >
                {language === 'en' ? 'Dismiss this guide' : 'このガイドを閉じる'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
