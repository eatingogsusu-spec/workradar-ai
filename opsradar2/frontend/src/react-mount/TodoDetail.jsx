import {
  briefTodoText,
  cleanTodoTitle,
  formatTodoDate,
  priorityBadgeClass,
  priorityLabel,
  statusBadgeClass,
  statusLabel,
} from './todoStateAdapter.js'

function Badge({ className, children }) {
  return <span className={className} style={{ whiteSpace: 'nowrap' }}>{children}</span>
}

export default function TodoDetail({ todo }) {
  if (!todo) {
    return (
      <>
        <div className="detail-empty" id="todoDetailEmpty">
          <i className="ti ti-hand-click"></i>
          <span>
            Todo를 클릭하면
            <br />
            상세 내용이 표시됩니다
          </span>
        </div>
        <div id="todoDetailContent" style={{ display: 'none', flex: 1, flexDirection: 'column', overflowY: 'auto' }}></div>
      </>
    )
  }

  const description = todo.description || briefTodoText(todo)
  const sourceName = todo.sourceFileName || todo.src || '출처 파일'

  return (
    <>
      <div className="detail-empty" id="todoDetailEmpty" style={{ display: 'none' }}>
        <i className="ti ti-hand-click"></i>
        <span>
          Todo를 클릭하면
          <br />
          상세 내용이 표시됩니다
        </span>
      </div>
      <div id="todoDetailContent" style={{ display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '14px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '12px', lineHeight: 1.5 }}>
            {cleanTodoTitle(todo.title)}
          </div>
          <section className="wr-detail-description">
            <b>업무 내용</b>
            <p>{description}</p>
          </section>
          <div className="detail-grid">
            <div className="detail-cell">
              <div className="detail-label">우선순위</div>
              <Badge className={priorityBadgeClass(todo.priority)}>{priorityLabel(todo.priority)}</Badge>
            </div>
            <div className="detail-cell">
              <div className="detail-label">상태</div>
              <Badge className={statusBadgeClass(todo.status)}>{statusLabel(todo.status)}</Badge>
            </div>
            <div className="detail-cell">
              <div className="detail-label">담당자</div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)' }}>{todo.assignee || '미지정'}</div>
              {todo.status === 'pending' && !todo.assignee && todo.recommendedAssignee ? (
                <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px' }}>
                  <i className="ti ti-sparkles"></i> 승인 시 {todo.recommendedAssignee} 배정
                </div>
              ) : null}
            </div>
            <div className="detail-cell">
              <div className="detail-label">등록일</div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)' }}>{formatTodoDate(todo.createdAt)}</div>
            </div>
            <div className="detail-cell">
              <div className="detail-label">마감일</div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)' }}>{formatTodoDate(todo.dueDate || todo.updatedAt)}</div>
            </div>
          </div>
          {todo.chunk ? (
            <>
              <div className="detail-section">출처 청크 원문</div>
              <div className="chunk-box">
                <div className="chunk-meta">
                  <i className="ti ti-file-text" style={{ fontSize: '11px', color: 'var(--accent)' }}></i>
                  {todo.src} · {todo.srcChunk}
                </div>
                {todo.chunk}
              </div>
            </>
          ) : null}
          <div className="detail-section">AI 분석 근거</div>
          {(todo.grounds || []).map((ground, index) => (
            <div className="detail-item" key={`${ground}-${index}`}>
              <i className="ti ti-point"></i>{ground}
            </div>
          ))}
          {todo.status === 'pending' && !todo.assignee && todo.recommendedAssignee ? (
            <>
              <div className="detail-section">AI 추천 담당자</div>
              <div className="detail-item">
                <i className="ti ti-user-check"></i><strong>{todo.recommendedAssignee}</strong> · {todo.recommendationReason || '업무 내용 기반 추천'}
              </div>
            </>
          ) : null}
          {todo.risk ? (
            <>
              <div className="detail-section">왜 위험한가</div>
              <div className="risk-box">{todo.risk}</div>
            </>
          ) : null}
          <div className="wr-todo-source">
            <b>출처</b>
            {todo.src ? (
              <button className="wr-source-link" onClick={() => window.downloadSource?.(todo.src, todo.sourceFileName || '')}>
                <i className="ti ti-download"></i> {sourceName}
              </button>
            ) : (
              <span>수동 등록</span>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '5px' }}>
          {todo.status === 'pending' ? (
            <>
              <div className="tbtn primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => window.approveTodo?.(todo.id)}>승인</div>
              <div className="tbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.openEditModal?.(todo.id)}>수정</div>
              <div className="tbtn" style={{ flex: 1, justifyContent: 'center', color: 'var(--danger)' }} onClick={() => window.rejectTodo?.(todo.id)}>반려</div>
            </>
          ) : todo.status === 'approved' ? (
            <>
              <div className="tbtn primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => window.doneTodo?.(todo.id)}>완료</div>
              <div className="tbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.openEditModal?.(todo.id)}>수정</div>
              <div className="tbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.undoTodo?.(todo.id)}>↩ 되돌리기</div>
            </>
          ) : (
            <div className="tbtn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => (window.returnRejectedTodoToPending || window.undoTodo)?.(todo.id)}>
              ↩ 되돌리기
            </div>
          )}
        </div>
      </div>
    </>
  )
}
