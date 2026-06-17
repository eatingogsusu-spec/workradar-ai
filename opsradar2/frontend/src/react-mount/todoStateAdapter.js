const TAB_STATUS = {
  ai: 'pending',
  inprogress: 'approved',
  done: 'done',
  rejected: 'rejected',
}

const TAB_BADGE_IDS = {
  inprogress: 't-in-cnt',
  ai: 't-ai-cnt',
  done: 't-done-cnt',
  rejected: 't-rej-cnt',
}

const PAGE_SIZE = 12

function bridge() {
  return window.opsRadarTodoBridge
}

export function getTodoSnapshot() {
  const snapshot = bridge()?.getSnapshot?.() || {}
  const g = snapshot.G || window.G || {}
  const activeTab = g.currentTodoTab || 'inprogress'
  return {
    todos: Array.isArray(snapshot.todos) ? snapshot.todos : [],
    activeTab,
    selectedTodoId: g.selectedTodoId ?? null,
    checked: { ...(g.todoChecked || {}) },
    search: { ...(g.todoSearch || {}) },
    searchField: { ...(g.todoSearchField || {}) },
    page: { ...(g.todoPage || {}) },
    viewMode: snapshot.viewMode || 'table',
  }
}

export function getVisibleTodos() {
  if (typeof window.getFilteredTodos === 'function') return window.getFilteredTodos()
  const { todos, activeTab, search, searchField } = getTodoSnapshot()
  const query = String(search[activeTab] || '').toLowerCase().trim()
  const field = searchField[activeTab] || 'all'
  return todos
    .filter((todo) => todo.status === TAB_STATUS[activeTab])
    .filter((todo) => {
      if (!query) return true
      const assignee = todoAssigneeLabel(todo)
      const values = {
        title: todo.title || '',
        description: todo.description || '',
        assignee,
        all: `${todo.title || ''} ${todo.description || ''} ${assignee}`,
      }
      return String(values[field] || values.all).toLowerCase().includes(query)
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || Number(b.id || 0) - Number(a.id || 0))
}

export function getPageTodos(list, activeTab) {
  const { page } = getTodoSnapshot()
  const current = Math.max(1, page[activeTab] || 1)
  return list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

export function cleanTodoTitle(title) {
  return String(title || '').replace(/^\s*\[[^\]]+\]\s*/, '').trim() || 'Untitled'
}

export function briefTodoText(todo) {
  const raw = String(todo?.description || '').replace(/\s+/g, ' ').trim()
  const base = raw || `${cleanTodoTitle(todo?.title)} 관련 업무 진행 및 결과 확인`
  return base.length > 72 ? `${base.slice(0, 69)}...` : base
}

export function todoAssigneeLabel(todo) {
  return todo?.assignee || (todo?.status === 'pending' ? todo?.recommendedAssignee : null) || '미지정'
}

export function formatTodoDate(value) {
  return value ? String(value).slice(0, 10) : '-'
}

export function confidenceColor(confidence) {
  if (confidence === null || confidence === undefined) return 'var(--text3)'
  if (confidence >= 85) return 'var(--success)'
  if (confidence >= 70) return 'var(--warn)'
  return 'var(--danger)'
}

export function statusLabel(status) {
  return {
    pending: '승인 대기',
    approved: '진행중',
    done: '완료',
    rejected: '반려됨',
  }[status] || ''
}

export function statusBadgeClass(status) {
  return {
    pending: 'badge b-warn',
    approved: 'badge b-accent',
    done: 'badge b-success',
    rejected: 'badge b-gray',
  }[status] || 'badge b-gray'
}

export function priorityLabel(priority) {
  return { high: '높음', medium: '중간', low: '낮음' }[priority] || ''
}

export function priorityBadgeClass(priority) {
  return { high: 'badge b-danger', medium: 'badge b-warn', low: 'badge b-gray' }[priority] || 'badge b-gray'
}

export function tabCounts(todos) {
  return {
    ai: todos.filter((todo) => todo.status === 'pending').length,
    inprogress: todos.filter((todo) => todo.status === 'approved').length,
    done: todos.filter((todo) => todo.status === 'done').length,
    rejected: todos.filter((todo) => todo.status === 'rejected').length,
  }
}

export function tabBadgeId(tab) {
  return TAB_BADGE_IDS[tab]
}

export function emitTodoRefresh(detail = {}) {
  window.dispatchEvent(new CustomEvent('opsradar:todo-refresh', { detail }))
}

export function setTodoTab(tab) {
  bridge()?.setTab?.(tab)
  emitTodoRefresh({ reason: 'tab-change', tab })
}

export function setTodoView(mode) {
  bridge()?.setViewMode?.(mode)
  emitTodoRefresh({ reason: 'view-change', mode })
}

export function setTodoSearchValue(value) {
  bridge()?.setSearch?.(value)
  emitTodoRefresh({ reason: 'search' })
}

export function setTodoSearchFieldValue(value) {
  bridge()?.setSearchField?.(value)
  emitTodoRefresh({ reason: 'search-field' })
}

export function setTodoPageValue(page) {
  bridge()?.setPage?.(page)
  emitTodoRefresh({ reason: 'page', page })
}

export function selectTodoId(id) {
  bridge()?.selectTodo?.(id)
  emitTodoRefresh({ reason: 'select', id })
}

export function toggleTodoChecked(id, checked) {
  bridge()?.toggleCheck?.(id, checked)
  emitTodoRefresh({ reason: 'check', id })
}

export function toggleAllTodos(ids, checked) {
  bridge()?.toggleAll?.(ids, checked)
  emitTodoRefresh({ reason: 'check-all' })
}

export function clearSelectedTodo() {
  bridge()?.selectTodo?.(null)
  emitTodoRefresh({ reason: 'clear-selected' })
}

export function getTodoById(id) {
  return getTodoSnapshot().todos.find((todo) => String(todo.id) === String(id))
}
