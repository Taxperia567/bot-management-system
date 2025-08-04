import React, { useState, useEffect } from 'react';

const BotList = ({ bots, onBotSelect, onBotControl, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filteredBots, setFilteredBots] = useState([]);

    useEffect(() => {
        filterBots();
    }, [bots, searchTerm, statusFilter]);

    const filterBots = () => {
        let filtered = bots;

        // Arama filtresi
        if (searchTerm) {
            filtered = filtered.filter(bot =>
                bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (bot.description && bot.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Durum filtresi
        if (statusFilter !== 'all') {
            filtered = filtered.filter(bot => bot.status === statusFilter);
        }

        setFilteredBots(filtered);
    };

    const handleBotAction = async (e, bot, action) => {
        e.stopPropagation();
        await onBotControl(bot.id, action);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#2ecc71';
            case 'offline': return '#e74c3c';
            case 'crashed': return '#f39c12';
            case 'maintenance': return '#9b59b6';
            default: return '#95a5a6';
        }
    };

    const formatLastPing = (timestamp) => {
        if (!timestamp) return 'Hiç';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Az önce';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
        return date.toLocaleDateString('tr-TR');
    };

    return (
        <div className="bot-list-container">
            <div className="bot-list-header">
                <h2>Bot Listesi ({filteredBots.length})</h2>
                <div className="bot-list-actions">
                    <input
                        type="text"
                        placeholder="Bot ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-input"
                        style={{ width: '200px' }}
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="form-input"
                        style={{ width: '120px' }}
                    >
                        <option value="all">Tüm Durumlar</option>
                        <option value="online">Çevrimiçi</option>
                        <option value="offline">Çevrimdışı</option>
                        <option value="crashed">Çökmüş</option>
                        <option value="maintenance">Bakım</option>
                    </select>
                    <button className="btn btn-primary" onClick={onRefresh}>
                        Yenile
                    </button>
                    <button 
                        className="btn btn-secondary"
                        onClick={() => window.electronAPI.scanBots()}
                    >
                        Yerel Tarama
                    </button>
                </div>
            </div>

            <div className="bot-grid">
                {filteredBots.map((bot) => (
                    <div
                        key={bot.id || bot.name}
                        className="bot-card"
                        onClick={() => onBotSelect(bot)}
                    >
                        <div className="bot-card-header">
                            <h3 className="bot-name">{bot.name}</h3>
                            <div className={`bot-status ${bot.status}`}>
                                <div 
                                    className="status-dot"
                                    style={{ backgroundColor: getStatusColor(bot.status) }}
                                ></div>
                                {bot.status || 'offline'}
                            </div>
                        </div>

                        <div className="bot-info">
                            <p><strong>Ana Dosya:</strong> {bot.main_file || 'Belirtilmemiş'}</p>
                            <p><strong>Son Ping:</strong> {formatLastPing(bot.last_ping)}</p>
                            {bot.localPath && (
                                <p><strong>Yerel Konum:</strong> {bot.localPath}</p>
                            )}
                            {bot.description && (
                                <p><strong>Açıklama:</strong> {bot.description}</p>
                            )}
                            {bot.ping_count_24h !== undefined && (
                                <p><strong>24s Ping:</strong> {bot.ping_count_24h}</p>
                            )}
                        </div>

                        <div className="bot-actions">
                            {bot.status === 'offline' ? (
                                <button
                                    className="btn btn-success"
                                    onClick={(e) => handleBotAction(e, bot, 'start')}
                                >
                                    Başlat
                                </button>
                            ) : (
                                <button
                                    className="btn btn-danger"
                                    onClick={(e) => handleBotAction(e, bot, 'stop')}
                                >
                                    Durdur
                                </button>
                            )}
                            <button
                                className="btn btn-secondary"
                                onClick={(e) => handleBotAction(e, bot, 'restart')}
                            >
                                Yeniden Başlat
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBotSelect(bot);
                                }}
                            >
                                Düzenle
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredBots.length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                    <h3>Bot bulunamadı</h3>
                    <p>Arama kriterlerinize uygun bot bulunamadı.</p>
                </div>
            )}
        </div>
    );
};

export default BotList;