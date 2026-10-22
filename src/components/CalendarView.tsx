import React, { useState, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileEdit,
} from 'lucide-react';
import { CalendarEvent, SocialAccount } from '../types/index.ts';
import { apiClient } from '../api/client.ts';

interface CalendarViewProps {
  onOpenCreatePost: (prefilledDate?: string) => void;
  onSelectPost: (postId: string) => void;
  accounts: SocialAccount[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onOpenCreatePost,
  onSelectPost,
  accounts,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let start: Date;
      let end: Date;

      if (viewMode === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        start = startOfWeek(monthStart);
        end = endOfWeek(monthEnd);
      } else if (viewMode === 'week') {
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
      } else {
        start = currentDate;
        end = currentDate;
      }

      const res = await apiClient.getCalendarEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        platform: platformFilter,
        status: statusFilter,
      });

      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, viewMode, platformFilter, statusFilter]);

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Status badge helper
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-3 h-3 text-emerald-600" />;
      case 'scheduled':
        return <Clock className="w-3 h-3 text-blue-600" />;
      case 'failed':
      case 'partially_published':
        return <AlertTriangle className="w-3 h-3 text-red-600" />;
      default:
        return <FileEdit className="w-3 h-3 text-stone-500" />;
    }
  };

  // Month grid calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Week days
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Calendar Top Bar */}
      <div className="p-4 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Controls */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-stone-900 tracking-tight min-w-[160px]">
            {format(currentDate, viewMode === 'day' ? 'MMMM d, yyyy' : 'MMMM yyyy')}
          </h2>

          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-white"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-white rounded"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-white"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'month' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'week' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'day' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Day
            </button>
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              aria-label="Filter by platform"
            >
              <option value="all">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Grid: Month View */}
      {viewMode === 'month' && (
        <div className="flex-1 flex flex-col min-h-[600px]">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80 text-center text-xs font-semibold text-stone-500 py-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-stone-200">
            {monthDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const dayIso = format(day, 'yyyy-MM-dd');
              const dayEvents = events.filter((ev) => isSameDay(new Date(ev.date), day));

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[105px] p-1.5 flex flex-col justify-between group transition-colors ${
                    isCurrentMonth ? 'bg-white' : 'bg-stone-50/50 text-stone-400'
                  } ${isToday ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-stone-900 text-white font-bold' : 'text-stone-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    <button
                      type="button"
                      onClick={() => onOpenCreatePost(dayIso)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-900 rounded hover:bg-stone-100 transition-opacity"
                      title="Create post on this day"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Post Badges */}
                  <div className="space-y-1 my-1 overflow-y-auto max-h-[80px]">
                    {dayEvents.map((ev) => {
                      const hasFb = ev.platforms.includes('facebook');
                      const hasIg = ev.platforms.includes('instagram');

                      return (
                        <div
                          key={ev.id}
                          onClick={() => onSelectPost(ev.id)}
                          className="px-2 py-1 rounded text-[11px] font-medium border border-stone-200 hover:border-stone-400 bg-stone-50 hover:bg-white cursor-pointer transition-all flex items-center gap-1.5 truncate shadow-2xs"
                        >
                          {/* Platform indicators */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {hasFb && (
                              <span className="w-2 h-2 rounded-full bg-blue-600" title="Facebook" />
                            )}
                            {hasIg && (
                              <span
                                className="w-2 h-2 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600"
                                title="Instagram"
                              />
                            )}
                          </div>

                          {getStatusIcon(ev.status)}

                          <span className="truncate text-stone-800">
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="flex-1 flex flex-col min-h-[500px]">
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 divide-x divide-stone-200">
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="p-3 text-center">
                  <div className="text-xs text-stone-500 uppercase">{format(day, 'EEE')}</div>
                  <div
                    className={`text-base font-semibold mt-1 inline-flex w-7 h-7 items-center justify-center rounded-full ${
                      isToday ? 'bg-stone-900 text-white' : 'text-stone-900'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 flex-1 divide-x divide-stone-200 min-h-[400px]">
            {weekDays.map((day) => {
              const dayEvents = events.filter((ev) => isSameDay(new Date(ev.date), day));
              const dayIso = format(day, 'yyyy-MM-dd');

              return (
                <div key={day.toISOString()} className="p-2 space-y-2 bg-white">
                  <button
                    type="button"
                    onClick={() => onOpenCreatePost(dayIso)}
                    className="w-full py-1.5 border border-dashed border-stone-200 rounded-lg text-xs text-stone-400 hover:text-stone-700 hover:border-stone-300 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>

                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onSelectPost(ev.id)}
                      className="p-2.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-400 cursor-pointer transition-all space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-500">
                          {format(new Date(ev.date), 'HH:mm')}
                        </span>
                        <div className="flex items-center gap-1">
                          {ev.platforms.map((p) => (
                            <span
                              key={p}
                              className={`text-[9px] uppercase px-1 rounded font-semibold ${
                                p === 'facebook'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {p === 'facebook' ? 'FB' : 'IG'}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-stone-900 line-clamp-2">
                        {ev.caption || 'Untitled Post'}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-stone-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-xs text-stone-500">
                {events.filter((ev) => isSameDay(new Date(ev.date), currentDate)).length} posts scheduled
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreatePost(format(currentDate, 'yyyy-MM-dd'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Post
            </button>
          </div>

          <div className="space-y-3">
            {events
              .filter((ev) => isSameDay(new Date(ev.date), currentDate))
              .map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectPost(ev.id)}
                  className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-all flex items-start gap-4 shadow-xs"
                >
                  <div className="text-sm font-mono font-medium text-stone-600 bg-stone-100 px-2 py-1 rounded">
                    {format(new Date(ev.date), 'HH:mm')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(ev.status)}
                      <span className="text-xs uppercase font-semibold text-stone-500 tracking-wider">
                        {ev.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-stone-900 font-medium line-clamp-2">{ev.caption || 'No caption'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {ev.platforms.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-stone-100 text-stone-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {events.filter((ev) => isSameDay(new Date(ev.date), currentDate)).length === 0 && (
              <div className="text-center py-12 border border-dashed border-stone-200 rounded-xl">
                <p className="text-sm text-stone-500">No posts scheduled for this day.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
