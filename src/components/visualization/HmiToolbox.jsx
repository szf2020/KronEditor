import { useState } from 'react';
import { COMPONENT_CATEGORIES, COMPONENT_DEFS } from './hmiComponentDefs';

const HmiToolbox = () => {
    const [expanded, setExpanded] = useState({ indicators: true, controls: true, display: false });

    const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const handleDragStart = (e, type) => {
        e.dataTransfer.setData('hmiComponentType', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: '#161616',
            borderRight: '1px solid #2a2a2a',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
        }}>
            <div style={{
                padding: '8px 10px 6px',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#555',
                borderBottom: '1px solid #222',
                flexShrink: 0,
            }}>
                Components
            </div>

            {COMPONENT_CATEGORIES.map(cat => (
                <div key={cat.key}>
                    {/* Category header */}
                    <div
                        onClick={() => toggle(cat.key)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 10px',
                            cursor: 'pointer',
                            background: '#1a1a1a',
                            borderBottom: '1px solid #222',
                            fontSize: 10,
                            fontWeight: '600',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#666',
                        }}
                    >
                        <span style={{ fontSize: 8, color: '#444' }}>{expanded[cat.key] ? '▼' : '▶'}</span>
                        {cat.label}
                    </div>

                    {/* Component items */}
                    {expanded[cat.key] && (
                        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {cat.components.map(type => {
                                const def = COMPONENT_DEFS[type];
                                if (!def) return null;
                                return (
                                    <div
                                        key={type}
                                        draggable
                                        onDragStart={e => handleDragStart(e, type)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 8px',
                                            borderRadius: 2,
                                            cursor: 'grab',
                                            background: 'transparent',
                                            border: '1px solid transparent',
                                            transition: 'background 0.1s, border-color 0.1s',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = '#232323';
                                            e.currentTarget.style.borderColor = '#333';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.borderColor = 'transparent';
                                        }}
                                    >
                                        <span style={{
                                            width: 22, height: 22,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: '#252525',
                                            border: '1px solid #333',
                                            borderRadius: 2,
                                            fontSize: 11,
                                            color: '#888',
                                            flexShrink: 0,
                                        }}>
                                            {def.icon}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#bbb', fontWeight: '400' }}>
                                            {def.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default HmiToolbox;
