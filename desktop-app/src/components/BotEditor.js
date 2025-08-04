import React, { useState, useEffect } from 'react';

const BotEditor = ({ bot, onSave, onBack }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [files, setFiles] = useState([]);
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [fileContents, setFileContents] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadBotFiles();
    }, [bot]);

    const loadBotFiles = async () => {
        try {
            let botFiles = [];

            // Yerel dosyaları varsa onları kullan
            if (bot.localFiles && bot.localFiles.length > 0) {
                botFiles = bot.localFiles;
            } else if (bot.localPath) {
                // Yerel klasörü tara
                const scannedFiles = await window.electronAPI.scanBots();
                const currentBot = scannedFiles.find(b => b.name === bot.name);
                if (currentBot) {
                    botFiles = currentBot.files;
                }
            }

            setFiles(botFiles);

            // Ana dosyayı otomatik aç
            if (botFiles.length > 0) {
                const mainFile = botFiles.find(f => 
                    f.name === bot.main_file || 
                    f.name.includes('index') || 
                    f.name.includes('main')
                ) || botFiles[0];

                openFileInTab(mainFile);
            }
        } catch (error) {
            console.error('Dosya yükleme hatası:', error);
        }
    };

    const openFileInTab = async (file) => {
        try {
            // Dosya içeriğini yükle
            let content = file.content;
            if (!content && file.path) {
                content = await window.electronAPI.readFile(file.path);
            }

            // Tab'ı aç
            if (!openTabs.find(tab => tab.name === file.name)) {
                setOpenTabs(prev => [...prev, file]);
            }

            setFileContents(prev => ({
                ...prev,
                [file.name]: content || ''
            }));

            setActiveTab(file.name);
            setSelectedFile(file);
        } catch (error) {
            console.error('Dosya açma hatası:', error);
        }
    };

    const closeTab = (fileName) => {
        setOpenTabs(prev => prev.filter(tab => tab.name !== fileName));
        
        if (activeTab === fileName) {
            const remainingTabs = openTabs.filter(tab => tab.name !== fileName);
            if (remainingTabs.length > 0) {
                setActiveTab(remainingTabs[0].name);
                setSelectedFile(remainingTabs[0]);
            } else {
                setActiveTab(null);
                setSelectedFile(null);
            }
        }

        // İçeriği temizle
        setFileContents(prev => {
            const updated = { ...prev };
            delete updated[fileName];
            return updated;
        });
    };

    const handleContentChange = (content) => {
        if (activeTab) {
            setFileContents(prev => ({
                ...prev,
                [activeTab]: content
            }));
            setHasChanges(true);
        }
    };

    const saveFiles = async () => {
        try {
            setSaving(true);

            const filesToSave = Object.keys(fileContents).map(fileName => {
                const file = files.find(f => f.name === fileName);
                return {
                    name: fileName,
                    path: file?.relativePath || fileName,
                    content: fileContents[fileName]
                };
            });

            // Sunucuya kaydet
            if (bot.id) {
                await onSave(bot.id, filesToSave);
            }

            // Yerel dosyaları kaydet
            if (bot.localPath) {
                for (const file of filesToSave) {
                    const filePath = `${bot.localPath}/${file.name}`;
                    await window.electronAPI.writeFile(filePath, file.content);
                }
            }

            setHasChanges(false);
            alert('Dosyalar başarıyla kaydedildi!');
        } catch (error) {
            console.error('Kaydetme hatası:', error);
            alert('Kaydetme hatası: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const validateCode = () => {
        if (!activeTab || !fileContents[activeTab]) {
            alert('Doğrulanacak kod bulunamadı');
            return;
        }

        const content = fileContents[activeTab];
        
        // Basit JavaScript syntax kontrolü
        try {
            // Eğer JavaScript dosyası ise
            if (activeTab.endsWith('.js')) {
                // eslint-disable-next-line no-new-func
                new Function(content);
                alert('Kod syntax açısından geçerli görünüyor!');
            } else {
                alert('Bu dosya tipi için syntax kontrolü desteklenmiyor');
            }
        } catch (error) {
            alert('Syntax hatası bulundu:\n' + error.message);
        }
    };

    const formatCode = () => {
        if (!activeTab || !fileContents[activeTab]) return;

        const content = fileContents[activeTab];
        
        // Basit kod formatlama (daha gelişmiş bir formatter kullanılabilir)
        if (activeTab.endsWith('.js')) {
            try {
                // Basit indentasyon düzeltmesi
                const lines = content.split('\n');
                let indent = 0;
                const formatted = lines.map(line => {
                    const trimmed = line.trim();
                    
                    if (trimmed.includes('}')) indent = Math.max(0, indent - 1);
                    const formattedLine = '  '.repeat(indent) + trimmed;
                    if (trimmed.includes('{')) indent++;
                    
                    return formattedLine;
                }).join('\n');

                handleContentChange(formatted);
            } catch (error) {
                console.error('Formatlama hatası:', error);
            }
        }
    };

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        switch (ext) {
            case 'js': return '📄';
            case 'json': return '📋';
            case 'md': return '📝';
            case 'txt': return '📄';
            default: return '📄';
        }
    };

    return (
        <div className="editor-container">
            <div className="editor-header">
                <div>
                    <button className="btn btn-secondary" onClick={onBack}>
                        ← Geri
                    </button>
                    <h2 style={{ display: 'inline-block', marginLeft: '20px' }}>
                        {bot.name} - Bot Editörü
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={validateCode}
                        disabled={!activeTab}
                    >
                        Kodu Doğrula
                    </button>
                    <button 
                        className="btn btn-secondary" 
                        onClick={formatCode}
                        disabled={!activeTab}
                    >
                        Formatla
                    </button>
                    <button 
                        className="btn btn-success" 
                        onClick={saveFiles}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? (
                            <>
                                <span className="loading-spinner"></span>
                                Kaydediliyor...
                            </>
                        ) : (
                            'Kaydet'
                        )}
                    </button>
                </div>
            </div>

            <div className="editor-content">
                <div className="file-explorer">
                    <div className="file-explorer-header">
                        Dosyalar ({files.length})
                    </div>
                    <ul className="file-list">
                        {files.map((file, index) => (
                            <li
                                key={index}
                                className={`file-item ${selectedFile?.name === file.name ? 'active' : ''}`}
                                onClick={() => openFileInTab(file)}
                            >
                                {getFileIcon(file.name)} {file.name}
                                {file.size && (
                                    <small style={{ display: 'block', color: '#666' }}>
                                        {(file.size / 1024).toFixed(1)} KB
                                    </small>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="code-editor">
                    {openTabs.length > 0 && (
                        <div className="editor-tabs">
                            {openTabs.map((tab) => (
                                <div key={tab.name} style={{ display: 'flex' }}>
                                    <button
                                        className={`editor-tab ${activeTab === tab.name ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveTab(tab.name);
                                            setSelectedFile(tab);
                                        }}
                                    >
                                        {getFileIcon(tab.name)} {tab.name}
                                        {fileContents[tab.name] !== (tab.content || '') && ' *'}
                                    </button>
                                    <button
                                        style={{
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            padding: '0 5px',
                                            fontSize: '12px'
                                        }}
                                        onClick={() => closeTab(tab.name)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab ? (
                        <textarea
                            className="code-textarea"
                            value={fileContents[activeTab] || ''}
                            onChange={(e) => handleContentChange(e.target.value)}
                            placeholder="Kod buraya yazın..."
                            spellCheck={false}
                        />
                    ) : (
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            flex: 1,
                            color: '#666'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <h3>Dosya seçin</h3>
                                <p>Düzenlemek için sol panelden bir dosya seçin</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {hasChanges && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    background: '#f39c12',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    fontSize: '14px'
                }}>
                    Kaydedilmemiş değişiklikler var
                </div>
            )}
        </div>
    );
};

export default BotEditor;