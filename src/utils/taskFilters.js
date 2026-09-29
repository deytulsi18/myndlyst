export const taskFilterOptions = ['all', 'active', 'completed']

const normalizeText = (value = '') => String(value).trim().toLowerCase()

const matchesSearch = (task, searchTerm) => {
  if (!searchTerm) return true

  const searchableValues = [task.title, task.notes, task.priority].filter(Boolean)
  return searchableValues.some((value) => normalizeText(value).includes(searchTerm))
}

const matchesStatusFilter = (task, filter = 'all') => {
  switch (filter) {
    case 'active':
      return !task.done
    case 'completed':
      return Boolean(task.done)
    case 'all':
    default:
      return true
  }
}

const filterTaskList = (taskList = [], searchTerm, filter) => {
  return taskList.filter((task) => matchesSearch(task, searchTerm) && matchesStatusFilter(task, filter))
}

export const filterVisibleTasks = (tasks, { search = '', filter = 'all' } = {}) => {
  const searchTerm = normalizeText(search)

  return {
    repetitive: filterTaskList(tasks?.repetitive ?? [], searchTerm, 'all'),
    oneTime: filterTaskList(tasks?.oneTime ?? [], searchTerm, filter),
    longTerm: filterTaskList(tasks?.longTerm ?? [], searchTerm, filter),
    shortTerm: filterTaskList(tasks?.shortTerm ?? [], searchTerm, filter),
  }
}

export const mergeTaskGroups = (groups) => groups.flatMap(({ type, label, tasks = [] }) => (
  tasks.map((task) => ({ ...task, taskType: type, taskTypeLabel: label }))
))
