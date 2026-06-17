import { tabBadgeId } from './todoStateAdapter.js'

const TABS = [
  { id: 'inprogress', label: '진행 Todo' },
  { id: 'ai', label: 'AI 제안' },
  { id: 'done', label: '완료' },
  { id: 'rejected', label: '반려' },
]

export default function TodoTabs({ activeTab, counts, onTabChange }) {
  return (
    <div className="tabs" id="todoTabs">
      {TABS.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          data-todo-tab={tab.id}
        >
          {tab.label} <span className={tab.id === 'ai' && counts.ai > 0 ? 'badge b-warn' : 'badge b-gray'} id={tabBadgeId(tab.id)}>
            {counts[tab.id] || 0}
          </span>
        </div>
      ))}
    </div>
  )
}
