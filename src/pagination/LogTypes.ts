/**
 * Logger interface for pagination components and utilities
 */
export interface Logger {
  addLog: (message: string, from: string, type?: LogType) => void
}

/**
 * LogType enum for categorizing log messages
 */
export enum LogType {
  Normal = 0,
  Warning = 1,
  Error = 2
}

