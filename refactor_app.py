import sys

file_path = '/home/fehim/Documents/KronEditor/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

replacements = [
    # Top level logs
    ("msg: 'System initialized.'", "msg: t('logs.systemInitialized') || 'System initialized.'"),
    ("msg: 'Ready to map PLC project...'", "msg: t('logs.systemReady') || 'Ready to map PLC project...'"),
    
    # Simulation listeners
    ("addLog('warning', `Simulation ${parsed.status}.`);", "addLog('warning', t('logs.simulationStatus', { status: parsed.status }) || `Simulation ${parsed.status}.`);"),
    ("addLog('error', `Simulation: ${parsed.error}`);", "addLog('error', t('logs.simulationError', { error: parsed.error }) || `Simulation: ${parsed.error}`);"),
    
    # Save operations
    ("addLog('success', `Project saved to ${currentFilePath} `);", "addLog('success', t('logs.projectSaved', { path: currentFilePath }) || `Project saved to ${currentFilePath} `);"),
    ("addLog('error', `Save Error: ${error} `);", "addLog('error', t('logs.saveError', { error: error }) || `Save Error: ${error} `);"),
    ("addLog('success', `Project saved to ${filePath} `);", "addLog('success', t('logs.projectSaved', { path: filePath }) || `Project saved to ${filePath} `);"),
    ("addLog('error', `Save As Error: ${error} `);", "addLog('error', t('logs.saveAsError', { error: error }) || `Save As Error: ${error} `);"),
    
    # New Project
    ("msg: 'Started new project.'", "msg: t('logs.startedNewProject') || 'Started new project.'"),
    
    # Close Project
    ("ask('Are you sure you want to close the current project? Any unsaved changes will be lost.',", "ask(t('messages.confirmCloseProject') || 'Are you sure you want to close the current project? Any unsaved changes will be lost.',"),
    
    # Open Project
    ("addLog('warning', 'Project had no configuration; restored default.');", "addLog('warning', t('logs.missingConfigRestored') || 'Project had no configuration; restored default.');"),
    ("addLog('success', `Project loaded from ${filePath} `);", "addLog('success', t('logs.projectLoaded', { path: filePath }) || `Project loaded from ${filePath} `);"),
    ("addLog('error', 'Failed to parse project file (Invalid Format).');", "addLog('error', t('logs.invalidFormat') || 'Failed to parse project file (Invalid Format).');"),
    ("addLog('error', `Open Error: ${error} `);", "addLog('error', t('logs.openError', { error: error }) || `Open Error: ${error} `);"),
    
    # Simulation toggle
    ("addLog('error', 'Cannot enable Simulation Mode while PLC is connected.');", "addLog('error', t('logs.cannotSimulateConnected') || 'Cannot enable Simulation Mode while PLC is connected.');"),
    ("addLog('warning', 'Please stop execution before toggling simulation mode.');", "addLog('warning', t('logs.stopExecutionFirst') || 'Please stop execution before toggling simulation mode.');"),
    ("addLog('info', 'Compiling Project for Simulation (C Transpilation)...');", "addLog('info', t('logs.compilingSimulationTranspile') || 'Compiling Project for Simulation (C Transpilation)...');"),
    ("addLog('success', `Transpiled C header and source successfully saved to ${outPath}`);", "addLog('success', t('logs.transpiledSaved', { path: outPath }) || `Transpiled C header and source successfully saved to ${outPath}`);"),
    ("addLog('info', 'Compiling simulation executable with gcc (debug symbols)...');", "addLog('info', t('logs.compilingSimulationGcc') || 'Compiling simulation executable with gcc (debug symbols)...');"),
    ("addLog('success', `Simulation executable compiled: ${exePath}`);", "addLog('success', t('logs.simulationCompiled', { path: exePath }) || `Simulation executable compiled: ${exePath}`);"),
    ("addLog('info', 'Simulation Mode Enabled. Variables populated with default values.');", "addLog('info', t('logs.simulationEnabled') || 'Simulation Mode Enabled. Variables populated with default values.');"),
    ("addLog('error', `Simulation Compilation Failed: ${error}`);", "addLog('error', t('logs.simulationCompileFailed', { error: error }) || `Simulation Compilation Failed: ${error}`);"),
    ("addLog('info', 'Simulation Mode Disabled.');", "addLog('info', t('logs.simulationDisabled') || 'Simulation Mode Disabled.');"),
    
    # Execution
    ("addLog('warning', 'Cannot start. Please enable Simulation Mode or connect to a PLC.');", "addLog('warning', t('logs.cannotStartEnableSim') || 'Cannot start. Please enable Simulation Mode or connect to a PLC.');"),
    ("addLog('error', `Failed to start simulation: ${err}`);", "addLog('error', t('logs.failedToStartSim', { error: err }) || `Failed to start simulation: ${err}`);"),
    ("addLog('success', 'PLC Execution Started.');", "addLog('success', t('logs.plcExecutionStarted') || 'PLC Execution Started.');"),
    ("addLog('error', `Failed to stop simulation: ${err}`);", "addLog('error', t('logs.failedToStopSim', { error: err }) || `Failed to stop simulation: ${err}`);"),
    ("addLog('error', `Force write failed for '${key}': ${err}`);", "addLog('error', t('logs.forceWriteFailed', { key: key, error: err }) || `Force write failed for '${key}': ${err}`);"),
    
    # Build
    ("addLog('info', `Build started for target: ${plcTarget}...`);", "addLog('info', t('logs.buildStartedTarget', { target: plcTarget }) || `Build started for target: ${plcTarget}...`);"),
    ("addLog('success', 'Project built successfully.');", "addLog('success', t('logs.projectBuilt') || 'Project built successfully.');"),
    ("addLog('error', `Build failed: ${err.message}`);", "addLog('error', t('logs.buildFailed', { error: err.message }) || `Build failed: ${err.message}`);"),
    
    # Send
    ("addLog('info', `Send to PLC triggered for target: ${plcTarget} `);", "addLog('info', t('logs.sendToPlcTriggered', { target: plcTarget }) || `Send to PLC triggered for target: ${plcTarget} `);"),
    ("addLog('success', 'Binary sent to PLC (Simulated Action)');", "addLog('success', t('logs.binarySentSimulated') || 'Binary sent to PLC (Simulated Action)');"),
    
    # Structure Handlers
    ("addLog('info', `Added Data Type ${name} (${type})`);", "addLog('info', t('logs.addedDataType', { name, type }) || `Added Data Type ${name} (${type})`);"),
    ("addLog('info', `Updated properties for ${name}`);", "addLog('info', t('logs.updatedProperties', { name }) || `Updated properties for ${name}`);"),
    ("addLog('info', `Added ${name} (${type}) to ${category}`);", "addLog('info', t('logs.addedItem', { name, type, category }) || `Added ${name} (${type}) to ${category}`);"),
    ("addLog('warning', `Deleted item ${id}`);", "addLog('warning', t('logs.deletedItem', { id }) || `Deleted item ${id}`);"),
    ("addLog('info', `Renamed item to ${newName}`);", "addLog('info', t('logs.renamedItem', { name: newName }) || `Renamed item to ${newName}`);")
]

for old, new in replacements:
    code = code.replace(old, new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("App.jsx refactored.")
