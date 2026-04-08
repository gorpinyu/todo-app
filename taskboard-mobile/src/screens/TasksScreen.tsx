import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, ScrollView, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, Task, Category, Priority } from "../api";
import { useAuth } from "../AuthContext";
import { useTheme } from "../theme";
import { useProject } from "../ProjectContext";
import TaskFormModal from "../components/TaskFormModal";
import TaskDetailModal from "../components/TaskDetailModal";

const STATUS_FILTERS = [
  { key: "all", label: "All" }, { key: "todo", label: "To Do" },
  { key: "inprogress", label: "In Progress" }, { key: "completed", label: "Done" }, { key: "overdue", label: "Overdue" },
];

export default function TasksScreen() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { projects, activeProject, setActiveProject, reload: reloadProjects } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const PRIORITY_COLORS: Record<string, string> = {
    High: theme.priorityHigh,
    Medium: theme.priorityMedium,
    Low: theme.priorityLow
  };

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    todo: theme.statusTodo,
    inprogress: theme.statusInProgress,
    completed: theme.statusCompleted,
  };

  const load = useCallback(async () => {
    try {
      const [t, c, p] = await Promise.all([api.getTasks(activeProject?.id), api.getCategories(), api.getPriorities()]);
      setTasks(t); setCategories(c); setPriorities(p);
    } catch (err: any) { Alert.alert("Error", err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== "completed").length;
  const filtered = tasks.filter(t => {
    if (filter === "overdue") { if (!(t.due_date && new Date(t.due_date) < today && t.status !== "completed")) return false; }
    else if (filter !== "all") { if (t.status !== filter) return false; }
    if (search.trim()) { if (!t.title.toLowerCase().includes(search.toLowerCase())) return false; }
    if (filterCategory !== null) { if (t.category?.id !== filterCategory) return false; }
    if (filterPriority !== null) { if (t.priority?.id !== filterPriority) return false; }
    return true;
  });
  const activeFilters = (filterCategory !== null ? 1 : 0) + (filterPriority !== null ? 1 : 0);

  async function handleDelete(id: number) {
    Alert.alert("Archive task?", "The task will be moved to archive.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: async () => {
        await api.deleteTask(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        setDetailTask(null);
      }},
    ]);
  }

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

  const s = createStyles(theme);

  if (loading) return <View style={[s.center, { backgroundColor: theme.bgPrimary }]}><ActivityIndicator size="large" color={theme.brandPrimary} /></View>;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bgPrimary }]} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: theme.textPrimary }]}>TaskBoard</Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>{activeProject?.name ?? "All Projects"} · {tasks.length} tasks</Text>
          {overdue > 0 && (
            <View style={s.overdueBadge}>
              <Text style={s.overdueBadgeText}>⚠ {overdue} overdue</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.borderDefault }]} onPress={() =>
          Alert.alert("Sign out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: logout },
          ])
        }>
          <Text style={[s.logoutText, { color: theme.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
      
      {projects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, paddingVertical: 8 }} 
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {projects.map(p => (
            <TouchableOpacity key={p.id} 
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeProject?.id === p.id ? theme.brandPrimary : theme.bgSecondary,
                borderWidth: 1, borderColor: activeProject?.id === p.id ? theme.brandPrimary : theme.borderDefault
              }} 
              onPress={() => setActiveProject(p)}
              onLongPress={() => {
                if (!p.is_default) {
                  Alert.alert("Manage Project", p.name, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Archive", style: "destructive", onPress: async () => {
                      try {
                        const result = await api.archiveProject(p.id);
                        if (result.has_tasks) {
                          Alert.alert("Project archived", "It contained tasks, so it was moved to the archive.");
                        }
                        if (activeProject?.id === p.id) {
                          const defaultProject = projects.find(proj => proj.is_default);
                          if (defaultProject) setActiveProject(defaultProject);
                        }
                        await reloadProjects();
                      } catch (err: any) {
                        Alert.alert("Error", err.message);
                      }
                    }},
                  ]);
                }
              }}>
              <Text style={{ fontSize: 16 }}>{p.emoji ?? "📁"}</Text>
              <Text style={{ 
                fontSize: 14, fontWeight: "600",
                color: activeProject?.id === p.id ? theme.textInverse : theme.textSecondary
              }}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
              backgroundColor: theme.bgSecondary,
              borderWidth: 1, borderColor: theme.borderDefault
            }}
            onPress={() => {
              Alert.prompt("New Project", "Enter project name:", [
                { text: "Cancel", style: "cancel" },
                { text: "Create", onPress: async (name) => {
                  if (name?.trim()) {
                    try {
                      await api.createProject({ name: name.trim() });
                      await reloadProjects();
                    } catch (err: any) {
                      Alert.alert("Error", err.message);
                    }
                  }
                }},
              ]);
            }}>
            <Text style={{ fontSize: 16 }}>+</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textSecondary }}>New</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      
      <View style={s.searchRow}>
        <View style={[s.searchBox, { backgroundColor: theme.bgSecondary, borderColor: theme.borderDefault }]}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={[s.searchInput, { color: theme.textPrimary }]} placeholder="Search tasks…" placeholderTextColor={theme.textMuted}
            value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
        </View>
        <TouchableOpacity style={[s.filterBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.borderDefault }, activeFilters > 0 && { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary }]} onPress={() => setShowFilters(true)}>
          <Text style={[s.filterBtnText, { color: theme.textSecondary }, activeFilters > 0 && { color: theme.textInverse }]}>
            {activeFilters > 0 ? `Filters (${activeFilters})` : "Filter"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.filterList} contentContainerStyle={s.filterContent}>
        {STATUS_FILTERS.map(item => (
          <TouchableOpacity key={item.key} style={[s.chip, { backgroundColor: theme.bgSecondary, borderColor: theme.borderDefault }, filter === item.key && { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary }]} onPress={() => setFilter(item.key)}>
            <Text style={[s.chipText, { color: theme.textSecondary }, filter === item.key && { color: theme.textInverse }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList data={filtered} keyExtractor={t => String(t.id)} contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.brandPrimary} />}
        ListEmptyComponent={<View style={s.empty}><Text style={[s.emptyText, { color: theme.textMuted }]}>No tasks here</Text></View>}
        renderItem={({ item }) => {
          const isOverdue = item.due_date && new Date(item.due_date) < today && item.status !== "completed";
          const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.todo;
          return (
            <TouchableOpacity style={[s.card, { backgroundColor: theme.bgSecondary, shadowColor: theme.shadowColor, borderLeftColor: item.priority ? PRIORITY_COLORS[item.priority.name] ?? theme.borderDefault : theme.borderDefault }]}
              onPress={() => setDetailTask(item)} activeOpacity={0.7}>
              <View style={s.cardTop}>
                <Text style={[s.cardTitle, { color: theme.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.statusText, { color: sc.text }]}>{item.status === "inprogress" ? "In Progress" : item.status === "todo" ? "To Do" : "Done"}</Text>
                </View>
              </View>
              {item.description ? <Text style={[s.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
              <View style={s.cardMeta}>
                {item.category && <Text style={[s.metaTag, { color: theme.textSecondary, backgroundColor: theme.bgPrimary }]}>{item.category.emoji} {item.category.name}</Text>}
                {item.due_date && <Text style={[s.metaDue, { color: theme.textMuted }, isOverdue ? s.metaOverdue : {}]}>📅 {item.due_date}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.brandPrimary, shadowColor: theme.brandPrimary }]} onPress={() => { setEditTask(null); setShowForm(true); }}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
      {showForm && (
        <TaskFormModal task={editTask} categories={categories} priorities={priorities}
          onClose={() => { setShowForm(false); setEditTask(null); }}
          onSave={async (data: object) => {
            if (editTask) {
              const updated = await api.updateTask(editTask.id, data);
              setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
            } else {
              const created = await api.createTask({ ...data, project_id: activeProject?.id });
              setTasks(prev => [created, ...prev]);
            }
            setShowForm(false); setEditTask(null);
          }}
        />
      )}
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)}
          onEdit={() => { setEditTask(detailTask); setDetailTask(null); setShowForm(true); }}
          onDelete={() => handleDelete(detailTask.id)}
          onStatusChange={(status: string) => handleStatusChange(detailTask.id, status)}
        />
      )}

      {/* Filter sheet */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilters(false)}>
        <View style={s.filterSheet}>
          <View style={s.filterSheetHeader}>
            <Text style={s.filterSheetTitle}>Filter Tasks</Text>
            <TouchableOpacity onPress={() => { setFilterCategory(null); setFilterPriority(null); }}>
              <Text style={s.filterClear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.filterSheetScroll}>
            <Text style={s.filterSectionLabel}>CATEGORY</Text>
            <View style={s.filterRow}>
              <TouchableOpacity style={[s.filterPill, filterCategory === null && s.filterPillActive]} onPress={() => setFilterCategory(null)}>
                <Text style={[s.filterPillText, filterCategory === null && s.filterPillTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity key={c.id} style={[s.filterPill, filterCategory === c.id && s.filterPillActive]} onPress={() => setFilterCategory(filterCategory === c.id ? null : c.id)}>
                  <Text style={[s.filterPillText, filterCategory === c.id && s.filterPillTextActive]}>{c.emoji} {c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.filterSectionLabel}>PRIORITY</Text>
            <View style={s.filterRow}>
              <TouchableOpacity style={[s.filterPill, filterPriority === null && s.filterPillActive]} onPress={() => setFilterPriority(null)}>
                <Text style={[s.filterPillText, filterPriority === null && s.filterPillTextActive]}>All</Text>
              </TouchableOpacity>
              {priorities.map(p => (
                <TouchableOpacity key={p.id} style={[s.filterPill, filterPriority === p.id && s.filterPillActive]} onPress={() => setFilterPriority(filterPriority === p.id ? null : p.id)}>
                  <Text style={[s.filterPillText, filterPriority === p.id && s.filterPillTextActive]}>{p.emoji} {p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={s.filterApply} onPress={() => setShowFilters(false)}>
            <Text style={s.filterApplyText}>Show {filtered.length} tasks</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: theme.textPrimary },
  headerSub: { fontSize: 13, color: theme.textMuted },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.borderDefault, backgroundColor: theme.bgSecondary },
  logoutText: { fontSize: 13, fontWeight: "600", color: theme.textSecondary },
  filterList: { flexGrow: 0, flexShrink: 0 },
  filterContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingRight: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault, marginRight: 8 },
  chipActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
  chipTextActive: { color: theme.textInverse },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  card: { backgroundColor: theme.bgSecondary, borderRadius: 12, padding: 14, borderLeftWidth: 4, shadowColor: theme.shadowColor, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.textPrimary, lineHeight: 20 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 18, marginBottom: 8 },
  cardMeta: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metaTag: { fontSize: 12, color: theme.textSecondary, backgroundColor: theme.bgElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaDue: { fontSize: 12, color: theme.textMuted },
  metaOverdue: { color: theme.danger },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: theme.textMuted, fontSize: 15 },
  fab: { position: "absolute", bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: theme.brandPrimary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  fabText: { color: theme.textInverse, fontSize: 28, lineHeight: 32 },
  overdueBadge: { backgroundColor: theme.dangerBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  overdueBadgeText: { fontSize: 11, fontWeight: "700", color: theme.danger },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.bgSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.borderDefault, paddingHorizontal: 12, height: 42 },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault },
  filterBtnActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: theme.textSecondary },
  filterBtnTextActive: { color: theme.textInverse },
  filterSheet: { flex: 1, backgroundColor: theme.bgPrimary },
  filterSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: theme.bgSecondary, borderBottomWidth: 1, borderBottomColor: theme.borderDefault },
  filterSheetTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  filterClear: { fontSize: 15, color: theme.danger, fontWeight: "600" },
  filterSheetScroll: { flex: 1, padding: 20 },
  filterSectionLabel: { fontSize: 11, fontWeight: "700", color: theme.textMuted, letterSpacing: 1, marginBottom: 10, marginTop: 16 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault },
  filterPillActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  filterPillText: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
  filterPillTextActive: { color: theme.textInverse },
  filterApply: { margin: 20, backgroundColor: theme.brandPrimary, borderRadius: 12, padding: 16, alignItems: "center" },
  filterApplyText: { color: theme.textInverse, fontSize: 16, fontWeight: "700" },
});

