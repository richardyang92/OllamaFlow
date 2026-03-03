/**
 * Test setup file for Vitest
 * 
 * This file is run before all tests to set up the testing environment.
 */

// Mock window.crypto for UUID generation
if (typeof window !== 'undefined' && !window.crypto) {
  Object.defineProperty(window, 'crypto', {
    value: {
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      },
    },
  })
}

// Mock electronAPI
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      execution: {
        updateStatus: async () => {},
      },
    },
  })
}

