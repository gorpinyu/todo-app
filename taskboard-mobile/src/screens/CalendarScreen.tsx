import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, Task, Category, Priority } from "../api";
import TaskDetailModal from "../components/TaskDetailModal";
import TaskFormModal from "../components/TaskFormModal";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  todo:       { bg: "#eff4ff", text: "#1a56db", dot: "#1a56db" },
  inprogress: { bg: "#fffbeb", text: "#d97706", dot: "#d97706" },
  completed:  { bg: "#ecfdf5", text: "#059669", dot: "#059669" },
};

export default function CalendarScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  useEffect(() => {
    Promise.all([api.getTasks(), api.getCategories(), api.getPriorities()]).then(([t, c, p]) => {
      setTasks(t); setCategories(c); setPriorities(p); setLoading(false);
    });
  }, []);

  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  const byDay: Record<number, Task[]> = {};
  for (const task of tasks.filter(t => !t.archived && t.due_date)) {
    const d = new Date(task.due_date!);
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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a56db" /></View>;

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
          const isOverdue = new Date(item.due_date!) < todayMidnight && item.status !== "completed";
          const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.todo;
          return (
            <TouchableOpacity style={s.taskRow} onPress={() => setDetailTask(item)} activeOpacity={0.7}>
              <View style={[s.taskDot, { backgroundColor: sc.dot }]} />
              <View style={s.taskRowBody}>
                <Text style={s.taskRowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.taskRowDate, isOverdue && s.overdueText]}>{isOverdue ? "⚠ " : "📅 "}{item.due_date}</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 32 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e6ed" },
  navText: { fontSize: 20, color: "#0f1c2e", lineHeight: 24 },
  monthLabel: { fontSize: 18, fontWeight: "700", color: "#0f1c2e" },
  dayNames: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 4 },
  dayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#9aa5b4" },
  grid: { paddingHorizontal: 12, marginBottom: 8 },
  week: { flexDirection: "row", marginBottom: 2 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8 },
  dayCellSelected: { backgroundColor: "#1a56db" },
  dayNum: { fontSize: 14, fontWeight: "500", color: "#0f1c2e" },
  todayNum: { color: "#1a56db", fontWeight: "800" },
  selectedNum: { color: "#fff", fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#1a56db", marginTop: 2 },
  dotSelected: { backgroundColor: "#fff" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#e2e6ed" },
  listHeaderText: { fontSize: 13, fontWeight: "700", color: "#0f1c2e" },
  clearDay: { fontSize: 13, color: "#1a56db", fontWeight: "600" },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700", color: "#9aa5b4", textTransform: "uppercase", letterSpacing: 0.5 },
  taskRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, gap: 10, shadowColor: "#0f1c2e", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  taskDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  taskRowBody: { flex: 1 },
  taskRowTitle: { fontSize: 14, fontWeight: "600", color: "#0f1c2e", marginBottom: 2 },
  taskRowDate: { fontSize: 12, color: "#9aa5b4" },
  overdueText: { color: "#dc2626" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 32, paddingHorizontal: 20 },
  emptyText: { color: "#9aa5b4", fontSize: 14, textAlign: "center" },
});
