import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ask } from '@tauri-apps/plugin-dialog';
import PlcIcon from '../assets/icons/plc-icon.png';

const EMPTY_IMG = new Image();
EMPTY_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Hover'da beliren "araya ekle" çizgisi
const InsertZone = ({ onInsert, disabled }) => {
    const [hovered, setHovered] = React.useState(false);
    if (disabled) return <div style={{ height: 3 }} />;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => { e.stopPropagation(); onInsert(); }}
            style={{
                height: hovered ? 20 : 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'height 0.1s ease',
                margin: '0 6px',
            }}
        >
            {hovered && (
                <>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#007acc', borderRadius: 1 }} />
                    <div style={{ position: 'relative', zIndex: 1, width: 16, height: 16, background: '#007acc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 1 }}>+</div>
                </>
            )}
        </div>
    );
};

const ProjectSidebar = ({ projectStructure, onSelectItem, activeId, onAddItem, onDeleteItem, onEditItem, onReorderItem, onSettingsClick, onShortcutsClick, isRunning = false }) => {
    const { t } = useTranslation();
    const [dragItem, setDragItem] = useState(null);
    const [dragEnabled, setDragEnabled] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [expanded, setExpanded] = useState({
        dataTypes: true,
        functionBlocks: true,
        functions: true,
        programs: true
    });

    const toggle = (key) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

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
                {key !== 'resources' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isRunning) onAddItem(key);
                        }}
                        disabled={isRunning}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: isRunning ? '#666' : '#fff',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            padding: '0 4px',
                            opacity: isRunning ? 0.4 : 1
                        }}
                        title={isRunning ? 'Simülasyon çalışırken düzenleme yapılamaz' : t('actions.addNew')}
                    >
                        +
                    </button>
                )}
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
                                <InsertZone
                                    onInsert={() => onAddItem(key, index + 1)}
                                    disabled={isRunning || !!dragItem}
                                />
                                </React.Fragment>
                            );
                        })}
                    {items.length === 0 && (
                        <div style={{ padding: '5px 15px', color: '#666', fontSize: '11px', fontStyle: 'italic' }}>
                            {t('messages.empty')}
                        </div>
                    )}
                    {/* Bottom drop zone: catches drags below all items */}
                    <div
                        style={{ minHeight: 16 }}
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
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #333',
                    color: '#fff',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <span>PLC Project</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <span
                        onClick={onShortcutsClick}
                        style={{ fontSize: '16px', color: '#ccc', cursor: 'pointer' }}
                        title={t('common.shortcuts') || 'Shortcuts'}
                    >
                        ℹ️
                    </span>
                    <span
                        onClick={onSettingsClick}
                        style={{ fontSize: '16px', color: '#ccc', cursor: 'pointer' }}
                        title={t('common.settings')}
                    >
                        ⚙️
                    </span>
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
