import {
  briefTodoText,
  cleanTodoTitle,
  confidenceColor,
  formatTodoDate,
  statusBadgeClass,
  statusLabel,
  todoAssigneeLabel,
} from './todoStateAdapter.js'

function TodoActions({ todo }) {
  if (todo.status === 'pending') {
    return (
      <div className="action-btns" onClick={(event) => event.stopPropagation()}>
        <div className="ab ab-approve" onClick={() => window.approveTodo?.(todo.id)}>승인</div>
        <div className="ab ab-edit" onClick={() => window.openEditModal?.(todo.id)}>수정</div>
        <div className="ab ab-reject" onClick={() => window.rejectTodo?.(todo.id)}>반려</div>
      </div>
    )
  }
  if (todo.status === 'approved') {
    return (
      <div className="action-btns" onClick={(event) => event.stopPropagation()}>
        <div className="ab ab-approve" style={{ background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => window.doneTodo?.(todo.id)}>완료</div>
        <div className="ab ab-edit" onClick={() => window.openEditModal?.(todo.id)}>수정</div>
        <div className="ab ab-undo" onClick={() => window.undoTodo?.(todo.id)}>↩</div>
      </div>
    )
  }
  if (todo.status === 'done') {
    return (
      <div className="action-btns" onClick={(event) => event.stopPropagation()}>
        <div className="ab ab-undo" onClick={() => window.restoreDoneTodo?.(todo.id)}>진행 Todo로 되돌리기</div>
        <div className="ab ab-reject" onClick={() => window.deleteDoneTodo?.(todo.id)}>삭제</div>
      </div>
    )
  }
  return (
    <div className="action-btns" onClick={(event) => event.stopPropagation()}>
      <div className="ab ab-undo" onClick={() => (window.returnRejectedTodoToPending || window.undoTodo)?.(todo.id)}>되돌리기</div>
      <div className="ab ab-reject" onClick={() => window.deleteRejectedTodo?.(todo.id)}>삭제</div>
      <div className="ab ab-edit" onClick={() => window.showTodoRejectionReason?.(todo.id)}>반려 사유</div>
    </div>
  )
}

function StatusBadge({ status }) {
  return <span className={statusBadgeClass(status)} style={{ whiteSpace: 'nowrap' }}>{statusLabel(status)}</span>
}

export function TodoTable({ activeTab, checked, selectedTodoId, todos, visible, onCheck, onSelect, onToggleAll }) {
  const allChecked = todos.length > 0 && todos.every((todo) => checked[todo.id])

  return (
    <div id="todoTableView" style={{ flex: 1, overflowY: 'auto', display: visible ? 'flex' : 'none', flexDirection: 'column' }}>
      <table className="todo-table">
        <thead>
          <tr>
            <th style={{ width: '28px' }}>
              <input
                type="checkbox"
                id="chkAll"
                checked={allChecked}
                onChange={(event) => onToggleAll(todos.map((todo) => todo.id), event.currentTarget.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
            </th>
            <th>Todo</th>
            <th id="todoCreatedHeader" style={{ width: '96px', textAlign: 'center', whiteSpace: 'nowrap', display: activeTab === 'ai' ? 'none' : 'table-cell' }}>
              등록일
            </th>
            <th id="todoUpdatedHeader" style={{ width: '96px', textAlign: 'center', whiteSpace: 'nowrap', display: activeTab === 'ai' ? 'none' : 'table-cell' }}>
              {activeTab === 'inprogress' ? '마감일' : '수정일'}
            </th>
            <th style={{ width: '84px', textAlign: 'center', whiteSpace: 'nowrap' }}>상태</th>
            <th style={{ width: '210px' }}>액션</th>
          </tr>
        </thead>
        <tbody id="todoBody">
          {todos.map((todo) => {
            const title = cleanTodoTitle(todo.title)
            const brief = briefTodoText(todo)
            const assignee = todoAssigneeLabel(todo)
            return (
              <tr
                key={todo.id}
                className={`todo-tr ${String(selectedTodoId) === String(todo.id) ? 'selected' : ''} ${todo.status}`}
                onClick={(event) => {
                  if (event.target.closest('.action-btns, input, button, select, textarea, a')) return
                  onCheck(todo.id, !checked[todo.id])
                }}
              >
                <td className="todo-check-cell">
                  <input
                    type="checkbox"
                    className="row-chk"
                    id={`chk-${todo.id}`}
                    checked={!!checked[todo.id]}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onCheck(todo.id, event.currentTarget.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </td>
                <td className="todo-main-cell">
                  <div
                    className={`todo-title ${todo.status === 'rejected' ? 'done-text' : ''} text-content`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(todo.id)
                    }}
                  >
                    <span>{title}</span>
                    {todo.status === 'pending' && !todo.assignee && todo.recommendedAssignee ? (
                      <span className="badge b-accent" title={todo.recommendationReason || '업무 내용 기반 추천'}>
                        <i className="ti ti-sparkles"></i> 추천: {todo.recommendedAssignee}
                      </span>
                    ) : null}
                  </div>
                  <div className="todo-src text-content">[담당자: {assignee}] {brief}</div>
                </td>
                <td className="todo-center-cell todo-created-at" style={{ display: activeTab === 'ai' ? 'none' : 'table-cell' }}>
                  {formatTodoDate(todo.createdAt)}
                </td>
                <td className="todo-center-cell todo-created-at" style={{ display: activeTab === 'ai' ? 'none' : 'table-cell' }}>
                  {activeTab === 'inprogress' ? formatTodoDate(todo.dueDate || todo.updatedAt) : formatTodoDate(todo.updatedAt)}
                </td>
                <td className="todo-center-cell"><StatusBadge status={todo.status} /></td>
                <td className="todo-action-cell"><TodoActions todo={todo} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function TodoCardGrid({ activeTab, selectedTodoId, todos, visible, onSelect }) {
  return (
    <div id="todoCardView" style={{ display: visible ? 'block' : 'none', flex: 1, overflowY: 'auto' }}>
      <div className="todo-card-grid" id="todoCardGrid">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={`todo-card ${String(selectedTodoId) === String(todo.id) ? 'selected' : ''}`}
            onClick={() => onSelect(todo.id)}
          >
            <div className="todo-card-meta">
              {activeTab === 'ai' ? null : <span className="badge b-gray">등록 {formatTodoDate(todo.createdAt)}</span>}
              {activeTab === 'inprogress' ? <span className="badge b-gray">수정 {formatTodoDate(todo.updatedAt)}</span> : null}
              <StatusBadge status={todo.status} />
              {todo.confidence !== null && todo.confidence !== undefined ? (
                <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: confidenceColor(todo.confidence) }}>{todo.confidence}%</span>
              ) : null}
            </div>
            <div className="todo-card-title">{cleanTodoTitle(todo.title)}</div>
            {todo.src ? <div className="todo-card-src">{todo.src}{todo.srcChunk ? ` · ${todo.srcChunk}` : ''}</div> : null}
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px' }}>{todo.assignee || '담당자 미지정'}</div>
            <div className="todo-card-actions" onClick={(event) => event.stopPropagation()}>
              <TodoActions todo={todo} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
