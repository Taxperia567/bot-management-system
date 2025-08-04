import React from 'react';

const StatusBar = ({ serverStatus, botCount, onlineBotCount }) => {
    return (
        <div className="status-bar">
            <div className="status-indicator">
                <div className={`status-dot ${serverStatus}`}></div>
                Sunucu: {serverStatus === 'connected' ? 'Bağlı' : 'Bağlantı Kesildi'}
            </div>
            <div>
                Toplam Bot: {botCount} | Çevrimiçi: {onlineBotCount}
            </div>
            <div>
                {new Date().toLocaleString('tr-TR')}
            </div>
        </div>
    );
};

export default StatusBar;