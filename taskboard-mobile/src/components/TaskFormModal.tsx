import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Task, Category, Priority } from "../api";
import { useTheme } from "../theme";

interface Props {
  task: Task | null; categories: Category[]; priorities: Priority[];
  onClose: () => void; onSave: (data: object) => Promise<void>;
}
const STATUSES = [{ key: "todo", label: "To Do" }, { key: "inprogress", label: "In Progress" }, { key: "completed", label: "Done" }];

export default function TaskFormModal({ task, categories, priorities, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [priorityId, setPriorityId] = useState<number | null>(task?.priority?.id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(task?.category?.id ?? null);
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try { await onSave({ title: title.trim(), description: description || null, status, priority_id: priorityId, category_id: categoryId, due_date: dueDate || null }); }
    finally { setSaving(false); }
  }

  const s = createStyles(theme);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={s.headerTitle}>{task ? "Edit Task" : "New Task"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || !title.trim()}>
            <Text style={[s.save, (!title.trim() || saving) && s.saveDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>TITLE</Text>
          <TextInput style={s.input} placeholder="Task title" placeholderTextColor={theme.textMuted} value={title} onChangeText={setTitle} autoFocus />
          <Text style={s.label}>DESCRIPTION</Text>
          <TextInput style={[s.input, s.textarea]} placeholder="Optional description" placeholderTextColor={theme.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={3} />
          <Text style={s.label}>STATUS</Text>
          <View style={s.row}>
            {STATUSES.map(st => (
              <TouchableOpacity key={st.key} style={[s.pill, status === st.key && s.pillActive]} onPress={() => setStatus(st.key)}>
                <Text style={[s.pillText, status === st.key && s.pillTextActive]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>PRIORITY</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.pill, priorityId === null && s.pillActive]} onPress={() => setPriorityId(null)}>
              <Text style={[s.pillText, priorityId === null && s.pillTextActive]}>None</Text>
            </TouchableOpacity>
            {priorities.map(p => (
              <TouchableOpacity key={p.id} style={[s.pill, priorityId === p.id && s.pillActive]} onPress={() => setPriorityId(p.id)}>
                <Text style={[s.pillText, priorityId === p.id && s.pillTextActive]}>{p.emoji} {p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>CATEGORY</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.pill, categoryId === null && s.pillActive]} onPress={() => setCategoryId(null)}>
              <Text style={[s.pillText, categoryId === null && s.pillTextActive]}>None</Text>
            </TouchableOpacity>
            {categories.map(c => (
              <TouchableOpacity key={c.id} style={[s.pill, categoryId === c.id && s.pillActive]} onPress={() => setCategoryId(c.id)}>
                <Text style={[s.pillText, categoryId === c.id && s.pillTextActive]}>{c.emoji} {c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>DUE DATE</Text>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={[s.dateBtnText, !dueDate && s.datePlaceholder]}>
              {dueDate ? `📅 ${dueDate}` : "Select a date (optional)"}
            </Text>
            {dueDate ? (
              <TouchableOpacity onPress={() => setDueDate("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.dateClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ? new Date(dueDate) : new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, date) => {
                if (Platform.OS !== "ios") setShowDatePicker(false);
                if (date) setDueDate(date.toISOString().split("T")[0]);
              }}
            />
          )}
          {Platform.OS === "ios" && showDatePicker && (
            <TouchableOpacity style={s.dateConfirm} onPress={() => setShowDatePicker(false)}>
              <Text style={s.dateConfirmText}>Done</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgPrimary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: theme.bgSecondary, borderBottomWidth: 1, borderBottomColor: theme.borderDefault },
  cancel: { fontSize: 16, color: theme.textSecondary },
  headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  save: { fontSize: 16, fontWeight: "700", color: theme.brandPrimary },
  saveDisabled: { opacity: 0.4 },
  scroll: { flex: 1, padding: 20 },
  label: { fontSize: 11, fontWeight: "600", color: theme.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault, borderRadius: 10, padding: 14, fontSize: 15, color: theme.textPrimary },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault },
  pillActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  pillText: { fontSize: 13, fontWeight: "600", color: theme.textSecondary },
  pillTextActive: { color: theme.textInverse },
  dateBtn: { backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.borderDefault, borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateBtnText: { fontSize: 15, color: theme.textPrimary },
  datePlaceholder: { color: theme.textMuted },
  dateClear: { fontSize: 16, color: theme.textMuted },
  dateConfirm: { backgroundColor: theme.brandPrimary, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8 },
  dateConfirmText: { color: theme.textInverse, fontSize: 15, fontWeight: "700" },
});
