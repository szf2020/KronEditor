import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ask } from '@tauri-apps/plugin-dialog';
import { getBoardById } from '../utils/boardDefinitions';
import PlcIcon from '../assets/icons/plc-icon.png';

const EMPTY_IMG = new Image();
EMPTY_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Hover'da beliren "araya ekle" çizgisi
const InsertZone = ({ onInsert, onPaste, canPaste, disabled }) => {
    const [hovered, setHovered] = React.useState(false);
    if (disabled) return <div style={{ height: 3 }} />;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                height: hovered ? 20 : 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'height 0.1s ease',
                margin: '0 6px',
                gap: 4,
            }}
        >
            {hovered && (
                <>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#007acc', borderRadius: 1 }} />
                    <div
                        onClick={(e) => { e.stopPropagation(); onInsert(); }}
                        style={{ position: 'relative', zIndex: 1, width: 16, height: 16, background: '#007acc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 1 }}
                        title="Yeni ekle"
                    >+</div>
                    {canPaste && (
                        <div
                            onClick={(e) => { e.stopPropagation(); onPaste && onPaste(); }}
                            style={{ position: 'relative', zIndex: 1, width: 16, height: 16, background: '#4caf50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 'bold', lineHeight: 1, cursor: 'pointer' }}
                            title="Yapıştır"
                        >📋</div>
                    )}
                </>
            )}
        </div>
    );
};

const ProjectSidebar = ({ projectStructure, onSelectItem, activeId, onAddItem, onDeleteItem, onEditItem, onReorderItem, onPasteItem, onBoardClick, selectedBoard, isRunning = false }) => {
    const { t } = useTranslation();
    const [dragItem, setDragItem] = useState(null);
    const [dragEnabled, setDragEnabled] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const clipboardRef = useRef(null);
    const [clipboardCategory, setClipboardCategory] = useState(null);
    const [expanded, setExpanded] = useState({
        dataTypes: true,
        functionBlocks: true,
        functions: true,
        programs: true
    });

    const toggle = (key) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Copy currently active sidebar item
    const handleSidebarCopy = useCallback(() => {
        if (isRunning || !activeId) return;
        for (const cat of ['dataTypes', 'functions', 'functionBlocks', 'programs']) {
            const item = projectStructure[cat]?.find(i => i.id === activeId);
            if (item) {
                clipboardRef.current = { category: cat, payload: JSON.parse(JSON.stringify(item)) };
                setClipboardCategory(cat);
                return;
            }
        }
    }, [isRunning, activeId, projectStructure]);

    // Paste sidebar item at a specific index within a category
    const handleSidebarPaste = useCallback((targetCategory, insertIndex) => {
        if (isRunning || !clipboardRef.current) return;
        const clip = clipboardRef.current;
        if (clip.category !== targetCategory) return;
        const src = clip.payload;
        const ts = Date.now();
        const newItem = {
            ...src,
            id: `${targetCategory}_${ts}`,
            name: `${src.name}_copy`,
            content: JSON.parse(JSON.stringify(src.content || {})),
        };
        if (onPasteItem) onPasteItem(targetCategory, newItem, insertIndex);
    }, [isRunning, onPasteItem]);

    // Ctrl+C / Ctrl+V keyboard handler for sidebar
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only act when focus is NOT in an input/textarea
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key === 'c') {
                handleSidebarCopy();
            } else if (key === 'v') {
                // Paste at end of the same category
                if (!clipboardRef.current) return;
                const cat = clipboardRef.current.category;
                const len = projectStructure[cat]?.length || 0;
                handleSidebarPaste(cat, len);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSidebarCopy, handleSidebarPaste, projectStructure]);

    const renderSection = (title, key, items, allowTypes = []) => (
        <div style={{ marginBottom: 10 }}>
            {/* Header */}
            <div
                style={{
                    padding: '5px 10px',
                    background: '#2d2d2d',
                    color: '#ddd',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
                onClick={() => toggle(key)}
            >
                <span>{expanded[key] ? '▼' : '▶'} {t(`sidebar.${key}`)}</span>
            </div>

            {/* List */}
            {expanded[key] && (
                <div
                    style={{ paddingLeft: 0 }}
                    onDragLeave={(e) => {
                        // Only clear when leaving the container entirely (not moving between children)
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setDragOverIndex(null);
                        }
                    }}
                >
                    <InsertZone
                        key="insert-top"
                        onInsert={() => onAddItem(key, 0)}
                        onPaste={() => handleSidebarPaste(key, 0)}
                        canPaste={clipboardCategory === key}
                        disabled={isRunning || !!dragItem}
                    />
                    {items.map((item, index) => {
                        const isBeingDragged = dragItem && dragItem.category === key && item.id === dragItem.id;
                        // dragOverIndex is an "insert-before" slot (0..items.length)
                        const showLineAbove = dragItem && dragItem.category === key && dragOverIndex === index;

                        return (
                            <React.Fragment key={item.id}>
                                <div
                                    draggable={!isRunning && dragEnabled}
                                    onDragStart={(e) => {
                                        if (isRunning || !dragEnabled) {
                                            e.preventDefault();
                                            return;
                                        }
                                        const originalIndex = items.findIndex(i => i.id === item.id);
                                        setDragItem({ category: key, index: originalIndex, id: item.id });
                                        e.dataTransfer.setData('text/plain', item.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        if (e.dataTransfer.setDragImage) {
                                            e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
                                        }
                                    }}
                                    onDragEnd={() => {
                                        setDragItem(null);
                                        setDragEnabled(false);
                                        setDragOverIndex(null);
                                    }}
                                    onDragOver={(e) => {
                                        if (isRunning || !dragItem || dragItem.category !== key) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const insertIndex = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
                                        if (insertIndex !== dragOverIndex) setDragOverIndex(insertIndex);
                                    }}
                                    onDrop={(e) => {
                                        if (isRunning) return;
                                        e.preventDefault();
                                        if (!dragItem || dragItem.category !== key || dragOverIndex === null) {
                                            setDragItem(null);
                                            setDragOverIndex(null);
                                            return;
                                        }
                                        const src = dragItem.index;
                                        const dst = dragOverIndex;
                                        // No-op: dragging onto itself or adjacent slot
                                        if (dst !== src && dst !== src + 1) {
                                            // Convert insert-before index to splice destination (post-removal index)
                                            const spliceDst = dst > src ? dst - 1 : dst;
                                            onReorderItem(key, src, spliceDst);
                                        }
                                        setDragItem(null);
                                        setDragEnabled(false);
                                        setDragOverIndex(null);
                                    }}
                                    onClick={() => onSelectItem(key, item.id)}
                                    style={{
                                        padding: '6px 15px',
                                        cursor: 'pointer',
                                        background: activeId === item.id ? '#37373d' : 'transparent',
                                        borderLeft: activeId === item.id ? '3px solid #007acc' : '3px solid transparent',
                                        borderTop: showLineAbove ? '2px solid #007acc' : '2px solid transparent',
                                        color: activeId === item.id ? '#fff' : '#ccc',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        opacity: isBeingDragged ? 0.4 : 1,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {/* Drag Handle (2x3 dots) */}
                                        <div
                                            onMouseEnter={() => { if (!isRunning) setDragEnabled(true); }}
                                            onMouseLeave={() => setDragEnabled(false)}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(2, 2px)',
                                                gap: '2px',
                                                padding: '4px',
                                                cursor: isRunning ? 'not-allowed' : 'grab',
                                                opacity: isRunning ? 0.2 : 0.6
                                            }}
                                            title="Sürükleyip sırasını değiştirin"
                                        >
                                            {[...Array(6)].map((_, i) => (
                                                <div key={i} style={{ width: '2px', height: '2px', background: '#ccc', borderRadius: '50%' }} />
                                            ))}
                                        </div>
                                        <span>
                                            {item.type === 'ST' ? '📄' :
                                                item.type === 'LD' ? '🪜' :
                                                    item.type === 'Array' ? <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: '10px', background: '#0e639c', color: '#fff', padding: '2px 4px', borderRadius: '3px', border: '1px solid #1177bb' }}>[ ]</span> :
                                                        item.type === 'Enumerated' ? <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: '10px', background: '#68217a', color: '#fff', padding: '2px 4px', borderRadius: '3px', border: '1px solid #8e2fade' }}>(E)</span> :
                                                            item.type === 'Structure' ? <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: '10px', background: '#b87333', color: '#fff', padding: '2px 4px', borderRadius: '3px', border: '1px solid #d9873c' }}>{'{ }'}</span> :
                                                                '📦'}
                                        </span>
                                        <span>{item.name}</span>
                                        {key === 'programs' && item.cycleTime && <span style={{ fontSize: '10px', color: '#888', marginLeft: '4px' }}>[{item.cycleTime}]</span>}
                                        {item.type && <span style={{ fontSize: '9px', color: '#666', border: '1px solid #444', padding: '0 2px', borderRadius: 2 }}>{item.type}</span>}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {/* Copy Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isRunning) return;
                                                clipboardRef.current = { category: key, payload: JSON.parse(JSON.stringify(item)) };
                                                setClipboardCategory(key);
                                            }}
                                            disabled={isRunning}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#666',
                                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                opacity: isRunning ? 0.2 : activeId === item.id ? 1 : 0.5
                                            }}
                                            title="Kopyala"
                                        >
                                            📋
                                        </button>
                                        {/* Edit Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isRunning) onEditItem && onEditItem(key, item.id);
                                            }}
                                            disabled={isRunning}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#666',
                                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                opacity: isRunning ? 0.2 : activeId === item.id ? 1 : 0.5
                                            }}
                                            title={isRunning ? 'Simülasyon çalışırken düzenleme yapılamaz' : (t('actions.edit') || 'Edit')}
                                        >
                                            ✎
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (isRunning) return;
                                                const confirmed = await ask(t('messages.confirmDelete', { name: item.name }), {
                                                    title: t('common.delete') || 'Delete',
                                                    type: 'warning'
                                                });
                                                if (confirmed) {
                                                    onDeleteItem(key, item.id);
                                                }
                                            }}
                                            disabled={isRunning}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#666',
                                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                opacity: isRunning ? 0.2 : activeId === item.id ? 1 : 0.5
                                            }}
                                            title={isRunning ? 'Simülasyon çalışırken düzenleme yapılamaz' : t('common.delete')}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                {index < items.length - 1 && (
                                    <InsertZone
                                        onInsert={() => onAddItem(key, index + 1)}
                                        onPaste={() => handleSidebarPaste(key, index + 1)}
                                        canPaste={clipboardCategory === key}
                                        disabled={isRunning || !!dragItem}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                    {key !== 'resources' && !isRunning && (
                        <div
                            onClick={() => onAddItem(key, items.length)}
                            style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', cursor: 'pointer', opacity: 0.45 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                        >
                            <div style={{ width: 18, height: 18, background: '#007acc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>+</div>
                        </div>
                    )}
                    {/* Bottom drop zone: catches drags below all items */}
                    <div
                        style={{ minHeight: dragItem ? 16 : 0 }}
                        onDragOver={(e) => {
                            if (isRunning || !dragItem || dragItem.category !== key) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverIndex !== items.length) setDragOverIndex(items.length);
                        }}
                        onDrop={(e) => {
                            if (isRunning || !dragItem || dragItem.category !== key) return;
                            e.preventDefault();
                            const src = dragItem.index;
                            const dst = items.length;
                            if (dst !== src && dst !== src + 1) {
                                const spliceDst = dst > src ? dst - 1 : dst;
                                onReorderItem(key, src, spliceDst);
                            }
                            setDragItem(null);
                            setDragEnabled(false);
                            setDragOverIndex(null);
                        }}
                    >
                        {dragItem && dragItem.category === key && dragOverIndex === items.length && (
                            <div style={{ height: 2, background: '#007acc', margin: '0 15px', borderRadius: 1 }} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div style={{ height: '100%', overflowY: 'auto', background: '#252526', borderRight: '1px solid #333' }}>
            {/* Board Name Header */}
            <div
                onClick={onBoardClick}
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #333',
                    color: '#fff',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title={t('board.openBoardConfig')}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '14px' }}>🔧</span>
                    <span style={{ fontSize: '12px' }}>{selectedBoard ? (getBoardById(selectedBoard)?.name || selectedBoard) : 'PLC Project'}</span>
                </div>

            </div>

            {/* Resources (Single Item, Flattened) */}
            <div
                onClick={() => {
                    const configItem = projectStructure.resources[0];
                    if (configItem) {
                        onSelectItem('resources', configItem.id);
                    }
                }}
                style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #333',
                    background: activeId === (projectStructure.resources[0]?.id) ? '#37373d' : 'transparent',
                    color: activeId === (projectStructure.resources[0]?.id) ? '#fff' : '#ccc',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                }}
                title={t('resources.globalVariables')}
            >
                <span>⚙️</span>
                <span>{t('sidebar.global')}</span>
            </div>
            {renderSection('Data Types', 'dataTypes', projectStructure.dataTypes)}
            {renderSection('Functions', 'functions', projectStructure.functions)}
            {renderSection('Function Blocks', 'functionBlocks', projectStructure.functionBlocks)}
            {renderSection('Programs', 'programs', projectStructure.programs)}
        </div>
    );
};

export default ProjectSidebar;
