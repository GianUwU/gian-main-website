import { useState, useEffect } from 'react'
import { fetchWithTokenRefresh } from '../utils/fetchWithTokenRefresh'
import './TaskList.css'

const API_BASE = '/api/tasks'

interface Task {
  id: number
  title: string
  due_date: string | null
  complete: boolean
  created_at: string
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [error, setError] = useState('')

  const fetchTasks = async () => {
    try {
      const response = await fetchWithTokenRefresh(API_BASE)
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const data = await response.json()
      setTasks(data.tasks)
      setError('')
    } catch (err) {
      setError('Failed to load tasks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    try {
      const response = await fetchWithTokenRefresh(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          due_date: newTaskDueDate || null,
          complete: false
        })
      })

      if (!response.ok) throw new Error('Failed to create task')

      setNewTaskTitle('')
      setNewTaskDueDate('')
      await fetchTasks()
    } catch (err) {
      setError('Failed to add task')
      console.error(err)
    }
  }

  const toggleTaskComplete = async (task: Task) => {
    try {
      const response = await fetchWithTokenRefresh(`${API_BASE}/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complete: !task.complete
        })
      })

      if (!response.ok) throw new Error('Failed to update task')

      await fetchTasks()
    } catch (err) {
      setError('Failed to update task')
      console.error(err)
    }
  }

  const deleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const response = await fetchWithTokenRefresh(`${API_BASE}/${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete task')

      await fetchTasks()
    } catch (err) {
      setError('Failed to delete task')
      console.error(err)
    }
  }

  if (loading) {
    return <div className="task-list-loading">Loading tasks...</div>
  }

  return (
    <div className="task-list-container">
      <h2>My Tasks</h2>

      {error && <div className="task-error">{error}</div>}

      <form onSubmit={handleAddTask} className="task-form">
        <input
          type="text"
          placeholder="Task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="task-input"
        />
        <input
          type="date"
          value={newTaskDueDate}
          onChange={(e) => setNewTaskDueDate(e.target.value)}
          className="task-date-input"
        />
        <button type="submit" className="task-add-btn">Add Task</button>
      </form>

      <div className="tasks-list">
        {tasks.length === 0 ? (
          <p className="no-tasks">No tasks yet. Add one above!</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`task-item ${task.complete ? 'completed' : ''}`}>
              <div className="task-checkbox">
                <input
                  type="checkbox"
                  checked={task.complete}
                  onChange={() => toggleTaskComplete(task)}
                />
              </div>
              <div className="task-content">
                <div className="task-title">{task.title}</div>
                {task.due_date && (
                  <div className="task-due-date">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="task-delete-btn"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
