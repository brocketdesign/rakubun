import { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Globe,
  MoreVertical,
  Repeat,
  X,
  Loader2,
  Sparkles,
  Check,
  ArrowRight,
  Zap,
  FileText,
  Search,
  Pencil,
  CalendarX2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '../../i18n';
import { useSites, sitesActions } from '../../stores/sitesStore';
import { SiteSelector } from '../../components/SiteSelector';
import { useArticles, articlesActions } from '../../stores/articlesStore';
import { useSchedules, schedulesActions } from '../../stores/schedulesStore';
import { usePlanLimits, useUsage } from '../../stores/subscriptionStore';
import { UsageMeter } from '../../components/UpgradePrompt';
import { ApiError } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SuggestedTopic {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  site: string;
  siteId: string;
  status: 'ready' | 'draft' | 'plan';
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const daysOfWeek = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

const monthNames = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

const analysisSteps = {
  en: ['Analyzing website content...', 'Identifying trending topics...', 'Creating optimal schedule...'],
  ja: ['ウェブサイトのコンテンツを分析中...', 'トレンドトピックを特定中...', '最適なスケジュールを作成中...'],
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
    const timer1 = setTimeout(() => setCurrentStep(1), 1000);
    const timer2 = setTimeout(() => setCurrentStep(2), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const steps = analysisSteps[language];

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-rakubun-accent/20" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-rakubun-accent animate-spin" />
        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-rakubun-accent" />
      </div>
      <div className="space-y-3 w-full max-w-xs">
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
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const sites = useSites();
  const allArticles = useArticles();
  const schedules = useSchedules();
  const limits = usePlanLimits();
  const usage = useUsage();

  // ─── Calendar State ─────────────────────────────────────────────────
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<number | null>(now.getDate());

  // ─── Auto Schedule Modal State ──────────────────────────────────────
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [autoStep, setAutoStep] = useState<1 | 2 | 3>(1);
  const [autoSiteId, setAutoSiteId] = useState('');
  const [articlesPerWeek, setArticlesPerWeek] = useState(3);
  const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const [autoError, setAutoError] = useState('');

  // ─── Calendar Filter State ─────────────────────────────────────────
  const [calendarSiteFilter, setCalendarSiteFilter] = useState('');

  // ─── Schedule Article Modal State ───────────────────────────────────
  const [showScheduleArticle, setShowScheduleArticle] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const [scheduleSiteFilter, setScheduleSiteFilter] = useState('');
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);

  // ─── Event Action Menu State ────────────────────────────────────────
  const [eventMenuId, setEventMenuId] = useState<string | null>(null);
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // ─── Load data on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!articlesActions.isLoaded()) {
      articlesActions.loadArticles(getToken);
    }
    if (!sitesActions.isLoaded() && !sitesActions.isLoading()) {
      sitesActions.loadSites(getToken);
    }
    if (!schedulesActions.isLoaded()) {
      schedulesActions.loadSchedules(getToken);
    }
  }, [getToken]);

  // ─── Site name lookup ───────────────────────────────────────────────
  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sites) {
      map[s.id] = s.name || s.url;
    }
    return map;
  }, [sites]);

  // ─── Dynamic calendar computation ──────────────────────────────────
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun

  const calendarDays: (number | null)[] = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [startDay, daysInMonth]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  const isToday = (day: number) => {
    const t = new Date();
    return day === t.getDate() && currentMonth === t.getMonth() && currentYear === t.getFullYear();
  };

  const isPast = (day: number) => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const d = new Date(currentYear, currentMonth, day);
    return d < t;
  };

  const currentMonthLabel = language === 'en'
    ? `${monthNames.en[currentMonth]} ${currentYear}`
    : `${currentYear}年${monthNames.ja[currentMonth]}`;

  // ─── Build calendar events map ─────────────────────────────────────
  const calendarEventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    const addEvent = (dateKey: string, event: CalendarEvent) => {
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    };

    // Scheduled articles
    for (const article of allArticles) {
      if (article.status === 'scheduled' && article.scheduledAt) {
        const d = new Date(article.scheduledAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const h = d.getHours();
        const m = d.getMinutes();
        const timeStr = formatTimeDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        addEvent(key, {
          id: article.id,
          title: article.title,
          time: timeStr,
          site: siteNameMap[article.site] || '',
          siteId: article.site,
          status: 'ready',
        });
      }
    }

    // Active schedule plan topics
    for (const schedule of schedules) {
      if (schedule.status === 'active') {
        for (const topic of schedule.topics) {
          if (topic.date) {
            const timeStr = topic.time ? formatTimeDisplay(topic.time) : '';
            addEvent(topic.date, {
              id: `plan-${schedule.id}-${topic.date}`,
              title: topic.title,
              time: timeStr,
              site: siteNameMap[schedule.siteId] || '',
              siteId: schedule.siteId,
              status: 'plan',
            });
          }
        }
      }
    }

    return map;
  }, [allArticles, schedules, siteNameMap]);

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = calendarEventsMap.get(key) || [];
    if (!calendarSiteFilter) return events;
    return events.filter(e => e.siteId === calendarSiteFilter);
  };

  // ─── Publishing Queue (upcoming scheduled articles + plan topics) ──
  const upcomingQueue = useMemo(() => {
    const nowMs = Date.now();
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    type QueueItem = { title: string; site: string; time: string; status: 'ready' | 'planned'; sortDate: number };
    const items: QueueItem[] = [];

    const formatDateLabel = (d: Date, timeStr: string) => {
      if (d.toDateString() === today.toDateString()) {
        return language === 'en' ? `Today, ${timeStr}` : `今日, ${timeStr}`;
      } else if (d.toDateString() === tomorrow.toDateString()) {
        return language === 'en' ? `Tomorrow, ${timeStr}` : `明日, ${timeStr}`;
      } else {
        const monthShort = language === 'en'
          ? monthNames.en[d.getMonth()].slice(0, 3)
          : `${d.getMonth() + 1}月`;
        return `${monthShort} ${d.getDate()}, ${timeStr}`;
      }
    };

    // Real scheduled articles
    for (const a of allArticles) {
      if (a.status !== 'scheduled' || !a.scheduledAt) continue;
      const dMs = new Date(a.scheduledAt).getTime();
      if (dMs <= nowMs) continue;
      if (calendarSiteFilter && a.site !== calendarSiteFilter) continue;
      const d = new Date(a.scheduledAt);
      const h = d.getHours();
      const m = d.getMinutes();
      const timeStr = formatTimeDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      items.push({
        title: a.title,
        site: siteNameMap[a.site] || '',
        time: formatDateLabel(d, timeStr),
        status: 'ready',
        sortDate: dMs,
      });
    }

    // Plan topics from active schedules
    for (const schedule of schedules) {
      if (schedule.status !== 'active') continue;
      if (calendarSiteFilter && schedule.siteId !== calendarSiteFilter) continue;
      for (const topic of schedule.topics) {
        if (!topic.date) continue;
        const topicDate = new Date(topic.date + 'T' + (topic.time || '09:00'));
        const dMs = topicDate.getTime();
        if (dMs <= nowMs) continue;
        const timeStr = formatTimeDisplay(topic.time || '09:00');
        items.push({
          title: topic.title,
          site: siteNameMap[schedule.siteId] || '',
          time: formatDateLabel(topicDate, timeStr),
          status: 'planned',
          sortDate: dMs,
        });
      }
    }

    return items.sort((a, b) => a.sortDate - b.sortDate).slice(0, 10);
  }, [allArticles, schedules, siteNameMap, language, calendarSiteFilter]);

  // ─── Monthly Stats ─────────────────────────────────────────────────
  const monthStats = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    let published = 0;
    let scheduled = 0;
    let drafts = 0;

    for (const a of allArticles) {
      if (calendarSiteFilter && a.site !== calendarSiteFilter) continue;
      if (a.status === 'published' && a.publishedAt) {
        const d = new Date(a.publishedAt);
        if (d >= monthStart && d <= monthEnd) published++;
      }
      if (a.status === 'scheduled' && a.scheduledAt) {
        const d = new Date(a.scheduledAt);
        if (d >= monthStart && d <= monthEnd) scheduled++;
      }
      if (a.status === 'draft') {
        const d = new Date(a.createdAt);
        if (d >= monthStart && d <= monthEnd) drafts++;
      }
    }

    // Count plan topics for the month too
    let planned = 0;
    for (const schedule of schedules) {
      if (schedule.status !== 'active') continue;
      if (calendarSiteFilter && schedule.siteId !== calendarSiteFilter) continue;
      for (const topic of schedule.topics) {
        if (topic.date) {
          const d = new Date(topic.date);
          if (d >= monthStart && d <= monthEnd) planned++;
        }
      }
    }

    return { published, scheduled, drafts, planned, total: published + scheduled + drafts + planned };
  }, [allArticles, schedules, currentYear, currentMonth, calendarSiteFilter]);

  // Draft articles for the schedule article modal
  const draftArticles = useMemo(() => {
    return allArticles.filter(a => a.status === 'draft');
  }, [allArticles]);

  const filteredDraftArticles = useMemo(() => {
    let filtered = draftArticles;
    if (scheduleSiteFilter) {
      filtered = filtered.filter(a => a.site === scheduleSiteFilter);
    }
    if (articleSearch.trim()) {
      const q = articleSearch.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        (siteNameMap[a.site] || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [draftArticles, articleSearch, scheduleSiteFilter, siteNameMap]);

  // ─── Auto Schedule Handlers ─────────────────────────────────────────

  const openAutoSchedule = () => {
    setAutoStep(1);
    setAutoSiteId(sites[0]?.id || '');
    setArticlesPerWeek(3);
    setSuggestedTopics([]);
    setShowAutoConfirm(false);
    setAutoError('');
    setShowAutoSchedule(true);
  };

  const closeAutoSchedule = () => {
    setShowAutoSchedule(false);
  };

  const startAnalysis = async () => {
    if (!autoSiteId) return;
    setAutoStep(2);
    setAutoError('');
    try {
      const topics = await articlesActions.autoSchedule(getToken, autoSiteId, articlesPerWeek);
      const mapped: SuggestedTopic[] = topics.map((t, i) => ({
        id: String(i + 1),
        title: t.title,
        description: t.description,
        date: t.suggestedDate || '',
        time: t.time || '09:00',
      }));
      setSuggestedTopics(mapped);
      setAutoStep(3);
    } catch (err) {
      console.error('Auto-schedule failed:', err);
      setAutoError(language === 'en' ? 'Analysis failed. Please try again.' : '分析に失敗しました。もう一度お試しください。');
      setAutoStep(1);
    }
  };

  const snapTo30Min = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const snapped = m < 15 ? '00' : m < 45 ? '30' : '00';
    const snappedH = m >= 45 ? (h + 1) % 24 : h;
    return `${String(snappedH).padStart(2, '0')}:${snapped}`;
  };

  const updateTopic = (topicId: string, field: 'date' | 'time', value: string) => {
    const finalValue = field === 'time' ? snapTo30Min(value) : value;
    setSuggestedTopics(prev =>
      prev.map(t => t.id === topicId ? { ...t, [field]: finalValue } : t)
    );
  };

  const applySchedule = async () => {
    const topics = suggestedTopics.map(t => ({
      title: t.title,
      description: t.description,
      date: t.date,
      time: t.time,
    }));
    try {
      const result = await schedulesActions.createSchedule(getToken, autoSiteId, topics);
      if (result) {
        setShowAutoConfirm(true);
        setTimeout(() => {
          setShowAutoConfirm(false);
          setShowAutoSchedule(false);
        }, 2000);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAutoError(language === 'en' ? 'Schedule limit reached. Please upgrade your plan.' : 'スケジュール数の上限に達しました。プランをアップグレードしてください。');
      } else {
        setAutoError(language === 'en' ? 'Failed to create schedule.' : 'スケジュールの作成に失敗しました。');
      }
    }
  };

  // ─── Event Action Handlers ─────────────────────────────────────────

  const toggleEventMenu = (eventId: string) => {
    setEventMenuId(prev => prev === eventId ? null : eventId);
  };

  const openReschedule = (event: CalendarEvent) => {
    setEventMenuId(null);
    // Pre-fill with the current date from selectedDate + current time from event
    const dateStr = selectedDate
      ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      : '';
    setRescheduleDate(dateStr);
    // Parse the displayed time back to 24h for the input
    const match = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      setRescheduleTime(`${String(h).padStart(2, '0')}:${m}`);
    } else {
      setRescheduleTime('09:00');
    }
    setRescheduleEvent(event);
  };

  const confirmReschedule = async () => {
    if (!rescheduleEvent || !rescheduleDate) return;
    const isPlan = rescheduleEvent.id.startsWith('plan-');
    if (isPlan) {
      // For plan topics: update the schedule's topic date/time
      const parts = rescheduleEvent.id.split('-');
      const scheduleId = parts[1];
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        const updatedTopics = schedule.topics.map(t =>
          t.title === rescheduleEvent.title
            ? { ...t, date: rescheduleDate, time: rescheduleTime || t.time }
            : t
        );
        await schedulesActions.updateSchedule(getToken, scheduleId, { topics: updatedTopics });
      }
    } else {
      // For real articles: update scheduledAt
      const dt = new Date(`${rescheduleDate}T${rescheduleTime || '09:00'}:00`);
      await articlesActions.scheduleArticle(getToken, rescheduleEvent.id, dt.toISOString());
    }
    setRescheduleEvent(null);
  };

  const unscheduleEvent = async (event: CalendarEvent) => {
    setEventMenuId(null);
    const isPlan = event.id.startsWith('plan-');
    if (isPlan) {
      // Remove topic from the schedule plan
      const parts = event.id.split('-');
      const scheduleId = parts[1];
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        const updatedTopics = schedule.topics.filter(t => t.title !== event.title);
        if (updatedTopics.length === 0) {
          await schedulesActions.deleteSchedule(getToken, scheduleId);
        } else {
          await schedulesActions.updateSchedule(getToken, scheduleId, { topics: updatedTopics });
        }
      }
    } else {
      // Revert article to draft
      await articlesActions.updateArticle(getToken, event.id, {
        status: 'draft',
        scheduledAt: null,
      });
    }
  };

  // ─── Schedule Article Handlers ──────────────────────────────────────

  const openScheduleArticle = () => {
    setSelectedArticleId('');
    setScheduleDate('');
    setArticleSearch('');
    setScheduleSiteFilter('');
    setShowScheduleConfirm(false);
    setShowScheduleArticle(true);
  };

  const closeScheduleArticle = () => {
    setShowScheduleArticle(false);
  };

  const confirmScheduleArticle = async () => {
    if (!selectedArticleId || !scheduleDate) return;
    const result = await articlesActions.scheduleArticle(
      getToken,
      selectedArticleId,
      new Date(scheduleDate).toISOString(),
    );
    if (result) {
      setShowScheduleConfirm(true);
      setTimeout(() => {
        setShowScheduleConfirm(false);
        setShowScheduleArticle(false);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Scheduler' : 'スケジューラー'}
          </h2>
          <p className="text-xs sm:text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Schedule and manage your article publishing calendar.'
              : '記事公開カレンダーのスケジュール管理。'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button className="btn-secondary text-sm" onClick={openAutoSchedule}>
            <Repeat className="w-4 h-4" />
            {language === 'en' ? 'Auto Schedule' : '自動スケジュール'}
          </button>
          <button className="btn-primary text-sm" onClick={openScheduleArticle}>
            <Plus className="w-4 h-4" />
            {language === 'en' ? 'Schedule Article' : '記事をスケジュール'}
          </button>
        </div>
      </div>

      {/* Usage Meter */}
      <UsageMeter
        label={language === 'en' ? 'Scheduled articles' : 'スケジュール済み記事'}
        used={usage.schedulesCount}
        limit={limits.maxSchedules}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-rakubun-border">
            <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-heading font-semibold text-rakubun-text">{currentMonthLabel}</h3>
            <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Site Filter */}
          <div className="px-5 py-2.5 border-b border-rakubun-border bg-rakubun-bg/30">
            <SiteSelector
              value={calendarSiteFilter}
              onChange={setCalendarSiteFilter}
              sites={sites}
              size="sm"
              placeholder={language === 'en' ? 'All sites' : 'すべてのサイト'}
            />
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-rakubun-border">
            {daysOfWeek[language].map((day) => (
              <div key={day} className="py-3 text-center text-xs font-medium text-rakubun-text-secondary">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const events = day ? getEventsForDay(day) : [];
              const todayFlag = day ? isToday(day) : false;
              const isSelected = day === selectedDate;
              const pastFlag = day ? isPast(day) : false;
              return (
                <div
                  key={i}
                  onClick={() => day && setSelectedDate(day)}
                  className={`
                    min-h-[100px] p-2 border-b border-r border-rakubun-border cursor-pointer
                    transition-colors
                    ${!day ? 'bg-rakubun-bg/30' : 'hover:bg-rakubun-bg/50'}
                    ${isSelected ? 'bg-rakubun-accent/5' : ''}
                    ${pastFlag ? 'opacity-50' : ''}
                  `}
                >
                  {day && (
                    <>
                      <span className={`
                        inline-flex items-center justify-center w-7 h-7 rounded-full text-sm
                        ${todayFlag
                          ? 'bg-rakubun-accent text-white font-bold'
                          : isSelected
                            ? 'text-rakubun-accent font-semibold'
                            : 'text-rakubun-text'
                        }
                      `}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className={`
                              text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate
                              ${event.status === 'ready'
                                ? 'bg-rakubun-accent/10 text-rakubun-accent'
                                : event.status === 'plan'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              }
                            `}
                            title={event.title}
                          >
                            {event.time ? `${event.time.split(' ')[0]} ` : ''}{event.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar - Queue */}
        <div className="space-y-4">
          {/* Selected Date Info */}
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
            <h3 className="font-heading font-semibold text-rakubun-text mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-rakubun-accent" />
              {selectedDate
                ? (language === 'en'
                    ? `${monthNames.en[currentMonth]} ${selectedDate}`
                    : `${currentMonth + 1}月${selectedDate}日`)
                : (language === 'en' ? 'Select a date' : '日付を選択')}
            </h3>
            {selectedDate && getEventsForDay(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getEventsForDay(selectedDate).map((event) => (
                  <div key={event.id} className="p-3 bg-rakubun-bg rounded-xl group relative">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rakubun-text truncate">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-rakubun-text-secondary">
                          {event.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {event.time}
                            </span>
                          )}
                          {event.site && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {event.site}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleEventMenu(event.id); }}
                        className="p-1 rounded-lg hover:bg-rakubun-surface text-rakubun-text-secondary opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Dropdown Menu */}
                    {eventMenuId === event.id && (
                      <div className="absolute right-3 top-10 z-20 bg-rakubun-surface rounded-xl border border-rakubun-border shadow-lg py-1 min-w-[160px]">
                        <button
                          onClick={() => openReschedule(event)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rakubun-text hover:bg-rakubun-bg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {language === 'en' ? 'Reschedule' : '日程変更'}
                        </button>
                        <button
                          onClick={() => unscheduleEvent(event)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-rakubun-bg transition-colors"
                        >
                          {event.id.startsWith('plan-')
                            ? <><Trash2 className="w-3.5 h-3.5" />{language === 'en' ? 'Remove from plan' : 'プランから削除'}</>
                            : <><CalendarX2 className="w-3.5 h-3.5" />{language === 'en' ? 'Unschedule' : 'スケジュール解除'}</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-rakubun-text-secondary">
                {language === 'en' ? 'No articles scheduled for this day.' : 'この日にスケジュールされた記事はありません。'}
              </p>
            )}
          </div>

          {/* Publishing Queue */}
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
            <h3 className="font-heading font-semibold text-rakubun-text mb-3">
              {language === 'en' ? 'Publishing Queue' : '公開キュー'}
            </h3>
            <div className="space-y-2">
              {upcomingQueue.length > 0 ? upcomingQueue.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-rakubun-bg/50 transition-colors cursor-pointer group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === 'ready' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-rakubun-text truncate">{item.title}</p>
                    <p className="text-xs text-rakubun-text-secondary">{item.time}</p>
                  </div>
                  <span className="text-[10px] text-rakubun-text-secondary opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {item.site}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-rakubun-text-secondary py-2">
                  {language === 'en' ? 'No upcoming scheduled articles.' : '予定されている記事はありません。'}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-rakubun-accent/5 to-blue-50 dark:to-blue-500/10 rounded-2xl border border-rakubun-accent/10 p-5">
            <h3 className="font-heading font-semibold text-rakubun-text mb-3">
              {language === 'en' ? 'This Month' : '今月'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-heading font-bold text-rakubun-accent">{monthStats.published}</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Published' : '公開済み'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-amber-600 dark:text-amber-400">{monthStats.scheduled}</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Scheduled' : '予約済み'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-blue-600 dark:text-blue-400">{monthStats.planned}</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Planned' : '計画済み'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-rakubun-text">{monthStats.drafts}</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Drafts' : '下書き'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Auto Schedule Modal ──────────────────────────────────────────── */}
      {showAutoSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rakubun-accent/10">
                  <Zap className="w-5 h-5 text-rakubun-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {language === 'en' ? 'Auto Schedule' : '自動スケジュール'}
                  </h3>
                  <p className="text-xs text-rakubun-text-secondary">
                    {language === 'en'
                      ? `Step ${autoStep} of 3`
                      : `ステップ ${autoStep} / 3`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeAutoSchedule}
                className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-center">
                {/* Step 1 */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors
                  ${autoStep > 1
                    ? 'bg-emerald-500 text-white'
                    : autoStep === 1
                      ? 'bg-rakubun-accent text-white ring-4 ring-rakubun-accent/20'
                      : 'bg-rakubun-bg border-2 border-rakubun-border text-rakubun-text-secondary'
                  }
                `}>
                  {autoStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                </div>
                {/* Line 1→2 */}
                <div className={`flex-1 h-[3px] transition-colors ${
                  autoStep > 1 ? 'bg-emerald-500' : 'bg-rakubun-border'
                }`} />
                {/* Step 2 */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors
                  ${autoStep > 2
                    ? 'bg-emerald-500 text-white'
                    : autoStep === 2
                      ? 'bg-rakubun-accent text-white ring-4 ring-rakubun-accent/20'
                      : 'bg-rakubun-bg border-2 border-rakubun-border text-rakubun-text-secondary'
                  }
                `}>
                  {autoStep > 2 ? <Check className="w-5 h-5" /> : '2'}
                </div>
                {/* Line 2→3 */}
                <div className={`flex-1 h-[3px] transition-colors ${
                  autoStep > 2 ? 'bg-emerald-500' : 'bg-rakubun-border'
                }`} />
                {/* Step 3 */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors
                  ${autoStep > 3
                    ? 'bg-emerald-500 text-white'
                    : autoStep === 3
                      ? 'bg-rakubun-accent text-white ring-4 ring-rakubun-accent/20'
                      : 'bg-rakubun-bg border-2 border-rakubun-border text-rakubun-text-secondary'
                  }
                `}>
                  {autoStep > 3 ? <Check className="w-5 h-5" /> : '3'}
                </div>
              </div>
              {/* Labels */}
              <div className="flex justify-between mt-2">
                <span className={`text-xs w-10 text-center ${autoStep >= 1 ? 'text-rakubun-text font-medium' : 'text-rakubun-text-secondary'}`}>
                  {language === 'en' ? 'Configure' : '設定'}
                </span>
                <span className={`text-xs text-center ${autoStep >= 2 ? 'text-rakubun-text font-medium' : 'text-rakubun-text-secondary'}`}>
                  {language === 'en' ? 'Analyzing' : '分析中'}
                </span>
                <span className={`text-xs w-10 text-center ${autoStep >= 3 ? 'text-rakubun-text font-medium' : 'text-rakubun-text-secondary'}`}>
                  {language === 'en' ? 'Results' : '結果'}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Step 1: Configure */}
              {autoStep === 1 && (
                <div className="space-y-5">
                  {autoError && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3">
                      <p className="text-sm text-red-700 dark:text-red-300">{autoError}</p>
                    </div>
                  )}
                  {/* Site Selector */}
                  <div>
                    <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                      {language === 'en' ? 'Select Site' : 'サイトを選択'}
                    </label>
                    <SiteSelector
                      value={autoSiteId}
                      onChange={setAutoSiteId}
                      sites={sites}
                      placeholder={language === 'en' ? 'Choose a site...' : 'サイトを選択...'}
                    />
                  </div>

                  {/* Articles Per Week */}
                  <div>
                    <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                      {language === 'en' ? 'Articles per week' : '週あたりの記事数'}
                    </label>
                    <div className="bg-rakubun-bg rounded-xl border border-rakubun-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl font-heading font-bold text-rakubun-accent">
                          {articlesPerWeek}
                        </span>
                        <span className="text-sm text-rakubun-text-secondary">
                          {language === 'en'
                            ? `${articlesPerWeek} article${articlesPerWeek > 1 ? 's' : ''} / week`
                            : `${articlesPerWeek}記事 / 週`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <button
                            key={n}
                            onClick={() => setArticlesPerWeek(n)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              articlesPerWeek === n
                                ? 'bg-rakubun-accent text-white shadow-sm'
                                : 'bg-rakubun-surface text-rakubun-text-secondary hover:bg-rakubun-surface/80'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Info note */}
                  <div className="bg-rakubun-accent/5 rounded-xl p-3 border border-rakubun-accent/10">
                    <p className="text-xs text-rakubun-text-secondary">
                      <Sparkles className="w-3.5 h-3.5 text-rakubun-accent inline mr-1" />
                      {language === 'en'
                        ? 'AI will analyze your site content and suggest optimized topics distributed throughout the week.'
                        : 'AIがサイトコンテンツを分析し、週を通じて最適化されたトピックを提案します。'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Analyzing */}
              {autoStep === 2 && (
                <AnalyzingStep language={language} />
              )}

              {/* Step 3: Results - Editable */}
              {autoStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {language === 'en'
                        ? `${suggestedTopics.length} articles scheduled across the week`
                        : `${suggestedTopics.length}件の記事を週全体にスケジュール`}
                    </p>
                  </div>

                  <p className="text-xs text-rakubun-text-secondary">
                    {language === 'en'
                      ? 'You can adjust the date and time for each article before applying.'
                      : '適用前に各記事の日付と時間を調整できます。'}
                  </p>

                  <div className="space-y-3">
                    {suggestedTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="p-4 bg-rakubun-bg rounded-xl border border-rakubun-border"
                      >
                        <h4 className="text-sm font-semibold text-rakubun-text mb-1">
                          {topic.title}
                        </h4>
                        <p className="text-xs text-rakubun-text-secondary mb-3">
                          {topic.description}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Date picker */}
                          <div>
                            <label className="block text-[10px] font-medium text-rakubun-text-secondary mb-1">
                              {language === 'en' ? 'Date' : '日付'}
                            </label>
                            <input
                              type="date"
                              value={topic.date}
                              onChange={(e) => updateTopic(topic.id, 'date', e.target.value)}
                              className="w-full px-2 py-1.5 bg-rakubun-surface rounded-lg text-xs text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20"
                            />
                          </div>
                          {/* Time picker */}
                          <div>
                            <label className="block text-[10px] font-medium text-rakubun-text-secondary mb-1">
                              {language === 'en' ? 'Time' : '時間'}
                            </label>
                            <input
                              type="time"
                              step="1800"
                              value={topic.time}
                              onChange={(e) => updateTopic(topic.id, 'time', e.target.value)}
                              className="w-full px-2 py-1.5 bg-rakubun-surface rounded-lg text-xs text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rakubun-border shrink-0">
              {autoStep === 1 && (
                <>
                  <button onClick={closeAutoSchedule} className="btn-secondary text-sm">
                    {language === 'en' ? 'Cancel' : 'キャンセル'}
                  </button>
                  <button
                    onClick={startAnalysis}
                    disabled={!autoSiteId}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {language === 'en' ? 'Analyze Site' : 'サイトを分析'}
                  </button>
                </>
              )}
              {autoStep === 2 && (
                <button onClick={closeAutoSchedule} className="btn-secondary text-sm">
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
              )}
              {autoStep === 3 && (
                <>
                  <button onClick={closeAutoSchedule} className="btn-secondary text-sm">
                    {language === 'en' ? 'Cancel' : 'キャンセル'}
                  </button>
                  <button onClick={applySchedule} className="btn-primary text-sm">
                    <Check className="w-4 h-4" />
                    {language === 'en' ? 'Apply Schedule' : 'スケジュールを適用'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto Schedule Confirmation Toast */}
      {showAutoConfirm && (
        <div className="fixed top-6 right-6 z-[60] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">
            {language === 'en' ? 'Schedule applied successfully!' : 'スケジュールが正常に適用されました！'}
          </span>
        </div>
      )}

      {/* ─── Schedule Article Modal ───────────────────────────────────────── */}
      {showScheduleArticle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rakubun-accent/10">
                  <CalendarDays className="w-5 h-5 text-rakubun-accent" />
                </div>
                <h3 className="font-heading font-semibold text-rakubun-text">
                  {language === 'en' ? 'Schedule Article' : '記事をスケジュール'}
                </h3>
              </div>
              <button
                onClick={closeScheduleArticle}
                className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Site Filter */}
              <div>
                <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                  {language === 'en' ? 'Filter by Site' : 'サイトで絞り込み'}
                </label>
                <SiteSelector
                  value={scheduleSiteFilter}
                  onChange={(siteId) => { setScheduleSiteFilter(siteId); setSelectedArticleId(''); }}
                  sites={sites}
                  placeholder={language === 'en' ? 'All sites' : 'すべてのサイト'}
                />
              </div>

              {/* Select Draft Article */}
              <div>
                <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                  {language === 'en' ? 'Select Draft Article' : '下書き記事を選択'}
                </label>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rakubun-text-secondary" />
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder={language === 'en' ? 'Search drafts...' : '下書きを検索...'}
                    className="w-full pl-10 pr-4 py-2 bg-rakubun-bg rounded-xl text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
                  />
                </div>

                {/* Draft Articles List */}
                <div className="border border-rakubun-border rounded-xl overflow-hidden max-h-[240px] overflow-y-auto">
                  {filteredDraftArticles.length > 0 ? (
                    filteredDraftArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => setSelectedArticleId(article.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-rakubun-border last:border-b-0 ${
                          selectedArticleId === article.id
                            ? 'bg-rakubun-accent/10'
                            : 'hover:bg-rakubun-bg/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selectedArticleId === article.id
                            ? 'border-rakubun-accent bg-rakubun-accent'
                            : 'border-rakubun-border'
                        }`}>
                          {selectedArticleId === article.id && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-rakubun-text truncate">{article.title}</p>
                          {(() => {
                            const site = sites.find(s => s.id === article.site);
                            const siteName = site?.name || site?.url;
                            return (
                              <p className="text-xs text-rakubun-text-secondary truncate">
                                {siteName ? `${siteName} · ` : ''}{article.wordCount} {language === 'en' ? 'words' : '語'} · SEO {article.seoScore}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-rakubun-text-secondary">
                      <FileText className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">
                        {draftArticles.length === 0
                          ? language === 'en' ? 'No draft articles available' : '下書き記事がありません'
                          : language === 'en' ? 'No results found' : '結果が見つかりません'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Date/Time Picker */}
              <div>
                <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                  {language === 'en' ? 'Schedule Date & Time' : 'スケジュール日時'}
                </label>
                <input
                  type="datetime-local"
                  step="1800"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-rakubun-bg rounded-xl text-sm text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rakubun-border shrink-0">
              <button onClick={closeScheduleArticle} className="btn-secondary text-sm">
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button
                onClick={confirmScheduleArticle}
                disabled={!selectedArticleId || !scheduleDate}
                className="btn-primary text-sm disabled:opacity-50"
              >
                <CalendarDays className="w-4 h-4" />
                {language === 'en' ? 'Schedule' : 'スケジュール'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Article Confirmation Toast */}
      {showScheduleConfirm && (
        <div className="fixed top-6 right-6 z-[60] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">
            {language === 'en' ? 'Article scheduled!' : '記事がスケジュールされました！'}
          </span>
        </div>
      )}

      {/* ─── Reschedule Modal ─────────────────────────────────────────── */}
      {rescheduleEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rakubun-accent/10">
                  <Pencil className="w-5 h-5 text-rakubun-accent" />
                </div>
                <h3 className="font-heading font-semibold text-rakubun-text">
                  {language === 'en' ? 'Reschedule' : '日程変更'}
                </h3>
              </div>
              <button
                onClick={() => setRescheduleEvent(null)}
                className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-rakubun-text truncate font-medium">{rescheduleEvent.title}</p>
              <div>
                <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                  {language === 'en' ? 'New Date' : '新しい日付'}
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-rakubun-bg rounded-xl text-sm text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                  {language === 'en' ? 'New Time' : '新しい時間'}
                </label>
                <input
                  type="time"
                  step="1800"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-rakubun-bg rounded-xl text-sm text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rakubun-border">
              <button onClick={() => setRescheduleEvent(null)} className="btn-secondary text-sm">
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button
                onClick={confirmReschedule}
                disabled={!rescheduleDate}
                className="btn-primary text-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {language === 'en' ? 'Save' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-away listener for event menu */}
      {eventMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setEventMenuId(null)} />
      )}
    </div>
  );
}
