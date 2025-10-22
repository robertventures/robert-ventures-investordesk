'use client'
import { useEffect, useState } from 'react'
import styles from './TabbedInvestmentType.module.css'

const options = [
  { key: 'individual', label: 'Individual' },
  { key: 'joint', label: 'Joint' },
  { key: 'entity', label: 'Entity' },
  { key: 'ira', label: 'IRA' }
]

export default function TabbedInvestmentType({ onCompleted, showContinueButton = true, autoSaveOnSelect = false, onChange, selectedValue, lockedAccountType }) {
  const [selected, setSelected] = useState(selectedValue || 'individual')
  const [isSaving, setIsSaving] = useState(false)

  // Optionally we could warn if session is missing, but keep the button state as Continue
  useEffect(() => {
    // no-op
  }, [])

  useEffect(() => {
    if (selectedValue) setSelected(selectedValue)
  }, [selectedValue])

  const handleSelect = async (key) => {
    if (lockedAccountType && key !== lockedAccountType) return
    setSelected(key)
    if (typeof onChange === 'function') onChange(key)
    if (!autoSaveOnSelect) return
    try {
      if (typeof window === 'undefined') return
      
      const userId = localStorage.getItem('currentUserId')
      const investmentId = localStorage.getItem('currentInvestmentId')
      if (!userId || !investmentId) return
      setIsSaving(true)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'updateInvestment', investmentId, fields: { accountType: key } })
      })
      const data = await res.json()
      if (data.success && typeof onCompleted === 'function') onCompleted(key)
    } catch (e) {
      console.error('Failed to set account type', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleContinue = async () => {
    const userId = localStorage.getItem('currentUserId')
    const investmentId = localStorage.getItem('currentInvestmentId')
    if (!userId || !investmentId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'updateInvestment', investmentId, fields: { accountType: selected } })
      })
      const data = await res.json()
      if (data.success) {
        if (typeof onCompleted === 'function') onCompleted(selected)
      }
    } catch (e) {
      console.error('Failed to set account type', e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        {options.map(opt => {
          const isLockedOther = Boolean(lockedAccountType && opt.key !== lockedAccountType)
          return (
            <button
              key={opt.key}
              type="button"
              className={`${styles.card} ${selected === opt.key ? styles.selected : ''} ${isLockedOther ? styles.disabled : ''}`}
              onClick={() => handleSelect(opt.key)}
              disabled={isLockedOther}
              aria-disabled={isLockedOther}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {showContinueButton && (
        <div className={styles.actions}>
          <button className={styles.primaryButton} onClick={handleContinue} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}


