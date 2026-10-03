import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDefaultManagerId } from './employeeAssignment.js'

test('prefers an explicit manager when provided', () => {
  const managerId = resolveDefaultManagerId({
    managerId: 'M-2',
    departmentHeadId: 'M-1',
    managers: [{ id: 'M-1' }, { id: 'M-3' }],
  })

  assert.equal(managerId, 'M-2')
})

test('falls back to the department head before the first manager', () => {
  const managerId = resolveDefaultManagerId({
    managerId: '',
    departmentHeadId: 'M-1',
    managers: [{ id: 'M-2' }, { id: 'M-3' }],
  })

  assert.equal(managerId, 'M-1')
})

test('uses the first available manager when no manager assignment exists', () => {
  const managerId = resolveDefaultManagerId({
    managerId: '',
    departmentHeadId: '',
    managers: [{ id: 'M-2' }, { id: 'M-3' }],
  })

  assert.equal(managerId, 'M-2')
})
