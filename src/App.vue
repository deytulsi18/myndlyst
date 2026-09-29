<script setup>
import confetti from 'canvas-confetti'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { filterVisibleTasks, mergeTaskGroups, taskFilterOptions } from './utils/taskFilters'

const STORAGE_KEY = 'myndlyst-tasks-v1'
const THEME_KEY = 'myndlyst-theme-v1'
const DEMO_SEED_KEY = 'myndlyst-demo-seed-v1'
const themeOrder = ['dark', 'light']
const taskTabs = [
  { id: 'ordinary', label: 'Ordinary tasks' },
  { id: 'special', label: 'Special tasks' },
]

const demoTasks = {
  oneTime: [
    { id: 'onetime-demo-completed', title: 'Write down one thing that went well', notes: 'A quick reflection helps make progress easier to notice.', priority: 'low', done: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  longTerm: [
    { id: 'longterm-demo-completed', title: 'Finish a first month of steady practice', notes: 'Mark the milestone, then choose a sustainable next step.', priority: 'low', done: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  shortTerm: [
    { id: 'shortterm-demo-completed', title: 'Send the follow-up you had been putting off', notes: 'Close the loop and clear a little space in your mind.', priority: 'medium', done: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
}

const defaultTasks = {
  repetitive: [
    { id: 'repeat-1', title: 'Start the day with intention', notes: 'Take five quiet minutes to choose what matters most today.', createdAt: new Date().toISOString() },
    { id: 'repeat-2', title: 'Close the day with a reset', notes: 'Tidy your space and leave one clear first step for tomorrow.', createdAt: new Date().toISOString() },
  ],
  oneTime: [
    { id: 'onetime-1', title: 'Make room for a real break', notes: 'Step away from your screen for fifteen minutes today.', priority: 'medium', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'onetime-2', title: 'Reach out to someone you value', notes: 'Send a thoughtful message or make time for a short call.', priority: 'low', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...demoTasks.oneTime,
  ],
  longTerm: [
    { id: 'longterm-1', title: 'Build a sustainable weekly routine', notes: 'Create a system you can repeat without burnout.', priority: 'medium', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...demoTasks.longTerm,
  ],
  shortTerm: [
    { id: 'shortterm-1', title: 'Finish the current draft', notes: 'Ship a version that is good enough to improve next.', priority: 'high', done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...demoTasks.shortTerm,
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
    if (!saved) {
      localStorage.setItem(DEMO_SEED_KEY, 'v3')
      return JSON.parse(JSON.stringify(defaultTasks))
    }

    const parsed = JSON.parse(saved)
    const fallback = JSON.parse(JSON.stringify(defaultTasks))

    const loadedTasks = {
      repetitive: Array.isArray(parsed.repetitive) ? parsed.repetitive : fallback.repetitive,
      oneTime: Array.isArray(parsed.oneTime) ? parsed.oneTime : fallback.oneTime,
      longTerm: Array.isArray(parsed.longTerm) ? parsed.longTerm : fallback.longTerm,
      shortTerm: Array.isArray(parsed.shortTerm) ? parsed.shortTerm : fallback.shortTerm,
    }

    if (localStorage.getItem(DEMO_SEED_KEY) !== 'v3') {
      for (const [taskGroup, sampleTasks] of Object.entries(demoTasks)) {
        const existingIds = new Set(loadedTasks[taskGroup].map((task) => task.id))
        loadedTasks[taskGroup].push(...sampleTasks.filter((task) => !existingIds.has(task.id)))
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedTasks))
      localStorage.setItem(DEMO_SEED_KEY, 'v3')
    }

    return loadedTasks
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
const completionToastMessage = ref('')
const activeTaskTab = ref('ordinary')
const accordionState = ref({ repetitive: false, oneTime: false, longTerm: false, shortTerm: false })
const repetitiveForm = ref({ title: '', notes: '' })
const oneTimeForm = ref({ title: '', notes: '', priority: 'medium' })
const specialTaskForm = ref({
  longTerm: { title: '', notes: '' },
  shortTerm: { title: '', notes: '' },
})
const taskSearch = ref('')
const taskFilter = ref('all')
const editingOneTimeId = ref(null)
const editingShortTermId = ref(null)
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
const completedShortTerm = computed(() => tasks.value.shortTerm.filter((task) => task.done).length)
const totalShortTerm = computed(() => tasks.value.shortTerm.length)
const shortTermCompletionRate = computed(() => totalShortTerm.value ? Math.round((completedShortTerm.value / totalShortTerm.value) * 100) : 0)
const taskFilterLabels = {
  all: 'All',
  active: 'Active',
  completed: 'Done',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
const filteredTasks = computed(() => filterVisibleTasks(tasks.value, {
  search: taskSearch.value,
  filter: taskFilter.value,
}))
const hasActiveTaskQuery = computed(() => Boolean(taskSearch.value.trim()) || taskFilter.value !== 'all')
const visibleRepetitiveTasks = computed(() => filteredTasks.value.repetitive)
const visibleOneTimeTasks = computed(() => filteredTasks.value.oneTime)
const visibleLongTermTasks = computed(() => filteredTasks.value.longTerm)
const visibleShortTermTasks = computed(() => filteredTasks.value.shortTerm)
const sortTaskList = (taskList = []) => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return [...taskList].sort((first, second) => {
    if (first.done !== second.done) return Number(first.done) - Number(second.done)

    const priorityDifference = (priorityOrder[first.priority] ?? 1) - (priorityOrder[second.priority] ?? 1)
    if (priorityDifference) return priorityDifference

    const firstTimestamp = Date.parse(first.createdAt || first.updatedAt || '') || 0
    const secondTimestamp = Date.parse(second.createdAt || second.updatedAt || '') || 0
    return secondTimestamp - firstTimestamp
  })
}
const sortedOneTimeTasks = computed(() => sortTaskList(visibleOneTimeTasks.value))
const sortedLongTermTasks = computed(() => sortTaskList(visibleLongTermTasks.value))
const sortedShortTermTasks = computed(() => sortTaskList(visibleShortTermTasks.value))
const filteredTabTasks = computed(() => {
  const groups = activeTaskTab.value === 'ordinary'
    ? [
        { type: 'repetitive', label: 'Repetitive', tasks: visibleRepetitiveTasks.value },
        { type: 'oneTime', label: 'One-time', tasks: sortedOneTimeTasks.value },
      ]
    : [
        { type: 'longTerm', label: 'Long-term', tasks: sortedLongTermTasks.value },
        { type: 'shortTerm', label: 'Short-term', tasks: sortedShortTermTasks.value },
      ]

  return mergeTaskGroups(groups)
})
const resultBadgeClasses = {
  repetitive: 'badge-result-repetitive',
  oneTime: 'badge-result-one-time',
  longTerm: 'badge-result-long-term',
  shortTerm: 'badge-result-short-term',
}
const themeLabel = computed(() => themeMode.value === 'light' ? 'Light' : 'Dark')
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

const showCompletionToast = (message) => {
  completionToastMessage.value = message
  completionToastVisible.value = true
  clearTimeout(completionToastTimeout)
  completionToastTimeout = setTimeout(() => {
    completionToastVisible.value = false
  }, 1800)
}

const celebrateAllComplete = () => {
  showCompletionToast('All one-time tasks complete!')
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

const celebrateShortTermComplete = () => {
  showCompletionToast('All short-term tasks complete!')
  confetti({
    particleCount: 150,
    spread: 92,
    startVelocity: 42,
    ticks: 120,
    origin: { y: 0.65 },
    colors: themeMode.value === 'light'
      ? ['#c50036', '#a34b00', '#ff9f43', '#ffd34e']
      : ['#ff526f', '#ff9f43', '#ffd34e', '#00e6a2'],
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

const resetShortTermForm = () => {
  specialTaskForm.value.shortTerm = { title: '', notes: '' }
  editingShortTermId.value = null
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

const addSpecialTask = (taskType) => {
  const form = specialTaskForm.value[taskType]
  const title = form.title.trim()
  if (!title) return

  if (taskType === 'shortTerm' && editingShortTermId.value) {
    const task = tasks.value.shortTerm.find((item) => item.id === editingShortTermId.value)
    if (!task) return

    const notes = form.notes.trim()
    openConfirmation({
      title: 'Save short-term task changes',
      message: `Save your edits to "${task.title}"?`,
      confirmText: 'Save changes',
      variant: 'edit',
      onConfirm: () => {
        task.title = title
        task.notes = notes
        task.editedAt = new Date().toISOString()
        task.updatedAt = task.editedAt
        resetShortTermForm()
        accordionState.value.shortTerm = false
      },
    })
    return
  }

  openConfirmation({
    title: taskType === 'longTerm' ? 'Add long-term task' : 'Add short-term task',
    message: `Create "${title}" in ${taskType === 'longTerm' ? 'long-term' : 'short-term'} tasks?`,
    confirmText: 'Add task',
    variant: 'add',
    onConfirm: () => {
      const createdAt = new Date().toISOString()
      tasks.value[taskType].unshift({
        id: createId(),
        title,
        notes: form.notes.trim(),
        priority: taskType === 'longTerm' ? 'medium' : 'high',
        done: false,
        createdAt,
        updatedAt: createdAt,
      })

      specialTaskForm.value[taskType] = { title: '', notes: '' }
      accordionState.value[taskType] = false
    },
  })
}

const editShortTermTask = (taskId) => {
  const task = tasks.value.shortTerm.find((item) => item.id === taskId)
  if (!task) return

  accordionState.value.shortTerm = true
  editingShortTermId.value = taskId
  specialTaskForm.value.shortTerm = {
    title: task.title,
    notes: task.notes || '',
  }
}

const toggleSpecialTask = (taskType, taskId) => {
  const task = tasks.value[taskType].find((item) => item.id === taskId)
  if (!task) return

  const actionLabel = task.done ? 'mark this task as not done' : 'mark this task as done'
  openConfirmation({
    title: task.done ? 'Undo special task' : 'Complete special task',
    message: `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} for "${task.title}"?`,
    confirmText: task.done ? 'Undo' : 'Done',
    variant: task.done ? 'undo' : 'complete',
    onConfirm: () => {
      task.done = !task.done
      task.updatedAt = new Date().toISOString()
      if (taskType === 'shortTerm' && task.done && totalShortTerm.value > 0 && completedShortTerm.value === totalShortTerm.value) {
        celebrateShortTermComplete()
      }
    },
  })
}

const deleteSpecialTask = (taskType, taskId) => {
  const task = tasks.value[taskType].find((item) => item.id === taskId)
  if (!task) return

  openConfirmation({
    title: taskType === 'longTerm' ? 'Delete long-term task' : 'Delete short-term task',
    message: `Remove "${task.title}" from your ${taskType === 'longTerm' ? 'long-term' : 'short-term'} list?`,
    confirmText: 'Delete',
    variant: 'delete',
    danger: true,
    onConfirm: () => {
      tasks.value[taskType] = tasks.value[taskType].filter((item) => item.id !== taskId)
      if (taskType === 'shortTerm' && editingShortTermId.value === taskId) {
        resetShortTermForm()
      }
    },
  })
}

const toggleFilteredTask = (task) => {
  if (task.taskType === 'oneTime') {
    toggleOneTimeTask(task.id)
  } else if (task.taskType !== 'repetitive') {
    toggleSpecialTask(task.taskType, task.id)
  }
}

const deleteFilteredTask = (task) => {
  if (task.taskType === 'repetitive') {
    deleteRepetitiveTask(task.id)
  } else if (task.taskType === 'oneTime') {
    deleteOneTimeTask(task.id)
  } else {
    deleteSpecialTask(task.taskType, task.id)
  }
}

const editFilteredTask = (task) => {
  if (task.taskType === 'oneTime') {
    editOneTimeTask(task.id)
  } else if (task.taskType === 'shortTerm') {
    editShortTermTask(task.id)
  }
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
      <span>{{ completionToastMessage }}</span>
    </div>

    <section class="task-tools" aria-label="Task search and filters">
      <label class="search-box" aria-label="Search tasks">
        <span aria-hidden="true">⌕</span>
        <input v-model="taskSearch" type="search" placeholder="Search tasks and notes" />
      </label>

      <div class="task-tabs" role="tablist" aria-label="Task groups">
        <button
          v-for="tab in taskTabs"
          :key="tab.id"
          type="button"
          class="task-tab"
          :class="{ active: activeTaskTab === tab.id }"
          :aria-selected="activeTaskTab === tab.id"
          @click="activeTaskTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-pills" role="tablist" aria-label="Task filters">
        <button
          v-for="option in taskFilterOptions"
          :key="option"
          type="button"
          class="filter-pill"
          :class="{ active: taskFilter === option }"
          :aria-pressed="taskFilter === option"
          @click="taskFilter = option"
        >
          {{ taskFilterLabels[option] }}
        </button>
      </div>
    </section>

    <section class="progress-summaries" aria-label="Task progress">
      <section class="completion-summary" aria-label="One-time task progress">
        <div class="progress-meta">
          <span>One-time</span>
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

      <section class="completion-summary" aria-label="Short-term task progress">
        <div class="progress-meta">
          <span>Short-term</span>
          <div class="summary-actions">
            <strong>{{ completedShortTerm }} / {{ totalShortTerm }} complete</strong>
          </div>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="Short-term task completion"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="shortTermCompletionRate"
          :aria-valuetext="completedShortTerm + ' of ' + totalShortTerm + ' tasks complete'"
        >
          <span class="progress-fill" :style="{ width: shortTermCompletionRate + '%' }"></span>
        </div>
      </section>
    </section>

    <main v-if="activeTaskTab === 'ordinary' && !hasActiveTaskQuery" class="board">
      <section class="panel" aria-labelledby="repetitive-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Recurring flow</p>
            <h2 id="repetitive-heading">Repetitive</h2>
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

        <ul v-if="visibleRepetitiveTasks.length" class="task-list" :class="{ minimal: compactMode }">
          <li v-for="task in visibleRepetitiveTasks" :key="task.id" class="task-card repetitive-task" :class="{ expanded: !compactMode }">
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

        <div v-else class="empty-state">
          {{ taskSearch || taskFilter !== 'all' ? 'No repetitive tasks match your search.' : 'No repetitive tasks yet. Add one to build your routine.' }}
        </div>
      </section>

      <section class="panel" aria-labelledby="onetime-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Single action</p>
            <h2 id="onetime-heading">One-time</h2>
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

        <ul v-if="sortedOneTimeTasks.length" class="task-list" :class="{ minimal: compactMode }">
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

        <div v-else class="empty-state">
          {{ taskSearch || taskFilter !== 'all' ? 'No one-time tasks match that filter.' : 'No one-time tasks yet. Create a focused item for today.' }}
        </div>
      </section>
    </main>

    <main v-else-if="activeTaskTab === 'special' && !hasActiveTaskQuery" class="board special-board">
      <section class="panel" aria-labelledby="longterm-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Future focus</p>
            <h2 id="longterm-heading">Long-term</h2>
          </div>
          <button class="accordion-toggle" type="button" @click="toggleAccordion('longTerm')">
            {{ accordionState.longTerm ? 'Hide add form' : 'Add task' }}
          </button>
        </div>

        <div v-if="accordionState.longTerm" class="accordion-body">
          <form class="task-form" @submit.prevent="addSpecialTask('longTerm')">
            <input v-model="specialTaskForm.longTerm.title" type="text" placeholder="Add a long-term task" maxlength="80" />
            <textarea v-model="specialTaskForm.longTerm.notes" rows="2" placeholder="Optional notes"></textarea>
            <button class="primary-btn" type="submit">Add task</button>
          </form>
        </div>

        <ul v-if="sortedLongTermTasks.length" class="task-list" :class="{ minimal: compactMode }">
          <li
            v-for="task in sortedLongTermTasks"
            :key="task.id"
            class="task-card special-task long-term-task"
            :class="[{ done: task.done, expanded: !compactMode, 'is-toggleable': compactMode }, 'priority-' + (task.priority || 'medium')]"
            :role="compactMode ? 'button' : undefined"
            :tabindex="compactMode ? 0 : undefined"
            @click="compactMode && toggleSpecialTask('longTerm', task.id)"
            @keydown.enter.space.prevent="compactMode && toggleSpecialTask('longTerm', task.id)"
          >
            <div class="task-header">
              <span v-if="!compactMode" class="badge badge-special">Long</span>
              <h3>{{ task.title }}</h3>
            </div>

            <template v-if="!compactMode">
              <div class="task-body">
                <p v-if="task.notes">{{ task.notes }}</p>
                <time class="task-timestamp" :datetime="task.updatedAt || task.createdAt">
                  {{ task.done ? 'Completed' : 'Added' }} {{ formatTaskTimestamp(task.updatedAt || task.createdAt) }}
                </time>
              </div>
              <footer class="task-footer">
                <div class="task-actions">
                  <button class="success-btn" type="button" @click="toggleSpecialTask('longTerm', task.id)">{{ task.done ? 'Undo' : 'Done' }}</button>
                  <button class="ghost-btn danger" type="button" @click="deleteSpecialTask('longTerm', task.id)">Delete</button>
                </div>
              </footer>
            </template>
          </li>
        </ul>

        <div v-else class="empty-state">
          {{ taskSearch || taskFilter !== 'all' ? 'No long-term tasks match that filter.' : 'No long-term tasks yet. Add a future goal.' }}
        </div>
      </section>

      <section class="panel" aria-labelledby="shortterm-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">Immediate action</p>
            <h2 id="shortterm-heading">Short-term</h2>
          </div>
          <button class="accordion-toggle" type="button" @click="toggleAccordion('shortTerm')">
            {{ accordionState.shortTerm ? 'Hide add form' : 'Add task' }}
          </button>
        </div>

        <div v-if="accordionState.shortTerm" class="accordion-body">
          <form class="task-form" @submit.prevent="addSpecialTask('shortTerm')">
            <input v-model="specialTaskForm.shortTerm.title" type="text" placeholder="Add a short-term task" maxlength="80" />
            <textarea v-model="specialTaskForm.shortTerm.notes" rows="2" placeholder="Optional notes"></textarea>
            <div class="button-row">
              <button class="primary-btn" type="submit">{{ editingShortTermId ? 'Save changes' : 'Add task' }}</button>
              <button v-if="editingShortTermId" class="secondary-btn" type="button" @click="resetShortTermForm">Cancel</button>
            </div>
          </form>
        </div>

        <ul v-if="sortedShortTermTasks.length" class="task-list" :class="{ minimal: compactMode }">
          <li
            v-for="task in sortedShortTermTasks"
            :key="task.id"
            class="task-card special-task short-term-task"
            :class="[{ done: task.done, expanded: !compactMode, 'is-toggleable': compactMode }, 'priority-' + (task.priority || 'high')]"
            :role="compactMode ? 'button' : undefined"
            :tabindex="compactMode ? 0 : undefined"
            @click="compactMode && toggleSpecialTask('shortTerm', task.id)"
            @keydown.enter.space.prevent="compactMode && toggleSpecialTask('shortTerm', task.id)"
          >
            <div class="task-header">
              <span v-if="!compactMode" class="badge badge-short">Short</span>
              <h3>{{ task.title }}</h3>
            </div>

            <template v-if="!compactMode">
              <div class="task-body">
                <p v-if="task.notes">{{ task.notes }}</p>
                <time class="task-timestamp" :datetime="task.updatedAt || task.createdAt">
                  {{ task.done ? 'Completed' : 'Added' }} {{ formatTaskTimestamp(task.updatedAt || task.createdAt) }}
                </time>
              </div>
              <footer class="task-footer">
                <div class="task-actions">
                  <button class="success-btn" type="button" @click="toggleSpecialTask('shortTerm', task.id)">{{ task.done ? 'Undo' : 'Done' }}</button>
                  <button class="ghost-btn" type="button" @click.stop="editShortTermTask(task.id)">Edit</button>
                  <button class="ghost-btn danger" type="button" @click="deleteSpecialTask('shortTerm', task.id)">Delete</button>
                </div>
              </footer>
            </template>
          </li>
        </ul>

        <div v-else class="empty-state">
          {{ taskSearch || taskFilter !== 'all' ? 'No short-term tasks match that filter.' : 'No short-term tasks yet. Capture the next immediate win.' }}
        </div>
      </section>
    </main>

    <main v-else class="board merged-board">
      <section class="panel merged-panel" aria-labelledby="filtered-heading">
        <div class="panel-header">
          <div>
            <p class="section-kicker">{{ activeTaskTab === 'ordinary' ? 'Ordinary tasks' : 'Special tasks' }}</p>
            <h2 id="filtered-heading">Matching tasks</h2>
          </div>
          <span class="result-count">{{ filteredTabTasks.length }} {{ filteredTabTasks.length === 1 ? 'task' : 'tasks' }}</span>
        </div>

        <ul v-if="filteredTabTasks.length" class="task-list" :class="{ minimal: compactMode }">
          <li
            v-for="task in filteredTabTasks"
            :key="task.taskType + '-' + task.id"
            class="task-card merged-task"
            :class="[
              { done: task.done, expanded: !compactMode, 'is-toggleable': compactMode && task.taskType !== 'repetitive' },
              task.taskType === 'longTerm' ? 'long-term-task' : '',
              task.taskType === 'shortTerm' ? 'short-term-task' : '',
              task.taskType === 'repetitive' ? 'repetitive-task' : 'priority-' + (task.priority || 'medium'),
            ]"
            :role="compactMode && task.taskType !== 'repetitive' ? 'button' : undefined"
            :tabindex="compactMode && task.taskType !== 'repetitive' ? 0 : undefined"
            :aria-label="task.done ? 'Mark ' + task.title + ' as not done' : task.taskType === 'repetitive' ? task.title : 'Mark ' + task.title + ' as done'"
            @click="compactMode && task.taskType !== 'repetitive' && toggleFilteredTask(task)"
            @keydown.enter.space.prevent="compactMode && task.taskType !== 'repetitive' && toggleFilteredTask(task)"
          >
            <div class="task-header">
              <span class="badge result-type-badge" :class="resultBadgeClasses[task.taskType]">{{ task.taskTypeLabel }}</span>
              <span v-if="!compactMode && task.priority" class="badge" :class="`badge-${task.priority}`">{{ task.priority }}</span>
              <h3>{{ task.title }}</h3>
            </div>

            <template v-if="!compactMode">
              <div class="task-body">
                <p v-if="task.notes">{{ task.notes }}</p>
                <time class="task-timestamp" :datetime="task.editedAt || task.updatedAt || task.createdAt">
                  {{ task.editedAt ? 'Edited' : task.done ? 'Completed' : 'Added' }} {{ formatTaskTimestamp(task.editedAt || task.updatedAt || task.createdAt) }}
                </time>
              </div>
              <footer class="task-footer">
                <div class="task-actions">
                  <template v-if="task.taskType !== 'repetitive'">
                    <button class="success-btn" type="button" @click.stop="toggleFilteredTask(task)">{{ task.done ? 'Undo' : 'Done' }}</button>
                    <button v-if="task.taskType === 'oneTime' || task.taskType === 'shortTerm'" class="ghost-btn" type="button" @click.stop="editFilteredTask(task)">Edit</button>
                  </template>
                  <button class="ghost-btn danger" type="button" @click.stop="deleteFilteredTask(task)">Delete</button>
                </div>
              </footer>
            </template>
          </li>
        </ul>

        <div v-else class="empty-state">No tasks match your search or filter in this tab.</div>
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
