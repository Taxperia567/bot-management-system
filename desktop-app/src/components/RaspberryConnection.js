import React, { useState, useEffect } from 'react';

const RaspberryConnection = ({ onBack }) => {
    const [raspberryStatus, setRaspberryStatus] = useState([]);
    const [syncProgress, setSyncProgress] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        loadRaspberryStatus();
        const interval = setInterval(loadRaspberryStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadRaspberryStatus = async () => {
        try {
            setRaspberryStatus([
                {
                    name: 'RaspberryPi-01',
                    ip: '192.168.1.100',
                    status: 'online',
                    lastHeartbeat: new Date().toISOString(),
                    cpuUsage: 25.5,
                    memoryUsage: 68.2,
                    diskUsage: 45.1,
                    runningBots: ['DiscordBot1', 'TelegramBot']
                }
            ]);
        } catch (error) {
            console.error('Raspberry Pi durum yükleme hatası:', error);
        }
    };

    const syncAllFiles = async () => {
        try {
            setSyncProgress({ current: 0, total: 100, status: 'Başlatılıyor...' });
            
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                setSyncProgress({ 
                    current: i, 
                    total: 100, 
                    status: i === 100 ? 'Tamamlandı!' : `Dosyalar kopyalanıyor... ${i}%`
                });
            }

            await window.electronAPI.syncToRaspberry();
            addLog('success', 'Tüm dosyalar başarıyla senkronize edildi');
            setTimeout(() => setSyncProgress(null), 2000);
        } catch (error) {
            console.error('Senkronizasyon hatası:', error);
            addLog('error', 'Senkronizasyon hatası: ' + error.message);
            setSyncProgress(null);
        }
    };

    const addLog = (type, message) => {
        const newLog = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date().toLocaleString('tr-TR')
        };
        setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#2ecc71';
            case 'offline': return '#e74c3c';
            case 'maintenance': return '#f39c12';
            default: return '#95a5a6';
        }
    };

    return (
        <div className="bot-list-container">
            <div className="bot-list-header">
                <div>
                    <button className="btn btn-secondary" onClick={onBack}>← Geri</button>
                    <h2 style={{ display: 'inline-block', marginLeft: '20px' }}>
                        Raspberry Pi Yönetimi
                    </h2>
                </div>
                <div className="bot-list-actions">
                    <button 
                        className="btn btn-primary" 
                        onClick={syncAllFiles}
                        disabled={syncProgress !== null}
                    >
                        {syncProgress ? 'Senkronize Ediliyor...' : 'Tüm Dosyaları Senkronize Et'}
                    </button>
                    <button className="btn btn-secondary" onClick={loadRaspberryStatus}>
                        Yenile
                    </button>
                </div>
            </div>

            {syncProgress && (
                <div style={{
                    background: 'white',
                    margin: '0 20px 20px 20px',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}>
                    <h4>Senkronizasyon İlerlemesi</h4>
                    <div style={{
                        background: '#f0f0f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        marginTop: '10px'
                    }}>
                        <div style={{
                            background: '#3498db',
                            height: '20px',
                            width: `${syncProgress.current}%`,
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    <p style={{ marginTop: '10px', color: '#666' }}>{syncProgress.status}</p>
                </div>
            )}

            <div className="bot-grid">
                {raspberryStatus.map((pi, index) => (
                    <div key={index} className="bot-card" style={{ cursor: 'default' }}>
                        <div className="bot-card-header">
                            <h3 className="bot-name">{pi.name}</h3>
                            <div className={`bot-status ${pi.status}`}>
                                <div 
                                    className="status-dot"
                                    style={{ backgroundColor: getStatusColor(pi.status) }}
                                ></div>
                                {pi.status}
                            </div>
                        </div>

                        <div className="bot-info">
                            <p><strong>IP Adresi:</strong> {pi.ip}</p>
                            <p><strong>CPU:</strong> {pi.cpuUsage}%</p>
                            <p><strong>RAM:</strong> {pi.memoryUsage}%</p>
                            <p><strong>Disk:</strong> {pi.diskUsage}%</p>
                            <p><strong>Çalışan Botlar:</strong> {pi.runningBots.join(', ')}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '20px', margin: '20px' }}>
                <div style={{ 
                    flex: 1, 
                    background: 'white', 
                    padding: '20px', 
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}>
                    <h4>Sistem Logları</h4>
                    <div style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '10px',
                        background: '#fafafa'
                    }}>
                        {logs.map((log) => (
                            <div key={log.id} style={{
                                padding: '8px',
                                marginBottom: '5px',
                                borderRadius: '4px',
                                background: log.type === 'error' ? '#ffebee' : 
                                           log.type === 'success' ? '#e8f5e8' : '#fff',
                                borderLeft: `4px solid ${log.type === 'error' ? '#f44336' : 
                                                        log.type === 'success' ? '#4caf50' : '#2196f3'}`
                            }}>
                                <small style={{ color: '#666' }}>{log.timestamp}</small>
                                <div>{log.message}</div>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <p style={{ color: '#666', textAlign: 'center' }}>Henüz log kaydı bulunmuyor</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RaspberryConnection;