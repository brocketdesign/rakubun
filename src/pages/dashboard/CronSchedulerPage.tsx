import { useState, useEffect } from 'react';
import {
  Timer,
  Globe,
  Plus,
  Loader2,
  Sparkles,
  Check,
  Pencil,
  Trash2,
  Play,
  Pause,
  Copy,
  Mail,
  Image,
  FileText,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Save,
  Zap,
  FileEdit,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '../../i18n';
import { useSites, sitesActions } from '../../stores/sitesStore';
import { SiteSelector } from '../../components/SiteSelector';
import {
  useCronJobs,
  useCronJobsLoading,
  cronJobsActions,
  type CronJob,
  type CronDaySchedule,
} from '../../stores/cronJobsStore';

// ─── Constants ──────────────────────────────────────────────────────────────────

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const daysOfWeekJa = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

const analysisSteps = {
  en: ['Fetching website categories...', 'Analyzing content types...', 'Generating optimal schedule...'],
  ja: ['ウェブサイトのカテゴリを取得中...', 'コンテンツタイプを分析中...', '最適なスケジュールを生成中...'],
};

function formatTimeDisplay(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ─── AnalyzingStep sub-component ────────────────────────────────────────────────

function AnalyzingStep({ language }: { language: 'en' | 'ja' }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStep(1), 1500);
    const timer2 = setTimeout(() => setCurrentStep(2), 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const steps = analysisSteps[language];

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-rakubun-accent/20" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-rakubun-accent animate-spin" />
        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-rakubun-accent" />
      </div>
      <div className="space-y-3 w-full max-w-sm">
        {steps.map((text, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i <= currentStep ? 'opacity-100' : 'opacity-30'
            }`}
          >
            {i < currentStep ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : i === currentStep ? (
              <Loader2 className="w-4 h-4 text-rakubun-accent animate-spin shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-rakubun-border shrink-0" />
            )}
            <span className="text-sm text-rakubun-text">{text}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-rakubun-text-secondary mt-4">
        {language === 'en' ? 'This may take up to 30 seconds...' : '最大30秒かかる場合があります...'}
      </p>
    </div>
  );
}

// ─── Schedule Table Row ─────────────────────────────────────────────────────────

function ScheduleRow({
  item,
  language,
  editing,
  onEdit,
  onSave,
  onCancel,
  editTime,
  setEditTime,
  editArticleType,
  setEditArticleType,
  editEnabled,
  setEditEnabled,
}: {
  item: CronDaySchedule;
  language: 'en' | 'ja';
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editTime: string;
  setEditTime: (v: string) => void;
  editArticleType: string;
  setEditArticleType: (v: string) => void;
  editEnabled: boolean;
  setEditEnabled: (v: boolean) => void;
}) {
  const dayLabel = language === 'en' ? item.day : daysOfWeekJa[daysOfWeek.indexOf(item.day)];

  return (
    <tr
      className={`border-b border-rakubun-border/50 transition-colors ${
        !item.enabled ? 'opacity-50' : ''
      } ${editing ? 'bg-rakubun-accent/5' : 'hover:bg-rakubun-bg-secondary/50'}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {editing ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => setEditEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-rakubun-border text-rakubun-accent focus:ring-rakubun-accent"
              />
              <span className="font-medium text-rakubun-text">{dayLabel}</span>
            </label>
          ) : (
            <span className="font-medium text-rakubun-text">{dayLabel}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="time"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            className="px-2 py-1 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-sm focus:outline-none focus:ring-2 focus:ring-rakubun-accent/50"
          />
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-rakubun-text">
            <Clock className="w-3.5 h-3.5 text-rakubun-text-secondary" />
            {formatTimeDisplay(item.time)} JST
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="text"
            value={editArticleType}
            onChange={(e) => setEditArticleType(e.target.value)}
            className="w-full px-2 py-1 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-sm focus:outline-none focus:ring-2 focus:ring-rakubun-accent/50"
          />
        ) : (
          <span className="text-sm text-rakubun-text">{item.articleType}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onSave}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              title={language === 'en' ? 'Save' : '保存'}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-rakubun-text-secondary hover:bg-rakubun-bg-secondary transition-colors"
              title={language === 'en' ? 'Cancel' : 'キャンセル'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-rakubun-text-secondary hover:text-rakubun-accent hover:bg-rakubun-bg-secondary transition-colors"
            title={language === 'en' ? 'Edit' : '編集'}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function CronSchedulerPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const sites = useSites();
  const cronJobs = useCronJobs();
  const cronJobsLoading = useCronJobsLoading();

  // ─── State ──────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [articlesPerWeek, setArticlesPerWeek] = useState(7);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  // Expanded card
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Editing existing cron job
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobSchedule, setEditJobSchedule] = useState<CronDaySchedule[]>([]);
  const [editJobImages, setEditJobImages] = useState(4);
  const [editJobArticlesPerWeek, setEditJobArticlesPerWeek] = useState(7);
  const [editJobWordMin, setEditJobWordMin] = useState(1000);
  const [editJobWordMax, setEditJobWordMax] = useState(1500);
  const [editJobEmail, setEditJobEmail] = useState('');
  const [editJobRowIndex, setEditJobRowIndex] = useState<number | null>(null);
  const [editJobRowTime, setEditJobRowTime] = useState('');
  const [editJobRowType, setEditJobRowType] = useState('');
  const [editJobRowEnabled, setEditJobRowEnabled] = useState(true);
  const [savingJob, setSavingJob] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copied state for cron ID
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── Load data on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!sitesActions.isLoaded() && !sitesActions.isLoading()) {
      sitesActions.loadSites(getToken);
    }
    if (!cronJobsActions.isLoaded() && !cronJobsActions.isLoading()) {
      cronJobsActions.loadCronJobs(getToken);
    }
  }, [getToken]);

  // ─── Site name lookup ───────────────────────────────────────────────


  // ─── Handlers ───────────────────────────────────────────────────────

  const handleAnalyzeSite = async () => {
    if (!selectedSiteId) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const result = await cronJobsActions.generateSchedule(getToken, selectedSiteId, articlesPerWeek);
      if (result) {
        // Auto-save as draft
        const site = sites.find((s) => s.id === selectedSiteId);
        if (!site) return;
        await cronJobsActions.createCronJob(getToken, {
          siteId: selectedSiteId,
          siteName: site.name || site.url,
          siteUrl: site.url,
          schedule: result.schedule,
          language: result.language,
          wordCountMin: 1000,
          wordCountMax: 1500,
          imagesPerArticle: 4,
          articlesPerWeek,
          style: result.style,
          emailNotification: '',
          status: 'draft',
        });
        resetCreateModal();
      } else {
        setAnalyzeError(
          language === 'en'
            ? 'Failed to generate schedule. Please try again.'
            : 'スケジュールの生成に失敗しました。もう一度お試しください。',
        );
      }
    } catch {
      setAnalyzeError(
        language === 'en'
          ? 'An error occurred while analyzing the site.'
          : 'サイト分析中にエラーが発生しました。',
      );
    } finally {
      setAnalyzing(false);
    }
  };



  const resetCreateModal = () => {
    setShowCreateModal(false);
    setSelectedSiteId('');
    setArticlesPerWeek(7);
    setAnalyzeError('');
  };

  const handleToggleStatus = async (job: CronJob) => {
    await cronJobsActions.updateCronJob(getToken, job.id, {
      status: job.status === 'active' ? 'paused' : 'active',
    });
  };

  const handleActivateJob = async (job: CronJob) => {
    await cronJobsActions.updateCronJob(getToken, job.id, {
      status: 'active',
    });
  };

  const handleDeleteJob = async (id: string) => {
    await cronJobsActions.deleteCronJob(getToken, id);
    setDeleteConfirmId(null);
  };

  const handleCopyCronId = (cronJobId: string) => {
    navigator.clipboard.writeText(cronJobId);
    setCopiedId(cronJobId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditingJob = (job: CronJob) => {
    setEditingJobId(job.id);
    setEditJobSchedule([...job.schedule]);
    setEditJobImages(job.imagesPerArticle);
    setEditJobArticlesPerWeek(job.articlesPerWeek);
    setEditJobWordMin(job.wordCountMin);
    setEditJobWordMax(job.wordCountMax);
    setEditJobEmail(job.emailNotification);
    setEditJobRowIndex(null);
  };

  const handleSaveJobEdits = async (jobId: string) => {
    setSavingJob(true);
    await cronJobsActions.updateCronJob(getToken, jobId, {
      schedule: editJobSchedule,
      imagesPerArticle: editJobImages,
      articlesPerWeek: editJobArticlesPerWeek,
      wordCountMin: editJobWordMin,
      wordCountMax: editJobWordMax,
      emailNotification: editJobEmail,
    });
    setEditingJobId(null);
    setSavingJob(false);
  };

  const handleCancelJobEdit = () => {
    setEditingJobId(null);
    setEditJobRowIndex(null);
  };

  // ─── Render Job Card ─────────────────────────────────────────────────

  const renderJobCard = (job: CronJob) => {
    const isExpanded = expandedJobId === job.id;
    const isEditing = editingJobId === job.id;
    const schedule = isEditing ? editJobSchedule : job.schedule;
    const isDraft = job.status === 'draft';

    return (
      <div
        key={job.id}
        className="bg-rakubun-surface border border-rakubun-border rounded-xl overflow-hidden"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rakubun-border/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isDraft
                  ? 'bg-amber-500'
                  : job.status === 'active'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-gray-400'
              }`}
            />
            <div>
              <h3 className="font-semibold text-rakubun-text flex items-center gap-2">
                📅 {job.siteName}
                {isDraft && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                    {language === 'en' ? 'Draft' : '下書き'}
                  </span>
                )}
                <span className="text-xs text-rakubun-text-secondary font-normal">
                  {language === 'en' ? 'Publishing Schedule' : '公開スケジュール'}
                </span>
              </h3>
              <p className="text-xs text-rakubun-text-secondary mt-0.5">{job.siteUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                {isDraft ? (
                  <button
                    onClick={() => handleActivateJob(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
                    title={language === 'en' ? 'Activate' : '有効化'}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Activate' : '有効化'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleStatus(job)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      job.status === 'active'
                        ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        : 'text-gray-400 hover:bg-rakubun-bg-secondary'
                    }`}
                    title={
                      job.status === 'active'
                        ? language === 'en'
                          ? 'Pause'
                          : '一時停止'
                        : language === 'en'
                          ? 'Resume'
                          : '再開'
                    }
                  >
                    {job.status === 'active' ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => startEditingJob(job)}
                  className="p-1.5 rounded-lg text-rakubun-text-secondary hover:text-rakubun-accent hover:bg-rakubun-bg-secondary transition-colors"
                  title={language === 'en' ? 'Edit' : '編集'}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(job.id)}
                  className="p-1.5 rounded-lg text-rakubun-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title={language === 'en' ? 'Delete' : '削除'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={() => handleSaveJobEdits(job.id)}
                  disabled={savingJob}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rakubun-accent text-white rounded-lg hover:bg-rakubun-accent/90 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {savingJob ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {language === 'en' ? 'Save' : '保存'}
                </button>
                <button
                  onClick={handleCancelJobEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-rakubun-border rounded-lg text-rakubun-text-secondary hover:bg-rakubun-bg-secondary text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
              </>
            )}
            <button
              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
              className="p-1.5 rounded-lg text-rakubun-text-secondary hover:bg-rakubun-bg-secondary transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rakubun-border/50 bg-rakubun-bg-secondary/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider w-36">
                  {language === 'en' ? 'Day' : '曜日'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider w-44">
                  {language === 'en' ? 'Time (JST)' : '時間 (JST)'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider">
                  {language === 'en' ? 'Article Type' : '記事タイプ'}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider w-20">
                  {/* Actions column */}
                </th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, idx) => {
                const isEditingRow = isEditing && editJobRowIndex === idx;

                return (
                  <ScheduleRow
                    key={idx}
                    item={item}
                    language={language}
                    editing={isEditingRow}
                    editTime={isEditingRow ? editJobRowTime : ''}
                    setEditTime={setEditJobRowTime}
                    editArticleType={isEditingRow ? editJobRowType : ''}
                    setEditArticleType={setEditJobRowType}
                    editEnabled={isEditingRow ? editJobRowEnabled : item.enabled}
                    setEditEnabled={setEditJobRowEnabled}
                    onEdit={() => {
                      setEditJobRowIndex(idx);
                      setEditJobRowTime(item.time);
                      setEditJobRowType(item.articleType);
                      setEditJobRowEnabled(item.enabled);
                    }}
                    onSave={() => {
                      const updated = [...editJobSchedule];
                      updated[idx] = {
                        ...updated[idx],
                        time: editJobRowTime,
                        articleType: editJobRowType,
                        enabled: editJobRowEnabled,
                      };
                      setEditJobSchedule(updated);
                      setEditJobRowIndex(null);
                    }}
                    onCancel={() => setEditJobRowIndex(null)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Details Panel (expanded) */}
        {isExpanded && (
          <div className="border-t border-rakubun-border/50 bg-rakubun-bg-secondary/20 px-5 py-4">
            <h4 className="text-xs font-semibold text-rakubun-text-secondary uppercase tracking-wider mb-3">
              {language === 'en' ? 'Details' : '詳細'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DetailItem
                icon={<Globe className="w-4 h-4" />}
                label={language === 'en' ? 'Language' : '言語'}
                value={job.language}
              />
              <DetailItem
                icon={<FileText className="w-4 h-4" />}
                label={language === 'en' ? 'Word Count' : '文字数'}
                value={
                  isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editJobWordMin}
                        onChange={(e) => setEditJobWordMin(Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-xs focus:outline-none focus:ring-1 focus:ring-rakubun-accent/50"
                      />
                      <span className="text-xs text-rakubun-text-secondary">-</span>
                      <input
                        type="number"
                        value={editJobWordMax}
                        onChange={(e) => setEditJobWordMax(Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-xs focus:outline-none focus:ring-1 focus:ring-rakubun-accent/50"
                      />
                      <span className="text-xs text-rakubun-text-secondary">
                        {language === 'en' ? 'words' : '語'}
                      </span>
                    </div>
                  ) : (
                    `${job.wordCountMin.toLocaleString()}-${job.wordCountMax.toLocaleString()} ${language === 'en' ? 'words' : '語'}`
                  )
                }
              />
              <DetailItem
                icon={<Image className="w-4 h-4" />}
                label={language === 'en' ? 'Images' : '画像'}
                value={
                  isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={editJobImages}
                        onChange={(e) => setEditJobImages(Number(e.target.value))}
                        className="w-14 px-1.5 py-0.5 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-xs focus:outline-none focus:ring-1 focus:ring-rakubun-accent/50"
                      />
                      <span className="text-xs text-rakubun-text-secondary">
                        {language === 'en' ? 'per article' : '記事ごと'}
                      </span>
                    </div>
                  ) : (
                    `${job.imagesPerArticle} ${language === 'en' ? 'per article (1 thumbnail + ' + (job.imagesPerArticle - 1) + ' illustrations)' : '記事ごと (1 サムネイル + ' + (job.imagesPerArticle - 1) + ' イラスト)'}`
                  )
                }
              />
              <DetailItem
                icon={<CalendarDays className="w-4 h-4" />}
                label={language === 'en' ? 'Articles per Week' : '週あたりの記事数'}
                value={
                  isEditing ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <button
                          key={n}
                          onClick={() => setEditJobArticlesPerWeek(n)}
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                            editJobArticlesPerWeek === n
                              ? 'bg-rakubun-accent text-white'
                              : 'border border-rakubun-border text-rakubun-text hover:bg-rakubun-bg-secondary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    `${job.articlesPerWeek} ${language === 'en' ? 'per week' : '本/週'}`
                  )
                }
              />
              {job.style && (
                <DetailItem
                  icon={<Sparkles className="w-4 h-4" />}
                  label={language === 'en' ? 'Style' : 'スタイル'}
                  value={job.style}
                />
              )}
              <DetailItem
                icon={<Mail className="w-4 h-4" />}
                label={language === 'en' ? 'Email Notification' : 'メール通知'}
                value={
                  isEditing ? (
                    <input
                      type="email"
                      value={editJobEmail}
                      onChange={(e) => setEditJobEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-1.5 py-0.5 rounded border border-rakubun-border bg-rakubun-bg text-rakubun-text text-xs focus:outline-none focus:ring-1 focus:ring-rakubun-accent/50"
                    />
                  ) : (
                    job.emailNotification || (language === 'en' ? 'Not set' : '未設定')
                  )
                }
              />
              <DetailItem
                icon={<Timer className="w-4 h-4" />}
                label={language === 'en' ? 'Cron Job ID' : 'CronジョブID'}
                value={
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono text-rakubun-text bg-rakubun-bg px-1.5 py-0.5 rounded">
                      {job.cronJobId}
                    </code>
                    <button
                      onClick={() => handleCopyCronId(job.cronJobId)}
                      className="p-0.5 rounded text-rakubun-text-secondary hover:text-rakubun-accent transition-colors"
                      title={language === 'en' ? 'Copy' : 'コピー'}
                    >
                      {copiedId === job.cronJobId ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                }
              />
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirmId === job.id && (
          <div className="border-t border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 px-5 py-3 flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">
              {language === 'en'
                ? 'Are you sure you want to delete this cron job?'
                : 'このCronジョブを削除してもよろしいですか？'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteJob(job.id)}
                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {language === 'en' ? 'Delete' : '削除'}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 border border-rakubun-border text-rakubun-text-secondary text-xs rounded-lg hover:bg-rakubun-bg-secondary transition-colors font-medium"
              >
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const existingSiteIds = new Set(cronJobs.map((j) => j.siteId));
  const availableSites = sites.filter((s) => !existingSiteIds.has(s.id));

  const draftJobs = cronJobs.filter((j) => j.status === 'draft');
  const activeJobs = cronJobs.filter((j) => j.status !== 'draft');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rakubun-text flex items-center gap-2">
            <Timer className="w-7 h-7 text-rakubun-accent" />
            {language === 'en' ? 'Cron Job Scheduler' : 'Cronジョブスケジューラー'}
          </h1>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Manage automated publishing schedules for your sites'
              : 'サイトの自動公開スケジュールを管理'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={availableSites.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-rakubun-accent text-white rounded-lg hover:bg-rakubun-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {language === 'en' ? 'New Schedule' : '新規スケジュール'}
        </button>
      </div>

      {/* Loading State */}
      {cronJobsLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-rakubun-accent" />
        </div>
      )}

      {/* Empty State */}
      {!cronJobsLoading && cronJobs.length === 0 && (
        <div className="bg-rakubun-surface border border-rakubun-border rounded-xl p-12 text-center">
          <Timer className="w-12 h-12 text-rakubun-text-secondary mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-rakubun-text mb-2">
            {language === 'en' ? 'No Cron Jobs Yet' : 'Cronジョブがありません'}
          </h3>
          <p className="text-sm text-rakubun-text-secondary mb-6 max-w-md mx-auto">
            {language === 'en'
              ? 'Create a cron job to automatically generate and publish articles on a weekly schedule based on your site\'s categories.'
              : 'サイトのカテゴリに基づいて、毎週自動的に記事を生成・公開するCronジョブを作成しましょう。'}
          </p>
          {sites.length > 0 ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rakubun-accent text-white rounded-lg hover:bg-rakubun-accent/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {language === 'en' ? 'Create First Schedule' : '最初のスケジュールを作成'}
            </button>
          ) : (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {language === 'en'
                ? 'Add a site first to create a cron job schedule.'
                : 'Cronジョブスケジュールを作成するには、まずサイトを追加してください。'}
            </p>
          )}
        </div>
      )}

      {/* Cron Job Cards — Drafts */}
      {!cronJobsLoading && draftJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-rakubun-text uppercase tracking-wider">
              {language === 'en' ? 'Drafts' : '下書き'}
            </h2>
            <span className="text-xs text-rakubun-text-secondary bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
              {draftJobs.length}
            </span>
          </div>
          {draftJobs.map((job) => renderJobCard(job))}
        </div>
      )}

      {/* Cron Job Cards — Active / Paused */}
      {!cronJobsLoading && activeJobs.length > 0 && (
        <div className="space-y-4">
          {draftJobs.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-rakubun-text uppercase tracking-wider">
                {language === 'en' ? 'Active Schedules' : 'アクティブなスケジュール'}
              </h2>
              <span className="text-xs text-rakubun-text-secondary bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                {activeJobs.length}
              </span>
            </div>
          )}
          {activeJobs.map((job) => renderJobCard(job))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-rakubun-surface border border-rakubun-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border">
              <h2 className="text-lg font-semibold text-rakubun-text flex items-center gap-2">
                <Timer className="w-5 h-5 text-rakubun-accent" />
                {language === 'en' ? 'Create Cron Job Schedule' : 'Cronジョブスケジュール作成'}
              </h2>
              <button
                onClick={resetCreateModal}
                className="p-1.5 rounded-lg text-rakubun-text-secondary hover:bg-rakubun-bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Select site */}
              {!analyzing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-rakubun-text mb-2">
                      {language === 'en' ? 'Select Site' : 'サイトを選択'}
                    </label>
                    <SiteSelector
                      value={selectedSiteId}
                      onChange={setSelectedSiteId}
                      sites={availableSites}
                      placeholder={language === 'en' ? '-- Choose a site --' : '-- サイトを選択 --'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-rakubun-text mb-2">
                      {language === 'en' ? 'Articles per Week' : '週あたりの記事数'}
                    </label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <button
                          key={n}
                          onClick={() => setArticlesPerWeek(n)}
                          className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                            articlesPerWeek === n
                              ? 'bg-rakubun-accent text-white border-rakubun-accent'
                              : 'border-rakubun-border text-rakubun-text hover:bg-rakubun-bg-secondary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-rakubun-text-secondary mt-1.5">
                      {language === 'en'
                        ? `${articlesPerWeek} article${articlesPerWeek > 1 ? 's' : ''} will be generated and published per week`
                        : `毎週${articlesPerWeek}本の記事が生成・公開されます`}
                    </p>
                  </div>

                  {analyzeError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">{analyzeError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleAnalyzeSite}
                    disabled={!selectedSiteId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rakubun-accent text-white rounded-lg hover:bg-rakubun-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    {language === 'en'
                      ? 'Analyze Site & Generate Schedule'
                      : 'サイトを分析してスケジュールを生成'}
                  </button>
                </>
              )}

              {/* Step 2: Analyzing */}
              {analyzing && <AnalyzingStep language={language} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail Item Sub-component ──────────────────────────────────────────────────

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-rakubun-text-secondary mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-rakubun-text-secondary font-medium">{label}</p>
        <div className="text-sm text-rakubun-text mt-0.5">{value}</div>
      </div>
    </div>
  );
}
