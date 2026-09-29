<script setup>
import confetti from 'canvas-confetti'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const STORAGE_KEY = 'myndlyst-tasks-v1'
const THEME_KEY = 'myndlyst-theme-v1'
const themeOrder = ['dark', 'light']

const defaultTasks = {
  repetitive: [
    { id: 'repeat-1', title: 'Start the day with intention', notes: 'Take five quiet minutes to choose what matters most today.', createdAt: new Date().toISOString() },
    { id: 'repeat-2', title: 'Close the day with a reset', notes: 'Tidy your space and leave one clear first step for tomorrow.', createdAt: new Date().toISOString() },
  ],
  oneTime: [
    { id: 'onetime-1', title: 'Make room for a real break', notes: 'Step away from your screen for fifteen minutes today.', priority: 'medium', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'onetime-2', title: 'Reach out to someone you value', notes: 'Send a thoughtful message or make time for a short call.', priority: 'low', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
}

const createId = () => {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const loadTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return JSON.parse(JSON.stringify(defaultTasks))

    const parsed = JSON.parse(saved)
    return {
      repetitive: Array.isArray(parsed.repetitive) ? parsed.repetitive : [],
      oneTime: Array.isArray(parsed.oneTime) ? parsed.oneTime : [],
    }
  } catch (error) {
    console.error('Unable to load tasks from localStorage.', error)
    return JSON.parse(JSON.stringify(defaultTasks))
  }
}

const tasks = ref(loadTasks())
const themeMode = ref('dark')
const compactMode = ref(true)
const installPromptEvent = ref(null)
const isOnline = ref(navigator.onLine)
const completionToastVisible = ref(false)
const accordionState = ref({ repetitive: false, oneTime: false })
const repetitiveForm = ref({ title: '', notes: '' })
const oneTimeForm = ref({ title: '', notes: '', priority: 'medium' })
const editingOneTimeId = ref(null)
const confirmModal = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  variant: 'complete',
  danger: false,
  onConfirm: null,
})

const completedOneTime = computed(() => tasks.value.oneTime.filter((task) => task.done).length)
const totalOneTime = computed(() => tasks.value.oneTime.length)
const completionRate = computed(() => totalOneTime.value ? Math.round((completedOneTime.value / totalOneTime.value) * 100) : 0)
const sortedOneTimeTasks = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return [...tasks.value.oneTime].sort((first, second) => {
    if (first.done !== second.done) return Number(first.done) - Number(second.done)

    const priorityDifference = (priorityOrder[first.priority] ?? 1) - (priorityOrder[second.priority] ?? 1)
    if (priorityDifference) return priorityDifference

    const firstTimestamp = Date.parse(first.createdAt || first.updatedAt || '') || 0
    const secondTimestamp = Date.parse(second.createdAt || second.updatedAt || '') || 0
    return secondTimestamp - firstTimestamp
  })
})
const themeLabel = computed(() => {
  return themeMode.value === 'light' ? 'Light' : 'Dark'
})
const confirmationLabels = {
  add: 'Add task',
  edit: 'Edit task',
  complete: 'Complete task',
  undo: 'Undo completion',
  delete: 'Delete task',
}
const confirmationMarks = {
  add: '+',
  edit: 'E',
  complete: '✓',
  undo: '↶',
  delete: '×',
}

const formatTaskTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const updateThemeChrome = (theme) => {
  const isLight = theme === 'light'
  document.body.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLight ? '#ffffff' : '#000000')
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', isLight ? 'default' : 'black-translucent')
  document.querySelector('link[rel="icon"]')?.setAttribute('href', isLight ? '/favicon-light.svg' : '/app-icon.svg')
}

const handleInstallPrompt = (event) => {
  event.preventDefault()
  installPromptEvent.value = event
}

const handleAppInstalled = () => {
  installPromptEvent.value = null
}

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine
}

const installApp = async () => {
  if (!installPromptEvent.value) return

  const promptEvent = installPromptEvent.value
  try {
    await promptEvent.prompt()
    await promptEvent.userChoice
  } finally {
    installPromptEvent.value = null
  }
}

let completionToastTimeout

const celebrateAllComplete = () => {
  completionToastVisible.value = true
  clearTimeout(completionToastTimeout)
  completionToastTimeout = setTimeout(() => {
    completionToastVisible.value = false
  }, 1800)

  confetti({
    particleCount: 110,
    spread: 76,
    startVelocity: 32,
    ticks: 105,
    origin: { y: 0.68 },
    colors: themeMode.value === 'light'
      ? ['#0057ff', '#008cff', '#087c50', '#ffd34e']
      : ['#00dbff', '#087bff', '#00e6a2', '#ffd34e'],
    disableForReducedMotion: true,
  })
}

