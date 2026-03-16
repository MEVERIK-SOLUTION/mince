import asyncio
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from jinja2 import Template
import logging
from dataclasses import dataclass
import os
from pathlib import Path

@dataclass
class EmailConfig:
    smtp_server: str
    smtp_port: int
    username: str
    password: str
    use_tls: bool = True
    use_ssl: bool = False
    sender_name: str = "Coin Collection Manager"

@dataclass
class PriceAlert:
    coin_id: str
    coin_name: str
    old_price: float
    new_price: float
    price_change: float
    price_change_percent: float
    currency: str
    auction_house: str
    auction_date: Optional[datetime]
    coin_image_url: Optional[str]
    auction_url: Optional[str]

@dataclass
class EmailNotification:
    recipient_email: str
    recipient_name: str
    subject: str
    template_name: str
    template_data: Dict[str, Any]
    attachments: Optional[List[str]] = None
    priority: str = "normal"  # low, normal, high
    send_at: Optional[datetime] = None

class EmailService:
    """Služba pro odesílání email notifikací"""
    
    def __init__(self, config: EmailConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.template_dir = Path(__file__).parent.parent / "templates" / "email"
        self.template_dir.mkdir(parents=True, exist_ok=True)
        
        # Vytvoří základní email šablony
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Vytvoří výchozí email šablony"""
        templates = {
            "price_alert.html": self._get_price_alert_template(),
            "weekly_summary.html": self._get_weekly_summary_template(),
            "auction_reminder.html": self._get_auction_reminder_template(),
            "new_coin_added.html": self._get_new_coin_template(),
            "welcome.html": self._get_welcome_template()
        }
        
        for template_name, template_content in templates.items():
            template_path = self.template_dir / template_name
            if not template_path.exists():
                template_path.write_text(template_content, encoding='utf-8')
    
    async def send_price_alerts(self, alerts: List[PriceAlert], user_email: str, user_name: str) -> bool:
        """Odešle cenové upozornění"""
        try:
            if not alerts:
                return True
            
            # Seskupí upozornění podle typu změny
            price_increases = [alert for alert in alerts if alert.price_change > 0]
            price_decreases = [alert for alert in alerts if alert.price_change < 0]
            
            template_data = {
                "user_name": user_name,
                "total_alerts": len(alerts),
                "price_increases": price_increases,
                "price_decreases": price_decreases,
                "date": datetime.now().strftime("%d.%m.%Y"),
                "app_url": os.getenv("APP_URL", "https://coin-collection.vercel.app")
            }
            
            subject = f"Cenové upozornění - {len(alerts)} změn v cenách mincí"
            
            notification = EmailNotification(
                recipient_email=user_email,
                recipient_name=user_name,
                subject=subject,
                template_name="price_alert.html",
                template_data=template_data,
                priority="high"
            )
            
            return await self.send_email(notification)
            
        except Exception as e:
            self.logger.error(f"Error sending price alerts: {str(e)}")
            return False
    
    async def send_weekly_summary(self, user_email: str, user_name: str, summary_data: Dict[str, Any]) -> bool:
        """Odešle týdenní souhrn"""
        try:
            template_data = {
                "user_name": user_name,
                "week_start": (datetime.now() - timedelta(days=7)).strftime("%d.%m.%Y"),
                "week_end": datetime.now().strftime("%d.%m.%Y"),
                **summary_data
            }
            
            notification = EmailNotification(
                recipient_email=user_email,
                recipient_name=user_name,
                subject="Týdenní souhrn vaší kolekce mincí",
                template_name="weekly_summary.html",
                template_data=template_data
            )
            
            return await self.send_email(notification)
            
        except Exception as e:
            self.logger.error(f"Error sending weekly summary: {str(e)}")
            return False
    
    async def send_auction_reminder(self, user_email: str, user_name: str, auction_data: Dict[str, Any]) -> bool:
        """Odešle připomínku aukce"""
        try:
            template_data = {
                "user_name": user_name,
                **auction_data
            }
            
            notification = EmailNotification(
                recipient_email=user_email,
                recipient_name=user_name,
                subject=f"Připomínka aukce: {auction_data.get('auction_name', 'Neznámá aukce')}",
                template_name="auction_reminder.html",
                template_data=template_data,
                priority="high"
            )
            
            return await self.send_email(notification)
            
        except Exception as e:
            self.logger.error(f"Error sending auction reminder: {str(e)}")
            return False
    
    async def send_welcome_email(self, user_email: str, user_name: str) -> bool:
        """Odešle uvítací email"""
        try:
            template_data = {
                "user_name": user_name,
                "app_url": os.getenv("APP_URL", "https://coin-collection.vercel.app"),
                "support_email": os.getenv("SUPPORT_EMAIL", "support@coin-collection.app")
            }
            
            notification = EmailNotification(
                recipient_email=user_email,
                recipient_name=user_name,
                subject="Vítejte v Coin Collection Manager!",
                template_name="welcome.html",
                template_data=template_data
            )
            
            return await self.send_email(notification)
            
        except Exception as e:
            self.logger.error(f"Error sending welcome email: {str(e)}")
            return False
    
    async def send_email(self, notification: EmailNotification) -> bool:
        """Odešle email podle notifikace"""
        try:
            # Načte a renderuje šablonu
            template_path = self.template_dir / notification.template_name
            if not template_path.exists():
                self.logger.error(f"Template not found: {notification.template_name}")
                return False
            
            template_content = template_path.read_text(encoding='utf-8')
            template = Template(template_content)
            html_content = template.render(**notification.template_data)
            
            # Vytvoří email zprávu
            message = MIMEMultipart("alternative")
            message["Subject"] = notification.subject
            message["From"] = f"{self.config.sender_name} <{self.config.username}>"
            message["To"] = notification.recipient_email
            
            # Nastaví prioritu
            if notification.priority == "high":
                message["X-Priority"] = "1"
                message["X-MSMail-Priority"] = "High"
            elif notification.priority == "low":
                message["X-Priority"] = "5"
                message["X-MSMail-Priority"] = "Low"
            
            # Přidá HTML obsah
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)
            
            # Přidá přílohy
            if notification.attachments:
                for attachment_path in notification.attachments:
                    await self._add_attachment(message, attachment_path)
            
            # Odešle email
            return await self._send_smtp_email(message, notification.recipient_email)
            
        except Exception as e:
            self.logger.error(f"Error sending email: {str(e)}")
            return False
    
    async def _add_attachment(self, message: MIMEMultipart, file_path: str):
        """Přidá přílohu k emailu"""
        try:
            if not os.path.exists(file_path):
                self.logger.warning(f"Attachment file not found: {file_path}")
                return
            
            with open(file_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            
            filename = os.path.basename(file_path)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {filename}'
            )
            
            message.attach(part)
            
        except Exception as e:
            self.logger.error(f"Error adding attachment {file_path}: {str(e)}")
    
    async def _send_smtp_email(self, message: MIMEMultipart, recipient_email: str) -> bool:
        """Odešle email přes SMTP"""
        try:
            # Vytvoří SSL kontext
            context = ssl.create_default_context()
            
            if self.config.use_ssl:
                # SSL připojení
                with smtplib.SMTP_SSL(self.config.smtp_server, self.config.smtp_port, context=context) as server:
                    server.login(self.config.username, self.config.password)
                    server.send_message(message, to_addrs=[recipient_email])
            else:
                # TLS připojení
                with smtplib.SMTP(self.config.smtp_server, self.config.smtp_port) as server:
                    if self.config.use_tls:
                        server.starttls(context=context)
                    server.login(self.config.username, self.config.password)
                    server.send_message(message, to_addrs=[recipient_email])
            
            self.logger.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            self.logger.error(f"SMTP error sending email to {recipient_email}: {str(e)}")
            return False
    
    def _get_price_alert_template(self) -> str:
        """Vrátí šablonu pro cenové upozornění"""
        return """
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cenové upozornění</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-item { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .price-increase { border-left-color: #e74c3c; }
        .price-decrease { border-left-color: #27ae60; }
        .coin-name { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
        .price-info { display: flex; justify-content: space-between; align-items: center; }
        .price-change { font-weight: bold; padding: 4px 8px; border-radius: 4px; }
        .increase { background: #ffe6e6; color: #e74c3c; }
        .decrease { background: #e6f7e6; color: #27ae60; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🪙 Cenové upozornění</h1>
        <p>Zdravím {{ user_name }}! Máme pro vás {{ total_alerts }} cenových změn.</p>
    </div>
    
    <div class="content">
        {% if price_increases %}
        <h2 style="color: #e74c3c;">📈 Zvýšení cen ({{ price_increases|length }})</h2>
        {% for alert in price_increases %}
        <div class="alert-item price-increase">
            <div class="coin-name">{{ alert.coin_name }}</div>
            <div class="price-info">
                <span>{{ alert.old_price }} {{ alert.currency }} → {{ alert.new_price }} {{ alert.currency }}</span>
                <span class="price-change increase">+{{ "%.1f"|format(alert.price_change_percent) }}%</span>
            </div>
            <small>{{ alert.auction_house }}{% if alert.auction_date %} • {{ alert.auction_date.strftime('%d.%m.%Y') }}{% endif %}</small>
        </div>
        {% endfor %}
        {% endif %}
        
        {% if price_decreases %}
        <h2 style="color: #27ae60;">📉 Snížení cen ({{ price_decreases|length }})</h2>
        {% for alert in price_decreases %}
        <div class="alert-item price-decrease">
            <div class="coin-name">{{ alert.coin_name }}</div>
            <div class="price-info">
                <span>{{ alert.old_price }} {{ alert.currency }} → {{ alert.new_price }} {{ alert.currency }}</span>
                <span class="price-change decrease">{{ "%.1f"|format(alert.price_change_percent) }}%</span>
            </div>
            <small>{{ alert.auction_house }}{% if alert.auction_date %} • {{ alert.auction_date.strftime('%d.%m.%Y') }}{% endif %}</small>
        </div>
        {% endfor %}
        {% endif %}
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{ app_url }}" class="button">Zobrazit v aplikaci</a>
        </div>
    </div>
    
    <div class="footer">
        <p>Coin Collection Manager • {{ date }}</p>
        <p>Pro zrušení notifikací navštivte nastavení v aplikaci.</p>
    </div>
</body>
</html>
        """
    
    def _get_weekly_summary_template(self) -> str:
        """Vrátí šablonu pro týdenní souhrn"""
        return """
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Týdenní souhrn</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .section { margin: 20px 0; }
        .section h3 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Týdenní souhrn</h1>
        <p>Zdravím {{ user_name }}! Zde je souhrn vaší kolekce za období {{ week_start }} - {{ week_end }}</p>
    </div>
    
    <div class="content">
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-number">{{ new_coins_count|default(0) }}</div>
                <div class="stat-label">Nové mince</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{ total_value_change|default(0) }} Kč</div>
                <div class="stat-label">Změna hodnoty</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{ price_alerts_count|default(0) }}</div>
                <div class="stat-label">Cenová upozornění</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{ auctions_watched|default(0) }}</div>
                <div class="stat-label">Sledované aukce</div>
            </div>
        </div>
        
        {% if top_coins %}
        <div class="section">
            <h3>🏆 Nejcennější přírůstky</h3>
            {% for coin in top_coins %}
            <div style="background: white; margin: 10px 0; padding: 10px; border-radius: 5px;">
                <strong>{{ coin.name }}</strong> - {{ coin.value }} {{ coin.currency }}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        {% if upcoming_auctions %}
        <div class="section">
            <h3>📅 Nadcházející aukce</h3>
            {% for auction in upcoming_auctions %}
            <div style="background: white; margin: 10px 0; padding: 10px; border-radius: 5px;">
                <strong>{{ auction.name }}</strong> - {{ auction.date.strftime('%d.%m.%Y') }}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{ app_url }}" class="button">Zobrazit kolekci</a>
        </div>
    </div>
    
    <div class="footer">
        <p>Coin Collection Manager • Týdenní souhrn</p>
        <p>Pro změnu frekvence souhrnu navštivte nastavení v aplikaci.</p>
    </div>
</body>
</html>
        """
    
    def _get_auction_reminder_template(self) -> str:
        """Vrátí šablonu pro připomínku aukce"""
        return """
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Připomínka aukce</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .auction-info { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f39c12; }
        .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 3px solid #f39c12; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
        .urgent { background: #e74c3c !important; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⏰ Připomínka aukce</h1>
        <p>Zdravím {{ user_name }}! Blíží se aukce, kterou sledujete.</p>
    </div>
    
    <div class="content">
        <div class="auction-info">
            <h2>{{ auction_name }}</h2>
            <p><strong>📅 Datum:</strong> {{ auction_date.strftime('%d.%m.%Y v %H:%M') if auction_date else 'Neuvedeno' }}</p>
            <p><strong>🏛️ Aukční dům:</strong> {{ auction_house|default('Neuvedeno') }}</p>
            <p><strong>📍 Místo:</strong> {{ auction_location|default('Online') }}</p>
            {% if auction_description %}
            <p><strong>📝 Popis:</strong> {{ auction_description }}</p>
            {% endif %}
        </div>
        
        {% if watched_lots %}
        <div class="highlight">
            <h3>🎯 Vaše sledované položky ({{ watched_lots|length }})</h3>
            {% for lot in watched_lots %}
            <div style="margin: 8px 0; padding: 8px; background: white; border-radius: 4px;">
                <strong>Lot {{ lot.number }}:</strong> {{ lot.name }}
                {% if lot.estimate_price %}
                <br><small>Odhadovaná cena: {{ lot.estimate_price }} {{ lot.currency|default('Kč') }}</small>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        {% if time_until_auction %}
        <div class="highlight">
            <p><strong>⏱️ Zbývá:</strong> {{ time_until_auction }}</p>
        </div>
        {% endif %}
        
        <div style="text-align: center; margin-top: 30px;">
            {% if auction_url %}
            <a href="{{ auction_url }}" class="button">Zobrazit aukci</a>
            {% endif %}
            <a href="{{ app_url }}" class="button">Otevřít aplikaci</a>
        </div>
    </div>
    
    <div class="footer">
        <p>Coin Collection Manager • Připomínka aukce</p>
        <p>Pro správu připomínek navštivte kalendář v aplikaci.</p>
    </div>
</body>
</html>
        """
    
    def _get_new_coin_template(self) -> str:
        """Vrátí šablonu pro novou minci"""
        return """
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nová mince přidána</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .coin-card { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #27ae60; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🪙 Nová mince v kolekci</h1>
        <p>Gratulujeme {{ user_name }}! Přidali jste novou minci do své kolekce.</p>
    </div>
    
    <div class="content">
        <div class="coin-card">
            <h2>{{ coin_name }}</h2>
            {% if coin_image %}
            <img src="{{ coin_image }}" alt="{{ coin_name }}" style="max-width: 200px; border-radius: 8px; margin: 10px 0;">
            {% endif %}
            <p><strong>💰 Hodnota:</strong> {{ coin_value }} {{ coin_currency|default('Kč') }}</p>
            <p><strong>📅 Rok:</strong> {{ coin_year|default('Neuvedeno') }}</p>
            <p><strong>🌍 Země:</strong> {{ coin_country|default('Neuvedeno') }}</p>
            <p><strong>🔧 Materiál:</strong> {{ coin_material|default('Neuvedeno') }}</p>
            {% if coin_description %}
            <p><strong>📝 Popis:</strong> {{ coin_description }}</p>
            {% endif %}
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{ app_url }}/collection" class="button">Zobrazit kolekci</a>
        </div>
    </div>
    
    <div class="footer">
        <p>Coin Collection Manager • Nová mince</p>
    </div>
</body>
</html>
        """
    
    def _get_welcome_template(self) -> str:
        """Vrátí uvítací šablonu"""
        return """
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vítejte v Coin Collection Manager</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .feature { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
        .secondary-button { background: #6c757d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🪙 Vítejte v Coin Collection Manager!</h1>
        <p>Zdravím {{ user_name }}! Těšíme se, že se k nám přidáváte.</p>
    </div>
    
    <div class="content">
        <p>Gratulujeme k registraci! Coin Collection Manager vám pomůže spravovat vaši sbírku mincí profesionálně a efektivně.</p>
        
        <h3>🚀 Co můžete dělat:</h3>
        
        <div class="feature">
            <h4>📱 Evidovat mince</h4>
            <p>Přidávejte mince do své kolekce s fotografiemi, popisy a hodnotami.</p>
        </div>
        
        <div class="feature">
            <h4>💰 Sledovat ceny</h4>
            <p>Automatické upozornění na změny cen vašich mincí z aukčních domů.</p>
        </div>
        
        <div class="feature">
            <h4>📊 Analyzovat kolekci</h4>
            <p>Detailní statistiky a analýzy hodnoty vaší sbírky.</p>
        </div>
        
        <div class="feature">
            <h4>🔍 Vyhledávat</h4>
            <p>Pokročilé vyhledávání a filtrování podle různých kritérií.</p>
        </div>
        
        <div class="feature">
            <h4>📅 Sledovat aukce</h4>
            <p>Kalendář aukčních událostí a připomínky důležitých termínů.</p>
        </div>
        
        <h3>🎯 Doporučené první kroky:</h3>
        <ol>
            <li>Přidejte svou první minci do kolekce</li>
            <li>Nastavte si cenová upozornění</li>
            <li>Prozkoumejte kalendář aukčních událostí</li>
            <li>Nakonfigurujte si notifikace podle preferencí</li>
        </ol>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="{{ app_url }}" class="button">Začít používat aplikaci</a>
            <a href="{{ app_url }}/help" class="button secondary-button">Nápověda</a>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p><strong>💡 Tip:</strong> Pokud potřebujete pomoc, neváhejte nás kontaktovat na <a href="mailto:{{ support_email }}">{{ support_email }}</a></p>
        </div>
    </div>
    
    <div class="footer">
        <p>Coin Collection Manager • Uvítací email</p>
        <p>Děkujeme, že jste si vybrali naši aplikaci pro správu vaší sbírky!</p>
    </div>
</body>
</html>
        """

# Utility funkce pro vytvoření email služby
def create_email_service() -> EmailService:
    """Vytvoří instanci email služby s konfigurací z prostředí"""
    config = EmailConfig(
        smtp_server=os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        username=os.getenv("SMTP_USERNAME", ""),
        password=os.getenv("SMTP_PASSWORD", ""),
        use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        use_ssl=os.getenv("SMTP_USE_SSL", "false").lower() == "true",
        sender_name=os.getenv("SENDER_NAME", "Coin Collection Manager")
    )
    
    return EmailService(config)

# Příklad použití
async def example_usage():
    """Příklad použití email služby"""
    email_service = create_email_service()
    
    # Cenové upozornění
    alerts = [
        PriceAlert(
            coin_id="1",
            coin_name="Československá 10 koruna 1932",
            old_price=1500.0,
            new_price=1800.0,
            price_change=300.0,
            price_change_percent=20.0,
            currency="CZK",
            auction_house="Aurea",
            auction_date=datetime.now(),
            coin_image_url="https://example.com/coin.jpg",
            auction_url="https://aurea.cz/auction/123"
        )
    ]
    
    await email_service.send_price_alerts(
        alerts=alerts,
        user_email="user@example.com",
        user_name="Jan Novák"
    )
    
    # Uvítací email
    await email_service.send_welcome_email(
        user_email="newuser@example.com",
        user_name="Nový Uživatel"
    )

if __name__ == "__main__":
    asyncio.run(example_usage())