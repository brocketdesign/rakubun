import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Globe,
  FileText,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Repeat,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const daysOfWeek = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

const scheduledItems = [
  { id: '1', title: 'SEO Guide for Beginners', site: 'techblog.com', date: 22, time: '5:00 PM', status: 'ready' },
  { id: '2', title: 'React 20 Preview', site: 'devinsights.io', date: 23, time: '9:00 AM', status: 'ready' },
  { id: '3', title: 'AI in Healthcare 2026', site: 'aiweekly.net', date: 24, time: '2:00 PM', status: 'ready' },
  { id: '4', title: 'CSS Container Queries Deep Dive', site: 'techblog.com', date: 25, time: '10:00 AM', status: 'draft' },
  { id: '5', title: 'Next.js vs Remix in 2026', site: 'devinsights.io', date: 27, time: '11:00 AM', status: 'ready' },
  { id: '6', title: 'Machine Learning Basics', site: 'aiweekly.net', date: 28, time: '3:00 PM', status: 'ready' },
];

const upcomingQueue = [
  { title: 'SEO Guide for Beginners', site: 'techblog.com', time: 'Today, 5:00 PM', status: 'ready' as const },
  { title: 'React 20 Preview', site: 'devinsights.io', time: 'Tomorrow, 9:00 AM', status: 'ready' as const },
  { title: 'AI in Healthcare 2026', site: 'aiweekly.net', time: 'Feb 24, 2:00 PM', status: 'ready' as const },
  { title: 'CSS Container Queries Deep Dive', site: 'techblog.com', time: 'Feb 25, 10:00 AM', status: 'draft' as const },
  { title: 'Next.js vs Remix in 2026', site: 'devinsights.io', time: 'Feb 27, 11:00 AM', status: 'ready' as const },
];

export default function SchedulerPage() {
  const { language } = useLanguage();
  const [currentMonth] = useState('February 2026');
  const [selectedDate, setSelectedDate] = useState(22);

  // Generate calendar days for February 2026
  // Feb 2026 starts on Sunday (index 0)
  const daysInMonth = 28;
  const startDay = 0; // Sunday
  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getScheduleForDay = (day: number) =>
    scheduledItems.filter(item => item.date === day);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Scheduler' : 'スケジューラー'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Schedule and manage your article publishing calendar.'
              : '記事公開カレンダーのスケジュール管理。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-sm">
            <Repeat className="w-4 h-4" />
            {language === 'en' ? 'Auto Schedule' : '自動スケジュール'}
          </button>
          <button className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            {language === 'en' ? 'Schedule Article' : '記事をスケジュール'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-rakubun-border">
            <button className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-heading font-semibold text-rakubun-text">{currentMonth}</h3>
            <button className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
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
              const schedule = day ? getScheduleForDay(day) : [];
              const isToday = day === 22;
              const isSelected = day === selectedDate;
              const isPast = day !== null && day < 22;
              return (
                <div
                  key={i}
                  onClick={() => day && setSelectedDate(day)}
                  className={`
                    min-h-[100px] p-2 border-b border-r border-rakubun-border cursor-pointer
                    transition-colors
                    ${!day ? 'bg-rakubun-bg/30' : 'hover:bg-rakubun-bg/50'}
                    ${isSelected ? 'bg-rakubun-accent/5' : ''}
                    ${isPast ? 'opacity-50' : ''}
                  `}
                >
                  {day && (
                    <>
                      <span className={`
                        inline-flex items-center justify-center w-7 h-7 rounded-full text-sm
                        ${isToday
                          ? 'bg-rakubun-accent text-white font-bold'
                          : isSelected
                            ? 'text-rakubun-accent font-semibold'
                            : 'text-rakubun-text'
                        }
                      `}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {schedule.map((item) => (
                          <div
                            key={item.id}
                            className={`
                              text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate
                              ${item.status === 'ready'
                                ? 'bg-rakubun-accent/10 text-rakubun-accent'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              }
                            `}
                            title={item.title}
                          >
                            {item.time.split(' ')[0]} {item.title}
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
              {language === 'en' ? `February ${selectedDate}` : `2月${selectedDate}日`}
            </h3>
            {getScheduleForDay(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getScheduleForDay(selectedDate).map((item) => (
                  <div key={item.id} className="p-3 bg-rakubun-bg rounded-xl group">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rakubun-text truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-rakubun-text-secondary">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {item.site}
                          </span>
                        </div>
                      </div>
                      <button className="p-1 rounded-lg hover:bg-rakubun-surface text-rakubun-text-secondary opacity-0 group-hover:opacity-100 transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
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
              {upcomingQueue.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-rakubun-bg/50 transition-colors cursor-pointer group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'
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
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-rakubun-accent/5 to-blue-50 dark:to-blue-500/10 rounded-2xl border border-rakubun-accent/10 p-5">
            <h3 className="font-heading font-semibold text-rakubun-text mb-3">
              {language === 'en' ? 'This Month' : '今月'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-heading font-bold text-rakubun-accent">12</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Published' : '公開済み'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-amber-600 dark:text-amber-400">5</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Scheduled' : '予約済み'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-rakubun-text">3</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'Drafts' : '下書き'}
                </p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-emerald-600 dark:text-emerald-400">89%</p>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en' ? 'On Time' : '時間通り'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