watch(
  tasks,
  () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value))
  },
  { deep: true },
)

watch(themeMode, (value) => {
  updateThemeChrome(value)
  localStorage.setItem(THEME_KEY, value)
})

onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (savedTheme && themeOrder.includes(savedTheme)) {
    themeMode.value = savedTheme
  }

  updateThemeChrome(themeMode.value)
  window.addEventListener('beforeinstallprompt', handleInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
  clearTimeout(completionToastTimeout)
})

const resetOneTimeForm = () => {
  oneTimeForm.value = { title: '', notes: '', priority: 'medium' }
  editingOneTimeId.value = null
}

const openConfirmation = ({ title, message, confirmText = 'Confirm', variant = 'complete', danger = false, onConfirm }) => {
  confirmModal.value = {
    open: true,
    title,
    message,
    confirmText,
    variant,
    danger,
    onConfirm,
  }
}

const closeConfirmation = () => {
  confirmModal.value.open = false
  confirmModal.value.onConfirm = null
}

const confirmAction = () => {
  if (typeof confirmModal.value.onConfirm === 'function') {
    confirmModal.value.onConfirm()
  }
  closeConfirmation()
}

const cycleTheme = () => {
  const index = themeOrder.indexOf(themeMode.value)
  const nextIndex = (index + 1) % themeOrder.length
  themeMode.value = themeOrder[nextIndex]
}

const toggleAccordion = (section) => {
  accordionState.value[section] = !accordionState.value[section]
}

const addRepetitiveTask = () => {
  const title = repetitiveForm.value.title.trim()
  if (!title) return

  openConfirmation({
    title: 'Add repetitive task',
    message: `Add "${title}" to your repetitive tasks?`,
    confirmText: 'Add task',
    variant: 'add',
    onConfirm: () => {
      tasks.value.repetitive.unshift({
        id: createId(),
        title,
        notes: repetitiveForm.value.notes.trim(),
        createdAt: new Date().toISOString(),
      })

      repetitiveForm.value = { title: '', notes: '' }
    accordionState.value.repetitive = false
    },
  })
}

const deleteRepetitiveTask = (taskId) => {
  const task = tasks.value.repetitive.find((item) => item.id === taskId)
  if (!task) return

  openConfirmation({
    title: 'Delete repetitive task',
    message: `This will remove "${task.title}" from your repetitive list.`,
    confirmText: 'Delete',
    variant: 'delete',
    danger: true,
    onConfirm: () => {
      tasks.value.repetitive = tasks.value.repetitive.filter((item) => item.id !== taskId)
    },
  })
}

const addOrUpdateOneTimeTask = () => {
  const title = oneTimeForm.value.title.trim()
  if (!title) return

  if (editingOneTimeId.value) {
    const task = tasks.value.oneTime.find((item) => item.id === editingOneTimeId.value)
    if (!task) return

    openConfirmation({
      title: 'Save task changes',
      message: `Save your edits to "${task.title}"?`,
      confirmText: 'Save changes',
      variant: 'edit',
      onConfirm: () => {
        task.title = title
        task.notes = oneTimeForm.value.notes.trim()
        task.priority = oneTimeForm.value.priority
        task.editedAt = new Date().toISOString()
        task.updatedAt = task.editedAt
        resetOneTimeForm()
        accordionState.value.oneTime = false
      },
    })
    return
  }

  openConfirmation({
    title: 'Add one-time task',
    message: `Create the task "${title}"?`,
    confirmText: 'Add task',
    variant: 'add',
    onConfirm: () => {
      const createdAt = new Date().toISOString()
      tasks.value.oneTime.unshift({
        id: createId(),
        title,
        notes: oneTimeForm.value.notes.trim(),
        priority: oneTimeForm.value.priority,
        done: false,
        createdAt,
        updatedAt: createdAt,
        editedAt: null,
      })

      resetOneTimeForm()
    accordionState.value.oneTime = false
    },
  })
}

