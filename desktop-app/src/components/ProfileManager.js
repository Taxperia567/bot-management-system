import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

const ProfileManager = ({ profiles, bots, onProfileCreate }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [profileList, setProfileList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            // Profilleri yükle (gerçek API'den)
            // Şimdilik mock data kullanıyoruz
            setProfileList(profiles || []);
        } catch (error) {
            console.error('Profil yükleme hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const CreateProfileModal = () => {
        const [formData, setFormData] = useState({
            name: '',
            description: '',
            notificationEnabled: true,
            selectedBots: []
        });

        const [botPermissions, setBotPermissions] = useState({});

        useEffect(() => {
            // Her bot için varsayılan izinleri ayarla
            const defaultPermissions = {};
            bots.forEach(bot => {
                defaultPermissions[bot.id || bot.name] = {
                    canView: true,
                    canEdit: false,
                    canStartStop: false,
                    canRestart: false,
                    receiveNotifications: true
                };
            });
            setBotPermissions(defaultPermissions);
        }, []);

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            try {
                setLoading(true);

                const selectedBotPermissions = formData.selectedBots.map(botId => ({
                    botId,
                    ...botPermissions[botId]
                }));

                const response = await axios.post(`${API_BASE_URL}/profiles`, {
                    name: formData.name,
                    description: formData.description,
                    notificationEnabled: formData.notificationEnabled,
                    botPermissions: selectedBotPermissions
                });

                if (response.data.success) {
                    alert(`Profil başarıyla oluşturuldu!\n\nAccess Key: ${response.data.accessKey}\n\nBu key'i güvenli bir yerde saklayın!`);
                    setShowCreateModal(false);
                    onProfileCreate();
                    
                    // Key'i panoya kopyala
                    navigator.clipboard.writeText(response.data.accessKey);
                }

            } catch (error) {
                console.error('Profil oluşturma hatası:', error);
                alert('Profil oluşturma hatası: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        const handleBotSelection = (botId) => {
            setFormData(prev => ({
                ...prev,
                selectedBots: prev.selectedBots.includes(botId)
                    ? prev.selectedBots.filter(id => id !== botId)
                    : [...prev.selectedBots, botId]
            }));
        };

        const handlePermissionChange = (botId, permission, value) => {
            setBotPermissions(prev => ({
                ...prev,
                [botId]: {
                    ...prev[botId],
                    [permission]: value
                }
            }));
        };

        return (
            <div className="modal-overlay">
                <div className="modal" style={{ maxWidth: '800px', width: '95%' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">Yeni Profil Oluştur</h2>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Profil Adı *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <textarea
                                className="form-input form-textarea"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Profil açıklaması..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={formData.notificationEnabled}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notificationEnabled: e.target.checked }))}
                                />
                                Bildirimleri etkinleştir
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Bot İzinleri</label>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '6px', padding: '10px' }}>
                                {bots.map(bot => (
                                    <div key={bot.id || bot.name} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                                        <label className="checkbox-item" style={{ marginBottom: '10px' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedBots.includes(bot.id || bot.name)}
                                                onChange={() => handleBotSelection(bot.id || bot.name)}
                                            />
                                            <strong>{bot.name}</strong>
                                        </label>

                                        {formData.selectedBots.includes(bot.id || bot.name) && (
                                            <div style={{ marginLeft: '20px' }}>
                                                <div className="checkbox-group">
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={botPermissions[bot.id || bot.name]?.canView || false}
                                                            onChange={(e) => handlePermissionChange(bot.id || bot.name, 'canView', e.target.checked)}
                                                        />
                                                        Görüntüleme
                                                    </label>
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={botPermissions[bot.id || bot.name]?.canEdit || false}
                                                            onChange={(e) => handlePermissionChange(bot.id || bot.name, 'canEdit', e.target.checked)}
                                                        />
                                                        Düzenleme
                                                    </label>
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={botPermissions[bot.id || bot.name]?.canStartStop || false}
                                                            onChange={(e) => handlePermissionChange(bot.id || bot.name, 'canStartStop', e.target.checked)}
                                                        />
                                                        Başlatma/Durdurma
                                                    </label>
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={botPermissions[bot.id || bot.name]?.canRestart || false}
                                                            onChange={(e) => handlePermissionChange(bot.id || bot.name, 'canRestart', e.target.checked)}
                                                        />
                                                        Yeniden Başlatma
                                                    </label>
                                                    <label className="checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={botPermissions[bot.id || bot.name]?.receiveNotifications || false}
                                                            onChange={(e) => handlePermissionChange(bot.id || bot.name, 'receiveNotifications', e.target.checked)}
                                                        />
                                                        Bildirim Alma
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading || !formData.name || formData.selectedBots.length === 0}
                            >
                                {loading ? 'Oluşturuluyor...' : 'Profil Oluştur'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="bot-list-container">
            <div className="bot-list-header">
                <h2>Profil Yönetimi</h2>
                <div className="bot-list-actions">
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Yeni Profil Oluştur
                    </button>
                    <button 
                        className="btn btn-secondary"
                        onClick={loadProfiles}
                    >
                        Yenile
                    </button>
                </div>
            </div>

            <div className="bot-grid">
                {profileList.map((profile, index) => (
                    <div key={index} className="bot-card">
                        <div className="bot-card-header">
                            <h3 className="bot-name">{profile.name}</h3>
                            <div className="bot-status online">
                                <div className="status-dot connected"></div>
                                Aktif
                            </div>
                        </div>

                        <div className="bot-info">
                            {profile.description && (
                                <p><strong>Açıklama:</strong> {profile.description}</p>
                            )}
                            <p><strong>Oluşturulma:</strong> {new Date(profile.created_at).toLocaleDateString('tr-TR')}</p>
                            <p><strong>Bildirimler:</strong> {profile.notification_enabled ? 'Açık' : 'Kapalı'}</p>
                            <p><strong>Access Key:</strong> {profile.access_key ? '••••••••' : 'Yok'}</p>
                        </div>

                        <div className="bot-actions">
                            <button className="btn btn-primary">
                                Düzenle
                            </button>
                            <button className="btn btn-secondary">
                                Key Göster
                            </button>
                            <button className="btn btn-danger">
                                Sil
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {profileList.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                    <h3>Profil bulunamadı</h3>
                    <p>Henüz hiç profil oluşturulmamış. İlk profilinizi oluşturun!</p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        İlk Profilimi Oluştur
                    </button>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
                    <p>Profiller yükleniyor...</p>
                </div>
            )}

            {showCreateModal && <CreateProfileModal />}
        </div>
    );
};

export default ProfileManager;