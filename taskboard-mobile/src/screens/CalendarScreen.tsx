import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, Task, Category, Priority } from "../api";
import { useTheme } from "../theme";
import { useProject } from "../ProjectContext";
import TaskDetailModal from "../components/TaskDetailModal";
import TaskFormModal from "../components/TaskFormModal";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { activeProject } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    todo:       { bg: theme.statusTodo.bg, text: theme.statusTodo.text, dot: theme.statusTodo.text },
    inprogress: { bg: theme.statusInProgress.bg, text: theme.statusInProgress.text, dot: theme.statusInProgress.text },
    completed:  { bg: theme.statusCompleted.bg, text: theme.statusCompleted.text, dot: theme.statusCompleted.text },
  };

  useEffect(() => {
    if (!activeProject) return;
    Promise.all([api.getTasks(activeProject.id), api.getCategories(), api.getPriorities()]).then(([t, c, p]) => {
      setTasks(t); setCategories(c); setPriorities(p); setLoading(false);
    });
  }, [activeProject]);

  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  // Helper to parse date string in local timezone
  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Get display date for task - completed tasks show by completion date, others by due date
  const getTaskDisplayDate = (task: Task): string | null => {
    if (task.status === "completed" && task.completed_at) {
      return task.completed_at.split('T')[0];
    }
    return task.due_date;
  };

  const byDay: Record<number, Task[]> = {};
  for (const task of tasks.filter(t => !t.archived)) {
    const displayDate = getTaskDisplayDate(task);
    if (!displayDate) continue;
    const d = parseLocalDate(displayDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(task);
    }
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const sections = selectedDay
    ? [{ title: new Date(year, month, selectedDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" }), data: byDay[selectedDay] ?? [] }]
    : Object.entries(byDay).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([day, t]) => ({
        title: new Date(year, month, parseInt(day)).toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" }),
        data: t,
      }));

  async function handleStatusChange(id: number, status: string) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as Task["status"] } : t));
    try {
      const updated = await api.updateTask(id, { title: task.title, description: task.description, status, priority_id: task.priority?.id, category_id: task.category?.id, due_date: task.due_date } as any);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      if (detailTask?.id === id) setDetailTask(updated);
    } catch { setTasks(prev => prev.map(t => t.id === id ? task : t)); }
  }

  async function handleDelete(id: number) {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setDetailTask(null);
  }

  const s = createStyles(theme);

  if (loading) return <View style={[s.center, { backgroundColor: theme.bgPrimary }]}><ActivityIndicator size="large" color={theme.brandPrimary} /></View>;

  const WeekView = () => {
    const startOfWeek = new Date(year, month, today.getDate() - today.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });

    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        {weekDays.map((d, i) => {
          const dayTasks = tasks.filter(t => {
            if (t.archived) return false;
            const displayDate = getTaskDisplayDate(t);
            if (!displayDate) return false;
            const taskDate = parseLocalDate(displayDate);
            return taskDate.toDateString() === d.toDateString();
          });
          
          // Skip days with no tasks
          if (dayTasks.length === 0) return null;
          
          const isTod = d.toDateString() === today.toDateString();
          return (
            <View key={i} style={[s.weekDayRow, isTod && s.weekDayRowToday]}>
              <View style={s.weekDayRowHeader}>
                <Text style={s.weekDayRowName}>{d.toLocaleDateString('default', { weekday: 'short' })}</Text>
                <Text style={[s.weekDayRowNum, isTod && s.weekDayRowNumToday]}>{d.getDate()}</Text>
              </View>
              <View style={s.weekDayRowTasks}>
                {dayTasks.map(task => {
                  const sc = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo;
                  return (
                    <TouchableOpacity key={task.id} style={s.weekTaskRowCard} onPress={() => setDetailTask(task)}>
                      <View style={[s.weekTaskRowDot, { backgroundColor: sc.dot }]} />
                      <Text style={s.weekTaskRowTitle} numberOfLines={2}>{task.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const CalendarHeader = () => (
    <>
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => { setSelectedDay(null); if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
          <Text style={s.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => { setSelectedDay(null); if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
          <Text style={s.navText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
        <TouchableOpacity 
          style={[s.viewToggle, viewMode === "month" && s.viewToggleActive]}
          onPress={() => { setViewMode("month"); setSelectedDay(null); }}>
          <Text style={[s.viewToggleText, viewMode === "month" && s.viewToggleTextActive]}>Month</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.viewToggle, viewMode === "week" && s.viewToggleActive]}
          onPress={() => { setViewMode("week"); setSelectedDay(null); }}>
          <Text style={[s.viewToggleText, viewMode === "week" && s.viewToggleTextActive]}>Week</Text>
        </TouchableOpacity>
      </View>
      {viewMode === "month" ? (
        <>
          <View style={s.dayNames}>
            {DAYS.map((d, i) => <Text key={i} style={s.dayName}>{d}</Text>)}
          </View>
          <View style={s.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={s.week}>
                {week.map((day, di) => {
                  const hasTasks = day ? (byDay[day]?.length ?? 0) > 0 : false;
                  const isSelected = day === selectedDay;
                  const isTod = day ? isToday(day) : false;
                  return (
                    <TouchableOpacity key={di} style={[s.dayCell, isSelected && s.dayCellSelected]}
                      onPress={() => day ? setSelectedDay(day === selectedDay ? null : day) : undefined}
                      disabled={!day} activeOpacity={day ? 0.7 : 1}>
                      <Text style={[s.dayNum, isTod && s.todayNum, isSelected && s.selectedNum]}>{day ?? ""}</Text>
                      {hasTasks && <View style={[s.dot, isSelected && s.dotSelected]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : (
        <WeekView />
      )}
      <View style={s.listHeader}>
        <Text style={s.listHeaderText}>
          {selectedDay
            ? new Date(year, month, selectedDay).toLocaleDateString("default", { month: "short", day: "numeric" })
            : new Date(year, month).toLocaleString("default", { month: "long" })}
        </Text>
        {selectedDay ? (
          <TouchableOpacity onPress={() => setSelectedDay(null)}>
            <Text style={s.clearDay}>Show all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <SectionList sections={sections} keyExtractor={item => String(item.id)}
        ListHeaderComponent={<CalendarHeader />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>No tasks with due dates this {selectedDay ? "day" : "month"}</Text></View>}
        renderSectionHeader={({ section }) => sections.length > 1 ? (
          <View style={s.sectionHeader}><Text style={s.sectionHeaderText}>{section.title}</Text></View>
        ) : null}
        renderItem={({ item }) => {
          const displayDate = getTaskDisplayDate(item);
          const isOverdue = item.due_date && new Date(item.due_date) < todayMidnight && item.status !== "completed";
          const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.todo;
          return (
            <TouchableOpacity style={s.taskRow} onPress={() => setDetailTask(item)} activeOpacity={0.7}>
              <View style={[s.taskDot, { backgroundColor: sc.dot }]} />
              <View style={s.taskRowBody}>
                <Text style={s.taskRowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.taskRowDate, isOverdue && s.overdueText]}>
                  {isOverdue ? "⚠ " : item.status === "completed" ? "✓ " : "📅 "}
                  {displayDate}
                </Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                <Text style={[s.statusPillText, { color: sc.text }]}>{item.status === "inprogress" ? "In Progress" : item.status === "todo" ? "To Do" : "Done"}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={s.scroll}
        stickySectionHeadersEnabled={false}
      />
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)}
          onEdit={() => { setEditTask(detailTask); setDetailTask(null); setShowForm(true); }}
          onDelete={() => handleDelete(detailTask.id)}
          onStatusChange={(status) => handleStatusChange(detailTask.id, status)}
        />
      )}
      {showForm && editTask && (
        <TaskFormModal task={editTask} categories={categories} priorities={priorities}
          onClose={() => { setShowForm(false); setEditTask(null); }}
          onSave={async (data) => {
            const updated = await api.updateTask(editTask.id, data);
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setShowForm(false); setEditTask(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 32 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.bgSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.borderDefault },
  navText: { fontSize: 20, color: theme.textPrimary, lineHeight: 24 },
  monthLabel: { fontSize: 18, fontWeight: "700", color: theme.textPrimary },
  dayNames: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 4 },
  dayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: theme.textMuted },
  grid: { paddingHorizontal: 12, marginBottom: 8 },
  week: { flexDirection: "row", marginBottom: 2 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8 },
  dayCellSelected: { backgroundColor: theme.brandPrimary },
  dayNum: { fontSize: 14, fontWeight: "500", color: theme.textPrimary },
  todayNum: { color: theme.brandPrimary, fontWeight: "800" },
  selectedNum: { color: theme.textInverse, fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.brandPrimary, marginTop: 2 },
  dotSelected: { backgroundColor: theme.textInverse },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.borderDefault },
  listHeaderText: { fontSize: 13, fontWeight: "700", color: theme.textPrimary },
  clearDay: { fontSize: 13, color: theme.brandPrimary, fontWeight: "600" },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  taskRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.bgSecondary, marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, gap: 10, shadowColor: theme.shadowColor, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  taskDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  taskRowBody: { flex: 1 },
  taskRowTitle: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 2 },
  taskRowDate: { fontSize: 12, color: theme.textMuted },
  overdueText: { color: theme.danger },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 32, paddingHorizontal: 20 },
  emptyText: { color: theme.textMuted, fontSize: 14, textAlign: "center" },
  viewToggle: { flex: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault, alignItems: "center" },
  viewToggleActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  viewToggleText: { fontSize: 13, fontWeight: "600", color: theme.textSecondary },
  viewToggleTextActive: { color: theme.textInverse },
  weekDayRow: { backgroundColor: theme.bgSecondary, borderRadius: 12, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: theme.borderDefault },
  weekDayRowToday: { borderColor: theme.brandPrimary, borderWidth: 2 },
  weekDayRowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: theme.bgElevated, borderBottomWidth: 1, borderBottomColor: theme.borderDefault },
  weekDayRowName: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
  weekDayRowNum: { fontSize: 18, fontWeight: "700", color: theme.textSecondary },
  weekDayRowNumToday: { color: theme.brandPrimary },
  weekDayRowTasks: { padding: 12, gap: 8 },
  weekDayRowEmpty: { fontSize: 13, color: theme.textMuted, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },
  weekTaskRowCard: { backgroundColor: theme.bgPrimary, borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: theme.brandPrimary, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  weekTaskRowDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  weekTaskRowTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.textPrimary, lineHeight: 20 },
});
