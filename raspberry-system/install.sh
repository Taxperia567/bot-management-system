#!/bin/bash

# Bot Manager Kurulum Scripti
set -e

echo "Bot Manager kurulumu başlıyor..."

# Python paketlerini kur
echo "Python paketleri kuruluyor..."
pip3 install -r requirements.txt

# Bot klasörünü oluştur
echo "Bot klasörü oluşturuluyor..."
sudo mkdir -p /home/pi/bots
sudo chown pi:pi /home/pi/bots

# Log klasörünü oluştur
echo "Log klasörü oluşturuluyor..."
sudo mkdir -p /var/log
sudo touch /var/log/bot_manager.log
sudo chown pi:pi /var/log/bot_manager.log

# Yapılandırma klasörünü oluştur
echo "Yapılandırma klasörü oluşturuluyor..."
sudo mkdir -p /etc/bot_manager
sudo chown pi:pi /etc/bot_manager

# Ana scripti kopyala
echo "Ana script kopyalanıyor..."
sudo cp bot_manager.py /usr/local/bin/bot_manager
sudo chmod +x /usr/local/bin/bot_manager

# Systemd service dosyasını oluştur
echo "Systemd service oluşturuluyor..."
sudo tee /etc/systemd/system/bot-manager.service > /dev/null <<EOF
[Unit]
Description=Bot Manager Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /usr/local/bin/bot_manager
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bot-manager

[Install]
WantedBy=multi-user.target
EOF

# Systemd'yi yeniden yükle
echo "Systemd yeniden yükleniyor..."
sudo systemctl daemon-reload

# Servisi etkinleştir
echo "Bot Manager servisi etkinleştiriliyor..."
sudo systemctl enable bot-manager.service

echo "Kurulum tamamlandı!"
echo ""
echo "Kullanım:"
echo "  Servisi başlat: sudo systemctl start bot-manager"
echo "  Servisi durdur: sudo systemctl stop bot-manager"
echo "  Servis durumu: sudo systemctl status bot-manager"
echo "  Logları göster: sudo journalctl -u bot-manager -f"
echo ""
echo "Yapılandırma dosyası: /etc/bot_manager/config.ini"
echo "Bot klasörü: /home/pi/bots"
echo "Log dosyası: /var/log/bot_manager.log"