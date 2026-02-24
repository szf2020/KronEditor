import React from 'react';
import { useTranslation } from 'react-i18next';
import PlcIcon from '../assets/icons/plc-icon.png';

const StartScreen = ({ onNewProject, onOpenProject }) => {
    const { t } = useTranslation();

    return (
        <div style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            background: '#1e1e1e',
            color: '#fff',
            userSelect: 'none',
            textAlign: 'center',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', width: '100%' }}>
                <img src={PlcIcon} alt="PLC Logo" style={{ width: '450px', opacity: 0.9, display: 'block', margin: '0 auto' }} />
            </div>

            <p style={{ color: '#888', marginBottom: '40px', fontSize: '18px', maxWidth: '600px', lineHeight: '1.5' }}>
                {t('messages.startScreenDesc') || 'A modern web-based PLC programming environment'}
            </p>

            <div style={{ display: 'flex', gap: '20px' }}>
                <button
                    onClick={onNewProject}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        background: '#0d47a1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#1565c0'}
                    onMouseOut={(e) => e.target.style.background = '#0d47a1'}
                >
                    <span style={{ fontSize: '20px' }}>+</span>
                    {t('common.newProject') || 'New Project'}
                </button>

                <button
                    onClick={onOpenProject}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        background: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s, borderColor 0.2s',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                    onMouseOver={(e) => {
                        e.target.style.background = '#444';
                        e.target.style.borderColor = '#777';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.background = '#333';
                        e.target.style.borderColor = '#555';
                    }}
                >
                    <span style={{ fontSize: '18px' }}>📂</span>
                    {t('common.openProject') || 'Open Project'}
                </button>
            </div>
        </div>
    );
};

export default StartScreen;
