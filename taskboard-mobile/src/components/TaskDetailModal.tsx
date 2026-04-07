import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { Task, Comment, api } from "../api";

interface Props {
  task: Task; onClose: () => void; onEdit: () => void;
  onDelete: () => void; onStatusChange: (status: string) => void;
}
const STATUS_NEXT: Record<string, { label: string; next: string }> = {
  todo: { label: "Start", next: "inprogress" },
  inprogress: { label: "Complete", next: "completed" },
  completed: { label: "Reopen", next: "todo" },
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  todo: { bg: "#eff4ff", text: "#1a56db" },
  inprogress: { bg: "#fffbeb", text: "#d97706" },
  completed: { bg: "#ecfdf5", text: "#059669" },
};

export default function TaskDetailModal({ task, onClose, onEdit, onDelete, onStatusChange }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    api.getComments(task.id).then(c => { setComments(c); setLoadingComments(false); });
  }, [task.id]);

  async function handleAddComment() {
    if (!newComment.trim()) return;
    const c = await api.addComment(task.id, newComment.trim());
    setComments(prev => [...prev, c]);
    setNewComment("");
  }

  const sc = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo;
  const next = STATUS_NEXT[task.status];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = task.due_date && new Date(task.due_date) < today && task.status !== "completed";

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity onPress={onEdit} style={s.actionBtn}><Text style={s.actionText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert("Archive task?", "Move to archive?", [
              { text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: onDelete }
            ])} style={[s.actionBtn, s.dangerBtn]}><Text style={s.dangerText}>Archive</Text></TouchableOpacity>
          </View>
        </View>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.titleRow}>
            <Text style={s.title}>{task.title}</Text>
            <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.statusText, { color: sc.text }]}>{task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : "Done"}</Text>
            </View>
          </View>
          {task.description ? <Text style={s.desc}>{task.description}</Text> : null}
          <View style={s.metaRow}>
            {task.priority && <View style={s.metaChip}><Text style={s.metaChipText}>{task.priority.emoji} {task.priority.name}</Text></View>}
            {task.category && <View style={s.metaChip}><Text style={s.metaChipText}>{task.category.emoji} {task.category.name}</Text></View>}
            {task.due_date && <View style={[s.metaChip, isOverdue ? s.overdueChip : {}]}><Text style={[s.metaChipText, isOverdue ? s.overdueText : {}]}>📅 {task.due_date}</Text></View>}
          </View>
          <TouchableOpacity style={s.nextBtn} onPress={() => onStatusChange(next.next)}>
            <Text style={s.nextBtnText}>{next.label}</Text>
          </TouchableOpacity>
          <Text style={s.sectionLabel}>COMMENTS</Text>
          {loadingComments ? <ActivityIndicator color="#1a56db" style={{ marginVertical: 12 }} /> : (
            <>
              {comments.map(c => (
                <View key={c.id} style={s.comment}>
                  <Text style={s.commentText}>{c.content}</Text>
                  <TouchableOpacity onPress={() => api.deleteComment(c.id).then(() => setComments(prev => prev.filter(x => x.id !== c.id)))}>
                    <Text style={s.commentDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={s.commentInput}>
                <TextInput style={s.commentField} placeholder="Add a comment…" placeholderTextColor="#9aa5b4"
                  value={newComment} onChangeText={setNewComment} multiline />
                <TouchableOpacity style={s.commentSend} onPress={handleAddComment} disabled={!newComment.trim()}>
                  <Text style={s.commentSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e6ed" },
  close: { fontSize: 18, color: "#4a5568", padding: 4 },
  headerActions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#eff4ff" },
  actionText: { fontSize: 14, fontWeight: "600", color: "#1a56db" },
  dangerBtn: { backgroundColor: "#fef2f2" },
  dangerText: { fontSize: 14, fontWeight: "600", color: "#dc2626" },
  scroll: { flex: 1, padding: 20 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: "#0f1c2e", lineHeight: 26 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "700" },
  desc: { fontSize: 15, color: "#4a5568", lineHeight: 22, marginBottom: 16 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  metaChip: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e6ed", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  metaChipText: { fontSize: 13, color: "#4a5568" },
  overdueChip: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  overdueText: { color: "#dc2626" },
  nextBtn: { backgroundColor: "#1a56db", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 24 },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: "#9aa5b4", letterSpacing: 1, marginBottom: 12 },
  comment: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentText: { flex: 1, fontSize: 14, color: "#0f1c2e", lineHeight: 20 },
  commentDelete: { color: "#9aa5b4", fontSize: 14, padding: 2 },
  commentInput: { backgroundColor: "#fff", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  commentField: { flex: 1, fontSize: 14, color: "#0f1c2e", maxHeight: 80 },
  commentSend: { backgroundColor: "#1a56db", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  commentSendText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
