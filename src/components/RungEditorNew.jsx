import { useState, useCallback, useRef, useEffect } from 'react';
import RungContainer, { blockConfig } from './RungContainer';
import ErrorBoundary from './ErrorBoundary';
import BlockSettingsModal from './BlockSettingsModal';
import DraggableBlock from './DraggableBlock';
import DragDropManager from '../utils/DragDropManager';

const EMPTY_IMG = new Image();
EMPTY_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Hover'da beliren "araya ekle" çizgisi
const InsertZone = ({ onInsert, disabled }) => {
  const [hovered, setHovered] = useState(false);
  if (disabled) return <div style={{ height: 6 }} />;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onInsert}
      style={{
        height: hovered ? 24 : 6,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'height 0.1s ease',
        margin: '0 4px',
      }}
    >
      {hovered && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#007acc', borderRadius: 1 }} />
          <div style={{ position: 'relative', zIndex: 1, width: 18, height: 18, background: '#007acc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>+</div>
        </>
      )}
    </div>
  );
};

/**
 * YENİ LADDER EDITOR MİMARİ
 * - Rung'lar bir liste olarak düzenleniyor
 * - Her rung'ın kendi blokları ve bağlantıları var
 * - Rung hareket ederken, içindeki her şey beraber hareket ediyor
 */

