import React, { useState, useEffect } from 'react';

const Settings = ({ settings, onSettingsChange, onBack }) => {
    const [formData, setFormData] = useState({
        apiUrl: 'http://localhost:3001',
        botDirectory: '',
        raspberryPi: {
            host: '',
            username: 'pi',
            password: '',
            port: 22,
            enabled: false
        },
        notifications: {
            enabled: true,
            sound: true,
            desktop: true
        },
        editor: {
            theme: 'light',
            fontSize: 14,
            tabSize: 2,
            wordWrap: true
        },
        autoSync: {
            enabled: false,
            interval: 300 // 5 dakika
        }
    });

    const [testingConnection, setTestingConnection] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedSettings = await window.electronAPI.getStoreValue('settings') || {};
            const botDirectory = await window.electronAPI.getStoreValue('botDirectory') || '';
            const raspberryConfig = await window.electronAPI.getStoreValue('raspberryConfig') || {};

            setFormData(prev => ({
                ...prev,
                ...savedSettings,
                botDirectory,
                raspberryPi: {
                    ...prev.raspberryPi,
                    ...raspberryConfig
                }
            }));
        } catch (error) {
            console.error('Ayar yükleme hatası:', error);
        }
    };

    const saveSettings = async () => {
        try {
            await window.electronAPI.setStoreValue('settings', formData);
            await window.electronAPI.setStoreValue('botDirectory', formData.botDirectory);
            await window.electronAPI.setStoreValue('raspberryConfig', formData.raspberryPi);

            onSettingsChange(formData);
            alert('Ayarlar başarıyla kaydedildi!');
        } catch (error) {
            console.error('Ayar kaydetme hatası:', error);
            alert('Ayar kaydetme hatası: ' + error.message);
        }
    };

    const selectBotDirectory = async () => {
        try {
            const directory = await window.electronAPI.selectDirectory();
            if (directory) {
                setFormData(prev => ({
                    ...prev,
                    botDirectory: directory
                }));
            }
        } catch (error) {
            console.error('Klasör seçme hatası:', error);
        }
    };

    const testRaspberryConnection = async () => {
        try {
            setTestingConnection(true);
            const result = await window.electronAPI.testRaspberryConnection(formData.raspberryPi);
            
            if (result.success) {
                alert('Bağlantı başarılı!');
            } else {
                alert('Bağlantı hatası: ' + result.message);
            }
        } catch (error) {
            console.error('Bağlantı testi hatası:', error);
            alert('Bağlantı testi hatası: ' + error.message);
        } finally {
            setTestingConnection(false);
        }
    };

    const handleInputChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleDirectChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="bot-list-container">
            <div className="bot-list-header">
                <div>
                    <button className="btn btn-secondary" onClick={onBack}>
                        ← Geri
                    </button>
                    <h2 style={{ display: 'inline-block', marginLeft: '20px' }}>
                        Ayarlar
                    </h2>
                </div>
                <div className="bot-list-actions">
                    <button className="btn btn-primary" onClick={saveSettings}>
                        Kaydet
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Genel Ayarlar */}
                <div className="settings-section">
                    <h3>Genel Ayarlar</h3>
                    <div className="form-group">
                        <label className="form-label">API URL</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.apiUrl}
                            onChange={(e) => handleDirectChange('apiUrl', e.target.value)}
                            placeholder="http://localhost:3001"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Bot Klasörü</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.botDirectory}
                                onChange={(e) => handleDirectChange('botDirectory', e.target.value)}
                                placeholder="Bot klasörü yolu..."
                                style={{ flex: 1 }}
                            />
                            <button 
                                type="button"
                                className="btn btn-secondary"
                                onClick={selectBotDirectory}
                            >
                                Seç
                            </button>
                        </div>
                    </div>
                </div>

                {/* Raspberry Pi Ayarları */}
                <div className="settings-section">
                    <h3>Raspberry Pi Bağlantısı</h3>
                    
                    <div className="form-group">
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.raspberryPi.enabled}
                                onChange={(e) => handleInputChange('raspberryPi', 'enabled', e.target.checked)}
                            />
                            Raspberry Pi bağlantısını etkinleştir
                        </label>
                    </div>

                    {formData.raspberryPi.enabled && (
                        <>
                            <div className="form-group">
                                <label className="form-label">IP Adresi / Hostname</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.raspberryPi.host}
                                    onChange={(e) => handleInputChange('raspberryPi', 'host', e.target.value)}
                                    placeholder="192.168.1.100"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.raspberryPi.username}
                                    onChange={(e) => handleInputChange('raspberryPi', 'username', e.target.value)}
                                    placeholder="pi"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Şifre</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={formData.raspberryPi.password}
                                    onChange={(e) => handleInputChange('raspberryPi', 'password', e.target.value)}
                                    placeholder="Raspberry Pi şifresi"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Port</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.raspberryPi.port}
                                    onChange={(e) => handleInputChange('raspberryPi', 'port', parseInt(e.target.value))}
                                    placeholder="22"
                                />
                            </div>

                            <div className="form-group">
                                <button 
                                    className="btn btn-primary"
                                    onClick={testRaspberryConnection}
                                    disabled={testingConnection || !formData.raspberryPi.host}
                                >
                                    {testingConnection ? (
                                        <>
                                            <span className="loading-spinner"></span>
                                            Test ediliyor...
                                        </>
                                    ) : (
                                        'Bağlantıyı Test Et'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Bildirim Ayarları */}
                <div className="settings-section">
                    <h3>Bildirim Ayarları</h3>
                    
                    <div className="checkbox-group">
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.notifications.enabled}
                                onChange={(e) => handleInputChange('notifications', 'enabled', e.target.checked)}
                            />
                            Bildirimleri etkinleştir
                        </label>
                        
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.notifications.sound}
                                onChange={(e) => handleInputChange('notifications', 'sound', e.target.checked)}
                                disabled={!formData.notifications.enabled}
                            />
                            Ses bildirimi
                        </label>
                        
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.notifications.desktop}
                                onChange={(e) => handleInputChange('notifications', 'desktop', e.target.checked)}
                                disabled={!formData.notifications.enabled}
                            />
                            Masaüstü bildirimi
                        </label>
                    </div>
                </div>

                {/* Editör Ayarları */}
                <div className="settings-section">
                    <h3>Editör Ayarları</h3>
                    
                    <div className="form-group">
                        <label className="form-label">Tema</label>
                        <select
                            className="form-input"
                            value={formData.editor.theme}
                            onChange={(e) => handleInputChange('editor', 'theme', e.target.value)}
                        >
                            <option value="light">Açık</option>
                            <option value="dark">Koyu</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Font Boyutu</label>
                        <input
                            type="number"
                            className="form-input"
                            value={formData.editor.fontSize}
                            onChange={(e) => handleInputChange('editor', 'fontSize', parseInt(e.target.value))}
                            min="10"
                            max="20"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tab Boyutu</label>
                        <input
                            type="number"
                            className="form-input"
                            value={formData.editor.tabSize}
                            onChange={(e) => handleInputChange('editor', 'tabSize', parseInt(e.target.value))}
                            min="2"
                            max="8"
                        />
                    </div>

                    <div className="form-group">
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.editor.wordWrap}
                                onChange={(e) => handleInputChange('editor', 'wordWrap', e.target.checked)}
                            />
                            Satır kaydırma
                        </label>
                    </div>
                </div>

                {/* Otomatik Senkronizasyon */}
                <div className="settings-section">
                    <h3>Otomatik Senkronizasyon</h3>
                    
                    <div className="form-group">
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={formData.autoSync.enabled}
                                onChange={(e) => handleInputChange('autoSync', 'enabled', e.target.checked)}
                            />
                            Otomatik senkronizasyonu etkinleştir
                        </label>
                    </div>

                    {formData.autoSync.enabled && (
                        <div className="form-group">
                            <label className="form-label">Senkronizasyon Aralığı (saniye)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.autoSync.interval}
                                onChange={(e) => handleInputChange('autoSync', 'interval', parseInt(e.target.value))}
                                min="60"
                                max="3600"
                            />
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .settings-section {
                    background: white;
                    padding: 25px;
                    margin-bottom: 20px;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }

                .settings-section h3 {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #2c3e50;
                    font-size: 18px;
                    font-weight: 600;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 10px;
                }
            `}</style>
        </div>
    );
};

export default Settings;