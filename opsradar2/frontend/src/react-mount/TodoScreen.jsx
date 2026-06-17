// Todo(s-todo) 화면의 React 렌더링 버전.
//
// 기존 #s-todo class/id 구조를 유지하되 Todo 탭, 목록, 카드, 상세, empty state는 React state로 렌더한다.
// 기존 전역 함수(renderTodos/openDashboardTodoTab/selectTodo 등)는 app.js compatibility wrapper를 통해
// React 이벤트를 발생시키므로 Dashboard/Calendar/분석 화면의 기존 호출 흐름은 유지된다.
import { memo, useEffect, useMemo, useState } from 'react'
import TodoDetail from './TodoDetail.jsx'
import TodoEmptyState from './TodoEmptyState.jsx'
import { TodoCardGrid, TodoTable } from './TodoList.jsx'
import TodoTabs from './TodoTabs.jsx'
import {
  clearSelectedTodo,
  getPageTodos,
  getTodoById,
  getTodoSnapshot,
  getVisibleTodos,
  pageCount,
  selectTodoId,
  setTodoPageValue,
  setTodoSearchFieldValue,
  setTodoSearchValue,
  setTodoTab,
  setTodoView,
  tabCounts,
  toggleAllTodos,
  toggleTodoChecked,
} from './todoStateAdapter.js'

function noticeForTab(tab) {
  if (tab === 'done') {
    return { icon: 'ti ti-circle-check', text: '완료 Todo를 상세 확인하거나 선택 항목을 영구 삭제할 수 있습니다.' }
  }
  if (tab === 'rejected') {
    return { icon: 'ti ti-ban', text: '반려 Todo를 되돌리거나 선택 항목을 영구 삭제할 수 있습니다.' }
  }
  if (tab === 'inprogress') {
    return { icon: 'ti ti-rotate-2', text: '체크한 진행 Todo를 되돌리거나 완료 처리할 수 있습니다.' }
  }
  return { icon: 'ti ti-sparkles', text: 'AI가 추출한 Todo 제안입니다. 검토 후 승인 또는 반려해주세요.' }
}

