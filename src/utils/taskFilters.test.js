import { describe, expect, it } from 'vitest'
import { filterVisibleTasks, mergeTaskGroups, taskFilterOptions } from './taskFilters.js'

describe('taskFilters', () => {
  const tasks = {
    repetitive: [
      { id: 'r1', title: 'Morning reset', notes: 'Stretch and review the plan' },
      { id: 'r2', title: 'Check inbox', notes: 'Clear the top priorities' },
    ],
    oneTime: [
      { id: 'o1', title: 'Plan sprint work', notes: 'Deck for sprint planning', priority: 'high', done: false },
      { id: 'o2', title: 'Book dentist visit', notes: 'Confirm appointment', priority: 'low', done: true },
      { id: 'o3', title: 'Draft follow-up email', notes: 'Send to design team', priority: 'medium', done: false },
    ],
    longTerm: [
      { id: 'l1', title: 'Build a learning system', notes: 'Track weekly wins', priority: 'medium', done: false },
      { id: 'l2', title: 'Finish deep work plan', notes: 'Focus on one project', priority: 'high', done: true },
    ],
    shortTerm: [
      { id: 's1', title: 'Send design follow-up', notes: 'Close the loop today', priority: 'high', done: false },
    ],
  }

  it('matches search text across titles and notes across all task groups', () => {
    const result = filterVisibleTasks(tasks, { search: 'plan', filter: 'all' })

    expect(result.repetitive.map((task) => task.id)).toEqual(['r1'])
    expect(result.oneTime.map((task) => task.id)).toEqual(['o1'])
    expect(result.longTerm.map((task) => task.id)).toEqual(['l2'])
    expect(result.shortTerm).toHaveLength(0)
  })

  it('filters completable tasks by completion state and keeps repetitive tasks visible', () => {
    const result = filterVisibleTasks(tasks, { search: '', filter: 'completed' })

    expect(result.repetitive).toHaveLength(2)
    expect(result.oneTime.map((task) => task.id)).toEqual(['o2'])
    expect(result.longTerm.map((task) => task.id)).toEqual(['l2'])
    expect(result.shortTerm).toHaveLength(0)
  })

  it('exposes only the all and completion-status filters', () => {
    expect(taskFilterOptions).toEqual(['all', 'active', 'completed'])
  })

  it('merges matching task groups and keeps each task subtype label', () => {
    const result = mergeTaskGroups([
      { type: 'repetitive', label: 'Repetitive', tasks: [{ id: 'r1', title: 'Morning reset' }] },
      { type: 'oneTime', label: 'One-time', tasks: [{ id: 'o1', title: 'Plan sprint work' }] },
    ])

    expect(result).toEqual([
      { id: 'r1', title: 'Morning reset', taskType: 'repetitive', taskTypeLabel: 'Repetitive' },
      { id: 'o1', title: 'Plan sprint work', taskType: 'oneTime', taskTypeLabel: 'One-time' },
    ])
  })
})
