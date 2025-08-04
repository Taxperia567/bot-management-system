#!/bin/bash

# Bot Manager kaldırma scripti

echo "Bot Manager kaldırılıyor..."

# Servisi durdur ve devre dışı bırak
echo "Servis durduruluyor..."
sudo systemctl stop bot-manager.service
sudo systemctl disable bot-manager.service

# Service dosyasını sil
echo "Service dosyası siliniyor..."
sudo rm -f /etc/systemd/system/bot-manager.service

# Ana scripti sil
echo "Ana script siliniyor..."
sudo rm -f /usr/local/bin/bot_manager

# Systemd'yi yeniden yükle
echo "Systemd yeniden yükleniyor..."
sudo systemctl daemon-reload

# Kullanıcıdan onay al
read -p "Yapılandırma dosyalarını da silmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Yapılandırma dosyaları siliniyor..."
    sudo rm -rf /etc/bot_manager
fi

read -p "Log dosyalarını silmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Log dosyaları siliniyor..."
    sudo rm -f /var/log/bot_manager.log
fi

read -p "Bot klasörünü silmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Bot klasörü siliniyor..."
    rm -rf /home/pi/bots
fi

echo "Bot Manager başarıyla kaldırıldı!"