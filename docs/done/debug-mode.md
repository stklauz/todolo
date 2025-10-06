# Debug Mode Documentation

## Overview

Todolo now includes a comprehensive debug mode that helps identify performance issues in production builds. The debug mode provides detailed logging and performance metrics for all critical operations.

## How to Enable Debug Mode

### Method 1: Menu Option
1. Open Todolo
2. Go to **View** → **Toggle Debug Mode** (or press `Cmd+D` on macOS, `Ctrl+D` on Windows/Linux)
3. The debug panel will appear on the right side of the screen

### Method 2: Keyboard Shortcut
- **macOS**: `Cmd+D`
- **Windows/Linux**: `Ctrl+D`

## Debug Panel Features

### Logs Tab
- **Real-time logging**: Shows all debug messages as they happen
- **Filtering**: Search through logs by operation name or log level
- **Log levels**: 
  - `INFO`: General information about operations
  - `WARN`: Warning messages
  - `ERROR`: Error conditions
  - `PERF`: Performance timing information

### Performance Tab
- **Performance Summary**: Shows aggregated performance data
- **Metrics per operation**:
  - **Count**: How many times the operation was performed
  - **Total Time**: Total time spent on the operation
  - **Average Time**: Average time per operation

### Export Functionality
- **Export Logs**: Download a JSON file with all debug data
- **Performance Data**: Includes timing information and operation counts
- **Timestamp**: When the debug session was captured

## What Gets Logged

### Storage Operations
- **Loading lists**: When the app loads the list index
- **Saving lists**: When list metadata is saved
- **Loading todos**: When todos for a specific list are loaded
- **Saving todos**: When todos are saved (both immediate and debounced)

### Performance Critical Operations
- **List switching**: Time taken to switch between lists
- **Todo operations**: Time for adding, editing, completing todos
- **IPC communication**: Time for communication between renderer and main process
- **File I/O**: Time for reading/writing files

### State Management
- **State initialization**: When the app initializes
- **List selection**: When switching between lists
- **Todo updates**: When todos are modified

## Performance Metrics Explained

### Storage Performance
- **loadListsIndex**: Time to load the list index file
- **saveListsIndex**: Time to save list metadata
- **loadListTodos**: Time to load todos for a specific list
- **saveListTodos**: Time to save todos for a specific list

### IPC Performance
- **Main Process Operations**: Time for file operations in the main process
- **Renderer Operations**: Time for operations in the renderer process

## Identifying Performance Issues

### Common Performance Bottlenecks

1. **Slow List Switching**
   - Look for high `loadListTodos` times
   - Check if lists are being loaded from disk repeatedly
   - Verify caching is working (should see "List todos already cached" messages)

2. **Slow Todo Operations**
   - Check `saveListTodos` performance
   - Look for frequent saves vs. debounced saves
   - Verify immediate vs. debounced save strategies

3. **IPC Communication Issues**
   - High times for storage operations indicate IPC overhead
   - Look for patterns in main process vs. renderer process times

### Performance Thresholds

- **Storage operations**: Should be < 50ms for small files
- **List switching**: Should be < 100ms for cached lists
- **Todo operations**: Should be < 20ms for immediate operations
- **IPC communication**: Should be < 10ms for simple operations

## Debug Mode Best Practices

### When to Use Debug Mode
- **Production performance issues**: When the app feels sluggish in production
- **Development optimization**: When optimizing specific operations
- **User-reported issues**: When users report slow performance

### How to Use Debug Data
1. **Enable debug mode** when you notice performance issues
2. **Reproduce the issue** while debug mode is active
3. **Export the logs** to analyze the performance data
4. **Look for patterns** in the performance metrics
5. **Identify bottlenecks** based on timing data

### Analyzing Performance Data
1. **Sort by average time** to find the slowest operations
2. **Look for high counts** of operations that should be cached
3. **Check for error patterns** that might indicate issues
4. **Compare timing** between different operations

## Troubleshooting

### Debug Panel Not Appearing
- Check if debug mode is enabled in the menu
- Try the keyboard shortcut
- Restart the app if needed

### No Performance Data
- Make sure to perform operations while debug mode is active
- Check that the operations you're testing are actually being logged
- Verify that the debug mode is enabled (not just the panel visible)

### High Memory Usage
- Debug mode stores up to 1000 log entries
- Clear logs periodically using the "Clear" button
- Disable debug mode when not needed

## Technical Details

### Log Storage
- Maximum 1000 log entries stored in memory
- Logs are cleared when debug mode is disabled
- Performance data is aggregated in real-time

### Performance Measurement
- Uses `performance.now()` for high-precision timing
- Measures both sync and async operations
- Tracks operation counts and total time

### IPC Communication
- Debug messages are sent from main process to renderer
- Performance data is collected in both processes
- Main process logs are shown in the console

## Example Debug Session

```
[DEBUG INFO] Initializing todos state - loading lists
[DEBUG PERF] Started: storage.loadListsIndex
[DEBUG PERF] Completed: storage.loadListsIndex { duration: '15.23ms' }
[DEBUG INFO] Lists index loaded successfully { listCount: 3, selectedListId: 'list-1' }
[DEBUG INFO] List selection changed - checking if todos need loading
[DEBUG INFO] Loading todos for selected list { selectedListId: 'list-1' }
[DEBUG PERF] Started: storage.loadListTodos
[DEBUG PERF] Completed: storage.loadListTodos { duration: '8.45ms' }
[DEBUG INFO] List todos loaded successfully { listId: 'list-1', todoCount: 12 }
```

This shows a typical list switching operation taking about 23ms total, which is within acceptable performance thresholds.
