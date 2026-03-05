import React, { useState, useMemo } from 'react';
import { PLC_BLOCKS } from '../utils/plcStandards';
import { LIBRARY_TREE } from '../utils/libraryTree';
import DragDropManager from '../utils/DragDropManager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_IMG = new Image();
EMPTY_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const generateSTSnippet = (blockType, customData) => {
  if (customData) {
    const inputs = customData.inputs || [];
    const instanceName = `${blockType}0`;
    if (customData.type === 'functionBlocks' || customData.class === 'FunctionBlock' || !customData.returnType) {
      const params = inputs.map(input => `  ${input.name} := ${input.default || ''},`).join('\n');
      return `${instanceName}(\n${params}\n);`;
    }
  }
  const blockConfig = PLC_BLOCKS[blockType];
  if (blockConfig) {
    const inputs = blockConfig.inputs || [];
    const instanceName = `${blockType}0`;
    const params = inputs.map(input => `  ${input.name} := ...`).join(',\n');
    return `${instanceName}(\n${params}\n);`;
  }
  return `${blockType}(...);`;
};

/** Build a flat lookup map blockType → library block data from all XML-loaded categories */
const buildBlockMap = (libraryData) => {
  const map = {};
  for (const cat of libraryData) {
    // Support both flat blocks and subcategory blocks
    const blocks = cat.blocks || [];
    for (const block of blocks) {
      if (block.blockType) map[block.blockType] = block;
    }
  }
  return map;
};

// ─── ToolboxItem ──────────────────────────────────────────────────────────────

const ToolboxItem = ({ blockType, subType, label, desc, color, customData }) => {
  const onDragStart = (event) => {
    const isContactOrCoil = blockType === 'Contact' || blockType === 'Coil';
    const nodeType = 'blockNode';

    event.dataTransfer.setData('application/reactflow', nodeType);
    if (blockType) event.dataTransfer.setData('blockType', blockType);
    event.dataTransfer.setData('label', label);
    if (customData) event.dataTransfer.setData('customData', JSON.stringify(customData));
    event.dataTransfer.effectAllowed = 'copyMove';

    if (blockType && !isContactOrCoil) {
      const data = customData || (PLC_BLOCKS[blockType] ? {} : null);
      if (data) {
        stSnippet = generateSTSnippet(blockType, data);
        event.dataTransfer.setData('stSnippet', stSnippet);
      }
    }

    // Pass the standard instance name format
    let instanceNameLabel = `${blockType}0`;

    DragDropManager.setDragData({
      type: nodeType,
      blockType,
      label,
      customData,
      stSnippet,
      instanceNamePattern: instanceNameLabel
    });

    if (event.dataTransfer.setDragImage) {
      event.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
    }
  };

  const onDragEnd = () => DragDropManager.clear();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        padding: '6px 10px',
        margin: '3px 0 3px 0',
        background: color,
        color: '#fff',
        borderRadius: '4px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.1)',
        userSelect: 'none'
      }}
    >
      <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{label}</span>
      {desc && <span style={{ fontSize: '10px', opacity: 0.75, marginTop: 1 }}>{desc}</span>}
    </div>
  );
};

// ─── Toolbox ──────────────────────────────────────────────────────────────────

const CAT_COLOR = '#673ab7';   // standard FB / library blocks
const UD_COLOR = '#007acc';   // user-defined
const CONTACT_COLOR = '#1a6b3a'; // contacts (green)
const COIL_COLOR = '#8b3a0f'; // coils (brown-red)