const RungEditorNew = ({ variables, setVariables, rungs, setRungs, availableBlocks, globalVars = [], liveVariables = null, parentName = "", readOnly = false, onForceWrite = null }) => {

  // Undo/Redo history - her snapshot { rungs, variables } çiftini saklıyor
  const historyRef = useRef([{
    rungs: JSON.parse(JSON.stringify(rungs)),
    variables: JSON.parse(JSON.stringify(variables))
  }]);
  const historyIndexRef = useRef(0);
  const [historyStats, setHistoryStats] = useState({ canUndo: 0, canRedo: 0 });

  // Settings modal state
  const [editingBlock, setEditingBlock] = useState(null);

  // Rung selection & drag/drop
  const [focusedRungId, setFocusedRungId] = useState(null);
  const [draggedRungIndex, setDraggedRungIndex] = useState(null);
  const [dragOverRungIndex, setDragOverRungIndex] = useState(null);

  // History kaydet - hem rungs hem variables birlikte
  const saveHistory = useCallback((newRungs, newVariables) => {
    const sliced = historyRef.current.slice(0, historyIndexRef.current + 1);
    sliced.push({
      rungs: JSON.parse(JSON.stringify(newRungs)),
      variables: JSON.parse(JSON.stringify(newVariables))
    });
    if (sliced.length > 50) sliced.shift();
    historyRef.current = sliced;
    historyIndexRef.current = sliced.length - 1;
    setHistoryStats({ canUndo: historyIndexRef.current, canRedo: 0 });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const state = historyRef.current[historyIndexRef.current];
      setRungs(JSON.parse(JSON.stringify(state.rungs)));
      setVariables(JSON.parse(JSON.stringify(state.variables)));
      setHistoryStats({
        canUndo: historyIndexRef.current,
        canRedo: historyRef.current.length - 1 - historyIndexRef.current
      });
    }
  }, [setRungs, setVariables]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const state = historyRef.current[historyIndexRef.current];
      setRungs(JSON.parse(JSON.stringify(state.rungs)));
      setVariables(JSON.parse(JSON.stringify(state.variables)));
      setHistoryStats({
        canUndo: historyIndexRef.current,
        canRedo: historyRef.current.length - 1 - historyIndexRef.current
      });
    }
  }, [setRungs, setVariables]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Blok verisini güncelleme
  const updateBlockData = useCallback((rungId, blockId, newData) => {
    if (readOnly) return;

    // instanceName değiştiyse variables'ı da güncelle
    let newVariables = variables;
    if (newData.instanceName) {
      newVariables = variables.map(v => v.id === blockId ? { ...v, name: newData.instanceName } : v);
      setVariables(newVariables);
    }

    setRungs(prevRungs => {
      const newRungs = prevRungs.map(rung => {
        if (rung.id === rungId) {
          return {
            ...rung,
            blocks: rung.blocks.map(b =>
              b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b
            )
          };
        }
        return rung;
      });
      saveHistory(newRungs, newVariables);
      return newRungs;
    });
  }, [readOnly, variables, saveHistory, setVariables]);

  // Blok pozisyonunu güncelleme (history'e kaydedilmez - performans için)
  const updateBlockPosition = useCallback((rungId, blockId, position) => {
    if (readOnly) return;
    setRungs(prevRungs => prevRungs.map(rung => {
      if (rung.id === rungId) {
        return {
          ...rung,
          blocks: rung.blocks.map(b => b.id === blockId ? { ...b, position } : b)
        };
      }
      return rung;
    }));
  }, [readOnly]);

  // Blok çift tıklandığında ayarları aç
  const handleNodeDoubleClick = useCallback((_event, node, rungId) => {
    if (readOnly) return;
    setEditingBlock({
      rungId,
      id: node.id,
      type: node.data.type,
      ...node.data
    });
  }, [readOnly]);

  // Ayarları kaydet
  const handleSaveSettings = useCallback((blockId, newSettings) => {
    if (!editingBlock) return;
    updateBlockData(editingBlock.rungId, blockId, newSettings);
    setEditingBlock(null);
  }, [editingBlock, updateBlockData]);

  // Rung ekleme
  // targetId: hangi rung'un yanına eklenecek (null = sona ekle)
  // before: true ise önce, false ise sonra ekle
  const addRung = useCallback((targetId = null, before = false) => {
    if (readOnly) return;
    const newRung = {
      id: `rung_${Date.now()}_${Math.random()}`,
      label: '',
      blocks: [],
      connections: []
    };

    let newRungs = [...rungs];
    const resolvedId = targetId || focusedRungId;

    if (resolvedId) {
      const idx = newRungs.findIndex(r => r.id === resolvedId);
      if (idx !== -1) {
        newRungs.splice(before ? idx : idx + 1, 0, newRung);
      } else {
        newRungs.push(newRung);
      }
    } else {
      newRungs.push(newRung);
    }

    // Update labels sequentially
    newRungs = newRungs.map((r, i) => ({ ...r, label: String(i).padStart(3, '0') }));

    setRungs(newRungs);
    setFocusedRungId(newRung.id);
    saveHistory(newRungs, variables);
  }, [readOnly, rungs, variables, focusedRungId, saveHistory]);

  // Rung silme
  const deleteRung = useCallback((rungId) => {
    if (readOnly) return;
    const newRungs = rungs.filter(r => r.id !== rungId);
    setRungs(newRungs);
    saveHistory(newRungs, variables);
  }, [readOnly, rungs, variables, saveHistory]);

  // Rung'lar arasında taşıma (yukarı/aşağı)
  const moveRung = useCallback((rungId, direction) => {
    if (readOnly) return;
    const idx = rungs.findIndex(r => r.id === rungId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= rungs.length - 1) return;

    let newRungs = [...rungs];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newRungs[idx], newRungs[swapIdx]] = [newRungs[swapIdx], newRungs[idx]];

    // Update labels sequentially
    newRungs = newRungs.map((r, i) => ({ ...r, label: String(i).padStart(3, '0') }));

    setRungs(newRungs);
    saveHistory(newRungs, variables);
  }, [readOnly, rungs, variables, saveHistory]);

  const handleDragStart = (e, index) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    setDraggedRungIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `rung_${index}`);
    if (e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (readOnly || draggedRungIndex === null) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const insertIndex = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
    if (insertIndex !== dragOverRungIndex) setDragOverRungIndex(insertIndex);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const src = draggedRungIndex;
    const dst = dragOverRungIndex;
    setDraggedRungIndex(null);
    setDragOverRungIndex(null);
    if (readOnly || src === null || dst === null || dst === src || dst === src + 1) return;

    let newRungs = [...rungs];
    const [removed] = newRungs.splice(src, 1);
    const spliceDst = dst > src ? dst - 1 : dst;
    newRungs.splice(spliceDst, 0, removed);

    // Update labels sequentially
    newRungs = newRungs.map((r, i) => ({ ...r, label: String(i).padStart(3, '0') }));

    setRungs(newRungs);
    saveHistory(newRungs, variables);
  };

  const handleDragEnd = () => {
    setDraggedRungIndex(null);
    setDragOverRungIndex(null);
  };

  // HELPER: Blok ekle + history'ye hem rungs hem variables kaydet
  const insertBlock = useCallback((rungId, blockType, position, instanceName, customData, newVariables) => {
    const blockId = `block_${Date.now()}_${Math.random()}`;
    // For Contact/Coil, propagate subType from customData directly onto data
    // so RungContainer can render the correct symbol immediately on drop.
    const subTypeOverride = (blockType === 'Contact' || blockType === 'Coil')
      ? customData?.subType
      : undefined;

    const newBlock = {
      id: blockId,
      type: blockType,
      position: position,
      data: {
        label: blockType === 'UserDefined' ? customData?.name : blockType,
        instanceName: instanceName,
        customData: customData,
        ...(subTypeOverride ? { subType: subTypeOverride } : {})
      }
    };

    setRungs(prevRungs => {
      const newRungs = prevRungs.map(rung => {
        if (rung.id === rungId) {
          return { ...rung, blocks: [...rung.blocks, newBlock] };
        }
        return rung;
      });
      saveHistory(newRungs, newVariables);
      return newRungs;
    });
  }, [setRungs, saveHistory]);

  // Main Add Block Handler
  const addBlockToRung = useCallback((rungId, blockType, position, customData = null) => {
    if (!position || readOnly) return;

    // 1. CONTACT / COIL LOGIC
    if (blockType === 'Contact' || blockType === 'Coil') {
      const allVars = [
        ...variables.map(v => ({ ...v, scope: 'Local' })),
        ...globalVars.map(v => ({ ...v, scope: 'Global' }))
      ];
      const boolVars = allVars.filter(v => v.type === 'BOOL');

      // Case A: BOOL değişken yok -> otomatik oluştur
      if (boolVars.length === 0) {
        let index = 0;
        let newName = '';
        while (true) {
          const candidate = `Var${index}`;
          if (!allVars.some(v => v.name === candidate)) {
            newName = candidate;
            break;
          }
          index++;
          if (index > 1000) { console.error("Loop safety break"); break; }
        }

        const newVar = {
          id: `created_var_${Date.now()}`,
          name: newName,
          class: 'Local',
          type: 'BOOL',
          location: '',
          initialValue: '',
          description: ''
        };
        const newVariables = [...variables, newVar];
        setVariables(newVariables);
        insertBlock(rungId, blockType, position, newName, customData, newVariables);
      }
      // Case B: BOOL değişken var -> boş placeholder
      else {
        insertBlock(rungId, blockType, position, '', customData, variables);
      }
      return;
    }

    // 2. DİĞER BLOKLAR (Standard / UserDefined)
    let instanceName;
    let newVariables = variables;

    // Use predefined name pattern if available
    const dragData = typeof DragDropManager !== 'undefined' ? DragDropManager.getDragData() : null;
    const namePatternBase = dragData?.instanceNamePattern ? dragData.instanceNamePattern.replace(/[0-9]+$/, '') : null;

    if (customData) {
      if (customData.type === 'functions') {
        instanceName = customData.name;
        // Function blok instance oluşturmaz, variables değişmez
      } else {
        // Function Block Instance
        const baseName = namePatternBase || customData.name;
        let index = 0;

        while (true) {
          const candidateName = `${baseName}${index}`;
          if (!variables.some(v => v.name === candidateName) && !(globalVars || []).some(v => v.name === candidateName)) {
            instanceName = candidateName;
            break;
          }
          index++;
          if (index > 1000) { console.error("Loop safety break"); break; }
        }

        const newVar = {
          id: `fb_inst_${Date.now()}`,
          name: instanceName,
          class: 'Local',
          type: customData.name,
          location: '',
          initialValue: '',
          description: 'FB Instance'
        };
        newVariables = [...variables, newVar];
        setVariables(newVariables);
      }
    } else {
      // Standard Blocks (TON, CTU, etc.)
      const baseName = namePatternBase || blockType;
      let index = 0;

      while (true) {
        const candidate = `${baseName}${index}`;
        if (!variables.some(v => v.name === candidate) && !(globalVars || []).some(v => v.name === candidate)) {
          instanceName = candidate;
          break;
        }
        index++;
        if (index > 1000) { console.error("Loop safety break"); break; }
      }

      const newVar = {
        id: `std_inst_${Date.now()}`,
        name: instanceName,
        class: 'Local',
        type: blockType,
        location: '',
        initialValue: '',
        description: ''
      };
      newVariables = [...variables, newVar];
      setVariables(newVariables);
    }

    insertBlock(rungId, blockType, position, instanceName, customData, newVariables);
  }, [readOnly, variables, globalVars, insertBlock, setVariables]);

  // Rung'dan blok silme - variable da siliniyorsa history'ye yeni hali kaydet
  const deleteBlockFromRung = useCallback((rungId, blockId) => {
    if (readOnly) return;
    let blockToDelete = null;
    const newRungs = rungs.map(rung => {
      if (rung.id === rungId) {
        blockToDelete = rung.blocks.find(b => b.id === blockId);
        return {
          ...rung,
          blocks: rung.blocks.filter(b => b.id !== blockId),
          connections: rung.connections.filter(c => c.source !== blockId && c.target !== blockId)
        };
      }
      return rung;
    });
    setRungs(newRungs);

    // Silinen bloğun variable'ını da kaldır - yeni variables'ı senkron hesapla
    let newVariables = variables;
    if (blockToDelete?.data?.instanceName) {
      const instanceName = blockToDelete.data.instanceName;
      const isUsedElsewhere = newRungs.some(r =>
        r.blocks.some(b => b.data?.instanceName === instanceName)
      );
      if (!isUsedElsewhere) {
        newVariables = variables.filter(v => v.name !== instanceName);
        setVariables(newVariables);
      }
    }

    // Her iki yeni state'i birlikte history'ye kaydet
    saveHistory(newRungs, newVariables);
  }, [readOnly, rungs, variables, saveHistory, setVariables]);

  // Rung'a bağlantı ekleme
  const addConnectionToRung = useCallback((rungId, connection) => {
    if (readOnly) return;
    const newRungs = rungs.map(rung => {
      if (rung.id === rungId) {
        return {
          ...rung,
          connections: [...rung.connections, {
            id: `conn_${Date.now()}_${Math.random()}`,
            ...connection
          }]
        };
      }
      return rung;
    });
    setRungs(newRungs);
    saveHistory(newRungs, variables);
  }, [readOnly, rungs, variables, saveHistory]);

  // Rung'dan bağlantı silme
  const deleteConnectionFromRung = useCallback((rungId, connectionId) => {
    if (readOnly) return;
    const newRungs = rungs.map(rung => {
      if (rung.id === rungId) {
        return {
          ...rung,
          connections: rung.connections.filter(c => c.id !== connectionId)
        };
      }
      return rung;
    });
    setRungs(newRungs);
    saveHistory(newRungs, variables);
  }, [readOnly, rungs, variables, saveHistory]);

  // Helpers to Group Variables by Type
  const processVars = (vars, scope) => vars.map(v => ({ name: v.name, type: v.type, scope }));
  const allProccessedVars = [
    ...processVars(variables, 'Local'),
    ...processVars(globalVars || [], 'Global')
  ];

  const varsByType = allProccessedVars.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = [];
    acc[v.type].push(v);
    return acc;
  }, {});
  const uniqueTypes = Object.keys(varsByType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#1e1e1e' }}>

      {/* Type-Specific Datalists */}
      {uniqueTypes.map(type => (
        <datalist key={type} id={`ladder-vars-${type}`}>
          {[...new Map(varsByType[type].map(item => [item.name, item])).values()].map(v => (
            <option
              key={v.name}
              value={`${v.scope === 'Global' ? '🌍' : '🏠'} ${v.name}`}
            />
          ))}
        </datalist>
      ))}

      {/* Fallback 'ALL' Datalist (for ANY type) */}
      <datalist id="ladder-vars-ANY">
        {[...new Map(allProccessedVars.map(item => [item.name, item])).values()].map(v => (
          <option
            key={v.name}
            value={`${v.scope === 'Global' ? '🌍' : '🏠'} ${v.name}`}
          />
        ))}
      </datalist>

      {/* TOOLBAR */}
      <div style={{ background: readOnly ? '#1a1a1a' : '#252526', borderBottom: '1px solid #333', padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => addRung()}
          disabled={readOnly}
          style={{
            background: readOnly ? '#444' : '#2e7d32',
            color: readOnly ? '#888' : 'white',
            border: 'none',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: 4,
            cursor: readOnly ? 'default' : 'pointer',
            fontWeight: 'bold',
            marginRight: '10px',
            opacity: readOnly ? 0.5 : 1
          }}
        >
          + Rung
        </button>

        {/* Draggable Blocks */}
        <div style={{ display: 'flex', gap: '10px', paddingLeft: '10px', borderLeft: '1px solid #444', opacity: readOnly ? 0.4 : 1, pointerEvents: readOnly ? 'none' : 'auto' }}>
          <DraggableBlock
            type="Contact"
            label="Contact"
            style={{ width: '42px', height: '35px' }}
            icon={
              <svg width="11" height="11" viewBox="0 0 40 40" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="0" y1="20" x2="10" y2="20" />
                <line x1="10" y1="5" x2="10" y2="35" />
                <line x1="30" y1="5" x2="30" y2="35" />
                <line x1="30" y1="20" x2="40" y2="20" />
              </svg>
            }
          />
          <DraggableBlock
            type="Coil"
            label="Coil"
            style={{ width: '42px', height: '35px' }}
            icon={
              <svg width="11" height="11" viewBox="0 0 40 40" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="0" y1="20" x2="10" y2="20" />
                <path d="M15,5 Q5,20 15,35" />
                <path d="M25,5 Q35,20 25,35" />
                <line x1="30" y1="20" x2="40" y2="20" />
              </svg>
            }
          />
        </div>

        <div style={{ color: '#888', fontSize: 11, display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span title="Ctrl+Z">
            ↩ {historyStats.canUndo > 0
              ? <span style={{ color: '#90caf9', fontWeight: 'bold' }}>{historyStats.canUndo}</span>
              : <span style={{ opacity: 0.4 }}>0</span>}
          </span>
          <span title="Ctrl+Shift+Z">
            ↪ {historyStats.canRedo > 0
              ? <span style={{ color: '#90caf9', fontWeight: 'bold' }}>{historyStats.canRedo}</span>
              : <span style={{ opacity: 0.4 }}>0</span>}
          </span>
          <span style={{ opacity: 0.4 }}>Ctrl+Z / Ctrl+Shift+Z</span>
        </div>
      </div>

      {/* RUNGS AREA */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#1e1e1e', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <InsertZone onInsert={() => addRung(rungs[0]?.id, true)} disabled={readOnly || draggedRungIndex !== null} />
          {rungs.map((rung, index) => (
            <div key={rung.id}>
              {/* Drag drop indicator above */}
              {draggedRungIndex !== null && dragOverRungIndex === index && (
                <div style={{ height: 3, background: '#007acc', borderRadius: 2, margin: '0 4px' }} />
              )}
            <div
              draggable={!readOnly}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              style={{
                opacity: draggedRungIndex === index ? 0.4 : 1,
                border: focusedRungId === rung.id ? '1px solid #007acc' : '1px solid transparent',
                borderRadius: '4px',
                transition: 'border 0.2s',
              }}
              onClick={() => {
                if (!readOnly) setFocusedRungId(rung.id);
              }}
            >
              <ErrorBoundary>
                <RungContainer
                  rung={rung}
                  index={index}
                  totalRungs={rungs.length}
                  isFocused={focusedRungId === rung.id}
                  onDelete={() => deleteRung(rung.id)}
                  onMoveUp={() => moveRung(rung.id, 'up')}
                  onMoveDown={() => moveRung(rung.id, 'down')}
                  onAddBlock={(blockType, position, customData) => addBlockToRung(rung.id, blockType, position, customData)}
                  onDeleteBlock={(blockId) => deleteBlockFromRung(rung.id, blockId)}
                  onAddConnection={(connection) => addConnectionToRung(rung.id, connection)}
                  onDeleteConnection={(connectionId) => deleteConnectionFromRung(rung.id, connectionId)}
                  onUpdateBlock={(blockId, newData) => updateBlockData(rung.id, blockId, newData)}
                  onUpdateBlockPosition={(blockId, position) => updateBlockPosition(rung.id, blockId, position)}
                  onNodeDoubleClick={(e, node) => handleNodeDoubleClick(e, node, rung.id)}
                  availableBlocks={availableBlocks}
                  variables={variables}
                  globalVars={globalVars}
                  liveVariables={liveVariables}
                  parentName={parentName}
                  readOnly={readOnly}
                  onForceWrite={onForceWrite}
                />
              </ErrorBoundary>
            </div>
              <InsertZone onInsert={() => addRung(rung.id, false)} disabled={readOnly || draggedRungIndex !== null} />
            </div>
          ))}
          {/* Drag drop indicator after last rung */}
          {draggedRungIndex !== null && dragOverRungIndex === rungs.length && (
            <div style={{ height: 3, background: '#007acc', borderRadius: 2, margin: '0 4px' }} />
          )}
          {rungs.length === 0 && (
            <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              Rung eklemek için yukarıdaki butona tıklayın
            </div>
          )}
          {/* Bottom drop zone: catches drags below all rungs */}
          <div
            style={{ flex: 1, minHeight: 40 }}
            onDragOver={(e) => {
              if (readOnly || draggedRungIndex === null) return;
              e.preventDefault();
              e.stopPropagation();
              if (dragOverRungIndex !== rungs.length) setDragOverRungIndex(rungs.length);
            }}
            onDrop={handleDrop}
          />
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <BlockSettingsModal
        isOpen={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        blockData={editingBlock}
        onSave={handleSaveSettings}
        blockConfig={blockConfig}
        variables={variables}
        globalVars={globalVars}
      />
    </div>
  );
};

export default RungEditorNew;
