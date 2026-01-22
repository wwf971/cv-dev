# Log System

## Overview
Logs collected via `paginationLogger` injected to components, displayed in `LogView` in panel(such as `panel_test`).
```
  panel_test_cv_jp.vue
    holds the logger
      → createLogger(logs, 'source') # creates logger writing to logs ref
    provide logger to descendant components
      → provide('paginationLogger', logger) # makes logger available to descendants
    pass logs to PanelTest.vue to be displayed
      → :logs="logs" passed to PanelTest
```