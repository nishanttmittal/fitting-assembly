/**
 * App root.
 * Runs version-safe data migrations once on boot (before any page reads
 * storage), then mounts the app shell for the fitting-assembly module.
 */
import { useState } from 'react'
import { runMigrations } from './core/db/migrations'
import AppShell from './app/AppShell'

runMigrations()

export default function App() {
  const [moduleId] = useState('fitting')
  return <AppShell moduleId={moduleId} />
}