const Toolbox = ({ userDefinedBlocks = [], libraryData = [], activeFileType }) => {
  // expand state: category-level and subcategory-level
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});

  const blockMap = useMemo(() => buildBlockMap(libraryData), [libraryData]);

  const toggleCat = (id) => setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSub = (id) => setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));

  /** Resolve a subcategory's items into ToolboxItem props */
  const resolveItems = (sub) => {
    if (sub.items) {
      return sub.items.map(item => {
        const isCC = item.blockType === 'Contact' || item.blockType === 'Coil';
        return {
          blockType: item.blockType,
          subType: item.subType,
          label: item.label,
          desc: item.desc,
          customData: isCC ? { subType: item.subType } : (item.customData || null),
          color: item.blockType === 'Contact' ? CONTACT_COLOR
            : item.blockType === 'Coil' ? COIL_COLOR
              : CAT_COLOR
        };
      });
    }

    if (sub.fromLibrary) {
      return sub.fromLibrary
        .map(bType => {
          const lib = blockMap[bType];
          if (!lib) return null;
          return {
            blockType: lib.blockType,
            label: lib.label,
            desc: lib.desc,
            customData: { inputs: lib.inputs, outputs: lib.outputs, class: lib.class },
            color: CAT_COLOR
          };
        })
        .filter(Boolean);
    }

    return [];
  };

  if (libraryData.length === 0) {
    return (
      <div style={{ padding: '15px', color: '#888', fontSize: '12px' }}>
        Loading library…
      </div>
    );
  }

  return (
    <div style={{ padding: '0 10px', height: '100%', overflowY: 'auto' }}>

      {/* ── Standard tree from LIBRARY_TREE ── */}
      {LIBRARY_TREE.map(cat => (
        <div key={cat.id} style={{ marginBottom: 6 }}>

          {/* Category header */}
          <div
            onClick={() => toggleCat(cat.id)}
            style={{
              padding: '8px 4px',
              color: '#ccc',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid #3e3e42',
              marginBottom: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span style={{ marginRight: 6, fontSize: 9, opacity: 0.7 }}>
              {expandedCats[cat.id] ? '▼' : '▶'}
            </span>
            {cat.title}
          </div>

          {expandedCats[cat.id] && (
            <div style={{ paddingLeft: 6 }}>
              {cat.subcategories.map(sub => {
                const items = resolveItems(sub);
                if (items.length === 0) return null;

                return (
                  <div key={sub.id} style={{ marginBottom: 4 }}>

                    {/* Subcategory header */}
                    <div
                      onClick={() => toggleSub(sub.id)}
                      style={{
                        padding: '5px 4px',
                        color: '#aaa',
                        fontSize: '10px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        borderLeft: '2px solid #555',
                        paddingLeft: 8,
                        marginBottom: 3,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        userSelect: 'none'
                      }}
                    >
                      <span style={{ marginRight: 5, fontSize: 8, opacity: 0.7 }}>
                        {expandedSubs[sub.id] ? '▼' : '▶'}
                      </span>
                      {sub.title}
                      <span style={{ marginLeft: 'auto', opacity: 0.45, fontSize: 9 }}>
                        {items.length}
                      </span>
                    </div>

                    {expandedSubs[sub.id] && (
                      <div style={{ paddingLeft: 10 }}>
                        {items.map((item, idx) => (
                          <ToolboxItem key={idx} {...item} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* ── User-Defined blocks (flat, no subcategories) ── */}
      {userDefinedBlocks && userDefinedBlocks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div
            onClick={() => toggleCat('user_defined')}
            style={{
              padding: '8px 4px',
              color: '#ccc',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              borderBottom: '1px solid #3e3e42',
              marginBottom: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span style={{ marginRight: 6, fontSize: 9, opacity: 0.7 }}>
              {expandedCats['user_defined'] ? '▼' : '▶'}
            </span>
            User Defined
          </div>

          {expandedCats['user_defined'] && (
            <div style={{ paddingLeft: 6 }}>
              {userDefinedBlocks.map((b, idx) => (
                <ToolboxItem
                  key={idx}
                  blockType={b.name}
                  label={b.name}
                  desc={b.type === 'functionBlocks' ? 'Block' : 'Function'}
                  customData={{ ...b }}
                  color={UD_COLOR}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Toolbox;
