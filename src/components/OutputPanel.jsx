import { useState, useRef, useEffect } from 'react';
import ForceWriteModal from './common/ForceWriteModal';

const LOG_COLORS = {
    info:    '#c8c8c8',
    success: '#4ec9b0',
    warning: '#e5a64a',
    error:   '#f14c4c',
};

const LOG_ICONS = {
    info:    '●',
    success: '●',
    warning: '▲',
    error:   '✖',
};

const LOG_BG_HOVER = {
    info:    'rgba(200,200,200,0.05)',
    success: 'rgba(78,201,176,0.07)',
    warning: 'rgba(229,166,74,0.09)',
    error:   'rgba(241,76,76,0.09)',
};

// Resolve an expression like "ProgName.varName" or "varName" to a liveKey
const resolveExpression = (expr, projectStructure) => {
    if (!expr || !projectStructure) return { liveKey: null, varType: null };

    const trimmed = expr.trim();
    const dotIdx = trimmed.indexOf('.');

    if (dotIdx > 0) {
        const progName = trimmed.slice(0, dotIdx).trim();
        const varName  = trimmed.slice(dotIdx + 1).trim();
        const allPOUs = [
            ...(projectStructure.programs || []),
            ...(projectStructure.functionBlocks || []),
        ];
        const pou = allPOUs.find(p =>
            p.name.trim().replace(/\s+/g, '_') === progName.replace(/\s+/g, '_') ||
            p.name.trim() === progName
        );
        const varEntry = (pou?.content?.variables || []).find(v => v.name === varName);
        const safeProg = progName.replace(/\s+/g, '_');
        const safeVar  = varName.replace(/\s+/g, '_');
        return {
            liveKey: `prog_${safeProg}_${safeVar}`,
            varType: varEntry?.type || null,
        };
    }

    const allPOUs = [
        ...(projectStructure.programs || []),
        ...(projectStructure.functionBlocks || []),
    ];
    for (const pou of allPOUs) {
        const v = (pou.content?.variables || []).find(vr => vr.name === trimmed);
        if (v) {
            const safeProg = pou.name.trim().replace(/\s+/g, '_');
            return { liveKey: `prog_${safeProg}_${trimmed.replace(/\s+/g, '_')}`, varType: v.type };
        }
    }
    return { liveKey: `${trimmed.replace(/\s+/g, '_')}`, varType: null };
};