const editOneTimeTask = (taskId) => {
  const task = tasks.value.oneTime.find((item) => item.id === taskId)
  if (!task) return

  openConfirmation({
    title: 'Edit one-time task',
    message: `Open "${task.title}" for editing?`,
    confirmText: 'Edit task',
    variant: 'edit',
    onConfirm: () => {
      accordionState.value.oneTime = true
      editingOneTimeId.value = taskId
      oneTimeForm.value = {
        title: task.title,
        notes: task.notes || '',
        priority: task.priority || 'medium',
      }
    },
  })
}

const toggleOneTimeTask = (taskId) => {
  const task = tasks.value.oneTime.find((item) => item.id === taskId)
  if (!task) return

  const actionLabel = task.done ? 'mark this task as not done' : 'mark this task as done'
  openConfirmation({
    title: task.done ? 'Undo task' : 'Complete task',
    message: `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} for "${task.title}"?`,
    confirmText: task.done ? 'Undo' : 'Done',
    variant: task.done ? 'undo' : 'complete',
    onConfirm: () => {
      task.done = !task.done
      task.updatedAt = new Date().toISOString()
      if (task.done && totalOneTime.value > 0 && completedOneTime.value === totalOneTime.value) {
        celebrateAllComplete()
      }
    },
  })
}

const deleteOneTimeTask = (taskId) => {
  const task = tasks.value.oneTime.find((item) => item.id === taskId)
  if (!task) return

  openConfirmation({
    title: 'Delete one-time task',
    message: `Delete "${task.title}" from your one-time list?`,
    confirmText: 'Delete',
    variant: 'delete',
    danger: true,
    onConfirm: () => {
      tasks.value.oneTime = tasks.value.oneTime.filter((item) => item.id !== taskId)
      if (editingOneTimeId.value === taskId) {
        resetOneTimeForm()
      }
    },
  })
}

