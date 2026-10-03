export function resolveDefaultManagerId({ managerId = '', departmentHeadId = '', managers = [] } = {}) {
  const normalizedManagers = Array.isArray(managers) ? managers : []

  return (
    managerId ||
    departmentHeadId ||
    normalizedManagers.find((manager) => String(manager?.access_role || '').toUpperCase() === 'MANAGER')?.id ||
    normalizedManagers[0]?.id ||
    ''
  )
}