const OutputPanel = ({
    logs = [],
    onClearLogs = null,
    watchTable = [],
    onWatchTableUpdate,
    onWatchTableRemove,
    onForceWrite = null,
    liveVariables = null,
    isRunning = false,
    projectStructure = null,
}) => {
    const [activeTab, setActiveTab] = useState('messages');
    const [forceModal, setForceModal] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [hoveredLog, setHoveredLog] = useState(null);
    const logEndRef = useRef(null);
    const editInputRef = useRef(null);

    useEffect(() => {
        if (['messages', 'warnings', 'errors'].includes(activeTab) && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab]);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const filtered = {
        messages: logs.filter(l => l.type === 'info' || l.type === 'success'),
        warnings: logs.filter(l => l.type === 'warning'),
        errors:   logs.filter(l => l.type === 'error'),
    };

    const TABS = [
        { key: 'messages', label: 'Messages', badge: filtered.messages.length, badgeColor: '#4ec9b0' },
        { key: 'warnings', label: 'Warnings', badge: filtered.warnings.length, badgeColor: '#e5a64a' },
        { key: 'errors',   label: 'Errors',   badge: filtered.errors.length,   badgeColor: '#f14c4c' },
        { key: 'watch',    label: 'Watchtable', badge: watchTable.length,       badgeColor: '#007acc' },
    ];

    const getLiveVal = (liveKey) => {
        if (!liveVariables || !liveKey) return undefined;
        return liveVariables[liveKey];
    };

    const formatVal = (val, type) => {
        if (val === null || val === undefined) return '---';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (type === 'TIME') {
            const us = Number(val);
            if (us >= 1000000 && us % 1000000 === 0) return `${us / 1000000}s`;
            if (us >= 1000 && us % 1000 === 0) return `${us / 1000}ms`;
            return `${us}µs`;
        }
        return String(val);
    };

    const commitEdit = (entry) => {
        if (!editValue.trim() || !onWatchTableUpdate) { setEditingId(null); return; }
        const { liveKey, varType } = resolveExpression(editValue, projectStructure);
        onWatchTableUpdate(entry.id, {
            ...entry,
            displayName: editValue.trim(),
            liveKey: liveKey || entry.liveKey,
            varType: varType || entry.varType,
        });
        setEditingId(null);
    };

    const tabStyle = (key) => ({
        padding: '5px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: activeTab === key ? '2px solid #007acc' : '2px solid transparent',
        color: activeTab === key ? '#e8e8e8' : '#666',
        fontSize: 11,
        fontWeight: activeTab === key ? '600' : '400',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        outline: 'none',
        transition: 'color 0.15s',
        userSelect: 'none',
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#141414' }}>

            {/* ── Tab bar ── */}
            <div style={{
                display: 'flex',
                background: '#1a1a1a',
                borderBottom: '1px solid #2a2a2a',
                overflowX: 'auto',
                flexShrink: 0,
            }}>
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(tab.key)}>
                        {tab.label}
                        {tab.badge != null && tab.badge > 0 && (
                            <span style={{
                                background: tab.badgeColor,
                                color: '#fff',
                                borderRadius: 2,
                                padding: '1px 5px',
                                fontSize: 10,
                                fontWeight: '700',
                                lineHeight: '14px',
                                minWidth: 16,
                                textAlign: 'center',
                                display: 'inline-block',
                                letterSpacing: '0',
                            }}>
                                {tab.badge > 999 ? '999+' : tab.badge}
                            </span>
                        )}
                    </button>
                ))}
                {/* Clear button — right-aligned */}
                {onClearLogs && ['messages','warnings','errors'].includes(activeTab) && (
                    <button
                        onClick={onClearLogs}
                        title="Clear all logs"
                        style={{
                            marginLeft: 'auto',
                            marginRight: 6,
                            alignSelf: 'center',
                            background: 'transparent',
                            border: '1px solid #3a3a3a',
                            borderRadius: 3,
                            color: '#666',
                            fontSize: 10,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#555'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#3a3a3a'; }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* ── Log content ── */}
            {activeTab !== 'watch' && (
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    fontFamily: '"Consolas", "Cascadia Code", monospace',
                    fontSize: 12,
                }}>
                    {filtered[activeTab].length === 0 ? (
                        <div style={{
                            color: '#3a3a3a',
                            padding: '12px 12px',
                            fontSize: 11,
                            fontStyle: 'italic',
                            letterSpacing: '0.03em',
                        }}>
                            No {activeTab}.
                        </div>
                    ) : (
                        filtered[activeTab].map((log, i) => {
                            const color = LOG_COLORS[log.type] || '#c8c8c8';
                            const icon  = LOG_ICONS[log.type]  || '●';
                            const bgHov = LOG_BG_HOVER[log.type] || 'rgba(200,200,200,0.05)';
                            const isHovered = hoveredLog === i;
                            return (
                                <div
                                    key={i}
                                    title={log.msg}
                                    onMouseEnter={() => setHoveredLog(i)}
                                    onMouseLeave={() => setHoveredLog(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        padding: '3px 10px',
                                        borderBottom: '1px solid #1e1e1e',
                                        background: isHovered ? bgHov : 'transparent',
                                        cursor: 'default',
                                        transition: 'background 0.1s',
                                        minWidth: 0,
                                    }}
                                >
                                    <span style={{
                                        color,
                                        fontSize: log.type === 'warning' ? 9 : 8,
                                        flexShrink: 0,
                                        lineHeight: 1,
                                    }}>
                                        {icon}
                                    </span>
                                    <span style={{
                                        color,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                        lineHeight: '18px',
                                    }}>
                                        {log.msg}
                                    </span>
                                </div>
                            );
                        })
                    )}
                    <div ref={logEndRef} />
                </div>
            )}

            {/* ── Watchtable ── */}
            {activeTab === 'watch' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {watchTable.length === 0 ? (
                        <div style={{
                            color: '#3a3a3a',
                            padding: '14px 12px',
                            fontSize: 11,
                            textAlign: 'center',
                            fontStyle: 'italic',
                            letterSpacing: '0.03em',
                        }}>
                            Watch table is empty.<br />
                            <span style={{ fontSize: 11, color: '#333' }}>Right-click a variable in the variable table to add it.</span>
                        </div>
                    ) : (
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 12,
                            color: '#ccc',
                            fontFamily: '"Consolas", "Cascadia Code", monospace',
                        }}>
                            <thead>
                                <tr style={{ background: '#1a1a1a', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <th style={{ padding: '5px 10px', borderBottom: '1px solid #2a2a2a', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Expression</th>
                                    <th style={{ padding: '5px 10px', borderBottom: '1px solid #2a2a2a', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Type</th>
                                    <th style={{ padding: '5px 10px', borderBottom: '1px solid #2a2a2a', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Live Value</th>
                                    <th style={{ padding: '5px 4px', borderBottom: '1px solid #2a2a2a', width: 28 }}></th>
                                    <th style={{ padding: '5px 4px', borderBottom: '1px solid #2a2a2a', width: 28 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchTable.map(entry => {
                                    const val = getLiveVal(entry.liveKey);
                                    const hasVal = val !== undefined;
                                    const isInvalid = isRunning && !hasVal;
                                    const displayVal = formatVal(val, entry.varType);
                                    const isEditing = editingId === entry.id;

                                    return (
                                        <tr key={entry.id} style={{
                                            borderBottom: '1px solid #1e1e1e',
                                            background: isInvalid ? 'rgba(241,76,76,0.06)' : 'transparent',
                                        }}>
                                            <td style={{ padding: '3px 10px' }}>
                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={() => commitEdit(entry)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitEdit(entry);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        style={{
                                                            background: '#1e1e1e',
                                                            border: '1px solid #007acc',
                                                            color: '#90caf9',
                                                            fontSize: 12,
                                                            fontFamily: 'inherit',
                                                            padding: '1px 5px',
                                                            width: '100%',
                                                            outline: 'none',
                                                            borderRadius: 0,
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        onClick={() => { setEditingId(entry.id); setEditValue(entry.displayName); }}
                                                        title={entry.displayName}
                                                        style={{
                                                            color: isInvalid ? '#f14c4c' : '#7eb8f7',
                                                            cursor: 'text',
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            padding: '1px 0',
                                                        }}
                                                    >
                                                        {entry.displayName}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '3px 10px', color: isInvalid ? '#f14c4c' : '#b07040', whiteSpace: 'nowrap' }}>
                                                {entry.varType || '—'}
                                            </td>
                                            <td style={{ padding: '3px 10px' }}>
                                                <span style={{
                                                    color: isInvalid ? '#f14c4c' : hasVal ? '#4ec9b0' : '#3a3a3a',
                                                    fontWeight: hasVal && !isInvalid ? '700' : '400',
                                                }}>
                                                    {isInvalid ? '? invalid' : displayVal}
                                                </span>
                                            </td>
                                            <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                                <button
                                                    title="Write value"
                                                    disabled={!isRunning || !onForceWrite || isInvalid}
                                                    onClick={() => setForceModal({
                                                        liveKey: entry.liveKey,
                                                        displayName: entry.displayName,
                                                        varType: entry.varType,
                                                        currentValue: val,
                                                    })}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: isRunning && onForceWrite && !isInvalid ? '#4fc3f7' : '#333',
                                                        cursor: isRunning && onForceWrite && !isInvalid ? 'pointer' : 'default',
                                                        fontSize: 13,
                                                        padding: '1px 3px',
                                                        lineHeight: 1,
                                                    }}
                                                >✎</button>
                                            </td>
                                            <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                                <button
                                                    title="Remove from watch"
                                                    onClick={() => onWatchTableRemove && onWatchTableRemove(entry.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#8b2020',
                                                        cursor: 'pointer',
                                                        fontSize: 12,
                                                        padding: '1px 3px',
                                                        lineHeight: 1,
                                                    }}
                                                >✕</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Force Write Modal */}
            {forceModal && (
                <ForceWriteModal
                    isOpen={true}
                    onClose={() => setForceModal(null)}
                    varName={forceModal.displayName}
                    varType={forceModal.varType}
                    currentValue={forceModal.currentValue}
                    liveKey={forceModal.liveKey}
                    onConfirm={(key, val) => { onForceWrite && onForceWrite(key, val); setForceModal(null); }}
                />
            )}
        </div>
    );
};

export default OutputPanel;