const cancelOneTimeEdit = () => {
  resetOneTimeForm()
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Planning dashboard</p>
        <h1>MyndLyst</h1>
      </div>

      <div class="header-actions">
        <button class="view-toggle" type="button" @click="compactMode = !compactMode" :title="compactMode ? 'Expanded view' : 'Minimal view'" aria-label="Toggle minimal view">
          {{ compactMode ? 'Expand' : 'Compact' }}
        </button>
        <button class="theme-toggle" type="button" @click="cycleTheme" :title="`Current theme: ${themeLabel}`" aria-label="Cycle theme">
          {{ themeLabel }}
        </button>
        <button v-if="installPromptEvent" class="install-toggle" type="button" @click="installApp">Install</button>
      </div>
    </header>

    <p v-if="!isOnline" class="offline-notice" role="status" aria-live="polite">Offline · Your saved tasks are available.</p>

    <div v-if="completionToastVisible" class="completion-toast" role="status" aria-live="polite" aria-atomic="true">
      <span class="completion-toast-mark" aria-hidden="true">✓</span>
      <span>All one-time tasks complete!</span>
    </div>

    <section class="completion-summary" aria-label="One-time task progress">
      <div class="progress-meta">
        <span>One-time tasks</span>
        <strong>{{ completedOneTime }} / {{ totalOneTime }} complete</strong>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="One-time task completion"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="completionRate"
        :aria-valuetext="completedOneTime + ' of ' + totalOneTime + ' tasks complete'"
      >
        <span class="progress-fill" :style="{ width: completionRate + '%' }"></span>
      </div>
    </section>

    <main class="board">
      <section class="panel" aria-labelledby="repetitive-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Recurring flow</p>
            <h2 id="repetitive-heading">Repetitive tasks</h2>
          </div>
          <button class="accordion-toggle" type="button" @click="toggleAccordion('repetitive')">
            {{ accordionState.repetitive ? 'Hide add form' : 'Add task' }}
          </button>
        </div>

        <div v-if="accordionState.repetitive" class="accordion-body">
          <form class="task-form" @submit.prevent="addRepetitiveTask">
            <input v-model="repetitiveForm.title" type="text" placeholder="Add a repeating task" maxlength="80" />
            <textarea v-model="repetitiveForm.notes" rows="2" placeholder="Optional notes"></textarea>
            <button class="primary-btn" type="submit">Add task</button>
          </form>
        </div>

        <ul v-if="tasks.repetitive.length" class="task-list" :class="{ minimal: compactMode }">
          <li v-for="task in tasks.repetitive" :key="task.id" class="task-card repetitive-task" :class="{ expanded: !compactMode }">
            <div class="task-header">
              <span v-if="!compactMode" class="badge badge-repeat">Repeat</span>
              <h3>{{ task.title }}</h3>
            </div>
            <template v-if="!compactMode">
              <div class="task-body">
                <p v-if="task.notes">{{ task.notes }}</p>
                <time class="task-timestamp" :datetime="task.editedAt || task.createdAt">
                  {{ task.editedAt ? 'Edited' : 'Added' }} {{ formatTaskTimestamp(task.editedAt || task.createdAt) }}
                </time>
              </div>
              <footer class="task-footer">
                <button class="ghost-btn danger" type="button" @click="deleteRepetitiveTask(task.id)">Delete</button>
              </footer>
            </template>
          </li>
        </ul>

        <div v-else class="empty-state">No repetitive tasks yet. Add one to build your routine.</div>
      </section>

      <section class="panel" aria-labelledby="onetime-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Single action</p>
            <h2 id="onetime-heading">One-time tasks</h2>
          </div>
          <button class="accordion-toggle" type="button" @click="toggleAccordion('oneTime')">
            {{ accordionState.oneTime ? 'Hide add form' : 'Add task' }}
          </button>
        </div>

        <div v-if="accordionState.oneTime" class="accordion-body">
          <form class="task-form" @submit.prevent="addOrUpdateOneTimeTask">
            <input v-model="oneTimeForm.title" type="text" placeholder="Add a one-time task" maxlength="80" />
            <textarea v-model="oneTimeForm.notes" rows="2" placeholder="Optional details"></textarea>
            <div class="form-row">
              <label>
                Priority
                <select v-model="oneTimeForm.priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <div class="button-row">
              <button class="primary-btn" type="submit">
                {{ editingOneTimeId ? 'Save changes' : 'Add task' }}
              </button>
              <button v-if="editingOneTimeId" class="secondary-btn" type="button" @click="cancelOneTimeEdit">Cancel</button>
            </div>
          </form>
        </div>

        <ul v-if="tasks.oneTime.length" class="task-list" :class="{ minimal: compactMode }">
          <li
            v-for="task in sortedOneTimeTasks"
            :key="task.id"
            class="task-card"
            :class="[{ done: task.done, expanded: !compactMode, 'is-toggleable': compactMode }, 'priority-' + task.priority]"
            :role="compactMode ? 'button' : undefined"
            :tabindex="compactMode ? 0 : undefined"
            :aria-label="task.done ? 'Mark ' + task.title + ' as not done' : 'Mark ' + task.title + ' as done'"
            @click="compactMode && toggleOneTimeTask(task.id)"
            @keydown.enter.space.prevent="compactMode && toggleOneTimeTask(task.id)"
          >
            <div class="task-header">
              <span v-if="!compactMode" class="badge" :class="`badge-${task.priority}`">{{ task.priority }}</span>
              <h3>{{ task.title }}</h3>
            </div>

            <template v-if="!compactMode">
              <div class="task-body">
                <p v-if="task.notes">{{ task.notes }}</p>
                <time class="task-timestamp" :datetime="task.editedAt || task.createdAt">
                  {{ task.editedAt ? 'Edited' : 'Added' }} {{ formatTaskTimestamp(task.editedAt || task.createdAt) }}
                </time>
              </div>
              <footer class="task-footer">
                <div class="task-actions">
                  <button class="success-btn" type="button" @click="toggleOneTimeTask(task.id)">
                    {{ task.done ? 'Undo' : 'Done' }}
                  </button>
                  <button class="ghost-btn" type="button" @click="editOneTimeTask(task.id)">Edit</button>
                  <button class="ghost-btn danger" type="button" @click="deleteOneTimeTask(task.id)">Delete</button>
                </div>
              </footer>
            </template>
          </li>
        </ul>

        <div v-else class="empty-state">No one-time tasks yet. Create a focused item for today.</div>
      </section>
    </main>

    <div v-if="confirmModal.open" class="modal-backdrop" @click.self="closeConfirmation">
      <div class="confirm-modal" :class="`variant-${confirmModal.variant}`" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <div class="modal-icon">
          {{ confirmationMarks[confirmModal.variant] }}
        </div>

        <div class="modal-copy">
          <span class="modal-kind">{{ confirmationLabels[confirmModal.variant] }}</span>
          <h3 id="confirmation-title">{{ confirmModal.title }}</h3>
          <p>{{ confirmModal.message }}</p>
        </div>

        <div class="modal-actions">
          <button class="secondary-btn" type="button" @click="closeConfirmation">Cancel</button>
          <button class="primary-btn" :class="{ danger: confirmModal.danger }" type="button" @click="confirmAction">
            {{ confirmModal.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
