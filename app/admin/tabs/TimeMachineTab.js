import { useState } from 'react'
import SectionCard from '../components/SectionCard'
import styles from './TimeMachineTab.module.css'

/**
 * Time Machine tab for controlling application time
 */
export default function TimeMachineTab({ 
  timeMachineData, 
  onUpdate, 
  onReset,
  currentUser
}) {
  const [newAppTime, setNewAppTime] = useState(
    new Date(timeMachineData.appTime).toISOString().slice(0, 16)
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    if (!newAppTime) {
      alert('Please enter a valid date and time')
      return
    }

    setIsUpdating(true)
    try {
      await onUpdate(newAppTime)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReset = async () => {
    setIsUpdating(true)
    try {
      const result = await onReset()
      if (result) {
        setNewAppTime(new Date(result.appTime).toISOString().slice(0, 16))
      }
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className={styles.timeMachineTab}>
      <SectionCard
        title={
          <div className={styles.titleWithBadge}>
            Time Machine
            {timeMachineData.isActive && (
              <span className={styles.activeIndicator}>(ACTIVE)</span>
            )}
          </div>
        }
      >
        <p className={styles.description}>
          Control the application's internal clock for testing time-sensitive features
          like investment maturity, payouts, and interest calculations.
        </p>

        <div className={styles.timeMachineControls}>
          {/* Current Time Display */}
          <div className={styles.timeDisplaySection}>
            <div className={styles.timeDisplay}>
              <div className={styles.timeRow}>
                <span className={styles.timeLabel}>App Time:</span>
                <span
                  className={styles.timeValue}
                  style={{ color: timeMachineData.isActive ? '#dc2626' : '#059669' }}
                >
                  {timeMachineData.appTime
                    ? new Date(timeMachineData.appTime).toLocaleString()
                    : 'Loading...'}
                </span>
              </div>
              {timeMachineData.isActive && (
                <div className={styles.timeRow}>
                  <span className={styles.timeLabel}>Real Time:</span>
                  <span className={styles.timeValue}>
                    {timeMachineData.realTime
                      ? new Date(timeMachineData.realTime).toLocaleString()
                      : 'Loading...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className={styles.timeControlsSection}>
            <label className={styles.inputLabel}>Set New Time</label>
            <input
              type="datetime-local"
              value={newAppTime}
              onChange={(e) => setNewAppTime(e.target.value)}
              className={styles.timeInput}
              disabled={isUpdating}
            />
            <div className={styles.buttonGroup}>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={styles.setTimeButton}
              >
                {isUpdating ? 'Updating...' : 'Set Time'}
              </button>
              {timeMachineData.isActive && (
                <button
                  onClick={handleReset}
                  disabled={isUpdating}
                  className={styles.resetTimeButton}
                >
                  Reset to Real Time
                </button>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

