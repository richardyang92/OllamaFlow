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
      file: {
        read: async () => ({ success: true, content: '' }),
        write: async () => ({ success: true }),
        list: async () => ({ success: true, files: [] }),
        exists: async () => ({ success: true, exists: false }),
        readImage: async () => ({ success: true }),
        readPdf: async () => ({ success: true }),
        delete: async () => ({ success: true }),
        copyFiles: async () => ({ success: true }),
      },
      command: {
        execute: async () => ({ success: true, stdout: '', stderr: '', exitCode: 0 }),
      },
      http: {
        fetch: async () => ({ success: true, body: '', status: 200, statusText: 'OK' }),
      },
      browser: {
        init: async () => ({ success: true }),
        navigate: async () => ({ success: true }),
        click: async () => ({ success: true }),
        type: async () => ({ success: true }),
        scroll: async () => ({ success: true }),
        screenshot: async () => ({ success: true }),
        getContent: async () => ({ success: true, content: '' }),
        evaluate: async () => ({ success: true, result: null }),
        waitForSelector: async () => ({ success: true }),
        close: async () => ({ success: true }),
        getStatus: async () => ({ isConnected: false }),
      },
      webParser: {
        isHtml: async () => false,
        parseHtml: async () => ({ title: '', mainContent: '', textContent: '', links: [] }),
        fetchAndParse: async () => ({ title: '', mainContent: '', textContent: '', links: [] }),
      },
      workflow: {
        loadData: async () => ({}),
        discoverAll: async () => [],
      },
      workspace: {
        open: async () => null,
        getDefaultProjectsPath: async () => '',
        getCustomProjectsPath: async () => null,
        setCustomProjectsPath: async () => {},
        getAll: async () => [],
        create: async () => true,
        readConfig: async () => ({}),
        writeConfig: async () => true,
        saveWorkflow: async () => true,
        deleteWorkspace: async () => true,
        exists: async () => false,
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async () => ({ canceled: true, filePath: '' }),
      },
      path: {
        join: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
        basename: (p: string) => p.split('/').pop() || '',
      },
      process: {
        platform: 'darwin',
        versions: {},
      },
      app: {
        getPath: async () => '',
        getVersion: async () => '0.0.0',
        quit: async () => {},
      },
      shell: {
        openExternal: async () => {},
        openPath: async () => '',
      },
      settings: {
        get: async () => null,
        set: async () => {},
      },
      agent: {
        getConversation: async () => null,
        saveConversation: async () => {},
        getConversationHistory: async () => ({ conversations: [], currentConversationId: null }),
        saveConversationHistory: async () => {},
        deleteConversation: async () => {},
        getConfig: async () => ({}),
        setConfig: async () => {},
        createSandbox: async () => {},
        deleteSandbox: async () => {},
      },
      globalAI: {
        getConfig: async () => ({}),
        setConfig: async () => {},
        getApiKey: async () => null,
        setApiKey: async () => {},
        deleteApiKey: async () => {},
        testConnection: async () => ({ success: true }),
        clearConfig: async () => {},
      },
      simplexng: {
        getEndpoint: async () => 'http://localhost:8888',
        setEndpoint: async () => {},
      },
      analytics: {
        getHistory: async () => [],
        saveHistory: async () => {},
        clearHistory: async () => {},
      },
      trace: {
        save: async () => {},
      },
    },
  })
}