function TodoScreen() {
  const [snapshot, setSnapshot] = useState(() => getTodoSnapshot())

  const refresh = () => setSnapshot(getTodoSnapshot())

  useEffect(() => {
    const handleRefresh = () => refresh()
    const handleTabChange = (event) => {
      if (event.detail?.tabId) setTodoTab(event.detail.tabId)
      refresh()
    }
    const handleViewChange = (event) => {
      if (event.detail?.mode) setTodoView(event.detail.mode)
      refresh()
    }
    const handleSelect = (event) => {
      if (event.detail?.id !== undefined) selectTodoId(event.detail.id)
      refresh()
    }

    window.addEventListener('opsradar:todo-refresh', handleRefresh)
    window.addEventListener('opsradar:todo-tab-change', handleTabChange)
    window.addEventListener('opsradar:todo-view-change', handleViewChange)
    window.addEventListener('opsradar:todo-select', handleSelect)
    refresh()
    return () => {
      window.removeEventListener('opsradar:todo-refresh', handleRefresh)
      window.removeEventListener('opsradar:todo-tab-change', handleTabChange)
      window.removeEventListener('opsradar:todo-view-change', handleViewChange)
      window.removeEventListener('opsradar:todo-select', handleSelect)
    }
  }, [])

  const activeTab = snapshot.activeTab
  const viewMode = snapshot.viewMode
  const allTodos = snapshot.todos
  const visibleTodos = useMemo(() => getVisibleTodos(), [snapshot])
  const totalPages = pageCount(visibleTodos.length)
  const currentPage = Math.min(snapshot.page[activeTab] || 1, totalPages)
  const pageTodos = useMemo(() => getPageTodos(visibleTodos, activeTab), [activeTab, visibleTodos, snapshot.page])
  const selectedTodo = getTodoById(snapshot.selectedTodoId)
  const counts = tabCounts(allTodos)
  const notice = noticeForTab(activeTab)
  const isAi = activeTab === 'ai'
  const isProgress = activeTab === 'inprogress'
  const showDelete = activeTab === 'done' || activeTab === 'rejected'
  const checkedProgressCount = allTodos.filter((todo) => todo.status === 'approved' && snapshot.checked[todo.id]).length
  const showProgressBulk = isProgress && checkedProgressCount > 0

  const changeTab = (tab) => {
    clearSelectedTodo()
    setTodoTab(tab)
    refresh()
  }

  const changeView = (mode) => {
    setTodoView(mode)
    refresh()
  }

  const changePage = (page) => {
    setTodoPageValue(page)
    refresh()
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="topbar-title">Todo 관리</div>
          <span
            id="todoFromIssueBanner"
            style={{
              display: 'none',
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '10px',
              background: 'var(--success-soft)',
              color: 'var(--success)',
              border: '1px solid rgba(26,158,106,.2)',
            }}
          >
            이슈에서 생성된 Todo 있음
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="view-toggle">
            <div
              className={`vt-btn ${viewMode === 'table' ? 'active' : ''}`}
              id="vt-table"
              onClick={() => changeView('table')}
              title="테이블 뷰"
            >
              <i className="ti ti-table" style={{ fontSize: '13px' }}></i>
            </div>
            <div
              className={`vt-btn ${viewMode === 'card' ? 'active' : ''}`}
              id="vt-card"
              onClick={() => changeView('card')}
              title="카드 뷰"
            >
              <i className="ti ti-layout-grid" style={{ fontSize: '13px' }}></i>
            </div>
          </div>
          <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text2)' }}>
            승인 대기{' '}
            <span style={{ fontWeight: 600, color: 'var(--warn)', fontFamily: 'var(--mono)' }} id="pendingCount">
              {counts.ai}
            </span>
            건
          </div>
          <div className="tbtn primary" onClick={() => window.openManualModal?.()}>
            <i className="ti ti-plus"></i> 수동 등록
          </div>
        </div>
      </div>

      <div className="ctx-banner" id="todoctxBanner">
        <i className="ti ti-link"></i>
        <span id="todoctxText">이슈에서 연결된 Todo가 최상단에 표시됩니다.</span>
        <div
          className="tbtn"
          onClick={() => window.nav?.('issues')}
          style={{ marginLeft: 'auto', fontSize: '10px', padding: '3px 8px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
        >
          ← 이슈 로그로
        </div>
      </div>

      <TodoTabs activeTab={activeTab} counts={counts} onTabChange={changeTab} />

      <div className="todo-list-tools">
        <select
          id="todoSearchField"
          className="todo-search-field"
          value={snapshot.searchField[activeTab] || 'all'}
          onChange={(event) => {
            setTodoSearchFieldValue(event.target.value)
            refresh()
          }}
          aria-label="Todo 검색 조건"
        >
          <option value="all">전체</option>
          <option value="title">제목</option>
          <option value="description">내용</option>
          <option value="assignee">담당자</option>
        </select>
        <div className="todo-search-wrap">
          <i className="ti ti-search"></i>
          <input
            id="todoSearchInput"
            type="search"
            value={snapshot.search[activeTab] || ''}
            placeholder="제목, 내용, 담당자 검색"
            onChange={(event) => {
              setTodoSearchValue(event.target.value)
              refresh()
            }}
          />
        </div>
      </div>

      <div
        id="todoAINotice"
        style={{
          background: 'var(--accent-soft)',
          borderBottom: '1px solid rgba(66,99,235,.12)',
          padding: '8px 16px',
          fontSize: '11px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <i className={notice.icon} id="todoNoticeIcon" style={{ fontSize: '13px' }}></i>
        <span id="todoNoticeText">{notice.text}</span>
        <div
          id="todoBulkActions"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '150px' }}
        >
          <div className="tbtn" id="todoBulkApproveBtn" onClick={() => window.bulkApprove?.()} style={{ display: isAi ? 'flex' : 'none' }}>
            <i className="ti ti-checks"></i> 체크항목 전체승인
          </div>
          <div
            className="tbtn"
            id="todoBulkRejectBtn"
            onClick={() => (isAi ? window.bulkReject?.() : window.bulkRejectProgressTodos?.())}
            style={{ display: isAi || showProgressBulk ? 'flex' : 'none', color: 'var(--danger)' }}
          >
            <i className="ti ti-ban"></i> {isAi ? '체크항목 반려' : '선택 반려'}
          </div>
          <div className="tbtn" id="todoBulkUndoBtn" onClick={() => window.bulkUndoApprove?.()} style={{ display: showProgressBulk ? 'flex' : 'none', marginLeft: isProgress ? '0' : '' }}>
            <i className="ti ti-rotate-2"></i> 체크항목 되돌리기
          </div>
          <div className="tbtn" id="todoBulkCompleteBtn" onClick={() => window.bulkCompleteTodos?.()} style={{ display: showProgressBulk ? 'flex' : 'none', color: 'var(--success)' }}>
            <i className="ti ti-check"></i> 선택 완료
          </div>
          <div className="tbtn" id="todoBulkRestoreDoneBtn" onClick={() => window.bulkRestoreDoneTodos?.()} style={{ display: activeTab === 'done' ? 'flex' : 'none', color: 'var(--accent)' }}>
            <i className="ti ti-arrow-back-up"></i> 선택항목 진행Todo 되돌리기
          </div>
          <div className="tbtn" id="todoBulkDeleteBtn" onClick={() => window.bulkDeleteTodos?.()} style={{ display: showDelete ? 'flex' : 'none', color: 'var(--danger)' }}>
            <i className="ti ti-trash"></i> 선택항목 영구삭제
          </div>
        </div>
      </div>

      <div className="body-wrap">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TodoTable
            activeTab={activeTab}
            checked={snapshot.checked}
            selectedTodoId={snapshot.selectedTodoId}
            todos={pageTodos}
            visible={viewMode === 'table' && pageTodos.length > 0}
            onCheck={(id, checked) => { toggleTodoChecked(id, checked); refresh() }}
            onSelect={(id) => { selectTodoId(id); refresh() }}
            onToggleAll={(ids, checked) => { toggleAllTodos(ids, checked); refresh() }}
          />
          <TodoCardGrid
            activeTab={activeTab}
            selectedTodoId={snapshot.selectedTodoId}
            todos={pageTodos}
            visible={viewMode === 'card' && pageTodos.length > 0}
            onSelect={(id) => { selectTodoId(id); refresh() }}
          />
          {!pageTodos.length ? <TodoEmptyState viewMode={viewMode} /> : null}

          <div id="todoPager" className="todo-pager">
            {totalPages > 1 ? Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1
              return (
                <button key={page} className={`todo-page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => changePage(page)}>
                  {page}
                </button>
              )
            }) : null}
          </div>
        </div>

        <div className="detail-panel">
          <TodoDetail todo={selectedTodo} />
        </div>
      </div>
    </>
  )
}

export default memo(TodoScreen)
