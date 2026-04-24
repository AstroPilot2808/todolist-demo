import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'todolist-demo:todos'
const UNDO_TIMEOUT_MS = 5000
const VALID_PRIORITIES = ['low', 'normal', 'high']
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }

const DEFAULT_TODOS = [
  { id: 1, text: 'Read a book', done: false, createdAt: 1, dueDate: null, priority: 'normal' },
  { id: 2, text: 'Go for a walk', done: true, createdAt: 2, dueDate: null, priority: 'low' },
  { id: 3, text: 'Write some code', done: false, createdAt: 3, dueDate: null, priority: 'high' },
]

function loadInitialTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_TODOS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t) => t && typeof t === 'object' && typeof t.text === 'string')
      .map((t, i) => ({
        id:
          typeof t.id === 'number' || typeof t.id === 'string'
            ? t.id
            : Date.now() + i,
        text: t.text,
        done: !!t.done,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : i,
        dueDate:
          typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)
            ? t.dueDate
            : null,
        priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : 'normal',
      }))
  } catch {
    return []
  }
}

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDueDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function priorityLabel(p) {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export default function App() {
  const [todos, setTodos] = useState(loadInitialTodos)
  const [input, setInput] = useState('')
  const [inputDue, setInputDue] = useState('')
  const [inputPriority, setInputPriority] = useState('normal')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('added')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editPriority, setEditPriority] = useState('normal')
  const [deletedRecord, setDeletedRecord] = useState(null)

  const editInputRef = useRef(null)
  const commitPendingRef = useRef(false)
  const today = todayIso()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    } catch {
      // storage may be unavailable (quota, private mode); losing a write is fine
    }
  }, [todos])

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (!deletedRecord) return undefined
    const timer = setTimeout(() => setDeletedRecord(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [deletedRecord])

  useEffect(() => {
    if (!deletedRecord) return undefined
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return
      if (e.key !== 'z' && e.key !== 'Z') return
      const t = e.target
      const typingInField =
        t &&
        (t.tagName === 'TEXTAREA' ||
          (t.tagName === 'INPUT' &&
            ['text', 'search', 'email', 'url', 'password', 'tel', 'number', 'date'].includes(
              t.type,
            )))
      if (typingInField) return
      e.preventDefault()
      const { todo, index } = deletedRecord
      setTodos((current) => {
        const next = [...current]
        next.splice(Math.min(index, next.length), 0, todo)
        return next
      })
      setDeletedRecord(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deletedRecord])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    const now = Date.now()
    setTodos([
      ...todos,
      {
        id: now,
        text,
        done: false,
        createdAt: now,
        dueDate: inputDue || null,
        priority: inputPriority,
      },
    ])
    setInput('')
    setInputDue('')
    setInputPriority('normal')
  }

  const toggleTodo = (id) =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const deleteTodo = (id) => {
    const index = todos.findIndex((t) => t.id === id)
    if (index === -1) return
    const todo = todos[index]
    setTodos(todos.filter((t) => t.id !== id))
    setDeletedRecord({ todo, index })
  }

  const undoDelete = () => {
    if (!deletedRecord) return
    const { todo, index } = deletedRecord
    setTodos((current) => {
      const next = [...current]
      next.splice(Math.min(index, next.length), 0, todo)
      return next
    })
    setDeletedRecord(null)
  }

  const clearCompleted = () => setTodos(todos.filter((t) => !t.done))

  const startEditing = (todo) => {
    commitPendingRef.current = true
    setEditingId(todo.id)
    setEditText(todo.text)
    setEditDue(todo.dueDate || '')
    setEditPriority(todo.priority)
  }

  const cancelEditing = () => {
    commitPendingRef.current = false
    setEditingId(null)
  }

  const commitEditing = () => {
    if (!commitPendingRef.current || editingId === null) return
    commitPendingRef.current = false
    const text = editText.trim()
    const id = editingId
    if (!text) {
      const index = todos.findIndex((t) => t.id === id)
      if (index !== -1) {
        const original = todos[index]
        setTodos(todos.filter((t) => t.id !== id))
        setDeletedRecord({ todo: original, index })
      }
    } else {
      setTodos(
        todos.map((t) =>
          t.id === id
            ? { ...t, text, dueDate: editDue || null, priority: editPriority }
            : t,
        ),
      )
    }
    setEditingId(null)
  }

  const handleEditBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      commitEditing()
    }
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEditing()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  const isOverdue = (t) => !!t.dueDate && !t.done && t.dueDate < today

  const filtered = todos.filter((t) =>
    filter === 'active' ? !t.done : filter === 'completed' ? t.done : true,
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'due') {
      const ax = a.dueDate || '\uFFFF'
      const bx = b.dueDate || '\uFFFF'
      if (ax !== bx) return ax < bx ? -1 : 1
      return a.createdAt - b.createdAt
    }
    if (sortBy === 'priority') {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (diff !== 0) return diff
      return a.createdAt - b.createdAt
    }
    return a.createdAt - b.createdAt
  })

  const remaining = todos.filter((t) => !t.done).length
  const completedCount = todos.filter((t) => t.done).length

  const countLabel =
    filter === 'all'
      ? `${remaining} ${remaining === 1 ? 'item' : 'items'} remaining`
      : `${filtered.length} of ${todos.length}`

  const tabClass = (name) =>
    `px-3 py-1 rounded-md text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      filter === name
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 hover:bg-slate-200'
    }`

  const priorityDotClass = (p) =>
    p === 'high' ? 'bg-red-500' : p === 'low' ? 'bg-slate-300' : 'bg-indigo-400'

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Todo List</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            addTodo()
          }}
          className="mb-4"
        >
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What needs doing?"
              aria-label="New todo"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <span>Due:</span>
              <input
                type="date"
                value={inputDue}
                onChange={(e) => setInputDue(e.target.value)}
                aria-label="Due date for new todo"
                className="px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Priority:</span>
              <select
                value={inputPriority}
                onChange={(e) => setInputPriority(e.target.value)}
                aria-label="Priority for new todo"
                className="px-2 py-1 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex gap-2" role="group" aria-label="Filter todos">
            <button
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={tabClass('all')}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              aria-pressed={filter === 'active'}
              className={tabClass('active')}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              aria-pressed={filter === 'completed'}
              className={tabClass('completed')}
            >
              Completed
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort todos by"
              className="px-2 py-1 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="added">Date added</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        </div>

        <ul className="space-y-2">
          {sorted.map((todo) => {
            const overdue = isOverdue(todo)
            const isEditing = editingId === todo.id
            return (
              <li
                key={todo.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                  aria-label={`Mark "${todo.text}" ${todo.done ? 'not done' : 'done'}`}
                  className="h-4 w-4 accent-indigo-600 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <span
                  aria-label={`${priorityLabel(todo.priority)} priority`}
                  title={`${priorityLabel(todo.priority)} priority`}
                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${priorityDotClass(
                    todo.priority,
                  )}`}
                />

                {isEditing ? (
                  <div
                    className="flex-1 flex flex-wrap items-center gap-2"
                    onBlur={handleEditBlur}
                    onKeyDown={handleEditKeyDown}
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit todo text"
                      className="flex-1 min-w-[8rem] px-2 py-1 border border-indigo-400 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="date"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                      aria-label="Edit due date"
                      className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      aria-label="Edit priority"
                      className="px-2 py-1 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <span
                      onDoubleClick={() => startEditing(todo)}
                      className={`flex-1 truncate ${
                        todo.done ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {todo.text}
                    </span>
                    {todo.dueDate && (
                      <span
                        className={`text-xs whitespace-nowrap shrink-0 ${
                          overdue ? 'text-red-600 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {overdue ? 'Overdue · ' : ''}
                        {formatDueDate(todo.dueDate)}
                      </span>
                    )}
                    <button
                      onClick={() => startEditing(todo)}
                      aria-label={`Edit "${todo.text}"`}
                      className="text-slate-400 hover:text-indigo-600 text-sm font-medium px-2 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      aria-label={`Delete "${todo.text}"`}
                      className="text-slate-400 hover:text-red-500 text-lg font-bold px-2 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            )
          })}
          {sorted.length === 0 && (
            <li className="text-center text-slate-400 py-4 text-sm">
              Nothing here.
            </li>
          )}
        </ul>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{countLabel}</span>
          <button
            onClick={clearCompleted}
            disabled={completedCount === 0}
            className="text-slate-600 hover:text-slate-800 font-medium px-2 py-1 rounded disabled:text-slate-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Clear completed
          </button>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
      >
        {deletedRecord && (
          <div className="pointer-events-auto bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span>Todo deleted</span>
            <button
              onClick={undoDelete}
              className="text-indigo-300 hover:text-indigo-200 font-semibold px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
